# Plan de pruebas QA + Seguridad — derechos desde el portal (L-DP4/L-DP6/L-DP8)

> **Alcance:** rectificación (L-DP4) y oposición al tratamiento (L-DP6) desde
> `/portal/mis-datos`, y el registro de actividades de tratamiento (L-DP8) en
> `/registro-tratamiento`. Incluye el refactor de los 5 puntos que hasheaban
> código de verificación por separado (`lib/codigo-verificacion.ts`) y la
> extensión de la purga automática (`lib/retencion.ts` / `retencion-purga.ts`)
> a las dos tablas nuevas.
>
> **Método:** igual que los planes anteriores de esta sesión. Unitario para
> validación/cálculo; integración contra Postgres real para el flujo completo;
> navegador con sesión real de portal para la verificación de punta a punta.
>
> _Creado 2026-09-16._

---

## Superficie nueva

| Categoría | Elemento |
|---|---|
| **Tablas** | `codigo_rectificacion_persona`, `solicitud_derecho_persona` (RLS + GRANTs) |
| **Acciones del portal** | `solicitarRectificacionAction`, `confirmarRectificacionAction`, `reportarIdentidadIncorrectaAction`, `oponerseAlTratamientoAction` |
| **UI** | `/portal/mis-datos` (nuevo), enlace desde `/portal/contrato/[id]` |
| **Página pública** | `/registro-tratamiento` |
| **Retención** | 2 categorías nuevas en `RETENCIONES`, purgadas por `purgarDatosVencidos` |
| **Refactor** | `sha256(código + AUTH_SECRET)` centralizado en 5 sitios que antes lo repetían |

---

## Resultados

_Ejecutado 2026-09-16. ✅ pasó · 🔧 falló y se corrigió._

### A. Autorización

| ID | Resultado |
|---|---|
| A1 | ✅ Toda acción exige `getPortalSession()`; sin sesión → `{ ok:false, error:"Tu sesión expiró…" }`, nada se escribe (test dedicado). |
| A2 | ✅ Cada acción escribe solo sobre `session.personaId` — no hay parámetro de persona que el cliente pueda sustituir. |
| A3 | ✅ RLS activa en ambas tablas nuevas (`relrowsecurity`, verificado tras aplicar `setup.sql`); GRANT DML a `housing_app` vía `alter default privileges` (verificado antes de re-aplicar RLS). |

### B. Validación de entrada

| ID | Resultado |
|---|---|
| B1 | ✅ Email inválido / teléfono con letras o muy corto → rechazado antes de tocar la BD. |
| B2 | ✅ Código de confirmación: debe ser 6 dígitos; código incorrecto cuenta intentos (máx. 3, luego el código se invalida). |
| B3 | 🔧 **Hallazgo #1**: `campo` en la firma de las acciones es un tipo de **compilación**, no de ejecución — una Server Action es un POST y nada impedía llamarla con un valor fuera de `"email" \| "telefono"`. Con un valor arbitrario, la validación tomaba la rama `telefono` (formato de teléfono) pero `confirmarRectificacionAction` aplicaba el resultado a la rama `email` (`campo === "telefono" ? … : …`), pudiendo escribir un valor con formato de teléfono en el campo de correo. **Corregido**: `esCampoRectificable()` al inicio de ambas acciones, rechaza cualquier valor que no sea exactamente uno de los dos. Test de regresión (unitario + integración). |
| B4 | ✅ Motivo (identidad/oposición) se recorta a 500 caracteres; vacío se rechaza en el reporte de identidad. |

### C. Fuga de información

| ID | Resultado |
|---|---|
| C1 | ✅ Nombre y RUT nunca se aceptan como editables — ni la UI los expone como campo, ni la acción los toca. |
| C2 | ✅ El código de verificación nunca se guarda ni se devuelve en claro (`hashCodigo`); confirmado en el test de integración (round-trip solo con el hash). |
| C3 | ✅ Cambio de teléfono: el código va al correo **actual** (no hay SMS) — verificado en el log de envío real durante la prueba en navegador (`Para: lucia@example.cl`, `Campo: teléfono`). |

### D. Integridad / auditoría

| ID | Resultado |
|---|---|
| D1 | ✅ Cada ejercicio de un derecho (rectificación, identidad, oposición) queda en `solicitud_derecho_persona` con IP — verificado en BD tras la prueba real en navegador. |
| D2 | ✅ La retención automática nueva purga solo lo vencido y conserva lo vigente (test de integración, mismo patrón que `otp`/`accesoPortal`/`auditoriaEquipo`). |
| D3 | ✅ La purga de una corredora no toca la de otra (RLS + filtro explícito, mismo test que las categorías existentes). |

### E. Correctitud funcional

| ID | Resultado |
|---|---|
| E1 | ✅ Rectificación de email: código al correo nuevo, se aplica solo con el código correcto, `persona.email` queda actualizado. |
| E2 | ✅ Rectificación de teléfono sin correo registrado: se rechaza con mensaje claro, no aplica el cambio a ciegas. |
| E3 | ✅ Oposición: `preferencia_notificacion` queda `suscrito=false` con el `alcance` elegido; reutiliza la baja de avisos ya existente en vez de duplicar lógica. |
| E4 | ✅ `registro-tratamiento`: cada `retencionClaves` resuelve a una fila real de `RETENCIONES` — no puede declarar un plazo que la purga no cumple (test). |
| E5 | ✅ `codigo-verificacion.ts`: determinista para el mismo código, nunca expone el código en claro, 6 dígitos con ceros a la izquierda. |

### F. Verificación de punta a punta (navegador, sesión real de portal)

- Login OTP como arrendataria vigente (Lucía Inquilina) → `/portal/mis-datos` renderiza identidad, correo, teléfono y oposición con datos reales.
- Rectificación de teléfono: código enviado al correo actual (confirmado en el log del servidor), confirmado con el código real, `persona.telefono` actualizado, `solicitud_derecho_persona` con `derecho=rectificacion`.
- Aviso de identidad incorrecta: registrado sin tocar la persona.
- Oposición con alcance "todos": `preferencia_notificacion` y `solicitud_derecho_persona` correctos.
- `/registro-tratamiento` y `/privacidad` (con el enlace y la fila de retención nuevos) renderizan correctamente, tema oscuro incluido.

### G. Regresión

- Suites completas: **`apps/web` 908 ✅ · `@housing/core` 74 ✅**. Typecheck y lint limpios.
- El refactor de `codigo-verificacion.ts` no cambió comportamiento en ninguno de los 5 sitios (mismo `sha256(código + secreto)`, mismos tests existentes en verde).

### Hallazgo

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Baja (autocontaminación de datos propios, requiere sortear la UI) | Un `campo` fuera de `"email"\|"telefono"` en las Server Actions de rectificación podía terminar escribiendo un valor con formato de teléfono en el campo de correo. | `esCampoRectificable()` al inicio de ambas acciones. |

### Deuda técnica encontrada y **derivada, no corregida en el acto**

El panel (`codigo_cambio_contacto`, usado por `/panel/perfil`) tiene el mismo
patrón de código de verificación que el portal, pero **nunca se purga** y no
tiene entrada en `RETENCIONES` — mismo tipo de brecha que L-DP1 corrigió para
otras tres categorías. No se corrigió en este pase porque la tabla no tiene
`tenant_id` (no se puede purgar dentro del loop por corredora sin antes
decidir cómo escoparla). Queda registrada como tarea de seguimiento.
