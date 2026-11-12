# Changelog

Todo lo que cambia de cara al producto, agrupado por etapa de desarrollo.

Este archivo cuenta **qué puede hacer el producto**. El detalle técnico de cada
etapa —con hallazgos, decisiones y verificaciones— está en
[`Docs/gestion/PROGRESO.md`](Docs/gestion/PROGRESO.md), y el razonamiento
transversal en [`BRAIN.md`](BRAIN.md).

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
El proyecto todavía no versiona releases: las secciones son etapas de
desarrollo, no versiones publicadas.

---

## [Unreleased]

### Añadido

- **Cambio de plan desde Mi Plan.** El Manager elige el plan nuevo. Si sube,
  decide si empieza en el próximo ciclo (sin cobro extra) o ahora mismo,
  pagando la diferencia del mes completo; el monto se muestra en UF + IVA y en
  pesos antes de pedirlo. Mientras no esté conectada la pasarela, la solicitud
  llega a soporte, que la aplica.
- **Bajar de plan exige que la cuenta quepa en el plan destino.** Se indica
  cuántas propiedades o usuarios sobran, con acceso directo a Propiedades o
  Equipo. El sistema nunca borra nada por su cuenta.

- **UF e IPC se cargan solos desde el Banco Central.** Un paso del cron diario
  trae la UF (con semanas de anticipación) y el IPC mensual, sin pisar valores
  ya guardados, y avisa en el log si algo falla. Rechaza un IPC que salta más de
  5 % respecto del anterior, señal de cambio de base. Requiere el token
  `BCCH_API_TOKEN`.

- **Canal para ejercer derechos sobre los datos personales** en `/derechos`: la
  persona elige el derecho (acceso, rectificación, supresión, oposición,
  portabilidad o bloqueo), recibe un número de solicitud y un correo de acuse con
  la fecha límite (30 días corridos), y el buzón de privacidad recibe el aviso.
  Un aviso diario recuerda las solicitudes por vencer. Se conservan 3 años.
- **Supresión de datos de una persona (solo Manager):** anonimiza su nombre,
  RUT, correo y teléfono y borra avisos, accesos y cuentas bancarias. Se rechaza
  con contratos vigentes, reservas activas o períodos sin liquidar, y conserva el
  ledger y los comprobantes que la ley obliga a guardar.
- **Procedimiento ante brechas de seguridad** y guía de correo con alias y
  etiquetas de Gmail, en `Docs/tecnica/`.

### Seguridad

- **El registro de corredoras queda cerrado por defecto en producción** (V0). El
  formulario muestra un aviso y la acción rechaza el envío aunque alguien la llame
  directamente. `REGISTRO_ABIERTO=true` lo abre.
- **El servidor no arranca en producción con el RUT o el teléfono de relleno** en
  los textos legales.
- **Los scripts del seed ya no corren con `NODE_ENV=production`**, aunque la base
  se vea como `localhost` por el proxy de Cloud SQL.

### Cambiado

- **La política de privacidad ya no promete 15 días hábiles** (con un artículo de
  ley sin verificar): publica el canal, 30 días corridos, la supresión con sus
  límites y qué hacemos ante un incidente de seguridad.
- **El reajuste por IPC usa el último índice disponible.** El INE publica el IPC
  de un mes hacia el día 8 del siguiente, así que antes de eso se usa el mes
  anterior, con la misma ventana de meses. El asiento del reajuste indica los
  meses usados. Si el IPC cargado tiene más de 2 meses de atraso o falta un
  índice, la conciliación se rechaza explicando por qué; antes se cobraba la
  renta sin reajustar y sin avisar.
- **Revisión responsive en iOS, Android y tablet**, con un recorrido
  automatizado de 8 perfiles (`npm run qa:mobile`).
- **Mi Plan cuenta los usuarios igual que Equipo**: las invitaciones
  pendientes también ocupan cupo.

### Seguridad

