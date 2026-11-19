// Recorrido responsive real: WebKit (motor de Safari/iOS) y Chromium (Android y
// escritorio) sobre el sitio público, el panel y el portal, con datos del seed.
//
// Uso (servidor de desarrollo en :3000 y base local `propigo-db` en Docker):
//   npm run qa:mobile --workspace @propigo/web [-- filtroDispositivo]
// Capturas e informe en apps/web/.qa-mobile/ (ignorado por git).
//
// Mide por página: scroll horizontal, elementos fuera de pantalla, inputs que
// hacen zoom en iOS (< 16px), contenido escondido tras scroll horizontal y
// errores de consola, estructura de textos (h1/main/hgroup, niveles, títulos
// sin punto, nombres accesibles), redirecciones inesperadas, textos o
// controles que se traslapan, texto recortado sin puntos suspensivos e
// imágenes rotas, sin tamaño o invisibles tras recorrer la página. Sale con
// código 1 si encuentra alguno. Avisa (sin fallar) las páginas que en un
// teléfono pasan de 8 pantallas de alto.
//
// SOLO LOCAL: para entrar sin correo inserta un dispositivo confiable y fija el
// código OTP del portal directamente en la base. Se niega a correr contra otra
// cosa que no sea localhost.
import { webkit, chromium, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.QA_BASE ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`qa-mobile solo corre contra localhost (recibí ${BASE}).`);
  process.exit(2);
}
const OUT = join(WEB, ".qa-mobile");
const FILTRO = process.argv[2] ?? "";
mkdirSync(OUT, { recursive: true });

const ENV = readFileSync(join(WEB, ".env"), "utf8");
const AUTH_SECRET = /^AUTH_SECRET=(.*)$/m.exec(ENV)?.[1].trim().replace(/^"|"$/g, "");
if (!AUTH_SECRET) { console.error("Falta AUTH_SECRET en apps/web/.env."); process.exit(2); }

const sql = (q) => execFileSync("docker", ["exec", "propigo-db", "psql", "-U", "propigo", "-d", "propigo", "-At", "-c", q], { encoding: "utf8" }).trim();

// Credenciales y personas del seed (prisma/seed.ts).
const CORREDOR = { email: "maria@corredorademo.cl", password: "Demo1234!" };
const PORTAL = [["16444555-0", "arrendatario"], ["9876543-3", "propietario"]];
const usuarioId = sql(`select id from usuario where email='${CORREDOR.email}'`);
const contratoId = sql(`select c.id from contrato c join usuario u on u.tenant_id=c.tenant_id where u.email='${CORREDOR.email}' and c.estado='vigente' order by c.created_at limit 1`);
if (!usuarioId || !contratoId) { console.error("Base sin datos del seed: corre db:setup → db:seed."); process.exit(2); }

const DISPOSITIVOS = [
  { id: "iphone-se",       motor: webkit,   d: devices["iPhone SE"] },
  { id: "iphone-15",       motor: webkit,   d: devices["iPhone 15"] },
  { id: "pixel-7",         motor: chromium, d: devices["Pixel 7"] },
  { id: "galaxy-s9",       motor: chromium, d: devices["Galaxy S9+"] },
  { id: "ipad-mini",       motor: webkit,   d: devices["iPad Mini"] },
  { id: "galaxy-tab",      motor: chromium, d: devices["Galaxy Tab S4"] },
  { id: "escritorio",      motor: chromium, d: devices["Desktop Chrome"] },
  // Borde inferior de `lg` con el sidebar abierto: el ancho útil más estrecho de escritorio.
  { id: "escritorio-1024", motor: chromium, d: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } } },
].filter((x) => x.id.includes(FILTRO));

