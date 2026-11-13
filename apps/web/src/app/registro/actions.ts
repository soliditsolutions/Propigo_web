"use server";

import { headers }                         from "next/headers";
import { redirect }                        from "next/navigation";
import { registroAbierto }                  from "@/lib/registro-abierto";
import { CORREO }                          from "@/lib/marca";
import { prisma }                          from "@/lib/db";
import { hashPassword }                    from "@/lib/password";
import { signSession, setSessionCookie }   from "@/lib/auth";
import { evaluatePassword }                from "@/lib/password-strength";
import { validateRut, canonicalRut }       from "@/lib/rut";
import { verificarMagicBytes, ALLOWED_MIME_IMAGES } from "@/lib/magic-bytes";
import { getClientIpFromHeaders }          from "@/lib/ip";
import { checkRateLimit }                  from "@/lib/rate-limit";
import { logError } from "@/lib/logger";
import { PLAN_GRATUITO_VALOR } from "@/lib/plans";
import { leerCedulaConIA } from "@/lib/ia/cedula";
import { ErrorIa, iaConfigurada } from "@/lib/ia/cloudflare";

export type RegistroState = { error: string; field?: string } | null;

const RESERVED_TERMS = [
  "admin", "administrador", "moderador", "soporte", "sistema",
  "housing", "solidit", "propigo", "root", "superuser",
];

// ── Helpers de normalización de nombre ───────────────────────────────────────
// Elimina acentos, pasa a mayúsculas, conserva solo letras y espacios.
// Permite comparar "García López" con "GARCIA LOPEZ" sin distinción de tildes.
function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verifica que los nombres ingresados en el formulario correspondan
 * al nombre extraído del carnet.
 *
 * Acepta diferencias de orden (nombres/apellidos pueden estar invertidos)
 * y omisiones de segundo nombre/apellido materno (frecuente en Chile).
 * Exige mínimo 2 palabras significativas y que al menos el 70 % de
 * las palabras del nombre ingresado aparezcan en el del carnet.
 */
function nombresCoinciden(entrado: string, carnet: string): boolean {
  const ne = normalizarNombre(entrado).split(" ").filter((w) => w.length > 2);
  const nc = normalizarNombre(carnet).split(" ").filter((w) => w.length > 2);

  if (ne.length < 2) return false; // mínimo: nombre + apellido

  const requerido  = Math.max(2, Math.ceil(ne.length * 0.7));
  const coincidencias = ne.filter((w) => nc.includes(w));
  return coincidencias.length >= requerido;
}

