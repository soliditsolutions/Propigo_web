# Sistema de Diseño UI (Propigo)

> Documento vivo. Última actualización: 2026-06-05  
> Basado en: investigación de tendencias 2026, guías Vercel Web Interface, auditoría completa del código actual.

---

> ⚠️ **Nota de estado (2026-07-27).** Las secciones 1-8 de abajo son la **propuesta original** (auditoría + plan v2, jun 2026) y quedaron desactualizadas: la paleta de la sección 4.2 (azul `#2563EB`, sidebar navy fijo, "dark mode → Fase 2") es la que se **reemplazó** por el tema dual **Aurora** (índigo `#6366F1`/`#4F46E5` + acentos teal/violeta, light y dark ambos completos — ver `Docs/gestion/fase2-aurora-sitio-completo-2026-07.md`). Se conserva como registro histórico de cómo se llegó hasta acá, no como referencia de tokens vigente.
>
> **Fuente de verdad de tokens hoy:** `apps/web/src/app/globals.css` (bloques `:root[data-theme="aurora-dark"]` / `:root[data-theme="aurora-light"]`) — leer el CSS directamente antes de asumir un valor de este documento. Este archivo tiene una reescritura completa pendiente para reflejar Aurora; mientras tanto, la sección **9 (nueva, abajo)** documenta las piezas agregadas en la sesión del 2026-07-27 sobre el sistema Aurora ya existente.

---

## 1. Fuentes consultadas y metodología

| Fuente | Relevancia |
|---|---|
| **Vercel Web Interface Guidelines** (github.com/vercel-labs) | Estándar de facto para Next.js — accesibilidad, formularios, animaciones, semántica |
| **SaaSUI 2026 Trends** (saasui.design) | 7 patrones dominantes en productos SaaS maduros |
| **Muzli Dashboard Examples 2026** (muz.li) | Paletas, layouts, tipografía en 50 dashboards reales |
| **DesignStudioUiUx — 12 Shifts 2026** | Mobile-first, micro-interacciones, progressive disclosure |
| **Shadcn/UI + Tailwind Ecosystem 2026** | Stack dominante para dashboards enterprise (11K+ stars) |
| **PropTech UX Agencies 2026** (bricxlabs, eleken) | Patrones específicos de real estate SaaS |
| **Dark Glassmorphism 2026** (Medium) | Tendencia visual y su aplicación práctica |

---

## 2. Tendencias clave 2026 — Lo que define los mejores productos

### 2.1 Calm Design (Linear, Vercel)
> "Less on screen. More in focus."

- **Qué es**: Ocultar lo no esencial por defecto. Mostrar complejidad progresivamente.
- **Cómo se ve**: Sidebar limpio, tablas sin bordes pesados, whitespace como elemento de diseño.
- **Impacto medido**: Menor churn en primeros 30 días cuando hay menos cognitive overload.

### 2.2 Confidence > Complexity
Los mejores SaaS B2B 2026 priorizan la **confianza del usuario** sobre la cantidad de features. El corredor debe sentir que tiene control total, no que está manejando una planilla.

### 2.3 Progressive Disclosure
- Estado inicial: vista limpia, acción principal clara.
- Filtros avanzados: colapsables (ya implementado ✓).
- Settings complejos: "avanzado" expandible.

### 2.4 Micro-interacciones como métricas de retención
- Animaciones de celebración en tareas completadas (liquidación cerrada ✓).
- Copy humano en estados vacíos.
- Feedback inmediato en cada acción.

### 2.5 Command Palette (Cmd+K)
Estándar esperado en toda herramienta B2B en 2026. Acceso a 200+ acciones desde teclado. **Pendiente — Fase 2.**

### 2.6 Tabular Data Excellence
Las plataformas financieras exitosas son mejores por sus tablas, no a pesar de ellas. Tablas con: sorting, filtros, columnas configurables, exportación.

