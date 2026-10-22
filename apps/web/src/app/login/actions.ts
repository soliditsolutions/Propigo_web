"use server";

import { redirect }                  from "next/navigation";
import { headers, cookies }          from "next/headers";
import { createHash }                from "crypto";
import { prisma }                    from "@/lib/db";
import { withTenant }                from "@/lib/tenant-db";
import { verifyPassword }            from "@/lib/password";
import { signSession, setSessionCookie, DEVICE_COOKIE_NAME } from "@/lib/auth";
import { getClientIpFromHeaders }    from "@/lib/ip";
import { checkRateLimit }            from "@/lib/rate-limit";

export type LoginState = {
  error:        string;
  field?:       string;
  /** Total de intentos fallidos acumulados tras este error */
  attempts?:    number;
  /** Timestamp (ms) hasta el que la cuenta está bloqueada temporalmente */
  lockedUntil?: number;
  /** true cuando la cuenta quedó bloqueada de forma permanente (5° fallo) */
  blocked?:     boolean;
} | null;

// ── Constantes ───────────────────────────────────────────────────────────────
const MAX_ATTEMPTS   = 5;
const LOCK_5MIN_MS   = 5  * 60_000;          //  5 minutos
const LOCK_1HR_MS    = 60 * 60_000;          //  1 hora
const LOCK_PERM_DATE = new Date("2099-01-01T00:00:00Z"); // bloqueo permanente en BD
const IP_WINDOW_MS   = 15 * 60 * 1000;       // 15 min
const IP_MAX_INTENTS = 30;

// ── Rate limiting por IP — persistido en BD ──────────────────────────────────
// FIX M1: usa AccesoLog (BD compartida) en vez de Map<> en memoria de Node.
// En deployments multi-instancia (Vercel Serverless, PM2 cluster, Docker
// replicas) cada instancia tiene su propio heap — un Map en memoria permite
// N×30 intentos antes de bloquear. La BD es el único estado compartido.
//
// LIMITACIÓN CONOCIDA: AccesoLog.tenantId es NOT NULL, por lo que el registro
// del intento solo es posible cuando el email corresponde a un usuario válido.
// Para emails inexistentes el rate limit no se almacena, pero el endpoint ya
// devuelve el mismo mensaje que para contraseña incorrecta (anti-enumeración)
// y la defensa per-cuenta (failedAttempts) no aplica. El bloqueo a nivel de
// red debe complementarse con rate limiting en proxy/CDN (nginx, Cloudflare).
//
// FIX M2: getClientIpFromHeaders() usa el ÚLTIMO hop de x-forwarded-for
// (puesto por el proxy real) en vez del primero (manipulable por el cliente).
async function checkIpLimitInDb(tenantId: string, ip: string): Promise<boolean> {
  if (ip === "127.0.0.1" || ip === "::1") return true; // local dev sin restricción
  const since = new Date(Date.now() - IP_WINDOW_MS);
  const count = await withTenant(tenantId, (tx) => tx.accesoLog.count({
    where: {
      tenantId,
      ip,
      accion:    "login_intento",
      createdAt: { gt: since },
    },
  }));
  return count < IP_MAX_INTENTS;
}

async function registrarIntentoLogin(tenantId: string, ip: string): Promise<void> {
  await withTenant(tenantId, (tx) => tx.accesoLog.create({ data: { tenantId, ip, accion: "login_intento" } }))
    .catch(() => { /* no bloquear el flujo si falla el log */ });
}

