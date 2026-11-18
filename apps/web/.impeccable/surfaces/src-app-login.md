---
version: 1
slug: "src-app-login"
primary_target: "src/app/login"
related_targets: ["src/app/recuperar-contrasena","src/app/registro"]
---

# Acceso: iniciar sesión, recuperar contraseña y crear cuenta

**Modo:** Operate (iniciar sesión y recuperar contraseña); el registro es Operate con una parte de confianza. **Visitante:** corredor de propiedades en Chile que entra casi a diario, o quien llega por primera vez a crear su cuenta gratuita. **Tarea:** entrar sin esperar, recuperar el acceso sin ansiedad, o crear la cuenta y confiar en lo que se le pide (incluida la cédula).

**Prioridad confirmada:** transmitir confianza y seriedad, y verse moderno y con energía. **Evitar (confirmado):** neón o efectos exagerados, y perder legibilidad en el tema claro. **Voz:** tú cercano y claro, sin exclamaciones ni emojis. **Prueba mostrable:** solo hechos del producto, con datos de ejemplo rotulados; ninguna cifra ni testimonio inventado.

**Intacto:** validaciones y mensajes de seguridad (bloqueo por intentos, anti-enumeración, medidor de contraseña), validación de RUT, verificación de cédula (cámara o archivo, con consentimiento aparte), verificación de dispositivo, interruptor `REGISTRO_ABIERTO`, temas claro y oscuro.

**Pendiente de decidir:** la estructura final. Se comparan cuatro en un preview (ruta de desarrollo `/preview-acceso`): tarjeta con pestañas, recorrido guiado, cabecera narrativa y escena animada del producto.

## Direction contract

THESIS: la puerta de Propigo es una sola tarjeta serena que se entiende de un vistazo y reacciona con precisión; rechaza el login genérico de panel lateral con lista de beneficios y fondo de neón. Una idea: el hilo de luz.

OWN-WORLD: Aurora, pero contenida. Fondo marino con bandas de azul, cian e índigo de baja intensidad; tarjeta de vidrio con borde de un píxel y radio de 16, sin halos de neón ni sombras de color. Azul de marca para la acción, cian solo en el hilo de luz y en el estado correcto. Geist para todo, con titulares a 28 y 30 píxeles en peso 600 y letra apretada a -0.02em. Campos de 48 píxeles, radio 12, ícono a la izquierda; anillo de foco azul de 3 píxeles. Reconocible sin texto por el hilo de luz y la franja de confianza.

STORY: el corredor entiende en dos segundos dónde está y qué hacer; sabe por qué se le pide cada cosa sensible; sale con la sensación de que su plata y sus contratos están en manos serias. Acción: entrar, recuperar o crear la cuenta.

FIRST VIEWPORT: escritorio 1440x900. Barra mínima: logo a la izquierda, selector de tema a la derecha. En el centro (o a un lado, según la estructura) la tarjeta de 440 a 480 píxeles de ancho con título de 28 px, una línea de apoyo, dos campos y el botón principal a ancho completo; debajo, enlace a la otra acción y la franja de confianza con tres hechos. Movimiento firma: un hilo de luz recorre el borde de la tarjeta mientras se valida o envía y se asienta en un check; la tarjeta cambia de altura y contenido con una transición continua al cambiar de acción.

FORM: cuatro estructuras en comparación. Tarjeta con pestañas (lead, posición 4 de 7), recorrido guiado (posición 2), cabecera narrativa (posición 7) y escena animada del producto (pedida por el usuario). seed:8c2e02288286eb0f

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