### 2.7 URL-driven State
Filtros, tabs, paginación deben reflejarse en la URL para deep-linking. **Actualmente ausente — a corregir.**

---

## 3. Auditoría del estado actual — Hallazgos críticos

### 3.1 Violaciones de las guías Vercel (severidad alta)

| # | Archivo | Problema | Regla violada |
|---|---|---|---|
| 1 | `cobros-client.tsx:368` | `<div className="cursor-pointer">` con `onClick` | Use `<button>` for actions, not `<div onClick>` |
| 2 | `propiedades-client.tsx:164` | `<div className="pgo-card-hover cursor-pointer" onClick>` | Same — div con handler de click |
| 3 | Todos los archivos | Cero `aria-label` en botones de ícono (X, ChevronDown, Plus) | Icon-only buttons require `aria-label` |
| 4 | `cobros-client.tsx` feedback | Sin `aria-live="polite"` en mensajes de feedback | Async updates need `aria-live` |
| 5 | Global | `transition: all` en clase `.pgo-btn-transition` (globals.css) | Never use `transition: all` — list properties |
| 6 | Toda la app | Cero instancias de `tabular-nums` para columnas de montos | `font-variant-numeric: tabular-nums` for numbers |
| 7 | Toda la app | Sin `prefers-reduced-motion` en ninguna animación | Honor reduced motion |
| 8 | `cobros-client.tsx` inputs | `<input>` sin `autocomplete` ni `name` | Inputs need `autocomplete` and `name` |
| 9 | Toda la app | `text-wrap: balance` ausente en headings | Use `text-wrap: balance` on headings |
| 10 | URL | Filtros/tabs no reflejados en URL | URL reflects state |

### 3.2 Violaciones de severidad media

| # | Problema | Impacto |
|---|---|---|
| 11 | Valores hex hardcoded (`#1A3557`, `#2563EB`) en 40+ lugares | Sistema de tokens inexistente — cambiar un color requiere buscar y reemplazar |
| 12 | Modales (propiedades) con `div` fijo — no usan Radix Dialog | Sin trampa de foco, sin Escape handler nativo, sin accesibilidad |
| 13 | Tabs de cobros con `useState` custom — no usan Radix Tabs | Sin `role="tablist"`, sin navegación por teclado ←→ |
| 14 | Botón shadcn existente (`components/ui/button.tsx`) ignorado | Se construyeron botones manuales en lugar de usar el componente existente |
| 15 | Sin `min-w-0` en flex children con texto | Texto truncado incorrectamente en viewports angostos |
| 16 | Sin `loading="lazy"` en imágenes futuras | Performance subóptima cuando se agreguen imágenes |
| 17 | `select-none` en card headers de cobros | Impide texto seleccionable; mejores semánticas disponibles |

### 3.3 Lo que está bien (conservar)

| ✓ Bien | Detalle |
|---|---|
| Stack tecnológico | Next.js 16 + Tailwind v4 + shadcn/ui — gold standard 2026 |
| Sidebar oscuro | Patrón dominante en 2026, ya implementado |
| Sistema de tabs en cobros | UX correcto, solo falta accesibilidad |
| Filtros colapsables | Patrón de progressive disclosure correcto |
| CSS custom properties (hw-*) | Base correcta, necesita expansión |
| Build limpio + TypeScript | Cero errores, buena base |
| shadcn/ui instalado | Componentes accesibles disponibles, subutilizados |

---

## 4. Sistema de diseño propuesto — Propigo Design System v2

### 4.1 Filosofía
**"Confianza antes que features."** Un corredor chileno gestiona dinero ajeno. Cada pixel debe comunicar **orden, control y profesionalismo**. La estética es subordinada a la función, pero la función debe ser bella.

**Modo**: Light-mode primario con sidebar oscuro. Dark mode completo → Fase 2. Justificación: Chile empresarial opera en modo claro; agregar dark mode es +30% de trabajo y el ROI es bajo en MVP B2B.

### 4.2 Paleta de tokens — definitiva

