# Fondos de la portada en teléfono y tablet: dirección de arte y prompts

Noviembre 2026. Cuatro imágenes verticales, una por sección de la portada, para
pantallas de menos de 1024 px. En escritorio se siguen usando las fotos del
recorrido animado (`src/images/backgrounds/scroll-walkthrough_*.png`).

Integradas el 2026-11-19 (ver «Integración» al final).

## Qué tienen que transmitir

Cada imagen acompaña una sección y cuenta lo que hace Propigo en esa parte, sin
texto en la imagen:

| Sección | Texto de la portada | Idea de la imagen |
|---|---|---|
| Inicio | «La gestión de arriendos, automática y sin errores» | Llegar a un departamento donde todo está en orden: el arriendo se administra solo |
| Lo que hace por ti | Contratos con reajuste IPC, cobros que se concilian solos, vitrina pública | El escritorio del corredor: contrato firmado, calendario de cobros, teléfono que confirma el pago, llaves |
| Destacado | Publicaciones recientes del marketplace | Un departamento listo para arrendar, con Santiago y la cordillera en la ventana |
| Planes | Tabla de precios | Calma: una pared con luz de mañana, casi sin objetos, para que la tabla se lea |

## Estilo común

El mismo mundo de las fotos de escritorio:

- **Luz:** natural, de mañana, cálida.
- **Materiales:** madera de roble clara, muros crema, lino y plantas verdes.
- **Composición:** poco cargada, realista y editorial.
- **Acento de marca:** pequeño y frío, en uno o dos objetos (azul `#1E6FE8`, cian `#2ED3EA`), por ejemplo un llavero o una taza.

Bloque de estilo, que va al final de cada prompt:

```text
Editorial interior photography, soft natural morning light from a large window,
warm neutral palette (cream plaster walls, light oak wood, linen, green plants)
with one or two small cool blue accents (#1E6FE8, #2ED3EA), realistic, calm,
uncluttered, shallow depth of field, shot on 35mm, vertical 9:16 composition.
The central area of the frame is calm and low in contrast, without small detail,
because text panels will be placed over it.
No text, no letters, no numbers, no logos, no watermarks, no readable screens.
```

Negativo, en los generadores que lo aceptan (Midjourney `--no`, Firefly «Excluir»):

```text
text, letters, numbers, logo, watermark, signature, readable screen, UI text,
clutter, dramatic shadows, neon, oversaturated colors, fisheye, distorted hands
```

## Prompts

### 1. Inicio: `movil-inicio`

```text
Vertical view from the entrance of a bright, tidy apartment in Santiago de Chile,
looking into a sunlit living room. In the lower third, a slim light oak console
by the door with a small ceramic dish holding a set of house keys on a blue
keyring, and a smartphone lying face up whose screen glows with a soft, abstract
blue interface and a single green confirmation shape (nothing readable). Upper
third: a large window with soft morning light and a green plant. The middle of
the frame is a calm cream wall with gentle light. Feeling: everything is in
order, nothing to worry about.
```

### 2. Lo que hace por ti: `movil-funciones`

```text
Top-down flat lay on a light oak desk, vertical. In the upper third: a signed
residential lease contract (blank lines, no readable text) with a dark blue
fountain pen resting on it. In the lower third: a smartphone showing a soft,
abstract monthly calendar grid where one cell is highlighted in blue and others
have small green check shapes (nothing readable), next to a set of house keys
on a blue keyring and a small linen notebook. The middle of the desk is empty
wood with soft window light and the shadow of a plant leaf.
```

### 3. Destacado: `movil-destacado`

```text
Vertical photo of a bright, furnished apartment ready to rent in Santiago de
Chile: light oak floor, a linen sofa in the lower third, a large window in the
upper third with a view of the city and the snow-capped Andes mountains in soft
morning haze. Clean, inviting, nobody in the room. The middle of the frame is a
calm wall and floor area with gentle light.
```

### 4. Planes: `movil-planes`

```text
Minimal vertical photo: soft morning sunlight and gentle leaf shadows on a
smooth cream plaster wall. At the very bottom, the edge of a light oak shelf with
a small green plant in a ceramic pot. Almost empty, very calm, low contrast,
lots of negative space.
```

## Especificaciones de entrega

- **Formato:** 9:16 vertical, mínimo 1080 × 1920 px (mejor 1152 × 2048 si el
  generador lo permite).
- **Archivo:** PNG o JPG de alta calidad. La app las convierte y reduce al
  servirlas (`next/image`), no hace falta comprimirlas.
- **Nombres y carpeta:** `apps/web/src/images/backgrounds/movil/` con
  `movil-inicio`, `movil-funciones`, `movil-destacado` y `movil-planes`.
- **Variantes:** si te gustan dos versiones de una misma imagen, deja ambas con
  sufijo (`movil-inicio-a`, `movil-inicio-b`) y elegimos viéndolas en el teléfono.
- **Licencia:** usar un plan del generador que permita uso comercial (Midjourney
  pagado, Adobe Firefly o Gemini/Imagen según sus términos vigentes). Revisar
  que no aparezcan marcas de agua: una foto local de prueba traía una de
  Shutterstock.
- **Personas:** ninguna o de espaldas. Las caras y manos generadas fallan con
  frecuencia y en una portada de confianza un rostro raro resta más de lo que
  suma.

## Cómo se recortan en el teléfono

Cada imagen cubre la sección completa (`object-cover`) y la sección cambia de
alto según su contenido. Con 375 px de ancho:

| Sección | Alto aprox. | Recorte de una 9:16 |
|---|---|---|
| Inicio | 760 px | casi entera |
| Lo que hace por ti | 740 px | casi entera |
| Destacado | 460 px | se ve la franja central (≈ 60 % del alto) |
| Planes | 950 px | entera, con un leve recorte lateral |

Por eso lo importante de «Destacado» (ventana y cordillera) tiene que quedar
cerca del centro vertical, no en los bordes.

## Integración (hecha el 2026-11-19)

- **Archivos usados:** `movil-funciones.jpg` y `movil-planes.jpg` tal cual. `movil-inicio.jpg` y `movil-destacado.jpg` llegaron como collage de varias escenas con costuras; se usan recortes de una sola escena (`movil-inicio-entrada.jpg`, 768 × 906, y `movil-destacado-ventana.jpg`, 768 × 524). Los originales no se suben al repositorio.
- **Resolución:** llegaron en 768 × 1376, por debajo de lo pedido. En teléfonos 3x y en tablet se amplían y se ven algo blandas bajo el velo. Si se regeneran, pedirlas en 1080 × 1920 o más y como una sola escena.
- **Código:** cada parada de `app/page.tsx` recibe `imagenMovil` (foto y encuadre). `FotoPorPantalla` en `ScrollWalkthrough.tsx` arma un `<picture>` con `media`, así cada foto solo se descarga en su tamaño de pantalla.
- **Contraste:** `.pgo-walk-foto-movil` en `globals.css` aplica un filtro por tema y un velo del color de página (66 % en claro, 72 % en oscuro). Se midió el contraste de cada texto de los paneles, con y sin foto, en Safari (iPhone SE, iPad Mini) y en Chromium (Pixel 7), en claro y en oscuro. Lo que queda bajo 4,5:1 ya fallaba sin foto por los tokens de color: es deuda aparte.
- Las láminas de dibujo técnico (`LaminasMovil.tsx`) y el vidrio al 70 % se eliminaron.
