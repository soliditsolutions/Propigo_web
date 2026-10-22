# Fase 2 — Aurora en el sitio completo (2026-07-09 → 2026-07-10)

> **Estado: IMPLEMENTADO.** El plan original de este documento (dualizar `--pf-*`, `ThemeToggle` en `PublicNavbar`, barrido de los 4 puntos ciegos en marketplace/auth/portal/legales) se ejecutó completo el 2026-07-09. El 2026-07-10 se sumó una segunda capa — **glassmorphism + fondo aurora animado** sobre las pantallas de autenticación, el home público y el hero del marketplace — más el rediseño del home (carruseles de corredores/propiedades, footer profesional). Ver §8 y §9 para el detalle de esta segunda capa; §1-§7 se conservan como registro de la auditoría y el plan original, ya ejecutado.

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Superficie ya con Aurora | Panel del corredor (`/panel/**`) — completo y verificado |
| Superficie pendiente | Sitio público (marketplace), login/registro/recuperación, legales, portal de autoconsulta |
| Páginas involucradas | 18 archivos de página + 13 componentes compartidos |
| Hex hardcodeado detectado | **~150 ocurrencias** repartidas en 24 archivos (ver §4) |
| Toggle de tema en sitio público | **No existe** — `ThemeToggle` no se usa fuera del panel |
| Tokens `--pf-*` (diseño público) | **Fijos, sin variante oscura** — un solo bloque `:root{}`, nunca tocado en Fase 1 |
| Riesgo principal | Los mismos 4 puntos ciegos que aparecieron en el panel (hex, clases Tailwind de paleta fija, tokens shadcn sin themear, strings `"white"` literales) muy probablemente se repiten aquí, sin auditar todavía |

**Por qué se posterga:** el mecanismo de tema ya es **global** (`data-theme` vive en `<html>`, el script anti-FOUC y el `ThemeToggle` no son panel-specific) — no hay que construir infraestructura nueva. Lo que falta es trabajo de barrido y verificación página por página, del mismo tamaño que Fase 1 completa.

## 2. Estado actual por superficie

| Superficie | Rutas | Sistema de tokens actual | Hex hardcodeado | Clases Tailwind paleta fija | Toggle |
|---|---|---|---|---|---|
| Panel corredor | `/panel/**` | `--pgo-*` (dual, verificado) | 0 | 0 | ✅ |
| Marketplace | `/marketplace`, `/marketplace/[id]` | `--pf-*` (fijo, light-only) | 5 | 1 | ❌ |
| Login/Registro/Recuperación | `/login`, `/registro`, `/recuperar-contrasena`, `/nueva-contrasena`, `/verificar-dispositivo` | `--pf-*` (fijo) | 52 | 1 | ❌ |
| Legales | `/privacidad`, `/terminos-uso` | `--pf-*` (fijo) | 42 | 5 | ❌ |
| Portal autoconsulta | `/portal`, `/portal/verificar`, `/portal/contrato/[id]` | `--pf-*` + `--pgo-danger` suelto | 21 | 4 | ❌ |
| Componentes compartidos | `components/public/*`, `components/marketplace/*`, `components/portal/*`, `components/ui/modal.tsx` | `--pf-*` | 17 | 5 | — |

> Detalle de conteos por archivo en el Anexo A.

## 3. Arquitectura necesaria

No se necesita un mecanismo nuevo — se **extiende el existente**:

1. **Dualizar `--pf-*`** — hoy vive en un único bloque `:root {}` (globals.css, sección "PayFlow Design System"). Hay que partirlo en `:root[data-theme="aurora-dark"]` / `:root[data-theme="aurora-light"]`, igual que se hizo con `--pgo-*` en Fase 1. Esto incluye recalibrar glows/sombras (el mismo criterio ya validado: blur puro en oscuro, halo direccional en claro).
2. **`ThemeToggle` en `PublicNavbar`** — mismo componente ya existente (`components/ui/theme-toggle.tsx`), solo agregar el botón al navbar público. Como el tema es global, un corredor que lo cambia en el panel lo vería igual en el sitio público (y viceversa) — comportamiento coherente, no requiere estado separado.
3. **Confirmar cobertura del script anti-FOUC** — ya vive en `layout.tsx` raíz, cubre toda la app; no requiere cambios.
4. **Revisar `components/ui/modal.tsx`** — usado por `ContactoModal`, `DenunciaModal`, `ValoracionModal`. Es un componente shadcn/genérico análogo a `Dialog`, que en el panel tenía tokens (`--popover`, etc.) sin themear y renderizaba fondo blanco fijo en oscuro (bug real encontrado y corregido hoy). Es altamente probable que `modal.tsx` tenga el mismo problema — revisar `modalInputStyle()` (`background: "#fff"` hardcodeado, línea 12) como primer sospechoso.

## 4. Los 4 puntos ciegos a barrer (mismo patrón que el panel)

Durante Fase 1 se descubrieron, en este orden, cuatro formas distintas en que un color queda "fuera" del sistema de temas — un grep no basta con revisar una sola:

1. **Hex literal** (`#RRGGBB`) — grep `#[0-9A-Fa-f]{6}`.
2. **Clases Tailwind de paleta fija** (`bg-blue-50`, `text-slate-900`, etc.) — grep `\b(bg|text|border|ring|divide)-(red|blue|...)-[0-9]{2,3}\b`.
3. **Tokens shadcn sin themear** (`--popover`, `--card`, `--background`, etc., usados por `Dialog`/`Button`/`Badge`/`Tabs` genéricos) — ya resuelto para el panel (globals.css los remapea a `--pgo-*` dentro de los bloques de tema); falta decidir si el sitio público también los necesita o si sigue usando solo `--pf-*` explícito.
4. **Strings de color literales en `style={{}}`** (`background: "white"`, `color: "black"`) — no lo detecta ningún grep de los anteriores, hay que buscar explícitamente `"white"|"black"|"#fff"` dentro de objetos `style`.

### Anexo A — Conteo de hex por archivo (grep `#[0-9A-Fa-f]{6}`)

| Archivo | Hex | Prioridad sugerida |
|---|---|---|
| `app/verificar-dispositivo/verificar-form.tsx` | 32 | Alta (flujo de login) |
| `app/privacidad/page.tsx` | 38 | Baja (texto legal estático) |
| `app/login/login-form.tsx` | 16 | Alta (primera pantalla que ve todo el mundo) |
| `app/portal/verificar/page.tsx` | 11 | Media |
| `app/portal/contrato/[contratoId]/page.tsx` | 9 | Media |
| `components/portal/PagosSection.tsx` | 9 | Media |
| `app/terminos-uso/page.tsx` | 4 | Baja |
| `app/marketplace/page.tsx` | 4 | Alta (mayor tráfico esperado) |
| `components/marketplace/DenunciaModal.tsx` | 5 | Media |
| `components/marketplace/ValoracionModal.tsx` | 4 | Media |
| `components/marketplace/CorredorPanel.tsx` | 3 | Media |
| `components/marketplace/LeafletMapInner.tsx` | 3 | Media (mapa, revisar si es de marca fija) |
| `app/recuperar-contrasena/page.tsx` | 2 | Alta |
| Resto (registro, nueva-contraseña, marketplace/[id], portal/page, modal.tsx, ComentariosSection, ValoracionButton) | 1 c/u | Media/Baja |

No se re-listan las clases Tailwind de paleta fija ni los strings `"white"` porque ese barrido específico aún no se ejecutó (es el paso 2 y 4 de la metodología de 4 puntos ciegos) — quedará para la sesión de implementación.

## 5. Plan de trabajo recomendado (orden)

Mismo orden que funcionó en Fase 1 — infraestructura primero, luego barrido por página de mayor a menor tráfico esperado:

1. Dualizar tokens `--pf-*` (dark/light) + recalibrar glows/sombras.
2. Agregar `ThemeToggle` a `PublicNavbar`.
3. Barrer marketplace (`/marketplace`, `/marketplace/[id]`, `filter-panel.tsx`, `CorredorPanel`, `PropertyMap`/`LeafletMapInner`) — mayor tráfico, primera impresión de un arrendatario nuevo.
4. Barrer login → registro → recuperar-contraseña → nueva-contraseña → verificar-dispositivo (el embudo de entrada del corredor).
5. Barrer portal de autoconsulta (`/portal/**`, `PagosSection`, `ComentariosSection`, `ValoracionButton`) — vista del arrendatario/propietario.
6. Revisar `components/ui/modal.tsx` con el mismo criterio que `Dialog` (probable bug de fondo fijo).
7. Legales (`/privacidad`, `/terminos-uso`) — decidir alcance: ¿tema completo o solo legible/neutro en ambos modos sin efectos "vanguardia" (glow, aurora animado), dado que es contenido de cumplimiento? Recomendación: tokens sí, efectos decorativos no.
8. `tsc --noEmit` limpio + verificación visual en Claude Preview de cada página, en ambos temas.

## 6. Plan de pruebas

### 6.1 Verificación visual por página (ambos temas)
Checklist a repetir por cada página listada en §2: sin fondos blancos/negros fijos, texto legible en ambos temas, badges/inputs/modales con el mismo tratamiento que el panel, sin scrollbar del navegador sin themear.

### 6.2 Prueba end-to-end solicitada explícitamente
Una vez aplicados los cambios, correr el flujo completo **desde la creación de una cuenta hasta el arriendo de una propiedad**, alternando ambas perspectivas:

- **Corredor:** registro → verificación de dispositivo → completar perfil → publicar propiedad → recibir contacto → crear contrato → gestionar cobro.
- **Cliente/arrendatario:** explorar marketplace → contactar corredor → (si aplica) firmar/activar contrato → acceder al portal de autoconsulta con RUT + OTP → ver estado de pagos.
- Repetir el recorrido crítico en **ambos temas** (Aurora Dark y Aurora Light) para confirmar que ningún paso del flujo queda ilegible o roto al cambiar de tema a mitad de camino.

Ver metodología de auditoría E2E ya usada en el proyecto: `Docs/gestion/auditoria-e2e-2026-07.md` (limpieza de datos con `npm run db:clean`, cuenta de corredor desde cero, `preview_fill`/`preview_click` en vez de `eval` para que los Server Actions se disparen de forma confiable).

## 7. Riesgos y decisiones pendientes

- **¿Las páginas legales llevan el toggle y los efectos "vanguardia"?** Recomendación en §5.7: tokens sí (legibilidad en ambos temas), glow/aurora animado no (es contenido de cumplimiento, no debe distraer).
- **¿El portal de autoconsulta del arrendatario comparte el mismo toggle que el corredor?** Dado que el tema es global vía `<html data-theme>` y no hay estado por rol, sí — es el comportamiento más simple y consistente. Confirmar que no haya expectativa de marca distinta para arrendatarios vs. corredores.
- **`LeafletMapInner`** — ya verificado: sus 3 hex (`#7C3AED`) son el color del pin del mapa (fill/stroke del ícono SVG), no fondo ni texto. Caso análogo al sidebar del panel — se puede dejar fijo intencionalmente, no requiere tokenizar.
- **Alcance de `modal.tsx`** — si el bug de fondo fijo se confirma, el fix es idéntico al ya aplicado a `Dialog` (remapear tokens shadcn dentro de los bloques de tema, más revisar `modalInputStyle()`).

## 8. Segunda capa — Glassmorphism + Aurora animada (2026-07-10)

Con el tema dual ya verificado en todo el sitio (§1-§7), se agregó una capa visual adicional: **vidrio esmerilado sobre un fondo aurora boreal animado**, primero en las 5 pantallas de autenticación y luego en el home público y el hero del marketplace.

