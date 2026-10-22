# Manual de usuario

> Guía sencilla de operación de Propigo. Dos audiencias: el **corredor** (panel de gestión) y el **arrendatario/propietario** (portal de consulta). Escrita para usuarios no técnicos.

---

## Parte 1 — Corredor (Panel)

El panel es tu centro de gestión. Se accede en **`/panel`** con tu cuenta.

### 1.1 Ingresar por primera vez
1. Entra a **`/registro`** y crea la cuenta de tu corredora (nombre, email, contraseña). Debes **aceptar los Términos y la Política de privacidad**.
2. La primera vez que ingresas desde un computador nuevo, el sistema te enviará un **código de 6 dígitos a tu correo**. Ingrésalo para confirmar el dispositivo (no te lo volverá a pedir en ese equipo).
3. Completa tu **perfil** (datos personales); es obligatorio para operar.

> ¿Olvidaste la contraseña? Usa "¿Olvidaste tu contraseña?" en `/login`: recibirás un enlace por correo (válido una sola vez).

### 1.2 Cargar una propiedad
1. Ve a **Propiedades → Nueva propiedad**.
2. Ingresa el **RUT del propietario** (si no existe, se crea automáticamente) y los datos del inmueble.
3. Sube hasta **5 fotos**. La propiedad nace en estado **Borrador**.
4. Cuando esté lista, pulsa **Activar → Disponible** para que pueda arrendarse/publicarse.

### 1.3 Crear un contrato
1. Ve a **Contratos → Nuevo contrato** y sigue los **4 pasos**: Propiedad → Arrendatario → Condiciones → Vigencia.
2. En Condiciones defines: moneda (**UF o CLP**), valor, día de vencimiento, comisión, reajuste, mora, gasto común y **garantía**.
3. Antes de confirmar verás un **preview del calendario** de pagos. Al confirmar, el contrato queda en **Borrador** y la propiedad pasa a **Reservada**.
4. (Opcional) Usa **Validar con IA** para revisar el contrato.
5. Pulsa **Activar contrato** para dejarlo **Vigente** (la propiedad pasa a **Arrendada**).

### 1.4 Cobrar y liquidar (lo más importante)
1. Ve a **Cobros**. Verás los períodos por conciliar.
2. **Paso 1 — Conciliar:** registra el pago con su **fecha real**. El sistema marca el período como pagado, emite el comprobante y —si corresponde— aplica el **reajuste de IPC**.
3. **Paso 2 — Liquidar:** agrega ajustes si los hay (por ejemplo, un descuento por reparación) y **cierra la liquidación**. Se calcula tu comisión y lo que se liquida al propietario.
4. Todos los comprobantes quedan en **Vouchers** (con filtros) y no se pueden alterar.

### 1.5 Renovar o terminar un contrato
- En el detalle del contrato, cuando esté por vencer, aparece el botón **Renovar** (define nueva fecha y valor).
- Para terminar, usa **Dar término al contrato** (normal o anticipado). La propiedad vuelve a **Disponible** y se calcula la multa/garantía informativa.

### 1.6 Comunicarte con el arrendatario
- En el contrato, pestaña **Mensajes**, escribe un mensaje (puedes adjuntar documentos). El arrendatario lo verá en su portal y recibirá un correo.

### 1.7 Recordatorios y notificaciones
- En **Notificaciones** ves los avisos generados. Los recordatorios de vencimiento se envían automáticamente según la configuración de tu corredora.

---

## Parte 2 — Arrendatario / Propietario (Portal)

No necesitas crear una cuenta. Consultas tu arriendo con tu RUT.

### 2.1 Ingresar
1. Entra a **`/portal`** (o "Consulta tu arriendo" en el sitio).
2. Escribe tu **RUT**. Recibirás un **código de acceso** en el correo registrado por tu corredor.
3. Ingresa el código. Tendrás una sesión de **solo lectura por 30 minutos**.

### 2.2 Qué puedes ver
- **Tu contrato:** renta, fechas y estado.
- **Tus pagos:** el calendario completo. Si llevas más de un año, usa el **selector de año** para ver períodos anteriores.
- **Tus documentos:** descarga el contrato y los comprobantes (descarga segura y personal).
- **Mensajes del corredor:** avisos e información que te dejó tu corredor.
- **Valorar al corredor:** si recibiste un enlace de valoración, puedes calificarlo (1 a 5 estrellas) una sola vez.

---

## Parte 3 — Interesado (Marketplace público)

1. Entra a **`/marketplace`** y **busca/filtra** propiedades (tipo, ubicación, precio, mascotas, etc.).
2. Abre una **ficha** para ver fotos y detalles.
3. **Contactar al corredor:** completa el formulario; el corredor recibirá tu consulta.
4. **Denunciar:** si algo parece fraudulento, usa "Reportar"; puedes hacerlo de forma anónima (debes declarar que la información es veraz).

> ⚠️ **Anti-fraude:** Propigo solo intermedia. Nunca transfieras dinero antes de visitar la propiedad y firmar contrato. Ver la advertencia completa en [Términos de uso](/terminos-uso).

---

## Preguntas frecuentes

- **No me llega el código de acceso.** Revisa que el correo esté registrado por tu corredor y mira la carpeta de spam. El código dura 10 minutos.
- **¿Por qué no puedo editar una propiedad?** Si está **Reservada** o **Arrendada**, se bloquea para proteger el contrato en curso.
- **¿Los comprobantes se pueden cambiar?** No. El sistema usa un registro contable **inmutable**: los errores se corrigen con asientos nuevos, nunca borrando.

---

> Este manual describe el MVP. Los pagos en línea reales, la firma electrónica avanzada y los arriendos por día llegan en fases posteriores (ver [roadmap-mvp.md](roadmap-mvp.md)).
