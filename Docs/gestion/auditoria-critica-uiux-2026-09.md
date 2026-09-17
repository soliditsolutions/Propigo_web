# Auditoría crítica de UI/UX — sección por sección

> **Objetivo:** el usuario pidió ser "el peor crítico" del producto, sección
> por sección, preguntando en cada una: ¿se puede mejorar? ¿falta algo? ¿es
> demasiado simple? ¿hay algún efecto/técnica de punta que la lleve a un
> nivel top-tier (Linear/Vercel/Stripe/Aceternity/Magic UI)?
>
> **Método:** consulta a la base de datos de diseño del skill
> `ui-ux-pro-max` (patrones de landing, presets de motion/GSAP con
> parámetros exactos), recorrido real en navegador (desktop ≥1024px,
> "casi-desktop" 824px, mobile 375px) con medición empírica (no solo
> capturas — `getBoundingClientRect`, `getComputedStyle`, muestreo estable
> en el tiempo) y lectura del código de cada componente. Cada hallazgo de
> esta lista fue verificado antes de reportarlo — no es una lista de
> impresiones.
>
> _Creado 2026-09-16._

---

## 0. Antes de la lista: un falso positivo descartado (ejemplo de rigor)

Al probar el `ScrollWalkthrough` en el ancho nativo del panel de navegador
(824px, justo bajo el breakpoint de 1024px que activa el modo "pinneado"),
capturé un frame donde el encabezado "Lo que hace por ti" aparecía tapado en
un 77% por el navbar sticky. Medí la posición de forma estable durante 2
segundos (6 muestras) para descartar que fuera un fotograma de animación a
medio camino — seguía fija. Antes de reportarlo como bug, verifiqué la causa:
a 824px el componente cae a su **modo apilado** (`isDesktopMq: false`), que
es scroll normal del documento sin ningún snapping — lo que había capturado
era simplemente un punto de tránsito de un scroll discreto de prueba, no un
estado de reposo real. Con scroll continuo (como haría cualquier persona) el
encabezado pasa por ahí y sigue, igual que en cualquier sitio con navbar
sticky. **No es un bug.** Reprobé a 1100px (modo pinneado real) y el
`padding-top: calc(var(--hw-navbar-h) + 4px)` que ya existe en el CSS
funciona exactamente como está documentado — el encabezado queda perfectamente
legible bajo el navbar. Lo dejo registrado porque es exactamente el tipo de
conclusión apresurada que un análisis menos cuidadoso habría reportado como
"hallazgo".

---

## 1. Navbar pública

**Bien:** píldora glass centrada, logo, toggle de tema, grid de 3 columnas
simétrico.

**Nota, no bug:** colapsa a hamburguesa bajo 1024px. Es un umbral razonable,
pero significa que cualquier ventana de navegador no maximizada en un laptop
(p. ej. 900-1000px) ve la versión mobile del nav, no la de escritorio. No lo
marco como defecto — es una decisión de umbral válida — pero vale la pena
saber que "desktop" en este proyecto empieza más tarde de lo que uno
asumiría.

**Oportunidad menor:** no hay indicador de "sección activa" (scroll-spy)
cuando el walkthrough está en modo apilado (mobile/<1024px) — sí lo hay en
modo pinneado (la píldora del stop activo se resalta). Bajo impacto.

---

## 2. Hero + Scroll Walkthrough — la pieza más ambiciosa del sitio

Esto ya es ingeniería de punta: `requestAnimationFrame` +
`IntersectionObserver` hechos a mano (sin GSAP ni ninguna librería), con
crossfade entre 4 escenas, amplificación de rueda, snapping magnético al
soltar, Y un fallback apilado accesible para mobile/`prefers-reduced-motion`/
sin JS que **nunca esconde contenido** (documentado explícitamente en el CSS:
"nunca se esconde contenido que el JS después no vaya a poder revelar"). Es
más sofisticado que lo que la mayoría de SaaS con presupuesto de diseño
dedicado implementa, y sin la dependencia de ~40kb que GSAP habría agregado.
**No recomiendo tocar la arquitectura de esto.**

