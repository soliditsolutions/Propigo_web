/**
 * Evaluador de fuerza de contraseña — sin dependencias externas.
 * Compatible con Node.js y Edge runtime (pura lógica JS, sin APIs del navegador).
 *
 * Política (2026-07-31, reemplaza el mínimo de 15 caracteres tipo NIST
 * passphrase — decisión del cliente: exigir 8+ con composición mixta es más
 * familiar para sus usuarios que forzar frases largas):
 *  - Mínimo 8 caracteres.
 *  - Al menos una letra, un número y un carácter especial.
 *  - No puede contener el nombre, correo o RUT del propio usuario.
 *  - No puede ser (ni contener, con variantes leet-speak) una contraseña de
 *    la lista de las más usadas — ver COMMON_PASSWORDS más abajo.
 *  - No puede ser una secuencia obvia (1234, abcd, qwerty) ni un carácter
 *    repetido 4+ veces seguidas.
 */

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PersonalInfo {
  nombre?: string | null;
  email?:  string | null;
  rut?:    string | null;
}

export interface PasswordStrength {
  score:      StrengthScore;
  label:      string;
  color:      string;
  suggestion: string;
  /** true cuando la contraseña cumple todos los requisitos mínimos para guardarse. */
  passes:     boolean;
}

// ── Lista de contraseñas más usadas ──────────────────────────────────────────
// Investigada el 2026-07-31: ranking global de NordPass (2025/2026, basado en
// análisis de brechas y dark web) + ranking específico de Chile publicado por
// BioBioChile/NordPass ("123456 y colocolo": 20 contraseñas más usadas en
// Chile 2025 — incluye patrones locales como "colocolo", "benjamin",
// "santiago1", "hola1234", "contraseña", que un blocklist genérico en inglés
// no habría capturado). El resto son entradas estables en los rankings
// anuales (SplashData/Keeper, Have I Been Pwned) desde hace varios años.
// Todo en minúsculas, sin tildes — se compara contra el password normalizado.
const COMMON_PASSWORDS = [
  // Top Chile 2025 (BioBioChile / NordPass) — nombres propios y jerga local
  "colocolo", "benjamin", "santiago1", "catrasca1", "hola1234", "contrasena",
  "nobody00", "nobody",
  // Secuencias numéricas / de teclado (globales, dominan todos los rankings)
  "123456", "1234567", "12345678", "123456789", "1234567890", "12345678910",
  "123123", "654321", "111111", "000000", "121212", "222222", "1122334455",
  "qwerty", "qwerty123", "qwertyuiop", "asdfgh", "asdf1234", "zxcvbn",
  "1q2w3e", "1q2w3e4r", "1qaz2wsx", "zaq12wsx", "qazwsx",
  // Palabras genéricas más usadas (inglés — el software y muchos usuarios
  // técnicos en Chile igual heredan estas)
  "password", "password1", "passw0rd", "welcome", "welcome123", "admin",
  "admin123", "letmein", "login", "changeme", "secret", "iloveyou",
  "sunshine", "princess", "monkey", "dragon", "master", "freedom",
  "whatever", "trustno1", "hunter2", "superman", "batman", "starwars",
  "solo", "ninja", "shadow", "michael", "jennifer", "jessica", "amanda",
  "daniel", "andrew", "joshua", "george", "hannah", "andrea", "matthew",
  "summer", "flower", "cookie", "tigger", "purple", "orange", "jordan",
  "hockey", "killer", "ranger", "harley", "phoenix", "banana", "thunder",
  "mercedes", "nascar", "corvette", "biteme", "football", "baseball",
  "computer", "chocolate", "abcd1234", "abc123",
];

// ── Normalización ─────────────────────────────────────────────────────────

/** Minúsculas, sin tildes. */
function normalizarBase(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Sustituciones leet-speak más comunes (P@ssw0rd → password) — detectan la
// práctica típica de "reforzar" una contraseña débil con símbolos parecidos
// a letras, que sigue siendo trivial de adivinar para un atacante real.
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "!": "i", "|": "i", "3": "e",
  "4": "a", "@": "a", "5": "s", "$": "s", "7": "t",
};

/** Normaliza + descarta símbolos restantes, SIN sustituir dígitos — preserva
 * secuencias/dígitos literales (RUT, "santiago1", "1234") que el leet-speak
 * de abajo destruiría (1→i, etc.) antes de poder compararlos. */
function normalizarPlano(s: string): string {
  return normalizarBase(s).replace(/[^a-z0-9]/g, "");
}

/** Normaliza + aplica leet-speak + descarta símbolos restantes — detecta
 * obfuscación tipo "P@ssw0rd" que normalizarPlano no vería. */
function normalizarLeet(s: string): string {
  const base = normalizarBase(s);
  let out = "";
  for (const ch of base) out += LEET[ch] ?? ch;
  return out.replace(/[^a-z0-9]/g, "");
}

/** Las dos variantes de comparación — ambas se revisan contra blocklist/secuencias/info personal. */
function variantes(pwd: string): string[] {
  const plano = normalizarPlano(pwd);
  const leet  = normalizarLeet(pwd);
  return plano === leet ? [plano] : [plano, leet];
}

function contieneComun(vs: string[]): boolean {
  return vs.some((v) => COMMON_PASSWORDS.some((w) => (w.length <= 3 ? v === w : v.includes(w))));
}

