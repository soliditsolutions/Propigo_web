"use server";

import { prisma }          from "@/lib/db";
import { withTenant }      from "@/lib/tenant-db";
import { getSession, signSession, setSessionCookie } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/password";
import { evaluatePassword }             from "@/lib/password-strength";
import { sendCambioContactoCodeEmail }  from "@/lib/email";
import { generarCodigo, hashCodigo as hashOtpCode } from "@/lib/codigo-verificacion";

class DomainError extends Error {
  constructor(msg: string) { super(msg); this.name = "DomainError"; }
}

// ── Tipos de estado ──────────────────────────────────────────────────────────

export type PerfilState = {
  ok:    true;
  perfilCompleto: boolean;
} | {
  ok:    false;
  error: string;
  field?: string;
} | null;

export type PasswordState = {
  ok:    true;
} | {
  ok:    false;
  error: string;
  field?: string;
} | null;

import { esRegionValida, esComunaValidaEnRegion } from "@housing/core";
import { validateRut, canonicalRut } from "@/lib/rut";

// ── Guardar perfil ───────────────────────────────────────────────────────────

export async function guardarPerfilAction(
  _prev: PerfilState,
  formData: FormData,
): Promise<PerfilState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };

  const rut             = formData.get("rut")?.toString().trim()               ?? "";
  const telefono        = formData.get("telefono")?.toString().trim()          ?? "";
  const fechaNacStr     = formData.get("fechaNacimiento")?.toString().trim()   ?? "";
  const direccion       = formData.get("direccion")?.toString().trim()         ?? "";
  const ciudad          = formData.get("ciudad")?.toString().trim()            ?? "";
  const region          = formData.get("region")?.toString().trim()            ?? "";
  const fotoPerfil      = formData.get("fotoPerfil")?.toString().trim()        ?? "";

  // ── Identidad ya verificada — RUT y fecha de nacimiento se fijan una sola
  // vez y quedan inmutables (mismo criterio que nombre/email, que ya eran
  // read-only). El RUT fue cruzado contra la cédula en /registro; permitir
  // cambiarlo después invalidaría esa verificación. Se compara contra la fila
  // real en BD (no solo se confía en que el cliente respete el `readOnly` del
  // input) — defensa en profundidad ante manipulación directa del formulario.
  const actual = await withTenant(session.tenantId, (tx) => tx.usuario.findUnique({
    where:  { id: session.sub },
    select: { rut: true, fechaNacimiento: true, telefono: true },
  }));
  if (!actual) return { ok: false, error: "Sesión inválida. Vuelve a iniciar sesión." };

  // ── Validaciones ──────────────────────────────────────────────────────────

  if (!rut) {
    return { ok: false, error: "El RUT es obligatorio.", field: "rut" };
  }
  if (!validateRut(rut)) {
    return { ok: false, error: "El RUT no es válido. Verifica el dígito verificador.", field: "rut" };
  }
  const rutCanonical = canonicalRut(rut);

  if (actual.rut && actual.rut !== rutCanonical) {
    return { ok: false, error: "El RUT no se puede modificar una vez verificado.", field: "rut" };
  }

  // Unicidad: solo aplica la primera vez que se fija (actual.rut === null) —
  // otro usuario ya registrado con ese RUT. usuario.rut es único GLOBAL (no
  // por tenant, ver setup.sql sección 4), así que este chequeo es
  // legítimamente cross-tenant. Igual que en login/registro, se resuelve con
  // una función SECURITY DEFINER de alcance mínimo, no dándole a housing_app
  // acceso directo a leer la tabla usuario completa (ver ADR-0011 Fase 2).
  if (!actual.rut) {
    const rutDupeRows = await prisma.$queryRaw<{ existe: boolean }[]>`
      SELECT auth_rut_pertenece_a_otro_usuario(${rutCanonical}, ${session.sub}::uuid) AS existe
    `.catch(() => null);
    if (rutDupeRows?.[0]?.existe) {
      return { ok: false, error: "Este RUT ya está registrado en otra cuenta.", field: "rut" };
    }
  }

  if (!telefono) {
    return { ok: false, error: "El teléfono es obligatorio.", field: "telefono" };
  }
  if (!/^\+?[\d\s\-().]{7,20}$/.test(telefono)) {
    return { ok: false, error: "Formato de teléfono inválido.", field: "telefono" };
  }
  // Una vez fijado por primera vez, el teléfono solo se cambia por el flujo
  // con código de verificación (solicitarCambioContactoAction) — este action
  // ya no acepta un cambio directo, para que ese canal quede protegido igual
  // que el correo.
  if (actual.telefono && actual.telefono !== telefono) {
    return {
      ok: false,
      error: "Para cambiar tu teléfono usa la opción \"Cambiar\" junto al campo — requiere un código de verificación.",
      field: "telefono",
    };
  }

  if (!fechaNacStr) {
    return { ok: false, error: "La fecha de nacimiento es obligatoria.", field: "fechaNacimiento" };
  }
  const fechaNac = new Date(fechaNacStr + "T00:00:00Z");
  if (isNaN(fechaNac.getTime())) {
    return { ok: false, error: "Fecha de nacimiento inválida.", field: "fechaNacimiento" };
  }
  if (actual.fechaNacimiento && actual.fechaNacimiento.getTime() !== fechaNac.getTime()) {
    return { ok: false, error: "La fecha de nacimiento no se puede modificar una vez guardada.", field: "fechaNacimiento" };
  }
  // Debe tener al menos 18 años
  const hoy18 = new Date();
  hoy18.setFullYear(hoy18.getFullYear() - 18);
  if (fechaNac > hoy18) {
    return { ok: false, error: "Debes tener al menos 18 años para usar Housing.", field: "fechaNacimiento" };
  }

  if (!direccion) {
    return { ok: false, error: "La dirección es obligatoria.", field: "direccion" };
  }
  if (direccion.length < 5 || direccion.length > 255) {
    return { ok: false, error: "La dirección debe tener entre 5 y 255 caracteres.", field: "direccion" };
  }

  // SEC: región/comuna deben venir de la lista cerrada de @housing/core —
  // el <select> del cliente ya lo restringe, pero un request manual podría
  // enviar cualquier string, así que se valida también en el servidor.
  if (!region) {
    return { ok: false, error: "La región es obligatoria.", field: "region" };
  }
  if (!esRegionValida(region)) {
    return { ok: false, error: "La región seleccionada no es válida.", field: "region" };
  }
  if (!ciudad) {
    return { ok: false, error: "La ciudad/comuna es obligatoria.", field: "ciudad" };
  }
  if (!esComunaValidaEnRegion(ciudad, region)) {
    return { ok: false, error: "La comuna seleccionada no pertenece a la región indicada.", field: "ciudad" };
  }

  // ── Persistir ────────────────────────────────────────────────────────────

  const requiredComplete = !!(rutCanonical && telefono && fechaNac && direccion && ciudad);

  try {
    await withTenant(session.tenantId, (tx) => tx.usuario.update({
      where: { id: session.sub },
      data:  {
        rut:             rutCanonical,
        telefono,
        fechaNacimiento: fechaNac,
        direccion,
        ciudad,
        region:          region || null,
        fotoPerfil:      fotoPerfil || null,
        perfilCompleto:  requiredComplete,
      },
    }));
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    return { ok: false, error: "Error al guardar el perfil. Intenta de nuevo." };
  }

  // ── Refrescar JWT con perfilCompleto actualizado ─────────────────────────
  // AUD-01: se preserva el payload completo (incluido deviceToken) — antes se
  // reconstruía a mano y se perdía deviceToken, expulsando al corredor a
  // /verificar-dispositivo cada vez que guardaba su perfil.
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se destructuran para excluirlos de `rest`, no para usarlos
    const { iat: _iat, exp: _exp, ...rest } = session;
    const newToken = await signSession({ ...rest, perfilCompleto: requiredComplete });
    await setSessionCookie(newToken);
  } catch {
    // Si falla el JWT, el perfil se guardó igual — el usuario re-loguea y ya
  }

  return { ok: true, perfilCompleto: requiredComplete };
}

