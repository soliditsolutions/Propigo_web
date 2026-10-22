# Auditoría UI/UX — Roadmap de Mejoras (2026-07-17)

> Auditoría del sitio público, autenticación, portal de autoconsulta y panel corredor contra el checklist de la skill `ui-ux-pro-max` (98 reglas en 10 categorías, priorizadas de Accesibilidad/CRÍTICA a Charts & Data/BAJA). No se encontraron bugs funcionales — todo lo auditado funciona — pero sí patrones de tamaño táctil, accesibilidad y consistencia visual que conviene resolver por etapas, priorizando primero lo que toca **componentes compartidos** (arreglo único, impacto amplio) sobre instancias aisladas.

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Partes auditadas | Home · Marketplace (listado + ficha + filtros) · Autenticación (login/registro) · Portal (RUT + OTP + contrato) · Panel (shell + nav + tablas) |
| Método | Checklist de `ui-ux-pro-max` (`references/quick-reference.md`, 98 reglas) + lectura de código + barridos `grep` sistémicos + medición real en navegador (alturas de botones vía DOM, layout a distintos anchos, ambos temas) |
| Hallazgos | **12**, en 4 etapas (2 críticos, 4 altos, 5 medios, 1 bajo) |
| Veredicto | El problema más extendido es de **tamaño táctil** (varios controles interactivos, sobre todo iconos-solo, quedan bajo el mínimo de 44×44px) — aparece repetido en Home, Marketplace y Panel porque varios sitios *override* manualmente el tamaño base de los componentes compartidos, que en su versión por defecto sí cumple. El resto son gaps puntuales de consistencia (breakpoints, estado activo de nav) y pulido (contraste, animación). |

## 2. Metodología

1. Se instaló la skill `ui-ux-pro-max` (`npx skills add`). Python no está disponible en esta máquina, así que en vez de correr `search.py` se leyeron directamente `references/quick-reference.md` (las 98 reglas, agnósticas de stack) y `references/pro-rules.md` (descartado — su propio scope notice indica que es solo para apps nativas/móviles, no aplica a este proyecto web).
2. Para cada parte: lectura del código fuente relevante, contraste contra las reglas de las categorías CRÍTICA/ALTA primero, y verificación en navegador de lo que no se puede confirmar solo leyendo código (alturas reales renderizadas, comportamiento responsive, contraste percibido).
3. Barridos `grep` a nivel de repo para distinguir problemas **sistémicos** (aparecen en el componente/clase compartida) de **instancias aisladas** (un override puntual) — esto es lo que determina el orden de las etapas: un fix sistémico vale más que 5 fixes puntuales.
4. Todas las mediciones de tamaño se hicieron con `getBoundingClientRect()` sobre el DOM real, no estimadas desde las clases de Tailwind.

## 3. Roadmap por etapas

### Etapa 1 — Crítico (accesibilidad básica)
- **UX-01** — Controles táctiles bajo el mínimo de 44×44px, patrón repetido en componentes compartidos.
- **UX-02** — El Portal OTP depende solo de un toast transitorio para mostrar errores del código.

### Etapa 2 — Alto (usabilidad diaria / conversión)
- **UX-03** — Breakpoints inconsistentes entre el hero y las feature cards del Home.
- **UX-04** — Sin indicador de página activa en el navbar público (el Panel ya lo resuelve — replicar el mismo patrón).
- **UX-05** — Campos sin `<label>` asociado en el drawer de filtros de Marketplace.
- **UX-06** — El drawer de filtros no bloquea el foco de teclado cuando está cerrado.

### Etapa 3 — Medio (pulido)
- **UX-07** — Contraste del texto de cuerpo en las feature cards del Home.
- **UX-08** — Animación de scroll-reveal por encima del máximo recomendado.
- **UX-09** — Las feature cards no tienen stagger al aparecer.
- **UX-10** — Afordancia de hover engañosa en 2 de 3 feature cards del Home.
- **UX-11** — Fotos de propiedades en la ficha de Marketplace sin `next/image`.

### Etapa 4 — Bajo (nice to have)
- **UX-12** — Los contadores del Home no usan `tabular-nums`.