- **Las verificaciones de RUT y correo únicos ya no se saltan si la base
  falla.** Antes, un error en la consulta se leía como "no existe" y dejaba
  seguir: ahora se rechaza la operación hasta poder verificar.
- **Política de seguridad de contenido (CSP) con nonce en todo el sitio
  público**: portada, marketplace, legales y portal. Navegar el sitio público
  ya no renueva la inactividad del panel.

### Corregido

- **La tabla de cookies de la Política de Privacidad ahora coincide con el
  código.** Citaba una cookie del portal que no existe, duraciones antiguas y
  omitía tres preferencias guardadas en el navegador (tema, menú lateral y guía
  de notificaciones). Se genera desde un único catálogo y una prueba falla si el
  código usa un nombre que no esté declarado. Se deja explícito que no hay
  cookies de analítica, publicidad ni terceros, y por eso no hay banner de
  aceptación.
- **Páginas de error y de "no encontrado" propias, en español.** Un enlace
  roto, una ficha que ya no está publicada o un contrato que no existe muestran
  qué pasó y cómo seguir; en el panel, sin salir del menú. Ante un error del
  servidor, la página ofrece "Reintentar" y un código de referencia para
  soporte, en el tema (claro u oscuro) que eligió el usuario.
- **Guardar sin conexión o con la sesión vencida ya no rompe la página.** Se
  avisa qué pasó (sin internet, servidor que no responde, problema nuestro o
  sesión expirada, con enlace para volver a entrar) y la pantalla queda como
  estaba.
- **Avisos emergentes más legibles**: los errores duran más, el tiempo se
  detiene con el mouse o el teclado encima, el mismo aviso no se apila y el
  botón de cerrar es más fácil de tocar.
- **Las consultas del marketplace ya no se pierden.** Si el correo al corredor
  no sale, la consulta queda pendiente y se reintenta automáticamente durante
  una semana; antes el visitante leía "El corredor recibirá tu mensaje" y el
  corredor nunca se enteraba.
- **Un correo rechazado por el proveedor ya no pasa por enviado.** Ahora se
  maneja como cualquier fallo de envío.
- **Los formularios conservan lo escrito cuando algo falla.** Ingreso,
  registro, invitación, recuperar contraseña y Mi perfil ya no se vacían ante
  un error de red o del servidor; solo la contraseña se borra, y solo cuando
  fue rechazada. Mi perfil, además, ya no lleva a la página de error al
  guardar sin conexión, y sus errores se anuncian a lectores de pantalla.
- El ingreso ya no culpa a la conexión del usuario cuando el problema es
  nuestro.
- **Notificaciones avisa cuando un envío falla**; antes no mostraba nada y
  el corredor creía que los avisos habían salido. El resultado de generar o
  enviar ya no desaparece al actualizarse la lista.
- **Dispositivos distingue "no hay dispositivos" de "no pudimos cargarlos"**,
  con botón para reintentar y enlace para volver a entrar si la sesión
  expiró.
- **La foto de perfil explica por qué no se subió** (formato, tamaño, red) y
  recuerda guardar el perfil para conservarla.
- Enviar un mensaje al arrendatario sin conexión ya no lleva a la página de
  error: se avisa y el texto sigue escrito. Las rutas de dispositivos y
  comentarios responden con un mensaje claro y dejan rastro si fallan.
- **Los fallos inesperados del servidor ahora quedan registrados.** Más de
  40 errores se descartaban sin rastro y el usuario solo leía "Intenta de
  nuevo".
- **Un contrato no se da por inexistente cuando la base falla**: se muestra
  la página de error con "Reintentar" en vez de "No encontramos lo que
  buscas". Las descargas y exportaciones distinguen la sesión expirada (401)
  de un problema del servidor (503).
- **El plan tiene un solo nombre**: Equipo decía "plan Gratuito" y el pie del
  menú "demo" para una cuenta que Mi Plan y Propiedades muestran como Bronze.
  Ahora todas las pantallas usan el nombre del plan que rige.
- **La prueba de retención es repetible**: una ejecución cortada dejaba su
  persona de prueba y la siguiente fallaba por RUT duplicado.