// ── Server Action principal ──────────────────────────────────────────────────
export async function registroAction(
  _prev: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  if (!registroAbierto()) {
    return { error: "El registro todavía no está abierto. Escríbenos a " + CORREO.soporte + " y te avisamos." };
  }
  const nombre   = formData.get("nombre")?.toString().trim()              ?? "";
  const rut      = formData.get("rut")?.toString().trim()                 ?? "";
  const email    = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const empresa  = formData.get("empresa")?.toString().trim()             ?? "";
  // Cómo opera la corredora. Decide dos cosas: si la comisión que emite lleva
  // IVA (DL 825 art. 12 E N° 8) y si hay que pedirle un RUT distinto del suyo.
  const esPersonaJuridica = formData.get("esPersonaJuridica")?.toString() !== "natural";
  const rutEmpresaRaw     = formData.get("rutEmpresa")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString()                   ?? "";
  const consent  = formData.get("consent")?.toString();
  const consentIa = formData.get("consentIa")?.toString();

  // ── 1. Validaciones de formato ────────────────────────────────────────────
  if (!nombre || !rut || !email || !empresa || !password) {
    return { error: "Completa todos los campos obligatorios." };
  }

  if (nombre.length < 2 || nombre.length > 80) {
    return { error: "El nombre debe tener entre 2 y 80 caracteres.", field: "nombre" };
  }

  if (!validateRut(rut)) {
    return { error: "El RUT no es válido. Verifica el dígito verificador.", field: "rut" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El correo electrónico no es válido.", field: "email" };
  }

  if (empresa.length < 2 || empresa.length > 120) {
    return { error: "El nombre de la empresa debe tener entre 2 y 120 caracteres.", field: "empresa" };
  }

  // Un corredor independiente ES la corredora: su RUT y el de la empresa son
  // el mismo, y pedírselo dos veces solo daría ocasión de tipearlo distinto.
  const rutEmpresa = esPersonaJuridica ? rutEmpresaRaw : rut;

  if (esPersonaJuridica && !rutEmpresa) {
    return { error: "Ingresa el RUT de la corredora.", field: "rutEmpresa" };
  }
  if (!validateRut(rutEmpresa)) {
    return {
      error: "El RUT de la corredora no es válido. Verifica el dígito verificador.",
      field: "rutEmpresa",
    };
  }

  const rutEmpresaCanonical = canonicalRut(rutEmpresa);

  // Ley 21.719 Art. 4 — consentimiento explícito e inequívoco (no premarcado)
  if (!consent) {
    return { error: "Debes aceptar los Términos de uso y la Política de privacidad." };
  }

  const nombreLower = nombre.toLowerCase();
  if (RESERVED_TERMS.some((t) => nombreLower.includes(t))) {
    return {
      error: "El nombre no puede contener términos reservados del sistema.",
      field: "nombre",
    };
  }

  const strength = evaluatePassword(password, { nombre, email, rut });
  if (!strength.passes) {
    return { error: strength.suggestion, field: "password" };
  }

  // ── 2. Verificación de identidad por carnet ──────────────────────────────
  // AUD-07: modo de prueba E2E — omite la verificación con IA (que exige una
  // cédula real) para permitir pruebas automatizadas del registro. SOLO
  // funciona fuera de producción; runStartupChecks() aborta el arranque si
  // esta variable llega a estar definida en un entorno de producción.
  const bypassIdentidad =
    process.env.NODE_ENV !== "production" && process.env.E2E_BYPASS_IDENTITY === "1";

  let rutCanonical: string;
  // IP de quien dio el consentimiento IA — se persiste junto al registro auditable
  // (ConsentimientoIa) al crear la cuenta, más abajo. null si vino por bypassIdentidad.
  let consentIaIp: string | null = null;

  if (bypassIdentidad) {
    rutCanonical = canonicalRut(rut);
  } else {
    const carnetFile = formData.get("carnet");

    if (!carnetFile || !(carnetFile instanceof File) || carnetFile.size === 0) {
      return {
        error: "Debes verificar tu identidad subiendo una foto de tu Cédula de Identidad.",
        field: "carnet",
      };
    }

    if (!ALLOWED_MIME_IMAGES.has(carnetFile.type)) {
      return { error: "El carnet debe ser una imagen JPG, PNG o WEBP.", field: "carnet" };
    }

    if (carnetFile.size > 5 * 1024 * 1024) {
      return { error: "La imagen del carnet no puede superar los 5 MB.", field: "carnet" };
    }

    // Consentimiento explícito ANTES de enviar la imagen a la IA externa (Cloudflare Workers AI).
    // Distinto del checkbox general de T&C (`consent`, Ley 21.719 Art. 4): este
    // es específico para el procesamiento de la foto del carnet por un tercero.
    if (!consentIa) {
      return {
        error: "Debes aceptar el envío de tu cédula a nuestro proveedor de verificación de identidad para continuar.",
        field: "carnet",
      };
    }

    // FIX M4: verificar magic bytes — el cliente puede declarar un MIME falso (CWE-434)
    const buffer = Buffer.from(await carnetFile.arrayBuffer());
    if (!verificarMagicBytes(buffer, carnetFile.type)) {
      return { error: "El archivo no corresponde al tipo de imagen declarado.", field: "carnet" };
    }

    // BL-INIT1 runtime: verificación explícita antes de la llamada a la API externa
    // para entregar un mensaje descriptivo al usuario en vez de un error genérico.
    if (!iaConfigurada()) {
      return {
        error: "El servicio de verificación de identidad no está disponible temporalmente. Contacta con soporte.",
        field: "carnet",
      };
    }

    // Rate limit por IP — el registro es previo a cualquier cuenta, así que no
    // hay usuarioId para limitar por sesión; una IP no debería necesitar más
    // de un puñado de intentos legítimos (foto borrosa, mal encuadre) por hora.
    const ip = getClientIpFromHeaders(await headers());
    consentIaIp = ip;
    const rlCarnet = checkRateLimit(`registro_carnet:${ip}`, 5, 10 * 60_000);
    if (!rlCarnet.allowed) {
      return {
        error: "Demasiados intentos de verificación. Intenta de nuevo en unos minutos.",
        field: "carnet",
      };
    }

    let carnetDatos: Awaited<ReturnType<typeof leerCedulaConIA>>;
    try {
      carnetDatos = await leerCedulaConIA(buffer);
    } catch (e) {
      logError("registro/leer-carnet", e);
      // Tope diario o límite del proveedor: reintentar no sirve hasta mañana.
      if (e instanceof ErrorIa && (e.codigo === "cupo_diario" || e.codigo === "limite_proveedor")) {
        return {
          error: "La verificación de identidad tiene mucha demanda hoy. Intenta de nuevo mañana o escríbenos a " + CORREO.soporte + ".",
          field: "carnet",
        };
      }
      return {
        error: "No pudimos procesar la imagen en este momento. Intenta de nuevo en unos segundos.",
        field: "carnet",
      };
    }

    if ("error" in carnetDatos) {
      const mensajes: Record<string, string> = {
        no_es_carnet: "La imagen no corresponde a una Cédula de Identidad chilena.",
        ilegible:     "La imagen del carnet es ilegible. Sube una foto más clara y bien iluminada.",
        incompleto:   "No pudimos leer todos los datos del carnet. Asegúrate de que el frontis sea totalmente visible.",
      };
      return {
        error: mensajes[carnetDatos.error] ?? "No pudimos verificar el carnet. Intenta con una imagen diferente.",
        field: "carnet",
      };
    }

    // Comparar RUT
    rutCanonical = canonicalRut(rut);
    const rutDelCarnet = canonicalRut(carnetDatos.rut ?? "");

    if (!rutDelCarnet || rutDelCarnet !== rutCanonical) {
      return {
        error: "El documento de identidad no corresponde con el RUT ingresado. Verifica que el carnet y los datos del formulario sean correctos.",
        field: "rut",
      };
    }

    // Comparar nombre
    if (!nombresCoinciden(nombre, carnetDatos.nombre ?? "")) {
      return {
        error: "El nombre del carnet no coincide con el nombre ingresado. Usa el nombre exacto que aparece en tu documento.",
        field: "nombre",
      };
    }
  }

  // ── 3. Unicidad en base de datos ─────────────────────────────────────────
  // Solo verificamos unicidad después de que la identidad está confirmada.
  // Esto evita que se enumeren emails/RUTs sin pasar la verificación.
  // ADR-0011 Fase 2: email/RUT únicos son GLOBALES (no por tenant) — antes de
  // que exista sesión no hay tenant al cual scopear la consulta, así que se
  // resuelve con las mismas funciones SECURITY DEFINER que usa login.
  try {
    const [emailRows, rutRows, rutEmpresaRows] = await Promise.all([
      prisma.$queryRaw<{ existe: boolean }[]>`SELECT auth_email_existe(${email}) AS existe`,
      prisma.$queryRaw<{ existe: boolean }[]>`SELECT auth_rut_existe(${rutCanonical}) AS existe`,
      // tenant.rut es único global desde el Grupo B del rowMap legal: identifica
      // a la corredora ante el SII y no puede repetirse entre cuentas.
      prisma.$queryRaw<{ existe: boolean }[]>`SELECT auth_rut_corredora_existe(${rutEmpresaCanonical}) AS existe`,
    ]);

    if (emailRows[0]?.existe) {
      return { error: "Ya existe una cuenta con este correo electrónico.", field: "email" };
    }
    if (rutRows[0]?.existe) {
      return { error: "Ya existe una cuenta registrada con este RUT.", field: "rut" };
    }
    if (rutEmpresaRows[0]?.existe) {
      return {
        error: esPersonaJuridica
          ? "Ya existe una corredora registrada con este RUT."
          : "Ya existe una corredora registrada con tu RUT.",
        field: esPersonaJuridica ? "rutEmpresa" : "rut",
      };
    }
  } catch (e) {
    logError("registro/verificar-unicidad", e);
    return { error: "No pudimos verificar los datos por un problema de nuestro lado. Intenta de nuevo en unos minutos." };
  }

  // ── 4. Crear Tenant + Usuario en transacción atómica ─────────────────────
  let newUser: {
    id: string; tenantId: string; rol: "manager" | "colaborador"; nombre: string; email: string;
  } | null = null;

  try {
    const passwordHash = await hashPassword(password);
    const now          = new Date();

    newUser = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data:   {
          nombre: empresa,
          rut:    rutEmpresaCanonical,
          esPersonaJuridica,
          plan:   PLAN_GRATUITO_VALOR,
        },
        select: { id: true },
      });

      // ADR-0011 Fase 2: el tenant recién se creó en esta misma transacción —
      // antes no existía ningún tenant al cual asociar la sesión RLS. A partir
      // de aquí, dentro de esta transacción, ya se puede escribir en usuario.
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;

      const usuario = await tx.usuario.create({
        data: {
          tenantId:       tenant.id,
          rol:            "manager",
          nombre,
          rut:            rutCanonical,
          email,
          passwordHash,
          consentGivenAt: now,
          consentVersion: "tys-v1.0",
        },
        select: { id: true, tenantId: true, rol: true, nombre: true, email: true },
      });

      // Registro auditable del consentimiento IA dado más arriba — solo aplica
      // si de verdad se llamó a la IA (bypassIdentidad se salta todo el flujo).
      // Limitación conocida: si el RUT/nombre del carnet no coincide con el
      // formulario (o cualquier otro paso posterior falla), la cuenta nunca se
      // crea y este registro tampoco se persiste — no existe tenant/usuario al
      // cual asociarlo antes de este punto (RLS exige tenant_id no nulo). El
      // consentimiento sigue exigiéndose y aplicándose correctamente antes de
      // la llamada a la IA; lo que no queda es la traza para un intento fallido.
      if (!bypassIdentidad) {
        await tx.consentimientoIa.create({
          data: {
            tenantId:  tenant.id,
            usuarioId: usuario.id,
            flujo:     "carnet_registro",
            version:   "ia-v1.0",
            ip:        consentIaIp,
          },
        });
      }

      return usuario;
    });
  } catch (e) {
    logError("registro/crear-cuenta", e);
    return { error: "No pudimos crear tu cuenta. Intenta de nuevo." };
  }

  // ── 5. Emitir sesión JWT ─────────────────────────────────────────────────
  // Sin deviceToken — el proxy redirigirá a /verificar-dispositivo.
  try {
    const token = await signSession({
      sub:            newUser.id,
      tenantId:       newUser.tenantId,
      rol:            newUser.rol,
      nombre:         newUser.nombre,
      email:          newUser.email,
      perfilCompleto: false,
    });
    await setSessionCookie(token);
  } catch (e) {
    logError("registro/iniciar-sesion", e);
    return { error: "Cuenta creada, pero no pudimos iniciar sesión. Intenta ingresar." };
  }

  redirect("/verificar-dispositivo");
}