**Oportunidades reales, con técnica concreta:**

- **Stop "Nuestros Planes"**: es la única parada pensada para una decisión de
  compra (no storytelling emocional), pero hereda el mismo tratamiento
  fotográfico + glass que las paradas narrativas. En productos top-tier
  (Stripe, Linear, Vercel) las tablas de precios casi siempre usan un fondo
  **más calmo y de mayor contraste** que el resto de la landing — es
  precisamente el momento donde el usuario necesita comparar cifras sin
  ruido visual detrás. Sugerencia: un fondo sólido/gradiente de marca propio
  para este stop, sin la foto compartida con las demás paradas.
- **Stop "Destacado"**: con pocos resultados sembrados (hoy 1 propiedad) el
  panel glass queda con mucho espacio vacío a la derecha — el layout no se
  adapta bien a baja densidad. Con más listings esto se resuelve solo, pero
  conviene que el contenedor del carrusel tenga un ancho ligado al número de
  tarjetas (o quede centrado) cuando hay menos de 3 ítems.
- **Count-up en los precios de los planes**: hoy "0,25 UF" aparece de golpe.
  Un conteo ascendente de ~300-400ms al entrar en viewport (mismo principio
  que el preset "Stagger List — Standard" del catálogo de motion, adaptado a
  un solo número) es una firma reconocible de landing pages financieras de
  alto nivel (Stripe, Mercury, Ramp).
- **La foto del hero** (interior genérico, puerta) es correcta pero
  "stock-y" — no es un problema de código, es una decisión de producción de
  contenido (fotografía propia vs. banco de imágenes). Lo señalo pero queda
  fuera del alcance de esta sesión.

---

## 3. Tarjetas de features ("Contratos y reajustes…", etc.)

Iconografía con fondo glass redondeado, copy específico y no genérico (ya
evaluado en la auditoría anterior). No pude verificar el estado `:hover` de
forma confiable con automatización de navegador — el código ya tiene
`.hw-card-hover` tokenizado (lift + sombra), pendiente confirmar visualmente
si estas 3 tarjetas puntuales lo usan.

---

## 4. Marketplace (listado)