- **Cada error se muestra una vez y donde corresponde** (M-23, M-25, M-27):
  - el portal ya no repite en un toast el error del código, que dejaba a la
    vista avisos de intentos ya superados; dice "Te queda 1 intento" y
    distingue un fallo del servidor de uno de conexión;
  - en Datos de la corredora los errores de la cuenta bancaria y de
    facturación salen todos a la vez, junto a su campo (con `aria-invalid` y
    el foco en el primero), en vez de uno por envío en un toast;
  - en Datos de la corredora y en Seguridad el error de un campo desaparece al
    corregirlo.
- **Una sesión que ya no vale lleva al login, sin falsos errores**: 25
  acciones del panel (cobros, contratos, propiedades, notificaciones, alertas,
  datos de la corredora) atrapaban el aviso de "sin sesión" de `getActor` y
  lo registraban como un error. Ahora lo relanzan, y una prueba que revisa el
  código impide volver a escribirlo. A un usuario desactivado en plena sesión,
  la acción le cierra la sesión y lo lleva a `/login`; antes la barra de
  direcciones quedaba en `/api/auth/logout`.
- **Cerrar sesión deja al usuario en el mismo dominio**: el panel y el portal
  redirigían a una URL armada con la del servidor interno. Detrás de un proxy
  eso era `https://localhost:3100/login`. Ahora la redirección es relativa.
- **Los límites de uso dicen cuánto esperar** (M-09, M-10, M-20):
  - todas las respuestas 429 (portal, consultas, denuncias, valoraciones,
    subidas, validaciones, exportaciones, código de dispositivo) dicen
    "Vuelve a intentarlo en N segundos/minutos", con el mismo plazo en
    `Retry-After`;
  - el portal muestra ese plazo en vez de "No fue posible enviar el código";
  - el código de dispositivo distingue "espera" (advertencia) de un fallo
    (error);
  - `/portal/verificar` explica qué hacer si el código no llega, con un
    texto neutro que no revela si el RUT existe.
- **Las descargas avisan si fallan**: los 11 enlaces a PDF, CSV y JSON del
  panel y del portal mostraban el error en crudo (`{"error":"No autorizado."}`)
  en una página en blanco si la sesión había expirado, el archivo no existía o
  se alcanzaba un límite. Ahora el motivo del servidor aparece en un aviso, con
  "Iniciar sesión" si corresponde. Mientras se genera el archivo, el ícono pasa
  a indicador de carga; con Ctrl+clic el enlace sigue funcionando como enlace.
- **Una caída o un timeout del servidor ya no se culpa a la red del usuario.**
  En la revisión de contratos con IA, la subida de anexos e imágenes y los
  formularios de contacto, denuncia y valoración, un 502/504 sin JSON mostraba
  "Error de conexión". Ahora dice que el problema es nuestro; un corte real de
  red se distingue de un servidor inalcanzable, un archivo cortado por el proxy
  (413) dice que es demasiado grande y la sesión expirada se nombra como tal.
  Los límites por exceso de envíos del marketplace se muestran como
  advertencia, no como error, y los errores de la revisión IA y de los anexos
  se anuncian a lectores de pantalla.

---

## Etapa 8 — Datos de la propiedad, visibilidad y blindaje público (2026-08-25 → 2026-08-26)

### Añadido

- **Rol de Avalúo del SII obligatorio en cada propiedad.** Identifica el
  inmueble ante el SII y ante Tesorería. Se valida con el formato oficial
  `manzana-predio`, con el código de comuna opcional (`573-24` o
  `13101-573-24`), y acepta lo que la gente pega desde un certificado: con
  puntos, espacios o guiones tipográficos.
- **Cuentas de servicios obligatorias**: agua, luz, gas y gastos comunes se
  declaran siempre al dar de alta una propiedad. "No aplica" es una respuesta
  válida y distinta de dejar en blanco — una cabaña sin gas de red es el caso
  normal, no un dato faltante.
