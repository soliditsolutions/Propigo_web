// Recorrido responsive real: WebKit (motor de Safari/iOS) y Chromium (Android y
// escritorio) sobre el sitio público, el panel y el portal, con datos del seed.
//
// Uso (servidor de desarrollo en :3000 y base local `propigo-db` en Docker):
//   npm run qa:mobile --workspace @propigo/web [-- filtroDispositivo]
// Capturas e informe en apps/web/.qa-mobile/ (ignorado por git).
//
// Mide por página: scroll horizontal, elementos fuera de pantalla, inputs que
// hacen zoom en iOS (< 16px), contenido escondido tras scroll horizontal y
// errores de consola. Sale con código 1 si encuentra alguno.
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
    // se desplazan a propósito (con difuminado que lo indica), no cuentan.
    const scrollInterno = [...document.querySelectorAll("body *")]
      .filter((el) => !el.classList.contains("pgo-scroll-x") && /(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 2 && el.clientHeight > 0)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} oculto=${el.scrollWidth - el.clientWidth}px`);
    return { scrollHorizontal: document.documentElement.scrollWidth - vw, fuera: fuera.slice(0, 8), zoomIOS, chicos, scrollInterno };
  }, tactil);
}

async function visitar(page, disp, ruta, nombre, informe) {
  const errores = [];
  const onConsola = (m) => { if (m.type() === "error") errores.push(m.text().slice(0, 300)); };
  const onError = (e) => errores.push("pageerror: " + e.message.slice(0, 200));
  page.on("console", onConsola);
  page.on("pageerror", onError);
  try {
    const r = await page.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 45_000 });
    await page.waitForTimeout(600);
    const m = await medir(page, !!disp.d.hasTouch);
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

const RUTAS_PUBLICAS = [["/", "portada"], ["/marketplace", "marketplace"], ["/login", "login"], ["/registro", "registro"], ["/recuperar-contrasena", "recuperar"], ["/portal", "portal-login"], ["/terminos-uso", "terminos"], ["/privacidad", "privacidad"]];
const RUTAS_PANEL = [["/panel", "panel-inicio"], ["/panel/propiedades", "panel-propiedades"], ["/panel/contratos", "panel-contratos"], [`/panel/contratos/${contratoId}`, "panel-contrato-detalle"], ["/panel/contratos/nuevo", "panel-contrato-nuevo"], ["/panel/cobros", "panel-cobros"], ["/panel/vouchers", "panel-vouchers"], ["/panel/equipo", "panel-equipo"], ["/panel/estadisticas", "panel-estadisticas"], ["/panel/notificaciones", "panel-notificaciones"], ["/panel/corredora", "panel-corredora"], ["/panel/perfil", "panel-perfil"]];

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
const conProblemas = informe.filter((r) => r.estado === "FALLÓ" || r.scrollHorizontal > 0 || r.fuera?.length || r.zoomIOS?.length || r.chicos?.length || r.scrollInterno?.length || r.errores?.length);
console.log(`páginas: ${informe.length} · con problemas: ${conProblemas.length} · capturas en ${OUT}`);
for (const r of conProblemas) {
  console.log(JSON.stringify({ disp: r.disp, pagina: r.nombre, estado: r.estado, scrollHorizontal: r.scrollHorizontal || undefined, fuera: r.fuera?.length ? r.fuera : undefined, zoomIOS: r.zoomIOS?.length ? r.zoomIOS : undefined, chicos: r.chicos?.length ? r.chicos : undefined, scrollInterno: r.scrollInterno?.length ? r.scrollInterno : undefined, errores: r.errores?.length ? r.errores.slice(0, 3) : undefined, error: r.error }));
}
process.exit(conProblemas.length ? 1 : 0);
