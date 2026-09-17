# Plan de pruebas QA + Seguridad — cambio de titularidad de propiedad (L-CM6)

> **Alcance:** `cambiarPropietarioPropiedad()` en
> `apps/web/src/app/panel/propiedades/actions.ts` — reasignación del
> `propietarioId` de una `Propiedad` y el aviso automático al arrendatario
> (nuevo tipo de `Notificacion`: `cambio_titularidad`).
>
> **Método:** igual que los planes anteriores de esta sesión. Unitario para
> la construcción del aviso; integración contra Postgres real para el flujo
> completo; navegador con sesión real de panel + portal para la verificación
> de punta a punta.
>
> _Creado 2026-09-16._

---

## Superficie nueva

| Categoría | Elemento |
|---|---|
| **Enum** | `TipoNotificacion.cambio_titularidad` |
| **Acción del panel** | `cambiarPropietarioPropiedad(propiedadId, { nombre, rut, email? })` |
| **UI** | Botón "Cambiar titularidad" en el modal de detalle de propiedad (`propiedades-client.tsx`), disponible en cualquier estado |
| **Lib** | `lib/cambio-titularidad.ts` — `construirAvisoCambioTitularidad()` |

---

## Resultados

_Ejecutado 2026-09-16. ✅ pasó._

### A. Autorización

| ID | Resultado |
|---|---|
| A1 | ✅ Reservada al Manager — un Colaborador recibe error antes de tocar la BD (test de integración); a diferencia de otras acciones de propiedad, no hay caso de "colaborador sobre lo asignado": es un hecho jurídico, no una edición de ficha. |
| A2 | ✅ Propiedad de otro tenant (o inexistente) → error genérico "no existe o no pertenece a este corredor" (IDOR-safe, no distingue los dos casos). |

### B. Validación de entrada

| ID | Resultado |
|---|---|
| B1 | ✅ RUT vacío, con dígito verificador inválido, o igual al del propietario actual → rechazado **antes** de crear ninguna Persona ni tocar `Propiedad`. |
| B2 | ✅ Nombre vacío → rechazado. |

### C. Correctitud funcional

| ID | Resultado |
|---|---|
| C1 | ✅ Busca la Persona por RUT dentro del tenant antes de crear una nueva — mismo patrón que `crearPropiedad`; no duplica si ya existe (verificado: el nombre de la Persona existente no se sobrescribe con el del formulario). |
| C2 | ✅ Funciona en cualquier estado de la propiedad (a diferencia de `actualizarPropiedad`, que bloquea `reservada`/`arrendada`) — es justo el caso de uso típico: una venta con arrendatario dentro. |
| C3 | ✅ Un contrato vigente sobre la propiedad → una `Notificacion` al arrendatario con nombre y RUT del nuevo propietario, y `payload` con el propietario anterior y nuevo (auditoría). Sin contrato vigente → cambia el propietario, cero notificaciones (`notificados: 0`), sin error. |
| C4 | ✅ El cuerpo del aviso aclara explícitamente que el contrato vigente no se ve alterado por el cambio. |

### D. Regresión

- Suite completa `apps/web`: **917/917 ✅** (908 previos + 9 nuevos). Typecheck y lint limpios.

### E. Verificación de punta a punta (navegador, sesión real)

- Manager (Corredora Demo SpA) abre el detalle de "Av. Providencia 2020, depto 805" (arrendada, contrato vigente de Lucía Inquilina) y usa "Cambiar titularidad".
- **Hallazgo de entorno, no del código**: el servidor de desarrollo tenía cacheado el cliente Prisma anterior a la migración del enum (`Invalid value for argument tipo. Expected TipoNotificacion.`) — mismo síntoma que con `TipoVoucher.garantia` en una sesión anterior. Se verificó el PID huérfano (`Get-Process` confirmó `node.exe` del propio `preview_start`), se detuvo, se reinició el servidor y el flujo completo pasó limpio.
- Confirmado en base de datos: `propiedad.propietario_id` apunta a la nueva Persona ("Rodrigo Nuevo Dueño", RUT `20111222-2`); `notificacion` con `tipo='cambio_titularidad'`, `persona_id` de Lucía Inquilina, `payload` con propietario anterior ("Ana Dueña") y nuevo.
- Confirmado en `/panel/notificaciones`: el aviso aparece en la cola de pendientes, con destinatario, asunto y propiedad correctos.
- El listado de propiedades del panel refleja "Propietario: Rodrigo Nuevo Dueño" inmediatamente tras guardar.