- **Cuentas adicionales** con nombre propio (internet, alarma, TV cable), que
  el corredor agrega y quita libremente.
- **Roles complementarios** para estacionamientos, bodegas u otras unidades:
  en un edificio cada una tiene su propio rol ante el SII.
- **Control de visibilidad hacia el portal.** El corredor decide, dato por
  dato, qué comparte con el propietario y el arrendatario. Lo que no comparte
  no se lista en el portal: no se revela ni siquiera que existe.
- **Los datos privados salen tapados en el portal** y se descubren con un
  botón, para que no queden a la vista de quien pase por detrás de la
  pantalla. Alcanza al rol, a los roles de las unidades, a los números de
  cuenta y al titular.
- **El borrador de contrato nombra el rol de avalúo** en su cláusula primera, y
  suma las unidades accesorias al objeto del arriendo cuando existen.
- **El portal muestra los servicios y el rol** al arrendatario y al
  propietario del contrato, con su propio texto de visibilidad.

### Cambiado

- **Las sesiones privadas son únicas por navegador.** Entrar al panel cierra la
  sesión del portal y viceversa. Antes convivían: en el computador de la
  oficina, donde el arrendatario firma, el navegador quedaba con dos
  identidades y volver atrás mostraba el panel del corredor.
- **Ambas sesiones caducan por inactividad**, no solo por tiempo total: 30
  minutos en el panel y 15 en el portal, además del tope absoluto de 8 horas y
  30 minutos respectivamente. Antes una pantalla abierta no costaba nada.

### Seguridad

- **El buscador público ya no acepta comodines del usuario.** `?q=%` devolvía
  el catálogo completo del marketplace, porque el texto llegaba al `LIKE` de
  Postgres sin escapar. Afectaba también al buscador de personas del panel.
- **Todo parámetro que entra por la URL se valida antes de consultar.** Doce
  filtros del marketplace tumbaban la página con un 500 ante cualquier valor
  no numérico, y la ficha devolvía 500 en vez de 404 con un identificador
  inválido. Ninguno llegó a ejecutar SQL, pero eran rutas públicas y sin
  sesión.
- **El portal ya no devuelve 500 con un identificador inválido**, un caso que
  solo aparecía estando autenticado.
- Se corrigió una cookie que **producción habría rechazado entera**: la del
  portal usaba un `path` incompatible con su propio prefijo de seguridad, y el
  portal no habría funcionado al desplegar.

### Corregido

- **Editar una propiedad descartaba el rol y las cuentas en silencio.** El
  formulario los mostraba, el guardado decía que había salido bien y la base
  conservaba el valor anterior.
- Una bodega podía quedar guardada **con el mismo rol que la propiedad**, lo
  que en el contrato nombra dos inmuebles distintos con un solo identificador.
- El aviso "eso parece un RUT" al escribir el rol solo aparecía con los RUT
  terminados en K; ahora reconoce cualquiera.
- `0-0` se aceptaba como rol válido, siendo el valor con que la migración
  rellenó las filas antiguas.
- Región, Comuna, Orientación y Colaborador asignado no tenían nombre
  accesible para lectores de pantalla.
- La sección de servicios del portal se mostraba sin tarjeta, desalineada del
  resto de las secciones.

---

## Etapa 7 — Billing, cupos de plan y notificaciones (2026-08-06 → 2026-08-19)

### Añadido

- **Puerto de cobro y webhook de billing** (ADR-0014), con los modelos de
  suscripción y cargos. La plataforma nunca toca el dinero del arriendo: el
  ledger de contratos y el de billing son libros separados.
- **Los cupos que venden los planes se aplican de verdad**: propiedades,
  usuarios y consumo de IA. Verificado con consumos en paralelo contra la base.
- **Alertas personalizadas** que el administrador define como plantilla y
  cualquier corredor puede usar, con opción de automatizarlas.
- **Baja de avisos por correo** con enlace en todos los correos, formulario de
  baja permanente o temporal, y control para volver a suscribirse desde el
  portal. Los avisos esenciales del contrato se separan de los opcionales.