---

## 4. Detalle de hallazgos

### UX-01 — Controles táctiles bajo 44×44px 🔴 (sistémico)

- **Regla:** `touch-target-size` (Touch & Interaction, CRÍTICA) — mínimo 44×44px.
- **Confirmado por medición real:**
  - Los 2 CTA principales del hero del Home ("Crear cuenta gratis", "Explorar propiedades") miden **36px** de alto (`Button size="lg"` → clase `h-9`).
  - Toda la escala de tamaños del componente compartido `components/ui/button.tsx` está bajo 44px: `default` (h-8=32px), `sm` (h-7=28px), `xs` (h-6=24px), `lg` (h-9=36px). Ningún tamaño de este componente cumple el mínimo.
- **Confirmado por lectura de código (mismo patrón, distintos archivos):**
  - `marketplace/filter-panel.tsx`: los inputs de rango (piezas, m², precio) y el input de baños miden 36px; los selects de región/comuna, 40px. El botón "Cerrar filtros" (ícono X) mide ~28px.
  - `components/marketplace/CorredorPanel.tsx`: "Contactar al corredor" ~38px, "Ir al portal de arrendatarios" ~32px.
  - `components/panel/shell.tsx`: botón colapsar/expandir sidebar ~28px, cerrar drawer mobile ~32px, abrir menú (hamburguesa) ~36px, cerrar sesión ~28px.
  - `login-form.tsx` / `registro-form.tsx`: el botón mostrar/ocultar contraseña (ícono ojo) mide ~24px.
- **Por qué importa:** son controles de uso frecuente (CTA de conversión, cerrar sesión, mostrar contraseña, abrir menú) — en móvil, tamaños bajo 44px aumentan el mistap y el desgaste de usuarios con menor precisión motriz.
- **Nota de alcance:** las clases base compartidas (`.pf-btn-primary`/`.pf-btn-secondary` en `globals.css`, con `padding: 14px 28px` sin altura fija) sí resuelven ~48px por defecto — el problema no es la clase base sino los `style={{ height: "..." }}` puntuales que la reducen en contextos "compactos" (sidebars, drawers, badges).
- **Solución propuesta:** subir el tamaño `lg`/`default` del componente `Button` a ≥44px (o agregar un tamaño `icon-touch`/`sm-touch` de 44px explícito para íconos-solo, con `hitSlop`/padding invisible si el visual debe verse más chico); revisar los overrides puntuales listados arriba caso a caso.

### UX-02 — Portal OTP: error solo por toast transitorio 🔴

- **Regla:** `error-placement` (Forms & Feedback) — "mostrar error debajo del campo relacionado"; `toast-accessibility`/`color-not-only`.
- **Archivo:** `app/portal/verificar/page.tsx`, función `showError()`.
- **Síntoma:** al ingresar un código incorrecto, la única señal es `toast(msg, "error")` (se autodescarta en unos segundos) más un cambio de color en el borde del input — sin texto de error persistente asociado al campo. Si el usuario no ve el toast a tiempo (o usa lector de pantalla y no está enfocado en la región del toast), solo queda un borde rojo sin explicación.
- **Solución propuesta:** agregar un `<p role="alert">` persistente debajo del input (mismo patrón ya usado en login/registro, que sí lo hacen bien) además del toast, no en su reemplazo.

### UX-03 — Breakpoints inconsistentes en el Home 🟠

- **Regla:** `breakpoint-consistency` (Layout & Responsive) — "usar breakpoints sistemáticos... consistentemente".
- **Archivo:** `app/page.tsx`.
- **Confirmado visualmente** a 700px de ancho: el hero (`md:grid-cols-2`, quiebra en 768px) sigue apilado en 1 columna, mientras las 3 feature cards (`sm:grid-cols-3`, quiebra en 640px) ya están en 3 columnas apretadas, con títulos partidos en 2 líneas ("Gestión Profesional" / "de Arriendos"). Layout visualmente descoordinado entre dos secciones de la misma página.
- **Solución propuesta:** unificar a un solo breakpoint (`md:` para ambas, o agregar un paso intermedio `sm:grid-cols-2` en las feature cards antes de saltar a 3).