**Bien:** buscador como elemento principal del hero, chips de filtro,
categorías por tipo — calza exactamente con el patrón "Marketplace/Directory"
de la guía de referencia (*"Search bar is the CTA. Reduce friction to
search."*).

**Bloqueador real para seguir evaluando esta sección:** hoy solo hay **una**
publicación sembrada, sin imagen (cae a un ícono por tipo de propiedad — buen
detalle de diseño, no es un bug). No pude ver cómo se comporta una grilla
real de 10-20 tarjetas con fotos, que es el 90% de la experiencia real de un
marketplace (grid responsivo, densidad, hover, cómo escala el carrusel del
home con más ítems). **Cualquier ajuste visual al grid ahora sería
especulativo.** Recomiendo sembrar 8-10 propiedades con imágenes antes de
seguir puliendo esta sección específica.

---

## 5. Ficha de propiedad

**Bien:** jerarquía correcta — precio + CTA "Contactar al corredor" en
sidebar sticky, enlace de "Reportar esta publicación o corredor" visible
(confianza/seguridad, coincide con el patrón de la guía). Breadcrumb
funcional.

**Oportunidad:** el estado sin imagen es un ícono plano sobre fondo liso
(gris/negro inerte). El proyecto ya tiene `.hw-aurora-bg` (blobs animados,
"usar con moderación" según su propio comentario) — un fondo sutil tipo
textura en vez de un rectángulo vacío se sentiría más cuidado en el estado
vacío, sin inventar nada nuevo.

---

## 6. Login / Registro / Portal (autenticación)

Consistencia visual real entre las tres superficies (misma familia de foto
lifestyle + card glass), copy claro, sellos de confianza ("Acceso seguro ·
Ley 21.719"). Sin hallazgos nuevos — ya cubierto por el fix de fuente y el
`h-dvh` de la auditoría anterior.

---

## 7. Panel — Dashboard "Resumen" — la sección con más retorno por esfuerzo

Esta es, con diferencia, la pantalla que más usa el cliente que paga (un
corredor la abre cada mañana), y es donde encontré el mayor margen de mejora
**con el menor esfuerzo**, porque las piezas ya existen en el proyecto y no
requieren ninguna dependencia nueva:

- **Sparklines en las tarjetas KPI**: `recharts` ya es una dependencia
  instalada (confirmado en `package.json`) pero no se usa en ninguna parte de
  `apps/web/src/app/panel/` hoy — está reservado para `estadisticas/`. Las 4
  tarjetas de `panel/page.tsx` ("Por cobrar", "En recaudación", "Contratos
  vigentes", "Gasto común") son número + label, sin tendencia. Linear, Vercel
  y Stripe muestran sistemáticamente una mini-serie de 7-14 días junto al
  número principal. Con `recharts` ya instalado esto es agregar un
  componente, no una librería.
- **Tokens de glow ya existentes, sin aplicar acá**: `--hw-glow-primary` /
  `--hw-glow-teal` / etc. existen en `globals.css` y ya se usan en
  `panel/cobros/cobros-client.tsx`, pero no en las tarjetas KPI del
  dashboard principal — que son justo las que tienen un acento de color
  semántico (rojo/azul/verde/morado) pidiendo ese refuerzo visual. Es aplicar
  un token que ya existe, no diseñar uno nuevo.
- **Count-up de los montos al cargar**: mismo principio que en la sección de
  planes, con más impacto real acá por ser la primera pantalla del día.

---

## 8. Footer

Correcto y deliberadamente honesto (sin redes sociales inventadas, ya
evaluado en la sesión anterior). Es utilitario por diseño — no compite por
atención y no debería. No amerita más inversión.

---

## Síntesis — dónde está realmente el techo

La mayor parte del sitio **ya opera cerca del nivel top-tier** que pide la
guía original: tokens de diseño maduros, dark mode robusto, animaciones ya
restringidas a transform/opacity, accesibilidad con buena cobertura,
ingeniería de scroll-storytelling hecha a mano sin dependencias. La brecha
real no está dispersa — se concentra en tres bolsillos concretos:

1. **El dashboard del panel** (`panel/page.tsx`) — mayor impacto percibido,
   menor riesgo, cero dependencias nuevas (todo lo necesario ya está
   instalado o tokenizado).
2. **El stop de precios del walkthrough** — un ajuste de fondo, CSS puro.
3. **El marketplace** — bloqueado por falta de datos de prueba realistas
   (imágenes + volumen), no por el código.

---

## Plan propuesto, en orden de retorno sobre esfuerzo

1. **Dashboard**: sparklines con `recharts` + aplicar los tokens `--hw-glow-*`
   ya existentes a las tarjetas KPI + count-up de los montos al cargar.
2. **Stop "Nuestros Planes"**: fondo propio sin foto compartida (CSS puro,
   sin riesgo).
3. **Estado vacío de imagen** en marketplace/ficha: textura sutil en vez de
   rectángulo inerte (CSS puro).
4. **Sembrar 8-10 propiedades con imágenes** en el seed de desarrollo, antes
   de cualquier ajuste adicional al grid del marketplace.
5. *(Fuera de alcance de código)* fotografía propia para el hero — decisión
   de producción de contenido, no de ingeniería.

---

## Resultado de la ejecución (2026-09-16)

El usuario aprobó el plan completo. Antes de tocar el dashboard (punto 1),
leí el código de `panel/page.tsx`, `components/panel/ui.tsx` y
`components/panel/animated-number.tsx` — y dos de las tres recomendaciones
de ese punto resultaron **ya implementadas**, con más sofisticación de la
que las capturas de pantalla dejaban ver:

- **Count-up de los montos**: ya existe (`AnimatedNumber`, easeOutCubic,
  respeta `prefers-reduced-motion`). Mi captura simplemente lo agarró
  después de que la animación de 700ms ya había terminado.
- **Glow semántico en las tarjetas KPI**: ya existe y es más elaborado de lo
  que pedí — `.hw-card-glow` (radial-gradient ambiental + doble box-shadow
  con `color-mix`, más intenso al hover) y `.hw-sheen` (barrido de luz),
  ambos ya aplicados en `StatCard`.
- **Sparklines**: sí es un hueco real (`recharts` no se usa en `panel/`,
  solo en `estadisticas/`), pero investigar el porqué reveló algo más
  importante: **`estadisticas/` está gateada por plan** (`getAnalyticsTier`).
  Agregar gráficos a `panel/page.tsx` —que ven **todos** los planes—
  regalaría gratis una vista previa de una función paga. Es una decisión de
  producto/monetización, no de diseño, así que **no se implementó** sin
  consultarlo primero.

Los puntos 2, 3 y 4 sí se ejecutaron:

- **Punto 2** — `ScrollWalkthrough`: `WalkStop.image` pasa a opcional; la
  parada "Nuestros Planes" ya no comparte foto con las 3 narrativas, cae al
  mismo `.hw-aurora-layer` que login/registro. Ajustado el conteo de
  `framesReady` para no esperar por una foto que no existe. Commit `f5e6e47`.
- **Punto 3** — `.pf-img-empty`: textura de puntos reemplaza el rectángulo
  liso en los 3 lugares que duplicaban el estado "sin fotos" (tarjeta del
  home, grilla de marketplace, ficha de propiedad). Mismo commit.
- **Punto 4** — `prisma/seed-demo-propiedades.ts` (`npm run
  db:seed-demo-propiedades`, idempotente, aditivo — no toca lo ya sembrado):
  6 propiedades nuevas, no 8-10 — el tenant demo cae en plan Bronze efectivo
  (cupo 10; ya tenía 4) y sembrar más habría roto el contador "X/10" del
  panel o requerido tocar el plan del tenant, fuera de alcance. Sin fotos
  reales: sin acceso de red confiable desde este entorno para bajar
  imágenes con licencia clara — pero el volumen ya alcanzó para verificar
  el grid real (7 tarjetas, 3 columnas, sin roturas) y el carrusel
  "Destacado" del home (antes 1 tarjeta con mucho vacío, ahora 4-5 visibles
  llenando el panel, confirmando que el problema era de datos, no de
  layout).

Suite completa 917/917 en cada paso, typecheck y lint limpios. El punto 5
(fotografía propia del hero) sigue fuera de alcance de código.

---

## Pendiente — pasada de responsive/mobile completa (reportado 2026-09-16)

El usuario reportó, para revisar en la sesión del 2026-09-17: **"la versión
mobile en general se ve bastante mal — textos mal centrados, párrafos
corridos, títulos, cards, botones mal orientados."**

Contexto importante: los chequeos mobile puntuales que hice durante esta
sesión (hero/home a 375px, dashboard del panel con `h-dvh`, la grilla del
marketplace, el formulario de alertas personalizadas, "Mi Plan") se vieron
bien en cada caso. Eso significa que **el problema no está necesariamente en
lo que toqué hoy** — es una impresión general del usuario sobre el producto
completo, así que puede estar en pantallas que no revisé a fondo en mobile:

- Login / registro / recuperar-contraseña / verificar-dispositivo (páginas de
  auth, con su layout de card sobre foto).
- Contratos, Cobros, Vouchers, Estadísticas, Equipo (secciones densas del
  panel, con tablas que capaz no colapsan bien a columna única).
- El portal del arrendatario completo (`/portal/*`), no solo la pantalla de
  login que ya se vio.
- Ficha de propiedad del marketplace y el flujo de contacto/denuncia.

**Para la próxima sesión:** conviene un recorrido sistemático a 375px (y
quizás 768px, tablet) página por página — no una corrección puntual sobre la
misma media docena de pantallas ya revisadas — para encontrar los casos
reales de texto mal centrado, párrafos sin `max-width` que corren de borde a
borde, y botones/cards que no se reordenan en columna. Sin ese recorrido
todavía no hay una lista concreta de qué corregir.