### 8.1 Tokens y utilidades nuevas (`globals.css`)

| Nombre | Qué es | Dónde vive |
|---|---|---|
| `--pgo-glass-card` | Relleno translúcido de tarjetas de contenido (más opaco que `--pgo-surface-glass`, calibrado para legibilidad de texto sobre blur) | Ambos temas |
| `--pgo-glass-input` | Relleno translúcido de inputs dentro de tarjetas glass | Ambos temas |
| `.pgo-aurora-layer` | Fondo aurora a pantalla completa — dos capas de radial-gradients (índigo/teal/violeta) con `blur()` y animación de deriva en sentidos opuestos (`pgo-aurora-drift-a/b`), intensidad por tema vía opacidad (`0.85` oscuro con `mix-blend-mode: screen`, `0.55` claro sin blend) | `globals.css`, sección "Fondo Aurora" |
| `.pgo-auth-card` | Tarjeta de vidrio esmerilado — `backdrop-filter: blur(24px) saturate(1.6)` + `--pgo-glass-card` + `--pgo-shadow-3` | `globals.css` |
| `.pgo-auth-aside` | Panel de marca en vidrio oscuro (deja translucir la aurora, texto blanco AA en ambos temas) | `globals.css` |

Todo respeta `prefers-reduced-motion` (regla global ya existente en `globals.css:353` neutraliza la animación de deriva).

### 8.2 Pantallas de autenticación

Aplicado a `/login`, `/registro`, `/recuperar-contrasena`, `/nueva-contrasena`, `/verificar-dispositivo`:
- Fondo `.pgo-aurora-layer` a pantalla completa (`position: fixed` cuando la página es de una sola vista, para que no se pierda si hay scroll).
- Tarjeta del formulario → `.pgo-auth-card`.
- Aside de marca (donde existe) → `.pgo-auth-aside`.
- Inputs → `--pgo-glass-input`.
- Casos especiales resueltos: estado de éxito de `recuperar-form.tsx` aplanado (evitar tarjeta-dentro-de-tarjeta); `verificar-dispositivo` migrado de un gradiente `--pf-*` fijo a la aurora `--pgo-*` dual.

Verificado en Aurora Dark, Aurora Light y viewport mobile (375px) para las 5 pantallas.

### 8.3 Corrección de higiene de datos hecha en el camino

Al verificar `/verificar-dispositivo` fue necesario simular un dispositivo nuevo para el usuario de prueba `pedro.test@corredoraetesting.cl` — se borró su fila en `dispositivo_confiable` (acción reversible, solo obliga a re-verificar OTP en el próximo login; no afecta datos de negocio).

## 9. Rediseño del home público (2026-07-10)

Con la capa de vidrio ya validada en auth, se extendió a `/` (home) y se agregaron dos secciones de contenido dinámico.

### 9.1 Layout y navegación

- El home dejó de tener un header/footer propio y ahora usa `PublicNavbar`/`PublicFooter` compartidos (misma fuente única que marketplace) — esto resolvió de paso el punto 4 pedido explícitamente: **el `ThemeToggle` no aparecía en el home** porque el home nunca usó `PublicNavbar` (que ya lo tenía desde la Fase 2 original).
- `PublicNavbar` se convirtió en **server component consciente de la sesión** (antes era estático): si hay sesión activa muestra "Ir al panel" + "Cerrar sesión"; si no, "Panel corredor" → `/login`. Antes esto solo pasaba en el home (con código propio); ahora es consistente en todas las páginas públicas que usan `PublicNavbar` (marketplace, ficha de propiedad, home).
- Fondo `.pgo-aurora-layer` a pantalla completa (`position: fixed`, ya que el home es más largo que un viewport).
- Tarjeta del núcleo financiero y las 3 tarjetas de features → `.pgo-auth-card`.

### 9.2 Carrusel "Corredores mejor valorados"