// ── Cambiar contraseña ───────────────────────────────────────────────────────

export async function cambiarPasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada." };

  const actual    = formData.get("passwordActual")?.toString()   ?? "";
  const nuevo     = formData.get("passwordNuevo")?.toString()    ?? "";
  const confirmar = formData.get("passwordConfirm")?.toString()  ?? "";

  if (!actual || !nuevo || !confirmar) {
    return { ok: false, error: "Completa todos los campos.", field: "passwordActual" };
  }

  if (nuevo !== confirmar) {
    return { ok: false, error: "Las contraseñas nuevas no coinciden.", field: "passwordConfirm" };
  }

  const strength = evaluatePassword(nuevo, { nombre: session.nombre, email: session.email });
  if (!strength.passes) {
    return { ok: false, error: strength.suggestion, field: "passwordNuevo" };
  }

  // Verificar contraseña actual
  let user: { passwordHash: string | null } | null = null;
  try {
    user = await withTenant(session.tenantId, (tx) => tx.usuario.findUnique({
      where:  { id: session.sub },
      select: { passwordHash: true },
    }));
  } catch {
    return { ok: false, error: "Error al verificar la contraseña." };
  }

  if (!user?.passwordHash) {
    return { ok: false, error: "No tienes contraseña configurada." };
  }

  const valid = await verifyPassword(actual, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "La contraseña actual es incorrecta.", field: "passwordActual" };
  }

  // Actualizar contraseña
  try {
    const newHash = await hashPassword(nuevo);
    await withTenant(session.tenantId, (tx) => tx.usuario.update({
      where: { id: session.sub },
      data:  { passwordHash: newHash },
    }));
  } catch {
    return { ok: false, error: "Error al actualizar la contraseña. Intenta de nuevo." };
  }

  return { ok: true };
}