async function medir(page, tactil) {
  return page.evaluate((tactil) => {
    const vw = document.documentElement.clientWidth;
    const fuera = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(el);
      if (st.position === "fixed" && st.visibility === "hidden") continue;
      // Si un ancestro recorta con overflow, no desborda la página.
      let p = el.parentElement, cortado = false;
      while (p && p !== document.body) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { cortado = true; break; }
        p = p.parentElement;
      }
      if (!cortado && (r.right > vw + 1 || r.left < -1)) {
        fuera.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
      }
    }
    // Safari iOS hace zoom al enfocar un campo con letra menor a 16px (solo táctil).
    const zoomIOS = !tactil ? [] : [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")]
      .filter((el) => el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${el.tagName.toLowerCase()}[name=${el.name || el.id || "?"}] ${getComputedStyle(el).fontSize}`);
    // Objetivos táctiles bajo 24px (WCAG 2.2 AA, 2.5.8). Excepciones de la norma: enlaces
    // dentro de texto y "espaciado" (un círculo de 24px centrado en el objetivo no toca a
    // otro objetivo). Además no cuentan los controles dentro de un <label> (toda la
    // etiqueta recibe el toque) ni .pgo-tap-target (área ampliada a 44px).
    const objetivos = [...document.querySelectorAll("a, button, [role=button], input[type=checkbox], input[type=radio]")]
      .filter((el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        // sr-only (p. ej. "Saltar al contenido"): recortado, no se puede tocar.
        const recortado = cs.clip.startsWith("rect") || cs.clipPath.startsWith("inset");
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && !recortado;
      });
    const toca = (r, o) => r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top;
    const chicos = !tactil ? [] : objetivos
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.height >= 24 && r.width >= 24) return false;
        if (el.tagName === "A" && el.closest("p, li") && getComputedStyle(el).display === "inline") return false;
        if (el.closest("label") || el.classList.contains("pgo-tap-target")) return false;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const zona = { left: cx - 12, right: cx + 12, top: cy - 12, bottom: cy + 12 };
        return objetivos.some((o) => o !== el && !o.contains(el) && !el.contains(o) && toca(zona, o.getBoundingClientRect()));
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.getAttribute("href") || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`);
    // Contenido escondido tras un scroll horizontal interno. Las filas .pgo-scroll-x
    // .pgo-chips-fila y .pgo-carrusel se desplazan a propósito (con difuminado que lo indica), no cuentan.
    const scrollInterno = [...document.querySelectorAll("body *")]
      .filter((el) => !el.matches(".pgo-scroll-x, .pgo-chips-fila, .pgo-carrusel") && /(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 2 && el.clientHeight > 0)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} oculto=${el.scrollWidth - el.clientWidth}px`);
    // Estructura de textos (PRODUCT.md): un h1 dentro del único main, con su
    // subtítulo en hgroup; niveles sin saltos; títulos sin punto final;
    // controles y campos con nombre accesible. Los diálogos abiertos no
    // cuentan para la jerarquía de la página. Las mayúsculas de título no se
    // miden aquí (direcciones y nombres propios darían falsos positivos): las
    // revisan las pruebas sobre los textos fijos.
    const estructura = [];
    const fueraDeDialogo = (el) => !el.closest("[role=dialog], dialog");
    const h1 = [...document.querySelectorAll("h1")].filter(fueraDeDialogo);
    if (h1.length !== 1) estructura.push(`h1=${h1.length}`);
    if (document.querySelectorAll("main").length !== 1) estructura.push(`main=${document.querySelectorAll("main").length}`);
    for (const h of h1) {
      if (!h.closest("main")) estructura.push("h1 fuera de main");
      if (h.nextElementSibling?.tagName === "P" && h.parentElement.tagName !== "HGROUP") estructura.push("subtítulo fuera de hgroup");
    }
    if (document.querySelector("main footer")) estructura.push("footer dentro de main");
    const titulos = [...document.querySelectorAll("main h1, main h2, main h3, main h4, main h5")].filter(fueraDeDialogo);
    let previo = 0;
    for (const h of titulos) {
      const n = Number(h.tagName[1]), t = h.textContent.trim().replace(/\s+/g, " ");
      if (previo && n > previo + 1) estructura.push(`salto h${previo}→h${n} "${t.slice(0, 30)}"`);
      previo = n;
      if (/\.$/.test(t)) estructura.push(`título con punto "${t.slice(0, 30)}"`);
    }
    for (const el of document.querySelectorAll("a[href], button")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (!(el.textContent.trim() || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || el.querySelector("img[alt]:not([alt=\"\"]), svg[aria-label]"))) {
        estructura.push(`${el.tagName.toLowerCase()} sin nombre ${(el.getAttribute("href") || el.className || "").toString().slice(0, 40)}`);
      }
    }
    for (const el of document.querySelectorAll("input:not([type=hidden]), select, textarea")) {
      if (el.getBoundingClientRect().width === 0) continue;
      if (!(el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"))) estructura.push(`campo sin etiqueta ${el.name || el.id || el.type}`);
    }
    // Traslapes: texto o controles que se pisan entre sí. Solo hojas visibles
    // (elementos con texto propio, controles, campos); las imágenes no cuentan
    // porque un sello sobre una foto es a propósito. Tampoco lo que está dentro
    // de un diálogo, de algo aria-hidden o de un elemento fijo (navbar, toasts).
    const visible = (el) => {
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.05 || a.getAttribute("aria-hidden") === "true") return false;
        if (s.position === "fixed" || s.position === "sticky") return false;
        if (a.matches("[role=dialog], dialog, .sr-only, details:not([open]) > :not(summary)")) return false;
      }
      return true;
    };
    // Lo que queda fuera de un contenedor con scroll o recorte (una lista con
    // alto máximo) no se ve: se mide solo la parte dentro de su ventana.
    const recortar = (el, c) => {
      let { left, top, right, bottom } = c;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === "visible" && s.overflowY === "visible") continue;
        const v = a.getBoundingClientRect();
        if (s.overflowX !== "visible") { left = Math.max(left, v.left); right = Math.min(right, v.right); }
        if (s.overflowY !== "visible") { top = Math.max(top, v.top); bottom = Math.min(bottom, v.bottom); }
      }
      return { left, top, right, bottom, width: right - left, height: bottom - top };
    };
    const conTextoPropio = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const hojas = [...document.querySelectorAll("body *")]
      .filter((el) => (el.matches("button, a[href], input:not([type=hidden]), select, textarea") || conTextoPropio(el)))
      // getClientRects: un enlace en línea que salta de renglón tiene una caja
      // por renglón; su caja envolvente pisaría a los vecinos sin hacerlo.
      .map((el) => ({ el, r: el.getBoundingClientRect(), cajas: [...el.getClientRects()].map((c) => recortar(el, c)).filter((c) => c.width > 2 && c.height > 2) }))
      .filter(({ el, r, cajas }) => r.width > 2 && r.height > 2 && cajas.length && visible(el));
    // Adorno a propósito: un elemento posicionado en absoluto dentro del
    // mismo contenedor que el otro (ojo de la contraseña, sello del avatar).
    const adorno = (x, y) => {
      for (let a = x; a && a !== document.body; a = a.parentElement) {
        if (getComputedStyle(a).position === "absolute") return !!a.offsetParent?.contains(y);
      }
      return false;
    };
    const pisan = (A, B) => A.cajas.some((a) => B.cajas.some((b) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 4 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4));
    const traslapes = [];
    for (let i = 0; i < hojas.length && traslapes.length < 6; i++) {
      for (let j = i + 1; j < hojas.length; j++) {
        const A = hojas[i], B = hojas[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        // Más de 4 px en ambos ejes: los bordes que se tocan no son traslape.
        if (pisan(A, B) && !adorno(A.el, B.el) && !adorno(B.el, A.el)) {
          const t = (x) => `${x.el.tagName.toLowerCase()} "${(x.el.innerText || x.el.getAttribute("aria-label") || x.el.name || "").trim().slice(0, 24)}"`;
          traslapes.push(`${t(A)} ⨯ ${t(B)}`);
          break;
        }
      }
    }
    // Texto cortado: una caja con overflow oculto que esconde parte de su texto
    // sin puntos suspensivos ni line-clamp (esos recortes son a propósito).
    const cortados = hojas
      .filter(({ el }) => conTextoPropio(el) && !el.matches("input, select, textarea"))
      .filter(({ el }) => {
        const s = getComputedStyle(el);
        if (s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none" && s.webkitLineClamp !== "") return false;
        const ocultaX = /(hidden|clip)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 2;
        const ocultaY = /(hidden|clip)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2;
        return ocultaX || ocultaY;
      })
      .slice(0, 6)
      .map(({ el }) => `${el.tagName.toLowerCase()} "${el.innerText.trim().slice(0, 30)}"`);
    // Largo de la página en pantallas: en móvil, más de ~8 cansa (se mide
    // aparte, como advertencia, no como error).
    const scroller = [...document.querySelectorAll("main")].find((m) => /(auto|scroll)/.test(getComputedStyle(m).overflowY)) ?? document.documentElement;
    const pantallas = Math.round((scroller.scrollHeight / window.innerHeight) * 10) / 10;
    return { scrollHorizontal: document.documentElement.scrollWidth - vw, fuera: fuera.slice(0, 8), zoomIOS, chicos, scrollInterno, estructura: [...new Set(estructura)].slice(0, 10), traslapes, cortados, pantallas };
  }, tactil);
}

/**
 * Recorre la página de arriba abajo (para que carguen las imágenes diferidas y
 * se disparen las animaciones de entrada) y devuelve las imágenes que no se
 * ven: rotas, con tamaño cero dentro de un contenedor visible, o que quedaron
 * invisibles (opacidad 0) después de pasar por ellas.
 */
async function imagenesPerdidas(page) {
  await page.evaluate(async () => {
    const sc = [...document.querySelectorAll("main")].find((m) => /(auto|scroll)/.test(getComputedStyle(m).overflowY));
    const alto = () => (sc ? sc.scrollHeight : document.documentElement.scrollHeight);
    for (let y = 0; y < alto(); y += Math.round(window.innerHeight * 0.7)) {
      if (sc) sc.scrollTo(0, y); else window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    if (sc) sc.scrollTo(0, 0); else window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const perdidas = [];
    for (const img of document.querySelectorAll("img")) {
      if (img.closest("[aria-hidden=true], [hidden]")) continue;
      const r = img.getBoundingClientRect();
      const padre = img.parentElement?.getBoundingClientRect();
      const nombre = (img.getAttribute("alt") || img.currentSrc || img.src).slice(-50);
      if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) perdidas.push(`rota: ${nombre}`);
      else if ((r.width === 0 || r.height === 0) && padre && padre.width > 40 && padre.height > 40 && getComputedStyle(img).display !== "none") perdidas.push(`sin tamaño: ${nombre}`);
      else if (r.width > 0 && Number(getComputedStyle(img).opacity) < 0.05) {
        let oculta = false;
        for (let a = img.parentElement; a && a !== document.body; a = a.parentElement) if (Number(getComputedStyle(a).opacity) < 0.05) { oculta = true; break; }
        if (!oculta) perdidas.push(`invisible: ${nombre}`);
      }
    }
    return perdidas.slice(0, 6);
  });
}

async function visitar(page, disp, ruta, nombre, informe) {
  const errores = [];
  // Las páginas 404 a propósito tienen dos avisos esperados:
  // - Chromium registra la respuesta del documento como "Failed to load
  //   resource … 404".
  // - Un notFound() lanzado por la página durante el SSR no lo atrapa ningún
  //   límite en el servidor: Next entrega un documento de error mínimo y el
  //   cliente renderiza todo, layout raíz incluido. React (solo en desarrollo)
  //   avisa del <script> anti-parpadeo del tema, que en ese render no corre;
  //   AsegurarTema reaplica el tema (components/ui/asegurar-tema.tsx).
  const esperado404 = ruta.startsWith(RUTA_404) || ruta.includes(ID_INEXISTENTE);
  const onConsola = (m) => {
    if (m.type() !== "error") return;
    if (esperado404 && /Failed to load resource.*404|Encountered a script tag while rendering React component/.test(m.text())) return;
    errores.push(m.text().slice(0, 300));
  };
  const onError = (e) => errores.push("pageerror: " + e.message.slice(0, 200));
  page.on("console", onConsola);
  page.on("pageerror", onError);
  try {
    const r = await page.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(600);
    const m = await medir(page, !!disp.d.hasTouch);
    // Una ruta que termina en otra (p. ej. el panel mandando a completar el
    // perfil) mide la pantalla equivocada: se reporta en vez de pasar en verde.
    const final = new URL(page.url()).pathname;
    if (final !== new URL(BASE + ruta).pathname) m.redirigido = final;
    m.imagenes = await imagenesPerdidas(page);
    // El panel desplaza un contenedor interno: expandirlo para capturar la página completa.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 300) {
          for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
            a.style.height = "auto"; a.style.maxHeight = "none"; a.style.overflowY = "visible";
          }
        }
      }
    });
    // caret "initial": con "hide" Playwright escribe caret-color en línea sobre los
    // inputs y, si llega antes de hidratar, React reporta un falso desajuste.
    await page.screenshot({ path: join(OUT, `${disp.id}__${nombre}.png`), fullPage: true, caret: "initial" });
    informe.push({ disp: disp.id, nombre, ruta, estado: r?.status(), ...m, errores });
  } catch (e) {
    informe.push({ disp: disp.id, nombre, ruta, estado: "FALLÓ", error: errorLegible(e), errores });
  }
  page.off("console", onConsola);
  page.off("pageerror", onError);
}

// Sin códigos de color ANSI y con la causa completa (Playwright la pone al final del log).
const errorLegible = (e) => String(e).replace(/\u001b\[\d+m/g, "").slice(0, 1500);

async function loginPanel(ctx, page) {
  const token = randomUUID();
  const hash = createHash("sha256").update(token).digest("hex");
  sql(`insert into dispositivo_confiable (usuario_id, token_hash, nombre) values ('${usuarioId}', '${hash}', 'Recorrido QA')`);
  await ctx.addCookies([{ name: "pgo_device", value: token, url: BASE }]);
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', CORREDOR.email);
  await page.fill('input[name="password"]', CORREDOR.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/panel/, { timeout: 45_000 });
}

async function loginPortal(page, rut) {
  // Tope de 3 códigos por persona cada 10 min: limpiar los de recorridos anteriores.
  sql(`delete from acceso_otp where persona_id in (select id from persona where rut='${rut}')`);
  await page.goto(BASE + "/portal", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="12.345.678-9"]', rut);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/portal\/verificar\?id=/, { timeout: 30_000 });
  const id = new URL(page.url()).searchParams.get("id");
  const codigo = "246813";
  sql(`update acceso_otp set codigo_hash='${createHash("sha256").update(codigo + AUTH_SECRET).digest("hex")}' where id='${id}'`);
  await page.fill("#portal-otp", codigo);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/portal\/contrato\//, { timeout: 30_000 });
  return page.url().replace(BASE, "");
}

// Páginas de error propias (auditoría de mensajes 2026-11, M-01): ruta
// inexistente, ficha despublicada y recurso del panel que no existe.
const RUTA_404 = "/esta-ruta-no-existe";
const ID_INEXISTENTE = "7d1f6e2a-1b2c-4d3e-8f90-123456789abc";
const RUTAS_PUBLICAS = [["/", "portada"], ["/marketplace", "marketplace"], ["/login", "login"], ["/registro", "registro"], ["/recuperar-contrasena", "recuperar"], ["/portal", "portal-login"], ["/terminos-uso", "terminos"], ["/privacidad", "privacidad"], [RUTA_404, "404-sitio"], [`/marketplace/${ID_INEXISTENTE}`, "404-ficha"]];
const RUTAS_PANEL = [["/panel", "panel-inicio"], ["/panel/propiedades", "panel-propiedades"], ["/panel/contratos", "panel-contratos"], [`/panel/contratos/${contratoId}`, "panel-contrato-detalle"], ["/panel/contratos/nuevo", "panel-contrato-nuevo"], ["/panel/cobros", "panel-cobros"], ["/panel/vouchers", "panel-vouchers"], ["/panel/equipo", "panel-equipo"], ["/panel/estadisticas", "panel-estadisticas"], ["/panel/notificaciones", "panel-notificaciones"], ["/panel/corredora", "panel-corredora"], ["/panel/perfil", "panel-perfil"], [`/panel/contratos/${ID_INEXISTENTE}`, "panel-404"]];

const informe = [];
try {
  for (const disp of DISPOSITIVOS) {
    const browser = await disp.motor.launch();
    // Público (primero sin aceptar el aviso anti-fraude, para medirlo)
    {
      const ctx = await browser.newContext({ ...disp.d, locale: "es-CL" });
      const page = await ctx.newPage();
      await visitar(page, disp, "/marketplace", "aviso-anti-fraude", informe);
      await ctx.addInitScript(() => localStorage.setItem("pgo_tos_v3", new Date().toISOString()));
      for (const [ruta, nombre] of RUTAS_PUBLICAS) await visitar(page, disp, ruta, nombre, informe);
      await page.goto(BASE + "/marketplace", { waitUntil: "networkidle" });
      const ficha = await page.$$eval('a[href^="/marketplace/"]', (as) => as.map((a) => a.getAttribute("href")).find((h) => h.split("/").length === 3));
      if (ficha) await visitar(page, disp, ficha, "ficha-propiedad", informe);
      else informe.push({ disp: disp.id, nombre: "ficha-propiedad", estado: "FALLÓ", error: "El marketplace no lista ninguna publicación (¿seed sin propiedades publicadas?)." });
      await ctx.close();
    }
    // Panel del corredor
    {
      const ctx = await browser.newContext({ ...disp.d, locale: "es-CL" });
      const page = await ctx.newPage();
      try {
        await loginPanel(ctx, page);
        for (const [ruta, nombre] of RUTAS_PANEL) await visitar(page, disp, ruta, nombre, informe);
      } catch (e) {
        informe.push({ disp: disp.id, nombre: "login-panel", estado: "FALLÓ", error: errorLegible(e) });
      }
      await ctx.close();
    }
    // Portal: arrendatario y propietario
    for (const [rut, quien] of PORTAL) {
      const ctx = await browser.newContext({ ...disp.d, locale: "es-CL" });
      await ctx.addInitScript(() => localStorage.setItem("pgo_tos_v3", new Date().toISOString()));
      const page = await ctx.newPage();
      try {
        const ruta = await loginPortal(page, rut);
        await visitar(page, disp, ruta, `portal-${quien}-contrato`, informe);
        await visitar(page, disp, "/portal/mis-datos", `portal-${quien}-mis-datos`, informe);
      } catch (e) {
        informe.push({ disp: disp.id, nombre: `portal-${quien}`, estado: "FALLÓ", error: errorLegible(e) });
      }
      await ctx.close();
    }
    await browser.close();
  }
} finally {
  sql(`delete from dispositivo_confiable where nombre='Recorrido QA'`);
}

writeFileSync(join(OUT, "informe.json"), JSON.stringify(informe, null, 2));
const conProblemas = informe.filter((r) => r.estado === "FALLÓ" || r.scrollHorizontal > 0 || r.fuera?.length || r.zoomIOS?.length || r.chicos?.length || r.scrollInterno?.length || r.estructura?.length || r.traslapes?.length || r.cortados?.length || r.imagenes?.length || r.redirigido || r.errores?.length);
console.log(`páginas: ${informe.length} · con problemas: ${conProblemas.length} · capturas en ${OUT}`);
for (const r of conProblemas) {
  console.log(JSON.stringify({ disp: r.disp, pagina: r.nombre, estado: r.estado, scrollHorizontal: r.scrollHorizontal || undefined, fuera: r.fuera?.length ? r.fuera : undefined, zoomIOS: r.zoomIOS?.length ? r.zoomIOS : undefined, chicos: r.chicos?.length ? r.chicos : undefined, scrollInterno: r.scrollInterno?.length ? r.scrollInterno : undefined, estructura: r.estructura?.length ? r.estructura : undefined, traslapes: r.traslapes?.length ? r.traslapes : undefined, cortados: r.cortados?.length ? r.cortados : undefined, imagenes: r.imagenes?.length ? r.imagenes : undefined, redirigido: r.redirigido, errores: r.errores?.length ? r.errores.slice(0, 3) : undefined, error: r.error }));
}
// Advertencia (no error): páginas que en un teléfono pasan de 8 pantallas de alto.
const LARGO_MAX = 8;
const largas = informe.filter((r) => r.pantallas > LARGO_MAX && ["iphone-se", "iphone-15", "pixel-7", "galaxy-s9"].includes(r.disp));
if (largas.length) console.log(`advertencia: ${largas.length} páginas de más de ${LARGO_MAX} pantallas en teléfono: ${[...new Set(largas.map((r) => `${r.nombre} (${r.pantallas})`))].join(", ")}`);
process.exit(conProblemas.length ? 1 : 0);