```css
/* Fondo y superficies */
--pgo-page:       #EFF3F8   /* Azul muy suave — rompe el blanco puro */
--pgo-surface:    #FFFFFF   /* Cards, paneles */
--pgo-surface-2:  #F8FAFD   /* Table headers, rows alternas */

/* Sidebar */
--pgo-sidebar:        #0F1E35   /* Deep navy — más profundo que el actual */
--pgo-sidebar-hover:  rgba(255,255,255,0.07)
--pgo-sidebar-active: rgba(255,255,255,0.14)
--pgo-sidebar-text:   rgba(255,255,255,0.90)
--pgo-sidebar-muted:  rgba(255,255,255,0.45)

/* Bordes */
--pgo-border:     #E1EAF4   /* Azul muy suave */
--pgo-border-2:   #C8D9EE   /* Border más visible (inputs focus, separadores) */

/* Textos */
--pgo-text-1:     #0F172A   /* Slate-900 — headings, datos críticos */
--pgo-text-2:     #334155   /* Slate-700 — body text */
--pgo-text-3:     #64748B   /* Slate-500 — labels, metadata */
--pgo-text-4:     #94A3B8   /* Slate-400 — placeholders, muted */

/* Primario — azul de confianza financiera */
--pgo-primary:    #2563EB   /* Blue-600 */
--pgo-primary-dk: #1D4ED8   /* Blue-700 hover */
--pgo-primary-lt: #EEF2FF   /* Blue-50 backgrounds */
--pgo-primary-bd: #BFDBFE   /* Blue-200 borders */

/* Semánticos */
--pgo-danger:     #DC2626   /* Red-600 — mora, alertas críticas */
--pgo-danger-lt:  #FEF2F2
--pgo-success:    #059669   /* Emerald-600 — pagado, liquidado */
--pgo-success-lt: #ECFDF5
--pgo-warning:    #D97706   /* Amber-600 — pendiente, por cerrar */
--pgo-warning-lt: #FFFBEB

/* Elevación — sistema de 3 niveles */
--pgo-shadow-1:   0 1px 3px rgba(15,31,53,0.04), 0 4px 14px rgba(15,31,53,0.06);
--pgo-shadow-2:   0 4px 12px rgba(15,31,53,0.08), 0 12px 32px rgba(15,31,53,0.10);
--pgo-shadow-3:   0 12px 40px rgba(15,31,53,0.18);  /* Modales */

/* Radios */
--pgo-radius:     14px   /* Cards */
--pgo-radius-sm:  8px    /* Badges, inputs */
--pgo-radius-xs:  6px    /* Tags inline */

/* Transiciones — propiedades explícitas */
--pgo-dur-fast:   100ms
--pgo-dur-std:    180ms
--pgo-dur-slow:   300ms
--pgo-ease:       cubic-bezier(0.16, 1, 0.3, 1)  /* ease-out spring */
```

### 4.3 Tipografía

**Font stack**: Geist Sans (ya disponible en Next.js 16, sin dependencia externa)

```css
/* Escala */
--pgo-text-xs:   11px / 1.4
--pgo-text-sm:   13px / 1.5
--pgo-text-base: 14px / 1.6   /* Default UI */
--pgo-text-md:   15px / 1.5
--pgo-text-lg:   16px / 1.4
--pgo-text-xl:   18px / 1.3
--pgo-text-2xl:  22px / 1.25
--pgo-text-3xl:  28px / 1.2   /* KPIs */

/* Pesos */
400: body, metadata
500: labels, captions
600: UI text, table headers
700: headings, KPI values

/* Reglas obligatorias */
- tabular-nums: TODA columna numérica (montos, fechas, contadores)
- text-wrap: balance: todos los headings h1-h4
- Elipsis: … no ...
- Citas tipográficas: " " no " "
```

### 4.4 Sistemas de animación

