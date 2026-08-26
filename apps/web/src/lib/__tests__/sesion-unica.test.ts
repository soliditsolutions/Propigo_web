/**
 * Sesiones privadas: una a la vez, y con caducidad por inactividad.
 *
 * El bug que originó esto: el panel del corredor y el portal del arrendatario
 * usan cookies distintas, y nada cerraba una al abrir la otra. En el navegador
 * de la oficina —donde el arrendatario firma— quedaban las dos identidades
 * vivas: volver atrás mostraba el panel y avanzar entraba al portal, sin que
 * nadie hubiera cerrado sesión.
 *
 * La regla se aplica en los setters de cookie y no en cada pantalla de login,
 * para que una entrada nueva no pueda olvidarse. Estos tests fijan las dos
 * mitades: la exclusión mutua y los dos relojes de caducidad.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const jarSet = vi.fn();
const jarGet = vi.fn(() => undefined);
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: jarSet, get: jarGet })),
}));

process.env.AUTH_SECRET = "x".repeat(48);

const { setSessionCookie, clearSessionCookie, sesionAgotada, COOKIE_NAME } = await import("../auth");
const { setPortalCookie, clearPortalCookie, sesionPortalAgotada, PORTAL_COOKIE_NAME } = await import("../portal-auth");
const {
  PANEL_INACTIVIDAD, PANEL_MAXIMO, PORTAL_INACTIVIDAD, PORTAL_MAXIMO,
  REFRESCO_MINIMO, superaMaximo, tocaRefrescar,
} = await import("../sesion-cookies");

/** Lo que se escribió para una cookie concreta en la última llamada. */
function escrituraDe(nombre: string) {
  const llamadas = jarSet.mock.calls.filter((c) => c[0] === nombre);
  return llamadas.length ? { valor: llamadas.at(-1)![1], opciones: llamadas.at(-1)![2] } : null;
}

beforeEach(() => vi.clearAllMocks());

describe("exclusión mutua entre panel y portal", () => {
  it("abrir sesión de corredor cierra la del portal", async () => {
    await setSessionCookie("jwt-de-panel");

    expect(escrituraDe(COOKIE_NAME)!.valor).toBe("jwt-de-panel");
    const portal = escrituraDe(PORTAL_COOKIE_NAME);
    expect(portal, "no se tocó la cookie del portal").not.toBeNull();
    expect(portal!.valor).toBe("");
    expect(portal!.opciones.maxAge).toBe(0);
  });

  it("abrir sesión de portal cierra la del corredor", async () => {
    await setPortalCookie("jwt-de-portal");

    expect(escrituraDe(PORTAL_COOKIE_NAME)!.valor).toBe("jwt-de-portal");
    const panel = escrituraDe(COOKIE_NAME);
    expect(panel, "no se tocó la cookie del panel").not.toBeNull();
    expect(panel!.valor).toBe("");
    expect(panel!.opciones.maxAge).toBe(0);
  });

  it("cerrar una NO cierra la otra: salir del portal no debe expulsar al corredor", async () => {
    // La exclusión es al ENTRAR. Al salir solo se cierra la propia, o cerrar
    // sesión en el portal echaría de su panel a quien nunca estuvo allí.
    await clearPortalCookie();
    expect(escrituraDe(COOKIE_NAME)).toBeNull();

    vi.clearAllMocks();
    await clearSessionCookie();
    expect(escrituraDe(PORTAL_COOKIE_NAME)).toBeNull();
  });

  it("las dos cookies viven en la raíz, o el borrado cruzado no tendría efecto", async () => {
    // Un borrado solo alcanza a la cookie del mismo path. Si el portal volviera
    // a "/portal", cerrarlo desde el panel dejaría de funcionar en silencio.
    await setSessionCookie("a");
    await setPortalCookie("b");
    for (const nombre of [COOKIE_NAME, PORTAL_COOKIE_NAME]) {
      expect(escrituraDe(nombre)!.opciones.path, nombre).toBe("/");
    }
  });

  it("al cerrar el portal se barre también el path antiguo", async () => {
    // Las sesiones abiertas antes del cambio de path viven en "/portal" y el
    // navegador las seguiría mandando.
    await clearPortalCookie();
    const paths = jarSet.mock.calls
      .filter((c) => c[0] === PORTAL_COOKIE_NAME)
      .map((c) => c[2].path);
    expect(paths).toContain("/");
    expect(paths).toContain("/portal");
  });

  it("ninguna cookie de sesión es accesible desde JavaScript", async () => {
    await setSessionCookie("a");
    await setPortalCookie("b");
    for (const nombre of [COOKIE_NAME, PORTAL_COOKIE_NAME]) {
      expect(escrituraDe(nombre)!.opciones.httpOnly, nombre).toBe(true);
      expect(escrituraDe(nombre)!.opciones.sameSite, nombre).toBe("strict");
    }
  });
});