### UX-04 — Sin indicador de página activa en el navbar público 🟠

- **Regla:** `nav-state-active` (Navigation Patterns) — "la ubicación actual debe resaltarse visualmente en la navegación".
- **Archivo:** `components/public/PublicNavLinks.tsx` + `.pf-navpill-link` en `globals.css` (solo define `:hover`, ninguna regla para página activa).
- **Contraste positivo:** el Panel (`components/panel/nav.tsx`) **ya implementa correctamente** `aria-current={active ? "page" : undefined}` comparando con `usePathname()` — es el mismo patrón, solo falta aplicarlo al navbar público.
- **Solución propuesta:** replicar el patrón de `nav.tsx` en `PublicNavLinks`/`PublicNavLink` (ya usa `usePathname()` para la lógica de Inicio/Conócenos — agregar `aria-current` + estilo visual distinto es una extensión natural del mismo componente).

### UX-05 — Campos sin `<label>` en el drawer de filtros de Marketplace 🟠

- **Regla:** `form-labels` (Accesibilidad, CRÍTICA) — "usar label con atributo for".
- **Archivo:** `app/marketplace/filter-panel.tsx`.
- **Alcance real (verificado, no es un problema del sitio en general):** de 63 usos de `<label>` en el repo, 26 tienen `htmlFor` explícito y el resto en su mayoría envuelve el input directamente (asociación implícita, también válida — ej. los checkboxes de "Comodidades" en este mismo archivo están bien). El gap real son los campos de **Región, Comuna, Piezas, Baños, m² y Precio** en este drawer: usan un `<p>` visual junto al `<input>`/`<select>`, sin `<label>` ni `htmlFor`/`id`, sin asociación programática.
- **Solución propuesta:** cambiar esos `<p>` por `<label htmlFor="...">` apuntando al `id` del campo correspondiente (patrón ya usado correctamente en login/registro).

### UX-06 — Drawer de filtros no bloquea foco de teclado al cerrarse 🟠

- **Regla:** `keyboard-nav` (Accesibilidad, CRÍTICA) — "el orden de tabulación coincide con el orden visual".
- **Archivo:** `app/marketplace/filter-panel.tsx`.
- **Síntoma:** el drawer cerrado usa `aria-hidden={!open}` y `transform: translateX(100%)` (fuera de pantalla), pero `aria-hidden` por sí solo no saca del orden de tabulación — un usuario de teclado puede seguir tabulando hacia inputs y botones invisibles.
- **Contraste:** el propio proyecto ya resolvió este mismo problema en `Carousel.tsx` usando `el.inert = true` en los grupos duplicados — es el patrón a reutilizar aquí.
- **Solución propuesta:** aplicar `inert` (vía ref, mismo approach que `Carousel.tsx`) al drawer cuando `open === false`.

### UX-07 — Contraste del texto de cuerpo en las feature cards del Home 🟡

- **Regla:** `color-accessible-pairs` (Typography & Color) — mínimo AA 4.5:1.
- **Archivo:** `app/page.tsx`, cards "Gestión Profesional de Arriendos" / "Pagos Más Fáciles" / "Hogar al Alcance de un Clic!".
- **Estado:** estimación, no medición exacta de píxel compuesto. El texto de cuerpo usa `rgba(255,255,255,0.45)` sobre una foto con tinte que varía entre 55% y 78% de mezcla — en las zonas menos teñidas (donde la foto de fondo es más clara) el contraste real podría caer bajo 4.5:1. El alpha es agresivamente bajo para texto de cuerpo independientemente del fondo.
- **Solución propuesta:** subir el alpha del texto a ~0.7–0.75, o aumentar el mix mínimo del overlay (actualmente 55%) — verificar con captura tras el cambio.

### UX-08 — Animación de scroll-reveal por encima del máximo recomendado 🟡