```css
/* Animaciones permitidas (compositor-friendly) */
transform: translateX/Y/Scale
opacity

/* NO usar */
transition: all  → reemplazar por propiedades explícitas

/* prefers-reduced-motion obligatorio */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Duraciones por caso de uso */
Hover state:        100ms ease-out
Card lift:          180ms ease-out
Dropdown open:      200ms ease-out
Modal enter:        300ms spring
Toast enter:        250ms ease-out
Tab transition:     150ms ease-out
```

### 4.5 Componentes — plan de corrección

**Prioridad 1 — Accesibilidad (rompe estándares):**
| Componente | Acción |
|---|---|
| Cobros card header | Cambiar `<div onClick>` a `<button>` con `role="tab"` semántico |
| Propiedades cards | Cambiar `<div onClick>` a `<button>` o `<article>` con handler correcto |
| Todos los botones ícono | Agregar `aria-label` descriptivo |
| Feedback de cobros | Agregar `role="alert"` y `aria-live="polite"` |
| Modal de propiedades | Reemplazar por Radix UI `Dialog` (ya en shadcn) |
| Tabs de cobros | Reemplazar por Radix UI `Tabs` (ya en shadcn) |

**Prioridad 2 — Sistema de tokens:**
| Acción | Detalle |
|---|---|
| Migrar hex hardcoded | 40+ instancias → CSS variables `--pgo-*` |
| `transition: all` | → `transition: box-shadow, transform, opacity, border-color` |
| `tabular-nums` | Aplicar en: montos, fechas, contadores |
| `text-wrap: balance` | Aplicar en todos los headings |
| `min-w-0` | Agregar en todos los flex children con texto |

**Prioridad 3 — URL State:**
| Acción | Detalle |
|---|---|
| Tabs en cobros | Tab activo reflejado en `?tab=paso1\|paso2` |
| Filtros | Filtro activo en URL params |
| Beneficio | Deep-linking, back-button funcional |

**Prioridad 4 — Forms:**
| Acción | Detalle |
|---|---|
| `autocomplete="off"` | En inputs de monto/fecha de cobros |
| `name` attribute | En todos los `<input>` |
| `inputmode="decimal"` | En inputs de monto |
| Error inline | Mensajes de error junto al campo, no toast global |

---

## 5. Pantallas — diagnóstico por pantalla

### Dashboard (`/panel`)
| Problema | Solución |
|---|---|
| KPI cards sin jerarquía clara cuando todos son positivos | Card "Por cobrar" con highlight de urgencia condicional |
| Tabla sin sorting por columna | Sortable headers con indicador visual |
| Sin empty state si no hay períodos | Ilustración + CTA primer contrato |
| Sin indicador de "última actualización" | Timestamp en header de tabla |

### Propiedades (`/panel/propiedades`)
| Problema | Solución |
|---|---|
| Modal con `div` fijo — sin trampa de foco | Radix Dialog |
| Cards sin hover accessible (div) | `<article>` o `<button>` con role semántico |
| Sin link directo al contrato desde la propiedad | Botón "Ver contrato" en modal |
| Sin conteo de contratos activos vs totales | Metadata en card |

### Contratos (`/panel/contratos`)
| Problema | Solución |
|---|---|
| Tabla muy ancha, columnas no priorizadas | Columnas configurables o rediseño con cards |
| Sin sorting por columna | Headers sortables |
| Sin indicador visual de "próximo a vencer" | Badge rojo cuando `fechaFin < 90 días` |
| "Ver →" muy pequeño | Fila completa clickeable → detalle |

### Cobros (`/panel/cobros`)
| Problema | Solución |
|---|---|
| `<div onClick>` en card header | `<button>` con `aria-expanded` |
| Sin `aria-live` en feedback | `role="alert"` |
| Paso 1/2 sin indicador de progreso total | Barra de progreso "X de Y liquidados este mes" |
| Inputs sin `autocomplete` ni `name` | Agregar atributos |