- **Tope de correos por persona y día**, para que un lote grande no se
  convierta en una avalancha.
- **Notificaciones agrupadas por categoría** en pestañas.
- **Política de contraseñas con medidor de fuerza.**

### Corregido

- **Cinco de ocho notificaciones nunca se enviaban.** Se creaban en un estado
  que el despachador no toma. Afectaba al comprobante del arrendatario, a la
  liquidación del propietario y a los avisos de firma pendiente, contrato
  activado y renovación.
- **HTML sin escapar en todos los correos**, alcanzable desde los formularios
  públicos del marketplace: quien enviaba el formulario decidía el HTML de un
  correo que salía de nuestro dominio.
- El comprobante de pago no traía el desglose que ya estaba calculado.

---

## Etapa 6 — Garantía, estadísticas y tema Aurora (2026-07-03 → 2026-07-27)

### Añadido

- **Garantía en UF o CLP**, con el reajuste resuelto a la fecha del evento.
- **Estadísticas de cartera** por plan: rotación, retención y comparables de
  mercado, exclusivas del administrador.
- **Borrador de contrato de arriendo descargable en PDF**: plantilla fija con
  datos reales, sin redacción libre de IA, y disponible solo mientras el
  contrato no se active.
- **Cuentas multi-usuario** (ADR-0013): administrador y colaboradores,
  invitación, desactivación, asignación de propiedades y cupos por plan.
- **Endurecimiento del cambio de datos de contacto**: RUT, nombre y fecha de
  nacimiento quedan bloqueados de por vida; teléfono y correo cambian solo con
  un código enviado al correo actual.
- **Tema Aurora dual** extendido al panel del corredor.

### Corregido

- **Ningún período pasaba nunca a "atrasado"**, lo que hacía imposible
  conciliar cualquier período real. Los datos de ejemplo fabricaban ese estado
  a mano y ocultaban el vacío.
- **Una cita legal fabricada** ("art. 46, Ley 18.101", que no existe) presente
  en seis lugares del código y la interfaz. El término anticipado se rediseñó
  sobre el Art. 1489 del Código Civil.
- Guardar el perfil expulsaba al usuario a la verificación de dispositivo.

---

## Etapa 5 — Plano público, portal y extras (2026-06-12 → 2026-07-01)

### Añadido

- **Marketplace público** de propiedades publicadas, sin autenticación, con
  filtros, mapa y ficha por propiedad.
- **Portal de autoconsulta** para arrendatarios y propietarios (ADR-0007):
  acceso sin cuenta mediante código de un solo uso al correo registrado, con
  respuesta idéntica exista o no el RUT.
- **Validación de contratos con IA**, y lectura del carnet por visión.
- **Doble factor por dispositivo confiable.**
- **Valoraciones, denuncias y comentarios del corredor.**
- **Páginas legales** (términos de uso y política de privacidad) y
  consentimiento explícito conforme a la Ley 21.719.
- **Ubicación aproximada por defecto**: el público ve comuna y región, y la
  dirección exacta solo si el corredor la habilita tras acordarlo con el
  propietario.

---

## Etapas 0 a 4 — Núcleo del MVP

### Añadido

- **Dominio financiero** en un paquete aislado: dinero en decimales, UF como
  serie temporal, reajuste de IPC por aniversario, calendario de pagos.
- **Ledger inmutable**: los asientos no se editan ni se borran, se reversan con
  asientos nuevos. Un disparador de la base rechaza cualquier modificación.
- **Conciliación de pagos** con fecha real, mora y gasto común traspasado.
- **Liquidación en dos pasos** con ventana del corredor y ajustes (ADR-0008).
- **Vouchers** de pago y de liquidación.
- **Panel del corredor**: propiedades, contratos, cobros, vouchers y
  notificaciones.
- **Aislamiento entre corredoras a nivel de base de datos** (RLS), no solo en
  el código de la aplicación.
- **Documentos por acceso autenticado y auditado**, nunca por enlace público.