/** Detecta corridas de 4+ caracteres consecutivos ascendentes/descendentes (1234, dcba, qrst…). */
function tieneCorridaEn(s: string, minCorrida: number): boolean {
  if (s.length < minCorrida) return false;
  let asc = 1, desc = 1;
  for (let i = 1; i < s.length; i++) {
    const prev = s.charCodeAt(i - 1);
    const curr = s.charCodeAt(i);
    if (curr === prev + 1) { asc++; desc = 1; }
    else if (curr === prev - 1) { desc++; asc = 1; }
    else { asc = 1; desc = 1; }
    if (asc >= minCorrida || desc >= minCorrida) return true;
  }
  return false;
}
function tieneSecuencia(vs: string[], minCorrida = 4): boolean {
  return vs.some((v) => tieneCorridaEn(v, minCorrida));
}

function contienePersonal(vs: string[], info?: PersonalInfo): boolean {
  if (!info) return false;
  const tokens: string[] = [];

  if (info.nombre) tokens.push(...normalizarBase(info.nombre).split(/\s+/));
  if (info.email) {
    const local = info.email.split("@")[0];
    if (local) tokens.push(normalizarBase(local));
  }
  if (info.rut) {
    // Se prueban ambas formas — la gente típicamente escribe solo el cuerpo
    // del RUT (sin el dígito verificador) al meterlo en una contraseña, pero
    // también se cubre el RUT completo.
    const limpio = info.rut.replace(/[^0-9kK]/g, "").toUpperCase();
    const cuerpo = limpio.slice(0, -1);
    if (cuerpo.length >= 5) tokens.push(cuerpo);
    if (limpio.length >= 6) tokens.push(limpio);
  }

  const tokensNorm = tokens
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 3);

  return vs.some((v) => tokensNorm.some((t) => v.includes(t)));
}

function charPoolSize(pwd: string): number {
  let pool = 0;
  if (/[a-z]/.test(pwd))        pool += 26;
  if (/[A-Z]/.test(pwd))        pool += 26;
  if (/[0-9]/.test(pwd))        pool += 10;
  if (/[^a-zA-Z0-9]/.test(pwd)) pool += 32;
  return pool;
}

const LABELS: Record<StrengthScore, string> = {
  0: "Muy débil",
  1: "Débil",
  2: "Aceptable",
  3: "Buena",
  4: "Excelente",
};
const COLORS: Record<StrengthScore, string> = {
  0: "#EF4444",
  1: "#F97316",
  2: "#EAB308",
  3: "#22C55E",
  4: "#10B981",
};

function resultado(score: StrengthScore, suggestion: string, passes: boolean): PasswordStrength {
  return { score, label: LABELS[score], color: COLORS[score], suggestion, passes };
}

export const PASSWORD_MIN_LENGTH = 8;

export interface RequisitosPassword {
  minLength:      boolean;
  hasLetter:      boolean;
  hasDigit:       boolean;
  hasSpecial:     boolean;
  noPersonalInfo: boolean;
  notCommon:      boolean;
}

/**
 * Estado de cada requisito por separado (a diferencia de evaluatePassword,
 * que se detiene en el primer problema) — pensado para pintar un checklist
 * en vivo en el formulario, no solo un mensaje único.
 */
export function checkRequisitos(pwd: string, personal?: PersonalInfo): RequisitosPassword {
  const vs = variantes(pwd);
  const repetido = /(.)\1{3,}/.test(pwd);
  return {
    minLength:      pwd.length >= PASSWORD_MIN_LENGTH,
    hasLetter:      /[a-zA-Z]/.test(pwd),
    hasDigit:       /[0-9]/.test(pwd),
    hasSpecial:     /[^a-zA-Z0-9]/.test(pwd),
    noPersonalInfo: !contienePersonal(vs, personal),
    notCommon:      !(contieneComun(vs) || tieneSecuencia(vs) || repetido),
  };
}

export function evaluatePassword(pwd: string, personal?: PersonalInfo): PasswordStrength {
  if (pwd.length === 0) {
    return { score: 0, label: "", color: "transparent", suggestion: "", passes: false };
  }

  const req = checkRequisitos(pwd, personal);

  // 1. Largo mínimo
  if (!req.minLength) {
    return resultado(0, `Debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`, false);
  }

  // 2. Información personal — el chequeo más específico primero, para dar
  // al usuario el motivo exacto en vez de un genérico "contraseña débil".
  if (!req.noPersonalInfo) {
    return resultado(0, "No uses tu nombre, correo o RUT como parte de la contraseña.", false);
  }

  // 3. Contraseñas comunes / secuencias / repeticiones — investigadas contra
  // rankings reales (ver COMMON_PASSWORDS), no una regla arbitraria.
  if (!req.notCommon) {
    return resultado(0, "Es una contraseña muy común o predecible. Evita secuencias, repeticiones y palabras de uso frecuente.", false);
  }

  // 4. Composición: letra + número + carácter especial
  if (!req.hasLetter || !req.hasDigit || !req.hasSpecial) {
    const faltantes: string[] = [];
    if (!req.hasLetter)  faltantes.push("una letra");
    if (!req.hasDigit)   faltantes.push("un número");
    if (!req.hasSpecial) faltantes.push("un carácter especial (!@#$…)");
    return resultado(1, `Agrega ${faltantes.join(", ")}.`, false);
  }

  // 5. Cumple todo lo mínimo — graduar por largo/entropía para el medidor
  const entropy = Math.log2(Math.max(charPoolSize(pwd), 1)) * pwd.length;
  if (pwd.length >= 16 || entropy >= 75) {
    return resultado(4, "Contraseña muy sólida. ¡Listo!", true);
  }
  if (pwd.length >= 12 || entropy >= 55) {
    return resultado(3, "Buena contraseña.", true);
  }
  return resultado(2, "Cumple los requisitos mínimos. Un poco más de largo la haría más fuerte.", true);
}
