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
