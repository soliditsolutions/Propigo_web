/**
 * Registro de Actividades de Tratamiento (L-DP8, Ley 21.719).
 *
 * No es prosa suelta: es la vista "por actividad" de datos que ya existen en
 * otros dos lugares, y que por eso NO se vuelven a inventar acá —
 *   · los plazos de retención vienen de `RETENCIONES` (lib/retencion.ts), la
 *     misma fuente que aplica la purga automática. No puede haber un plazo
 *     distinto entre el registro y lo que de verdad se borra.
 *   · las finalidades y bases de legitimación usan la MISMA cita legal que
 *     `/privacidad §3` — si una cambia, cambia la otra (búscalas juntas).
 *
 * Lo nuevo de este módulo es cruzar ambas cosas por actividad, que es el
 * formato que exige un registro de tratamiento: para cada actividad, qué
 * datos, de quién, con qué base, quién más los ve, y por cuánto tiempo.
 */
import { RETENCIONES, type Retencion } from "./retencion";

export type ActividadTratamiento = {
  actividad: string;
  finalidad: string;
  baseLegal: string;
  categoriasDatos: string[];
  categoriasTitulares: string[];
  /** null = no sale de Housing SOLIDIT (tratamiento interno). */
  destinatarios: string[] | null;
  /** Claves de `RETENCIONES` que aplican a esta actividad. */
  retencionClaves: Retencion["clave"][];
  medidasSeguridad: string[];
};

const MEDIDAS_BASE = [
  "Aislamiento multi-tenant a nivel de fila (RLS): una corredora no puede leer ni escribir los datos de otra, aunque comparta la misma base",
  "Cifrado en tránsito (TLS) y en reposo",
  "Contraseñas y códigos de un solo uso con hash irreversible — nunca en texto claro",
];

export const ACTIVIDADES_TRATAMIENTO: ActividadTratamiento[] = [
  {
    actividad: "Gestión de propiedades, contratos y cobros",
    finalidad: "Prestación del servicio: publicar propiedades, generar contratos, calendarizar y conciliar pagos, emitir comprobantes y liquidaciones.",
    baseLegal: "Ejecución de contrato (art. 13 a) Ley 21.719)",
    categoriasDatos: ["Identificación (nombre, RUT, contacto)", "Datos contractuales y financieros (rentas, garantías, historial de pago)"],
    categoriasTitulares: ["Corredor (Usuario)", "Arrendatario", "Propietario"],
    destinatarios: null,
    retencionClaves: ["contratos", "contable", "cuenta"],
    medidasSeguridad: MEDIDAS_BASE,
  },
  {
    actividad: "Autenticación y dispositivos confiables",
    finalidad: "Verificar la identidad de quien entra al panel o al portal, y reconocer dispositivos ya verificados para no pedir 2FA en cada acceso.",
    baseLegal: "Interés legítimo (art. 13 f) Ley 21.719)",
    categoriasDatos: ["Credenciales (hash)", "Código de verificación (hash)", "Token de dispositivo (hash)", "Dirección IP", "Tipo de navegador"],
    categoriasTitulares: ["Corredor (Usuario)", "Arrendatario", "Propietario"],
    destinatarios: null,
    retencionClaves: ["otp", "dispositivos"],
    medidasSeguridad: MEDIDAS_BASE,
  },
  {
    actividad: "Auditoría y trazabilidad de accesos",
    finalidad: "Registrar quién accedió a qué documento o hizo qué acción, para poder responder ante un incidente o una auditoría.",
    baseLegal: "Obligación legal (art. 13 c) Ley 21.719) — Ley 19.628 y 21.719",
    categoriasDatos: ["Acción realizada", "Dirección IP", "Fecha y hora"],
    categoriasTitulares: ["Corredor (Usuario)", "Arrendatario", "Propietario"],
    destinatarios: null,
    retencionClaves: ["accesoPortal", "auditoriaEquipo"],
    medidasSeguridad: MEDIDAS_BASE,
  },
  {
    actividad: "Comunicaciones transaccionales",
    finalidad: "Enviar códigos de acceso, comprobantes, recordatorios de vencimiento y avisos del ciclo de vida del contrato.",
    baseLegal: "Ejecución de contrato (art. 13 a) Ley 21.719)",
    categoriasDatos: ["Correo electrónico", "Contenido del aviso (monto, fecha, inmueble)"],
    categoriasTitulares: ["Arrendatario", "Propietario"],
    destinatarios: ["Resend Inc. (EE.UU.) — proveedor de correo transaccional, como encargado del tratamiento"],
    retencionClaves: [],
    medidasSeguridad: MEDIDAS_BASE,
  },
  {
    actividad: "Validación asistida de contratos y de identidad al registrarse",
    finalidad: "Detectar alertas legales en el borrador de un contrato (solo texto) y validar la cédula al crear una cuenta (con visión), con consentimiento explícito antes de cada envío.",
    baseLegal: "Consentimiento (art. 13 b) Ley 21.719) — se pide antes de cada envío, no una vez por todas",
    categoriasDatos: ["Texto del contrato", "Imagen de la cédula (al registrarse)"],
    categoriasTitulares: ["Corredor (Usuario), al crear su cuenta o un contrato"],
    destinatarios: ["Groq Inc. (EE.UU.) — proveedor de IA, no almacena lo enviado, como encargado del tratamiento"],
    retencionClaves: [],
    medidasSeguridad: [...MEDIDAS_BASE, "Registro del consentimiento (ConsentimientoIa) previo a cada envío a un proveedor externo"],
  },
  {
    actividad: "Geocodificación de propiedades para el marketplace",
    finalidad: "Ubicar la propiedad en el mapa público. Por defecto se muestra un área aproximada; la dirección exacta solo si el corredor y el propietario lo autorizan.",
    baseLegal: "Ejecución de contrato / interés legítimo (art. 13 a) y f) Ley 21.719)",
    categoriasDatos: ["Dirección, comuna y región de la propiedad — nunca datos del propietario ni del arrendatario"],
    categoriasTitulares: ["Propietario (indirectamente, a través del inmueble)"],
    destinatarios: ["OpenStreetMap Foundation — Nominatim (Reino Unido), servicio gratuito de geocodificación"],
    retencionClaves: [],
    medidasSeguridad: MEDIDAS_BASE,
  },
  {
    actividad: "Infraestructura y hosting",
    finalidad: "Alojar la base de datos y la aplicación.",
    baseLegal: "Ejecución de contrato (art. 13 a) Ley 21.719)",
    categoriasDatos: ["Todos los datos de la plataforma, cifrados en tránsito y en reposo"],
    categoriasTitulares: ["Corredor (Usuario)", "Arrendatario", "Propietario"],
    destinatarios: ["Proveedor de infraestructura cloud — certificación SOC 2, contrato de procesamiento de datos (DPA) firmado, como encargado del tratamiento"],
    retencionClaves: [],
    medidasSeguridad: MEDIDAS_BASE,
  },
];

/** Las claves de retención que de verdad usa una actividad, resueltas. */
export function retencionesDe(actividad: ActividadTratamiento): Retencion[] {
  return actividad.retencionClaves.map((c) => RETENCIONES.find((r) => r.clave === c)!);
}
