# Revisión responsive iOS / Android / tablet — 2026-11-02

Alcance: sitio público, panel del corredor y portal de arrendatario/propietario
(26 pantallas). Método: navegación real con Playwright en **WebKit** (motor de
Safari/iOS) y **Chromium** (Android y escritorio), con los datos del seed, en
8 perfiles: iPhone SE (320 px), iPhone 15, Pixel 7, Galaxy S9+ (360 px),
iPad Mini (768 px), Galaxy Tab S4, escritorio 1280 px y escritorio 1024 px.

Resultado final: **208 páginas medidas, 0 problemas** (`npm run qa:mobile`).

## Cómo repetirla

```bash
npm run qa:mobile --workspace @propigo/web
```

Requiere el servidor de desarrollo en `:3000` y la base local `propigo-db`
cargada con el seed (`db:setup` → `db:seed`). Un argumento opcional filtra
perfiles (`-- iphone`, `-- escritorio`). Capturas e `informe.json` quedan en
`apps/web/.qa-mobile/` (ignorado por git). Sale con código 1 si encuentra algo.

Mide por página: scroll horizontal de la página, elementos fuera de pantalla,
campos que provocan zoom en iOS (letra < 16 px, solo en táctil), contenido
escondido tras un scroll horizontal interno, objetivos táctiles bajo 24 px
(WCAG 2.2 AA 2.5.8, con sus excepciones) y errores de consola.

Solo local: para entrar sin correo inserta un dispositivo confiable y fija el
código OTP del portal en la base; se niega a correr contra un host que no sea
localhost.

## Hallazgos corregidos

| # | Dónde | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Todos los formularios | Safari iOS hacía zoom al enfocar campos con letra de 13–15 px (estilos en línea). | Regla global `@media (pointer: coarse)`: 16 px en inputs, selects y textareas (excluye OTP, que ya es más grande). |
| 2 | `/privacidad` | Desborde horizontal a 320–360 px (tarjetas de finalidad y textos largos sin corte). | Tarjetas en columna en móvil y `overflow-wrap: anywhere` en las secciones. |
| 3 | Portal | El aviso anti-fraude decía "acceder al marketplace" dentro del portal. | `TerminosAviso` recibe `destino`. |
| 4 | Portal · Mis pagos | La tabla escondía la columna de estado; fondo de la píldora inválido (`var(--x)18`). | Lista de tarjetas en móvil; `color-mix()` para el fondo. Mismo arreglo en vouchers. |
| 5 | Panel · cabecera | El nombre de la corredora se montaba sobre el avatar. | `min-w-0` + truncado. |
| 6 | Panel · inicio, contratos, notificaciones, vouchers | Tablas que escondían monto, estado y acciones en móvil y tablet (con el sidebar abierto quedan ~500–720 px útiles). | Tarjetas hasta `xl` (vouchers hasta `lg`); tabla desde ahí. Notificaciones: la propiedad pasa bajo el asunto (columna redundante que no cabía a 1280 px). |
| 7 | Notificaciones | Etiquetas crudas ("Cambio_titularidad", "pendiente"). | Mapas tipados exhaustivos (`Record<Enum, …>`). |
| 8 | Chips del marketplace y pestañas de notificaciones | Filas con scroll horizontal sin pista de que hay más. | Utilidad `.pgo-scroll-x`: difuminado en el borde derecho; el último ítem queda nítido al final. `Tabs` con fondo continuo y `aria-label` propio. |
| 9 | `Badge` (panel) | CSS `capitalize` mayusculaba cada palabra ("Término Anticipado", "Riesgo Bajo") y las píldoras se partían en dos líneas. | Sin transformación: los textos llegan escritos vía `estadoLabel`; `whitespace-nowrap`. |
| 10 | Planes (portada) | El tooltip de cada característica no abría en iPhone (Safari no enfoca un botón al tocarlo), medía 16 px y se salía de la pantalla. | Abre/cierra por toque (cierra al tocar fuera o con Escape), área táctil de 44 px, texto de 12 px, alineado al borde derecho. |
| 11 | Portal · Mis datos | Radios de baja de avisos sin `name` común (sin navegación con flechas ni "1 de 2" en lector de pantalla). | `name="alcance-baja"`. |
| 12 | `SectionTitle` | Descripción apretada junto al título en móvil. | Pasa a su propia línea bajo `sm`. |
| 13 | Buscadores | Placeholder cortado sin indicación. | `text-overflow: ellipsis`. |

Pruebas automatizadas nuevas: `components/panel/__tests__/estado-label.test.tsx`
y `components/public/__tests__/planes-tooltip.test.tsx`.

## Falsos positivos descartados

- **Error de hidratación en vouchers/corredora (Galaxy S9):** lo causaba la
  propia captura de Playwright (`caret: "hide"` escribe `caret-color` en línea
  sobre los inputs; si llega antes de hidratar, React reporta un desajuste). El
  script usa `caret: "initial"` y el error desaparece.
- **Objetivos chicos** que sí cumplen: íconos con `.pgo-tap-target` (área de
  44 px), controles dentro de un `<label>`, enlaces en línea en el texto y
  enlaces del pie con separación suficiente (excepción de espaciado de 2.5.8).