// ── Cambiar teléfono/correo (código de 6 dígitos al correo actual) ──────────
// Mismo patrón que /api/auth/dispositivo/enviar + /confirmar (CodigoDispositivo):
// hash sha256(código + AUTH_SECRET), expira a los 10 min, máx. 3 intentos,
// rate limit 1/min + 5/10min por usuario. La diferencia clave: el código
// siempre se envía al correo YA VERIFICADO de la sesión, nunca al valor nuevo
// — eso es lo que prueba que quien pide el cambio sigue teniendo acceso a la
// cuenta antes de aceptar el dato nuevo.

export type CampoContacto = "telefono" | "email";

export type SolicitarCambioContactoState =
  | { ok: true }
  | { ok: false; error: string };

export type ConfirmarCambioContactoState =
  | { ok: true; valorNuevo: string }
  | { ok: false; error: string };

export async function solicitarCambioContactoAction(
  campo: CampoContacto,
  valorNuevoRaw: string,
  password: string,
): Promise<SolicitarCambioContactoState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };

  // Re-autenticación: el código al correo actual prueba que la sesión sigue
  // teniendo acceso a esa cuenta, pero no prueba que sea el dueño legítimo
  // quien está frente al teclado ahora mismo (ej. sesión abierta y desatendida).
  // Exigir la contraseña aquí, antes de gastar un envío de código, cierra ese hueco.
  if (!password) {
    return { ok: false, error: "Ingresa tu contraseña para confirmar el cambio." };
  }
  let usuarioAuth: { passwordHash: string | null } | null = null;
  try {
    usuarioAuth = await withTenant(session.tenantId, (tx) => tx.usuario.findUnique({
      where: { id: session.sub }, select: { passwordHash: true },
    }));
  } catch {
    return { ok: false, error: "Error al verificar la contraseña." };
  }
  if (!usuarioAuth?.passwordHash || !(await verifyPassword(password, usuarioAuth.passwordHash))) {
    return { ok: false, error: "Contraseña incorrecta." };
  }

  const valorNuevo = campo === "email"
    ? valorNuevoRaw.trim().toLowerCase()
    : valorNuevoRaw.trim();

  if (campo === "telefono") {
    if (!/^\+?[\d\s\-().]{7,20}$/.test(valorNuevo)) {
      return { ok: false, error: "Formato de teléfono inválido." };
    }
    const actual = await withTenant(session.tenantId, (tx) => tx.usuario.findUnique({
      where: { id: session.sub }, select: { telefono: true },
    }));
    if (actual?.telefono === valorNuevo) {
      return { ok: false, error: "Ya es tu teléfono actual." };
    }
  } else {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valorNuevo)) {
      return { ok: false, error: "El correo electrónico no es válido." };
    }
    if (valorNuevo === session.email) {
      return { ok: false, error: "Ya es tu correo actual." };
    }
    // Unicidad global — misma función SECURITY DEFINER que usa /registro.
    const rows = await prisma.$queryRaw<{ existe: boolean }[]>`
      SELECT auth_email_existe(${valorNuevo}) AS existe
    `.catch(() => null);
    if (rows?.[0]?.existe) {
      return { ok: false, error: "Ya existe una cuenta con ese correo." };
    }
  }

  // ── Rate limiting — mismas ventanas que dispositivo/enviar ───────────────
  const ahora     = new Date();
  const hace1min  = new Date(ahora.getTime() - 60 * 1000);
  const hace10min = new Date(ahora.getTime() - 10 * 60 * 1000);

  const [reciente, totalRecientes] = await Promise.all([
    prisma.codigoCambioContacto.findFirst({
      where: { usuarioId: session.sub, createdAt: { gt: hace1min } },
    }),
    prisma.codigoCambioContacto.count({
      where: { usuarioId: session.sub, createdAt: { gt: hace10min } },
    }),
  ]);

  if (reciente) {
    return { ok: false, error: "Espera al menos 1 minuto antes de solicitar otro código." };
  }
  if (totalRecientes >= 5) {
    return { ok: false, error: "Demasiados intentos. Espera antes de volver a intentarlo." };
  }

  const codigo     = generarCodigo();
  const codigoHash = hashOtpCode(codigo);
  const expiraAt   = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await prisma.$transaction([
      prisma.codigoCambioContacto.deleteMany({
        where: { usuarioId: session.sub, campo, usadoAt: null },
      }),
      prisma.codigoCambioContacto.create({
        data: { usuarioId: session.sub, campo, valorNuevo, codigoHash, expiraAt },
      }),
    ]);
    await sendCambioContactoCodeEmail(session.email, session.nombre, codigo, campo, valorNuevo);
  } catch {
    return { ok: false, error: "No se pudo enviar el código. Intenta de nuevo." };
  }

  return { ok: true };
}