- Query nueva (`getTopCorredores` en `app/page.tsx`): `prisma.valoracionCorredor.groupBy` por `tenantId` (con `esVisible: true`), promedio y conteo de estrellas, top 10 por promedio descendente.
- **No existe una foto/logo por corredor en el modelo (`Tenant` no tiene ese campo)** — se usa un avatar de iniciales con la paleta de marca en vez de una imagen inventada.
- Botón de contacto → enlaza a `/marketplace?corredor={tenantId}` (nuevo filtro agregado a `getPublicaciones`) en vez de abrir un modal de contacto genérico, porque el único flujo de contacto real (`ContactoModal`) está atado a una publicación específica, no a un corredor suelto. El marketplace muestra un banner "Mostrando propiedades de X" con opción de quitar el filtro.
- Sección completa oculta si no hay valoraciones aún (evita un carrusel vacío/roto en tenants nuevos).

### 9.3 Carrusel "Propiedades destacadas"

- **Decisión de datos importante:** el modelo no tiene un rating por propiedad, solo por corredor (`ValoracionCorredor` → `Tenant`). En vez de inventar un campo nuevo (fuera de alcance de un maquetado) o mostrar "mejor valoradas" sin sustento real, las propiedades se ordenan por **el rating del corredor asociado** (mostrado como badge en la tarjeta junto al nombre del corredor) y, en empate/ausencia de rating, por fecha de publicación descendente. La disponibilidad ya está garantizada por el filtro (`propiedad.estado = "disponible"`), no hace falta "priorizar" aparte.
- Si se quiere un rating real por propiedad a futuro, requiere: nuevo modelo `ValoracionPropiedad` (o campo en `Propiedad`), flujo de captura (¿mismo token de valoración post-contrato?) y migración — alcance de una sesión dedicada, no de este maquetado.
- Botón → `/marketplace/{publicacionId}` (ficha real), con badge "Disponible" siempre visible (todas las propiedades listadas aquí lo están, por el filtro de la query).

### 9.4 Footer profesional

`PublicFooter` pasó de una sola fila (logo + 2 links + año) a 4 columnas: Marca (+ badge Ley 21.719), Producto, Cuenta, Legal + CTA. Se usaron **solo enlaces internos reales** (`/marketplace`, `/portal`, `/login`, `/registro`, `/recuperar-contrasena`, `/terminos-uso`, `/privacidad`) — deliberadamente no se agregaron redes sociales ni un correo de contacto porque no existen todavía en el producto; agregarlos habría significado inventar URLs/direcciones falsas. Fondo migrado a `--pf-surface-glass` + blur, consistente con `.pf-navbar`.

### 9.5 Extensión al marketplace ("sitio público en general")

Se agregó un acento `.pgo-aurora-layer` (opacidad reducida) al hero de `/marketplace`, superpuesto al gradiente existente sin reemplazarlo — mismo lenguaje visual, riesgo mínimo sobre una página ya verificada extensamente. **No se aplicó** a la grilla de tarjetas del marketplace ni al cuerpo de la ficha de propiedad (`/marketplace/[id]`): son vistas densas en datos/texto, y la regla ya documentada en `globals.css` ("nunca detrás de texto largo o formularios densos") sigue aplicando. Páginas legales y portal de autoconsulta quedan fuera de esta segunda capa por el mismo criterio.

### 9.6 Componentes nuevos

`components/public/`: `Carousel.tsx` (scroll nativo + snap, flechas de conveniencia, sin dependencias externas), `RatingStars.tsx`, `CorredorCard.tsx`, `PropiedadDestacadaCard.tsx`.

### 9.7 Verificación

`tsc --noEmit` limpio en cada paso. Verificado en navegador: home en Aurora Dark/Light y mobile (375px); carrusel de corredores con datos reales insertados temporalmente y removidos tras confirmar el render; flujo completo carrusel → filtro de marketplace → banner de filtro; navbar consciente de sesión (logueado y anónimo) en home, marketplace y ficha de propiedad, sin regresiones.