### Detalle contrato (`/panel/contratos/[id]`)
| Problema | Solución |
|---|---|
| Ledger sin sorting ni filtro | Filtro por tipo de asiento |
| Sin botón "Ir a cobros" para períodos pendientes | CTA contextual en card de período atrasado |
| Garantía sin historial de movimientos | Expandir sección garantía con asientos GARANTIA_* |

---

## 6. Roadmap de implementación — priorizado

### Fase A — Fundación (2–3 sesiones) ← **Siguiente paso**
1. Migrar CSS tokens a variables definitivas (sección 4.2)
2. Corregir `div onClick` → `button` + `aria-*`
3. Agregar `tabular-nums`, `text-wrap: balance`, `min-w-0`
4. Agregar `aria-label` en todos los botones de ícono
5. `role="alert"` + `aria-live` en feedbacks
6. Reemplazar `transition: all` por propiedades explícitas
7. `prefers-reduced-motion` en globals.css

### Fase B — Accesibilidad de componentes (1–2 sesiones)
1. Modal propiedades → Radix Dialog (ya en shadcn)
2. Tabs cobros → Radix Tabs con keyboard nav
3. URL state para tabs y filtros principales
4. Form inputs con `autocomplete`, `name`, `inputmode`

### Fase C — Mejoras visuales (2 sesiones)
1. Tabla contratos → columnas con sorting
2. Badge "próximo a vencer" en contratos
3. Progress bar de liquidaciones en cobros
4. Empty states con ilustraciones simples
5. Timestamp "actualizado hace X min" en dashboard

### Fase D — Features avanzados (Fase 2)
1. Command palette Cmd+K
2. Dark mode completo
3. Tablas con columnas configurables
4. Notificaciones en tiempo real
5. Exportación CSV/Excel

---

## 7. Conclusiones del arquitecto

### Por qué no se hizo "bien desde el principio"

No es un fallo de implementación — es un fallo de proceso:

1. **Se construyó funcionalidad antes de sistema de diseño.** La secuencia correcta es: tokens → componentes → pantallas. Aquí fue al revés.

2. **shadcn/ui instalado pero ignorado.** Hay un `Button` accesible en `components/ui/button.tsx` que nunca se usa. Los botones se construyeron manualmente sin los atributos ARIA que shadcn provee.

3. **Accesibilidad tratada como opcional.** En Chile, la Ley 20.422 exige accesibilidad en servicios digitales. En un producto financiero que maneja PII sensible, la accesibilidad es también cumplimiento.

4. **CSS tokens parciales.** Se crearon variables `--pgo-*` pero se mezclaron con hex hardcoded. Un sistema de tokens debe ser exhaustivo o pierde su valor.

### El estándar al que apuntamos

Los productos de referencia (Linear, Stripe, Vercel Dashboard) comparten:
- Cero `div onClick` — todo interactivo es semánticamente correcto
- Tokens de color gestionados como código (no como valores mágicos)
- Cada número financiero en tabular-nums
- Animaciones que respetan al usuario (`prefers-reduced-motion`)
- URL que refleja el estado (filtros, tabs, páginas)

**El código que tenemos hoy es funcional y visualmente decente. El salto al siguiente nivel es sistemático, no cosmético.**

---

## 8. Adiciones sobre Aurora (2026-07-27) — sidebar del panel

El tema Aurora (ver nota de estado arriba) ya cubría sitio público/auth/portal. Esta sesión lo extendió al sidebar del **panel** corredor, que hasta entonces usaba `--pgo-sidebar*` (navy fijo, pensado solo para el aside de marca de login) y por eso "cambiar a claro" solo aclaraba la misma paleta oscura por transparencia — nunca hubo un diseño claro real para esa superficie.

### 8.1 Tokens nuevos — `--pgo-panel-nav-*` (themeados, en `globals.css`)

Paralelos a `--pgo-sidebar*` (que sigue existiendo intacto, solo para login/registro). Usados únicamente por `components/panel/shell.tsx` y `components/panel/nav.tsx`:

| Token | Rol |
|---|---|
| `--pgo-panel-nav-bg` | Base de color del panel (navy en oscuro / `--pgo-surface` blanco en claro) |
| `--pgo-panel-nav-border` | Borde del panel |
| `--pgo-panel-nav-text` / `--pgo-panel-nav-muted` / `--pgo-panel-nav-faint` | Jerarquía de texto (activo / label normal / subtítulo tenue) |
| `--pgo-panel-nav-surface` / `--pgo-panel-nav-surface-2` | Superficies internas (chips, avatar, botones de colapsar) — dos intensidades |
| `--pgo-panel-nav-hover-bg` / `--pgo-panel-nav-active-bg` | Estados de ítem de navegación |
| `--pgo-panel-nav-glow` | Color del glow del ítem activo (translúcido) |
| `--pgo-panel-nav-inset` | Highlight superior (efecto vidrio) del ítem activo |

### 8.2 Clases nuevas

- **`.pgo-panel-aside`** — vidrio del sidebar del panel (`background: color-mix(--pgo-panel-nav-bg, transparent)` + blur). Distinta de `.pgo-auth-aside` (fija oscura, solo login/registro) a propósito: misma técnica de vidrio, distinta relación con el tema.
- **`.pgo-sidebar-link`** — hover del ítem de navegación. `--pgo-sidebar-hover` estaba definido en los tokens desde el diseño original pero sin ningún consumidor.
- **`.pgo-beams-layer`** — fondo del sidebar en tema oscuro: franjas de luz irregulares (gradientes lineales con paradas hechas a mano, no `repeating-linear-gradient` — un patrón perfectamente periódico se lee como textura, no como luz) + `mask-image` para fundido vertical. Aproximación **CSS-only** de un componente "Beams" (React Bits, three.js/WebGL) evaluado y descartado: ~250 KB de bundle adicional solo para un fondo decorativo, y sin soporte nativo de `prefers-reduced-motion` (un loop de `requestAnimationFrame` no lo respeta automáticamente como sí lo hace una `animation` CSS). En tema claro cae al mismo blob suave de `.pgo-aurora-layer`.
- **`.pgo-cta-secondary`** (rediseñada, ya existía) — CTAs secundarios del hero del Home. Pasó de `--pgo-surface-glass` (~4% opacidad, casi invisible sobre el panel de vidrio del hero) a `color-mix(--pf-purple, --pgo-glass-card)` — mismo token que ya usa `.pgo-walk-panel` para "vidrio sobre foto", con tinte de marca.

### 8.3 Lección de arquitectura de tokens

Antes de reusar un token o clase "porque ya existe y se ve parecido", confirmar que el contexto de origen tiene la **misma relación con el tema** que el contexto nuevo. `--pgo-sidebar*` es fijo por diseño (el aside de login debe verse igual sin importar el tema del sitio visitante); el sidebar del panel es superficie de trabajo diaria y sí debe adaptarse. Mismo tipo de error, segunda instancia: `.pgo-scroll-dark` (scrollbar fijo oscuro) también asumía "el sidebar nunca cambia" — se quitó del contenedor de nav del panel, dejando el scrollbar global (ya themeado) tomar el control.

---

## 9. Recursos de referencia

- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)
- [7 SaaS UI Trends 2026](https://www.saasui.design/blog/7-saas-ui-design-trends-2026)
- [50 Best Dashboard Designs 2026](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
- [shadcn/ui Dashboard Templates 2026](https://thefrontkit.com/blogs/best-shadcn-dashboard-templates-2026)
- [PropTech UX Agencies 2026](https://bricxlabs.com/ux-agencies/best-proptech-ux-agencies)
- [Enterprise Color Palettes 2026](https://ilovehue.co/blog/tech-saas-color-palettes/)
- [Dark Glassmorphism 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [SaaS Design Trends 2026](https://www.designstudiouiux.com/blog/top-saas-design-trends/)