describe("caducidad por inactividad", () => {
  it("la ventana del portal es más corta que la del panel", () => {
    // El portal se abre a menudo en un equipo prestado; el panel es la jornada
    // de trabajo de alguien en su propio computador.
    expect(PORTAL_INACTIVIDAD).toBeLessThan(PANEL_INACTIVIDAD);
    expect(PORTAL_MAXIMO).toBeLessThan(PANEL_MAXIMO);
  });

  it("la cookie caduca junto con la ventana de inactividad, no después", async () => {
    // Si maxAge sobreviviera al `exp` del JWT, el navegador seguiría mandando
    // un token muerto en cada request.
    await setSessionCookie("a");
    expect(escrituraDe(COOKIE_NAME)!.opciones.maxAge).toBe(PANEL_INACTIVIDAD);

    await setPortalCookie("b");
    expect(escrituraDe(PORTAL_COOKIE_NAME)!.opciones.maxAge).toBe(PORTAL_INACTIVIDAD);
  });
});

describe("tope absoluto desde el login", () => {
  const enSegundos = (d: number) => Math.floor(d / 1000);
  const AHORA = Date.UTC(2026, 7, 26, 12, 0, 0);

  it("una sesión recién abierta no está agotada", () => {
    expect(sesionAgotada({ ini: enSegundos(AHORA) } as never, AHORA)).toBe(false);
    expect(sesionPortalAgotada({ ini: enSegundos(AHORA) } as never, AHORA)).toBe(false);
  });

  it("se agota al superar su máximo, aunque haya habido actividad continua", () => {
    // `iat` se renueva con cada request; `ini` no. Es la diferencia entre
    // "sigue trabajando" y "esta sesión ya lleva demasiado abierta".
    const viejaPanel  = { ini: enSegundos(AHORA) - PANEL_MAXIMO  - 1, iat: enSegundos(AHORA) };
    const viejaPortal = { ini: enSegundos(AHORA) - PORTAL_MAXIMO - 1, iat: enSegundos(AHORA) };
    expect(sesionAgotada(viejaPanel as never, AHORA)).toBe(true);
    expect(sesionPortalAgotada(viejaPortal as never, AHORA)).toBe(true);
  });

  it("justo en el límite todavía no se agota", () => {
    const justa = { ini: enSegundos(AHORA) - PANEL_MAXIMO };
    expect(superaMaximo(justa, PANEL_MAXIMO, AHORA)).toBe(false);
  });

  it("un token viejo sin `ini` usa su `iat`, y no queda eterno", () => {
    // Los tokens emitidos antes de este cambio no traen `ini`. Caer en "nunca
    // se agota" sería peor que regalarles una ventana de más.
    const antiguo = { iat: enSegundos(AHORA) - PANEL_MAXIMO - 1 };
    expect(superaMaximo(antiguo, PANEL_MAXIMO, AHORA)).toBe(true);
  });

  it("un token sin ninguna marca de tiempo no se da por agotado", () => {
    // No hay información para decidir; la caducidad la resuelve el `exp` del
    // JWT, que jose valida aparte.
    expect(superaMaximo({}, PANEL_MAXIMO, AHORA)).toBe(false);
  });
});

describe("renovación de la ventana", () => {
  const AHORA = Date.UTC(2026, 7, 26, 12, 0, 0);
  const seg = Math.floor(AHORA / 1000);

  it("no re-firma en cada request", () => {
    // Cargar dos páginas seguidas no debe costar dos firmas.
    expect(tocaRefrescar({ iat: seg }, AHORA)).toBe(false);
    expect(tocaRefrescar({ iat: seg - REFRESCO_MINIMO + 1 }, AHORA)).toBe(false);
  });

  it("re-firma pasado el umbral", () => {
    expect(tocaRefrescar({ iat: seg - REFRESCO_MINIMO }, AHORA)).toBe(true);
    expect(tocaRefrescar({ iat: seg - 600 }, AHORA)).toBe(true);
  });

  it("un token sin `iat` se re-firma para que pase a tenerlo", () => {
    expect(tocaRefrescar({}, AHORA)).toBe(true);
  });
});