export async function confirmarCambioContactoAction(
  campo: CampoContacto,
  codigoIngresado: string,
): Promise<ConfirmarCambioContactoState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };

  const codigo = codigoIngresado.trim();
  if (!/^\d{6}$/.test(codigo)) {
    return { ok: false, error: "El código debe tener 6 dígitos." };
  }

  const registro = await prisma.codigoCambioContacto.findFirst({
    where:   { usuarioId: session.sub, campo, usadoAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  if (!registro) {
    return { ok: false, error: "No hay código activo. Solicita uno nuevo." };
  }
  if (registro.expiraAt <= new Date()) {
    return { ok: false, error: "Tu código expiró. Solicita uno nuevo." };
  }
  if (registro.intentos >= 3) {
    return { ok: false, error: "Demasiados intentos. Solicita un nuevo código." };
  }

  const { intentos: intentosUsados } = await prisma.codigoCambioContacto.update({
    where:  { id: registro.id },
    data:   { intentos: { increment: 1 } },
    select: { intentos: true },
  });

  const codigoHash = hashOtpCode(codigo);
  if (registro.codigoHash !== codigoHash) {
    if (intentosUsados >= 3) {
      await prisma.codigoCambioContacto.update({
        where: { id: registro.id },
        data:  { usadoAt: new Date() },
      });
      return { ok: false, error: "Demasiados intentos. Solicita un nuevo código." };
    }
    const restantes = 3 - intentosUsados;
    return {
      ok:    false,
      error: `Código incorrecto. ${restantes} intento${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""}.`,
    };
  }

  try {
    await withTenant(session.tenantId, (tx) => tx.usuario.update({
      where: { id: session.sub },
      data:  campo === "telefono"
        ? { telefono: registro.valorNuevo }
        : { email: registro.valorNuevo },
    }));
    await prisma.codigoCambioContacto.update({
      where: { id: registro.id },
      data:  { usadoAt: new Date() },
    });
  } catch {
    return { ok: false, error: "No se pudo aplicar el cambio. Intenta de nuevo." };
  }

  if (campo === "email") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se destructuran para excluirlos de `rest`, no para usarlos
      const { iat: _iat, exp: _exp, ...rest } = session;
      const newToken = await signSession({ ...rest, email: registro.valorNuevo });
      await setSessionCookie(newToken);
    } catch {
      // Si falla el refresh del JWT, el correo ya cambió en BD — el usuario
      // simplemente re-loguea con el correo nuevo la próxima vez.
    }
  }

  return { ok: true, valorNuevo: registro.valorNuevo };
}
