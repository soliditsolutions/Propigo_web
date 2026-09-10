# Plan de pruebas QA + Seguridad — devolución de garantía como boleta (L-CM5)

> **Alcance:** el ajuste que convierte la retención de garantía de un número
> único a un listado de retenciones con motivo (boleta), con comprobante y
> aviso al arrendatario. Archivos: `lib/garantia-devolucion.ts`,
> `lib/garantia-devolucion-pdf.tsx`, `construirSnapshotGarantia`,
> `terminarContrato`, `cierre-section.tsx`, las rutas de PDF de voucher (panel y
> portal), y el enum `TipoVoucher += garantia` (migración).
>
> **Método:** igual que los planes anteriores. Unitario para el cálculo y el
> PDF; integración contra Postgres real para el flujo completo (`terminarContrato`);
> navegador para la verificación de punta a punta.
>
> _Creado 2026-09-10._

---

## "Verifica esto mismo para otros cobros o avisos similares"

| Cobro / aviso | ¿Detallado por concepto y comunicado? | Acción |
|---|---|---|
| **Retención de garantía** | ❌ Un número único, asiento genérico, aviso de una línea | 🔧 **Corregido en este ajuste** |
| Liquidación al propietario | ✅ `AjusteForm[]` con descripción obligatoria (`validarAjustes`) | — |
| Estado de cuenta de deuda (L-CM1) | ✅ Línea por concepto (arriendo / gasto común / mora) | — |
| Comprobante de pago | ✅ Snapshot con arriendo, GC, interés, ajustes | — |
| Reajuste IPC / mora / diferencia aceptada | ✅ Cada asiento con glosa | — |
| Recordatorio de pago | Un período (arriendo + GC + mora); el detalle de deuda va en el estado de cuenta | — |
| Renta del período faltante (término anticipado) | Informativa a propósito — "se gestiona fuera del sistema" | Sin cambio |

**Conclusión:** la garantía era el único punto donde un cobro compuesto se
colapsaba a un total sin desglose comunicado a la parte afectada.

---

## Secciones

### A. Autorización

| ID | Prueba | Esperado |
|---|---|---|
| A1 | `terminarContrato` sin sesión / colaborador sobre contrato no asignado | `DomainError` "No tienes acceso" |
| A2 | La ruta PDF del voucher `garantia` sin sesión | `401` |
| A3 | Portal: el **arrendatario** descarga su comprobante `garantia`; el **propietario** NO | arrendatario 200, propietario 404 |
| A4 | Portal: el arrendatario de OTRO contrato pide este voucher | `404` |

### B. Cálculo (`calcularDevolucionGarantia` / `construirSnapshotGarantia`)

| ID | Prueba | Esperado |
|---|---|---|
| B1 | Sin retenciones | se devuelve toda la garantía; saldo pendiente 0 |
| B2 | Retenciones ≤ garantía | `retenido + devuelto = disponible`; cada ítem cubierto entero |
| B3 | Retenciones > garantía | `retenido = disponible`, `devuelto = 0`, `saldo = Σ − disponible`; devolución nunca negativa |
| B4 | Reajuste UF | `recibido + reajuste = disponible`; la boleta cuadra |
| B5 | P-GA5: `recibido + reajuste − retenido = devuelto` en el snapshot | exacto |

### C. Validación de entrada

| ID | Prueba | Esperado |
|---|---|---|
| C1 | Retención sin motivo (o solo espacios) | rechazada, contrato sigue vigente |
| C2 | Monto cero, negativo o no entero | rechazado |
| C3 | Motivo > 200 caracteres | rechazado |
| C4 | Payloads (`<script>`, `</Text>`, `&`) en el motivo y en los nombres | el PDF se genera igual (react-pdf escapa) |
| C5 | `retenciones` ausente / `undefined` | se trata como lista vacía → devuelve todo |

### D. Ledger e integridad (integración, Postgres real)

| ID | Prueba | Esperado |
|---|---|---|
| D1 | Termina con 2 retenciones dentro de la garantía | 2 asientos `RETENCION_GARANTIA` con su glosa + 1 `DEVOLUCION_GARANTIA` |
| D2 | `v_garantia_retenida` tras el cierre | `0` (garantía liquidada) |
| D3 | Retenciones > garantía | Σ `RETENCION_GARANTIA` = garantía disponible (el exceso NO entra al ledger); `v_garantia_retenida` = 0 |
| D4 | El voucher `garantia` se crea con folio `GA-AAAA-NNNNN` y snapshot que cuadra | sí |
| D5 | `asiento_ledger` sigue siendo append-only | el trigger `prevent_mutation` intacto |

### E. Comunicación (P-GA4)

| ID | Prueba | Esperado |
|---|---|---|
| E1 | La notificación de término lleva el desglose ítem por ítem | "− Pintura living: $120.000", "Se devuelve: $350.000" |
| E2 | Con saldo pendiente, el aviso lo dice | "Saldo pendiente de pago…" |
| E3 | El PDF cita el folio del comprobante | presente |

### F. UI (`cierre-section.tsx`)

| ID | Prueba | Esperado |
|---|---|---|
| F1 | Lista repetible de retenciones (agregar / eliminar), motivo + monto | funciona |
| F2 | Boleta en vivo: garantía − Σ retenciones = se devuelve | correcto |
| F3 | Fila a medio llenar (motivo sin monto) | bloquea "Confirmar término" con aviso |
| F4 | Retenciones > garantía | muestra "Saldo que el arrendatario debe pagar" |
| F5 | Lista vacía | "se devuelve todo", término procede |

### G. Regresión

| ID | Prueba | Esperado |
|---|---|---|
| G1 | Voucher `pago` y `liquidacion` siguen generando su PDF (dispatch por `snapshot.tipo`) | sí |
| G2 | Historial de vouchers: filtro y etiqueta para `garantia` | presente |
| G3 | Suites completas | verdes |

---

## Resultados

_(Se completa al ejecutar.)_