// ── Server Action ────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // FIX M2: IP del cliente vía utilidad centralizada
  const hdrs = await headers();
  const ip   = getClientIpFromHeaders(hdrs);

  const email    = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!email || !password) {
    return { error: "Ingresa tu correo electrónico y contraseña." };
  }

  // Tope por IP ANTES de buscar la cuenta: el conteo en BD (checkIpLimitInDb)
  // solo corre cuando el correo existe, así que probar miles de correos
  // inexistentes (credential stuffing) no tenía freno. Mismo umbral y ventana.
  if (ip !== "127.0.0.1" && ip !== "::1"
      && !checkRateLimit(`login_ip:${ip}`, IP_MAX_INTENTS, IP_WINDOW_MS).allowed) {
    return { error: "Demasiados intentos desde tu red. Espera 15 minutos e intenta de nuevo." };
  }

  // ── Buscar usuario ──────────────────────────────────────────────────────
  let user: {
    id:             string;
    tenantId:       string;
    rol:            "manager" | "colaborador";
    nombre:         string;
    email:          string;
    passwordHash:   string | null;
    perfilCompleto: boolean;
    failedAttempts: number;
    lockedUntil:    Date | null;
    desactivadoEn:  Date | null;
  } | null = null;

  // ADR-0011 Fase 2: buscar por email es legítimamente cross-tenant (no
  // sabemos a qué tenant pertenece el usuario hasta encontrarlo) — se resuelve
  // con la función SECURITY DEFINER auth_lookup_usuario_by_email en vez de
  // darle a propigo_app acceso directo a leer toda la tabla usuario.
  try {
    const rows = await prisma.$queryRaw<{
      id: string; tenant_id: string; rol: "manager" | "colaborador"; nombre: string; email: string;
      password_hash: string | null; perfil_completo: boolean;
      failed_attempts: number; locked_until: Date | null; desactivado_en: Date | null;
    }[]>`SELECT * FROM auth_lookup_usuario_by_email(${email})`;
    const row = rows[0];
    user = row ? {
      id:             row.id,
      tenantId:       row.tenant_id,
      rol:            row.rol,
      nombre:         row.nombre,
      email:          row.email,
      passwordHash:   row.password_hash,
      perfilCompleto: row.perfil_completo,
      failedAttempts: row.failed_attempts,
      lockedUntil:    row.locked_until,
      desactivadoEn:  row.desactivado_en,
    } : null;
  } catch {
    return { error: "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo." };
  }

  // ── Rate limiting por IP (BD-backed, scoped al tenant) ─────────────────
  // Solo disponible cuando el email es válido (AccesoLog requiere tenantId).
  // Para correos inexistentes rige el tope en memoria de más arriba.
  if (user) {
    await registrarIntentoLogin(user.tenantId, ip);
    if (!(await checkIpLimitInDb(user.tenantId, ip))) {
      return { error: "Demasiados intentos desde tu red. Espera 15 minutos e intenta de nuevo." };
    }
  }

  // ── Verificar bloqueo de cuenta ─────────────────────────────────────────
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const isPermanent = user.failedAttempts >= MAX_ATTEMPTS;
    if (isPermanent) {
      return {
        error:    "Bloqueamos tu cuenta por seguridad.",
        blocked:  true,
        attempts: user.failedAttempts,
      };
    }
    return {
      error:       "Tu cuenta está bloqueada temporalmente.",
      lockedUntil: user.lockedUntil.getTime(),
      attempts:    user.failedAttempts,
    };
  }

  // ── Mitigación timing attack: siempre ejecutar la verificación ──────────
  const dummyHash  = "pbkdf2v1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const storedHash = user?.passwordHash ?? dummyHash;
  const valid      = await verifyPassword(password, storedHash);

  if (!user || !user.passwordHash || !valid) {
    if (user) {
      const newAttempts = user.failedAttempts + 1;

      // Bloqueo escalonado:
      //   3° fallo → 5 minutos
      //   4° fallo → 1 hora
      //   5° fallo → permanente (fecha lejana en BD para que el check siempre la detecte)
      let lockUntil: Date | undefined;
      if      (newAttempts >= MAX_ATTEMPTS) lockUntil = LOCK_PERM_DATE;
      else if (newAttempts === 4)           lockUntil = new Date(Date.now() + LOCK_1HR_MS);
      else if (newAttempts === 3)           lockUntil = new Date(Date.now() + LOCK_5MIN_MS);

      await withTenant(user.tenantId, (tx) => tx.usuario.update({
        where: { id: user!.id },
        data:  {
          failedAttempts: newAttempts,
          ...(lockUntil ? { lockedUntil: lockUntil } : {}),
        },
      })).catch(() => {});

      const isPermanent = newAttempts >= MAX_ATTEMPTS;
      return {
        error:    isPermanent ? "Bloqueamos tu cuenta por seguridad." : "Correo o contraseña incorrectos.",
        attempts: newAttempts,
        ...(lockUntil && !isPermanent ? { lockedUntil: lockUntil.getTime() } : {}),
        ...(isPermanent               ? { blocked: true }                    : {}),
      };
    }
    return { error: "Correo o contraseña incorrectos." };
  }

  // ── Collaborator desactivado (ADR-0013) ─────────────────────────────────
  // Mensaje genérico, mismo criterio anti-enumeración del resto del archivo:
  // solo se revela después de validar la contraseña, nunca antes.
  if (user.desactivadoEn) {
    return { error: "Esta cuenta no tiene acceso. Contacta al administrador de tu cuenta." };
  }

  // ── Login exitoso: resetear contadores y crear sesión ──────────────────
  try {
    await withTenant(user.tenantId, (tx) => tx.usuario.update({
      where: { id: user!.id },
      data:  {
        lastLoginAt:    new Date(),
        failedAttempts: 0,
        lockedUntil:    null,
      },
    }));

    // ── Reconocimiento automático de dispositivo confiable ────────────────
    // Si la cookie pgo_device existe y su hash coincide con un dispositivo
    // registrado para este usuario, se embebe el deviceToken en el JWT
    // directamente — evitando la pantalla de verificación en cada login.
    const jar        = await cookies();
    const pgoDevice   = jar.get(DEVICE_COOKIE_NAME)?.value;
    let deviceToken: string | undefined;

    if (pgoDevice) {
      const tokenHash   = createHash("sha256").update(pgoDevice).digest("hex");
      const dispositivo = await prisma.dispositivoConfiable.findFirst({
        where:  { usuarioId: user.id, tokenHash },
        select: { id: true },
      });
      if (dispositivo) {
        deviceToken = pgoDevice;
        // Actualizar "último acceso" del dispositivo reconocido
        await prisma.dispositivoConfiable.update({
          where: { id: dispositivo.id },
          data:  { lastSeenAt: new Date() },
        }).catch(() => { /* no crítico */ });
      }
    }

    const token = await signSession({
      sub:            user.id,
      tenantId:       user.tenantId,
      rol:            user.rol,
      nombre:         user.nombre,
      email:          user.email,
      perfilCompleto: user.perfilCompleto,
      ...(deviceToken ? { deviceToken } : {}),
    });

    await setSessionCookie(token);
  } catch {
    return { error: "No pudimos iniciar tu sesión. Intenta de nuevo." };
  }

  // redirect() lanza un error interno de Next.js — debe ir fuera del try/catch
  redirect("/panel");
}