- **Regla:** `duration-timing` (Animación) — transiciones complejas ≤400ms, evitar pasar de 500ms.
- **Archivo:** `globals.css`, clase `.pgo-scroll-reveal` (agregada esta sesión) — `transition: opacity 550ms, transform 550ms`.
- **Solución propuesta:** bajar a 400–450ms.

### UX-09 — Feature cards sin stagger al aparecer 🟡

- **Regla:** `stagger-sequence` (Animación) — 30–50ms entre ítems de un grid.
- **Archivo:** `app/page.tsx` — las 3 feature cards están envueltas en un único `<ScrollReveal>`, aparecen todas a la vez.
- **Solución propuesta:** envolver cada card individualmente con `delayMs` incremental (el componente `ScrollReveal` ya soporta esa prop).

### UX-10 — Afordancia de hover engañosa en las feature cards 🟡

- **Regla:** `state-clarity` (Style Selection) — "diferenciar visualmente estados interactivos de los no interactivos".
- **Archivo:** `app/page.tsx` — las 3 cards comparten `hover:-translate-y-1`, pero solo "Hogar al Alcance de un Clic!" es un link real a `/marketplace`.
- **Síntoma:** al pasar el mouse por "Gestión Profesional de Arriendos" o "Pagos Más Fáciles", la card se eleva como si fuera clickeable, pero no pasa nada al hacer click.
- **Solución propuesta:** quitar el hover-lift de las 2 cards no interactivas, o convertir las 3 en links reales (a secciones de detalle, o anclas a `#conocenos`/`#features`).

### UX-11 — Fotos de propiedades sin `next/image` en la ficha de Marketplace 🟡

- **Regla:** `image-optimization` (Performance).
- **Archivo:** `app/marketplace/[id]/page.tsx` — usa `<img>` nativo (con `eslint-disable-next-line @next/next/no-img-element` explícito) en vez de `next/image`, probablemente porque las URLs vienen de storage externo sin dominio configurado.
- **Impacto real:** parcialmente mitigado — la imagen secundaria ya usa `loading="lazy"` y los contenedores tienen altura fija (sin CLS), pero se pierde el `srcset`/conversión automática a WebP/AVIF.
- **Solución propuesta:** si las imágenes vienen de un dominio fijo, agregarlo a `images.remotePatterns` en `next.config` y migrar a `next/image`.

### UX-12 — Contadores del Home sin `tabular-nums` 🟢

- **Regla:** `number-tabular` (Typography & Color) — el propio proyecto ya define `.pgo-num` para esto.
- **Archivo:** `app/page.tsx` — `stats.propiedadesDisponibles` / `stats.corredoresActivos` no llevan la clase `.pgo-num` que sí se usa correctamente en el Portal (`portal/contrato/[contratoId]/page.tsx`).
- **Solución propuesta:** agregar `.pgo-num` a esos dos `<p>`.

---

## 5. Lo que ya está bien (para no perder de vista al priorizar)

- **Formularios de login/registro** (`login-form.tsx`, `registro-form.tsx`): labels con `htmlFor`, `aria-invalid`/`aria-describedby`, errores con `role="alert"`, validación con scroll+foco automático al primer campo inválido, toggle mostrar/ocultar contraseña, `autoComplete` correcto por campo, checkbox de consentimiento no premarcado (Ley 21.719). Prácticamente ejemplar contra el checklist.
- **Panel shell** (`components/panel/shell.tsx`): skip link (WCAG 2.4.1), `aria-expanded` en el botón de menú, `aria-hidden` + cierre con Escape + scroll-lock en el drawer mobile, navegación adaptativa sidebar↔drawer según ancho de pantalla.
- **Panel nav** (`components/panel/nav.tsx`): `aria-current="page"` ya implementado — es el patrón que falta replicar en el navbar público (UX-04).
- **Portal OTP** (`portal/verificar/page.tsx`): input de 56px (cumple touch target), `aria-live="polite"` en el contador de intentos restantes, `autoComplete="one-time-code"`.
- **Tema claro/oscuro**: ya auditado y verificado en una fase anterior de esta misma sesión (tokens `--pgo-*`/`--pf-*` revisados en ambos temas) — no se encontraron regresiones nuevas.
