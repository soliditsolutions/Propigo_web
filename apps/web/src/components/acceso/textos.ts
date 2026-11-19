/**
 * Textos de las pantallas de acceso. Voz confirmada: tú cercano y claro, frases
 * cortas, sin exclamaciones ni emojis, y con el porqué de cada pedido sensible.
 * La marca, el eslogan y los correos salen de lib/marca.ts, nunca a mano.
 */
import { PLAN_GRATUITO } from "@/lib/plans";

export type Flujo = "login" | "recuperar" | "registro";

export const T = {
  login: {
    titulo: "Qué bueno verte de nuevo",
    sub: "Entra para ver cómo van tus arriendos.",
    correo: "Correo",
    correoPlaceholder: "tu@correo.cl",
    clave: "Contraseña",
    olvido: "¿Olvidaste tu contraseña?",
    cta: "Entrar",
    ctaCargando: "Entrando…",
    ctaOk: "Listo, entrando",
    primeraVez: "¿Primera vez en Propigo?",
    crear: "Crea tu cuenta gratis",
    errorCredenciales: "Ese correo y esa contraseña no coinciden. Revísalos e inténtalo otra vez.",
    errorCorreo: "Escribe un correo válido, por ejemplo tu@correo.cl.",
    pausaTitulo: "Hacemos una pausa de seguridad",
    pausaTexto:
      "Hubo varios intentos seguidos y, para proteger tu cuenta, queda en pausa unos minutos. Puedes esperar o crear una contraseña nueva.",
    pausaFalta: "Puedes volver a intentar en",
  },
  recuperar: {
    titulo: "Recupera tu acceso",
    sub: "Escribe el correo de tu cuenta y te enviamos un enlace para crear una contraseña nueva.",
    cta: "Enviarme el enlace",
    ctaCargando: "Enviando…",
    volver: "Volver a entrar",
    enviadoTitulo: "Revisa tu correo",
    enviadoTexto:
      "Si ese correo tiene una cuenta en Propigo, en unos minutos te llega un enlace. Sirve una sola vez y vence a los 15 minutos.",
    noLlego: "¿No llegó? Mira en spam o pide otro enlace",
    reenviar: "Enviar otro enlace",
    reenviarEn: "Podrás pedir otro en",
  },
  registro: {
    titulo: "Crea tu cuenta gratis",
    sub: "Empieza con tu primera propiedad. Sin tarjeta de crédito.",
    yaTienes: "¿Ya tienes cuenta?",
    entrar: "Entra",
    pasos: [
      { titulo: "Quién eres", detalle: "Tu nombre, RUT, correo y contraseña." },
      { titulo: "Tu corredora", detalle: "El nombre que va en tus comprobantes." },
      { titulo: "Verifica que eres tú", detalle: "Una foto de tu cédula, solo para esto." },
    ],
    paso1Titulo: "Cuéntanos quién eres",
    paso1Sub: "Tal como aparecen en tu cédula: los vamos a comparar.",
    nombre: "Nombre completo",
    nombrePlaceholder: "María José Pérez González",
    rut: "RUT",
    rutPlaceholder: "12.345.678-9",
    rutError: "Revisa el RUT: el dígito verificador no coincide.",
    correo: "Correo",
    clave: "Contraseña",
    paso2Titulo: "Ahora, tu corredora",
    paso2Sub: "Va en cada comprobante y liquidación que emitas.",
    corredora: "Nombre de la corredora",
    corredoraPlaceholder: "Corredora del Sur SpA",
    comoOpera: "¿Cómo opera tu corredora?",
    empresa: "Como empresa",
    empresaDetalle: "SpA, Ltda., EIRL u otra sociedad con RUT propio.",
    natural: "Como persona natural",
    naturalDetalle: "La corredora eres tú, con tu mismo RUT.",
    rutCorredora: "RUT de la corredora",
    rutCorredoraAyuda: "No es el tuyo: es el de la empresa.",
    paso3Titulo: "Verifica que eres tú",
    paso3Sub:
      "Quienes confían su arriendo a un corredor merecen saber que hay alguien real detrás. Por eso comprobamos tu identidad.",
    razones: [
      "Leemos tu RUN y tu nombre de la foto y los comparamos con lo que escribiste.",
      "La foto se reduce y se envía a Cloudflare solo para esa lectura. No la guardamos.",
      "Tarda unos segundos.",
    ],
    camara: "Usar la cámara",
    subir: "Subir una foto",
    subirTitulo: "Arrastra la foto o elígela",
    subirAyuda: "Frente de tu cédula, JPG, PNG o WEBP, hasta 5 MB.",
    camaraBloqueada:
      "El navegador bloqueó la cámara. Permítela desde el candado junto a la dirección y reintenta, o sube una foto.",
    consentIa:
      "Acepto que la foto de mi cédula se envíe a Cloudflare (Workers AI) solo para verificar mi identidad.",
    consentTerminos: "He leído y acepto los",
    terminos: "Términos de uso",
    y: "y la",
    privacidad: "Política de privacidad",
    leyFin: "conforme a la Ley 21.719.",
    cta: "Crear mi cuenta",
    ctaCargando: "Verificando tu cédula…",
    siguiente: "Continuar",
    atras: "Atrás",
    exitoTitulo: "Tu cuenta está lista",
    exitoTexto:
      "Un último paso: confirma este dispositivo con el código de 6 dígitos que te enviamos al correo.",
    exitoCta: "Ingresar el código",
  },
  /** Tarjetas flotantes del panel de marca: funciones del producto, sin cifras inventadas. */
  destellos: {
    login: [
      { titulo: "Pago detectado", detalle: "El arriendo de este mes" },
      { titulo: "Reajuste IPC aplicado", detalle: "Al nuevo valor del contrato" },
      { titulo: "Comprobante listo", detalle: "Para rendirle al propietario" },
    ],
    recuperar: [
      { titulo: "Enlace de un solo uso", detalle: "Vence a los 15 minutos" },
    ],
  },
  confianza: [
    "Conexión cifrada",
    "Datos tratados según la Ley 21.719",
    "Comprobantes que no se pueden alterar",
  ],
  planGratuito: {
    nombre: "Plan Gratuito",
    detalle: `${PLAN_GRATUITO.maxPropiedades} propiedad · ${PLAN_GRATUITO.maxUsuarios} usuario · sin tarjeta`,
  },
} as const;

/** Saludo según la hora local, para la cabecera narrativa. */
export function saludoSegunHora(hora: number): string {
  if (hora >= 5 && hora < 12) return "Buenos días.";
  if (hora >= 12 && hora < 20) return "Buenas tardes.";
  return "Buenas noches.";
}
