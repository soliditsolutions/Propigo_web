/**
 * Catálogo de lo que Propigo guarda en el dispositivo (cookies y localStorage).
 *
 * Es la única fuente de la tabla de /privacidad §7. Existe porque esa tabla se
 * había desfasado del código (nombre de cookie del portal inexistente, duraciones
 * viejas y tres claves de localStorage sin declarar). El test
 * `__tests__/almacenamiento.test.ts` falla si el código usa un nombre `pgo_*`
 * que no esté acá.
 *
 * Criterio legal (Ley 21.719, vigente 01/12/2026): lo estrictamente necesario
 * para prestar el servicio que la persona pidió no requiere consentimiento; sí lo
 * requiere cualquier cookie de analítica, publicidad o perfilamiento. Hoy no hay
 * ninguna de esas, por eso no hay banner. SI se agrega una, hay que declararla
 * acá Y construir el consentimiento previo (opt-in, granular, revocable) antes
 * de que se escriba.
 *
 * `esencial: false` aquí son solo preferencias de interfaz que la persona fija
 * con una acción directa (tema, menú contraído, guía cerrada): viven en el
 * navegador, no se envían al servidor ni contienen datos personales.
 */
import { PANEL_INACTIVIDAD, PORTAL_INACTIVIDAD, PORTAL_MAXIMO } from "./sesion-cookies";

export type TipoAlmacenamiento = "cookie" | "localStorage";

export interface ElementoAlmacenamiento {
  /** Nombre sin prefijo `__Host-`; el nombre real en producción lo lleva. */
  nombre: string;
  /** Nombre tal como lo ve el usuario en las herramientas del navegador. */
  nombreVisible: string;
  tipo: TipoAlmacenamiento;
  /** Detalle técnico corto para mostrar bajo el nombre. */
  detalle: string;
  finalidad: string;
  duracion: string;
  esencial: boolean;
}

const min = (s: number) => `${Math.round(s / 60)} minutos`;

export const ALMACENAMIENTO: readonly ElementoAlmacenamiento[] = [
  {
    nombre: "pgo_session",
    nombreVisible: "__Host-pgo_session",
    tipo: "cookie",
    detalle: "Cookie de sesión del panel (httpOnly, SameSite estricta)",
    finalidad: "Mantener abierta la sesión del corredor. Sin ella no puede acceder al panel.",
    duracion: `${min(PANEL_INACTIVIDAD)} sin actividad (máximo 8 horas desde que inicia sesión)`,
    esencial: true,
  },
  {
    nombre: "pgo_device",
    nombreVisible: "__Host-pgo_device",
    tipo: "cookie",
    detalle: "Cookie de dispositivo confiable (httpOnly, SameSite estricta)",
    finalidad: "Recordar que este dispositivo ya verificó su identidad, para no pedir el código de seguridad en cada ingreso.",
    duracion: "1 año, o hasta que el corredor la revoque desde Mi perfil",
    esencial: true,
  },
  {
    nombre: "pgo_portal",
    nombreVisible: "__Host-pgo_portal",
    tipo: "cookie",
    detalle: "Cookie de sesión del portal (httpOnly, SameSite estricta)",
    finalidad: "Mantener abierta la consulta de arrendatarios y propietarios en el portal.",
    duracion: `${min(PORTAL_INACTIVIDAD)} sin actividad (máximo ${min(PORTAL_MAXIMO)})`,
    esencial: true,
  },
  {
    nombre: "pgo_tos_v3",
    nombreVisible: "pgo_tos_v3",
    tipo: "localStorage",
    detalle: "Almacenamiento local del navegador",
    finalidad: "Recordar que usted leyó y aceptó el aviso de términos y anti-fraude, para no mostrarlo de nuevo.",
    duracion: "Hasta que borre los datos del sitio en su navegador",
    esencial: true,
  },
  {
    nombre: "pgo_theme",
    nombreVisible: "pgo_theme",
    tipo: "localStorage",
    detalle: "Almacenamiento local del navegador",
    finalidad: "Recordar el tema claro u oscuro que usted eligió.",
    duracion: "Hasta que borre los datos del sitio en su navegador",
    esencial: false,
  },
  {
    nombre: "pgo_sidebar_collapsed",
    nombreVisible: "pgo_sidebar_collapsed",
    tipo: "localStorage",
    detalle: "Almacenamiento local del navegador",
    finalidad: "Recordar si dejó contraído el menú lateral del panel.",
    duracion: "Hasta que borre los datos del sitio en su navegador",
    esencial: false,
  },
  {
    nombre: "pgo_notif_guide_dismissed",
    nombreVisible: "pgo_notif_guide_dismissed",
    tipo: "localStorage",
    detalle: "Almacenamiento local del navegador",
    finalidad: "Recordar que cerró la guía de la sección Notificaciones.",
    duracion: "Hasta que borre los datos del sitio en su navegador",
    esencial: false,
  },
];
