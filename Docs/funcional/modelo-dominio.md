# Modelo de dominio (núcleo financiero)

> Esta es la parte que **debe funcionar de verdad** incluso en el MVP local (ver [ADR-0003](../decisiones/ADR-0003-fidelidad-prototipo.md)). Es lo que diferencia a Propigo.
>
> Reglas de negocio validadas con el cliente el 2026-06-03 → ver [ADR-0004](../decisiones/ADR-0004-reglas-financieras.md).

## Entidades principales

```
Tenant (corredora)  [config: ventana_liquidacion_dias, recordatorio_dias_antes]
  └── Usuario (SOLO corredores: manager/colaborador — ADR-0013; los únicos que se autentican)
  └── Persona (propietarios y arrendatarios; sin login, son partes/contactos)
  └── Propiedad (datos duros: ubicación, características, gastos comunes, estado)
        └── Publicacion (aviso de marketing; baja si la propiedad no está disponible)
        └── Reserva (el corredor reserva; la publicación se baja)
        └── Contrato (un arriendo)
              ├── Términos (ver abajo)
              ├── CalendarioPago[]      (un período por ciclo; mes completo)
              │     └── AjusteLiquidacion[]  (reparaciones, descuentos, retenciones)
              └── Voucher[]             (inmutables, ligados a este contrato)
              └── Documento[]           (contrato, anexos, comprobantes, certificado reserva)
  └── Ledger (asientos contables, append-only, por tenant)
  └── Notificacion (a personas: cobros, vouchers, recordatorios, avisos)
  └── AccesoOTP / AccesoLog (portal de autoconsulta de las partes)

Series temporales (por país, no por tenant):
  └── SerieUF     (valor CLP por UF, diario — fuente SII/Banco Central)
  └── SerieIPC    (índice IPC mensual — fuente INE)
```

> **Acceso** (ver [ADR-0005](../decisiones/ADR-0005-acceso-partes-y-publicacion.md) y [ADR-0007](../decisiones/ADR-0007-portal-autoconsulta-otp.md)): solo los corredores tienen cuenta en el SaaS. Propietarios y arrendatarios usan el sitio público y un **portal de autoconsulta de solo lectura** con **OTP** (RUT + ID identifican; el código enviado al contacto registrado autentica), donde ven su arriendo, pagos y documentos. Las comunicaciones a las partes van por `Notificacion`.

## Términos del contrato (configurables por el corredor)

| Término | Valores | Efecto |
|---|---|---|
| `denominacion` | `UF` \| `CLP` | Bifurca el cálculo del valor (ver regla 1). |
| `valor_arriendo` | número | En UF (con decimales) o en CLP (entero). |
| `dia_vencimiento` | 1–31 | Día del ciclo en que vence el pago. |
| `comision_corredor_pct` | % | Comisión que retiene el corredor. |
| `reajuste` | `frecuencia` (default anual) | Solo aplica si `denominacion = CLP` (ver regla 2). |
| `mora_tasa` | tasa | Interés por atraso (ver regla 5). |
| `mora_dias_gracia` | días | Días tras el vencimiento sin interés. |
| `multa_meses` | número | Meses de arriendo que se cobran por término anticipado (ver regla 4). |
| `garantia_meses` / `garantia_monto_clp` | número | Mes(es) de garantía (tope legal 2) y monto recibido (ver regla 14). |
| `fecha_inicio` / `fecha_fin` | fecha | Define el aniversario de reajuste y el plazo pactado. |

## Reglas de negocio clave

### Regla 1 — Denominación: UF vs CLP (bifurca todo)
La renta se expresa en una de dos monedas, y **cada una se indexa distinto**:

- **Renta en UF**: el monto en CLP **flota a diario** (la UF ya está indexada a inflación). Se convierte UF→CLP con el valor de la UF **a la fecha del evento** (vencimiento/pago). **No** se reajusta por IPC (sería doble indexación).
- **Renta en CLP**: monto fijo en pesos. Se reajusta por **variación del IPC en el aniversario** del contrato (regla 2).

### Regla 2 — Reajuste de IPC por aniversario (solo CLP) — CRÍTICA (#7)
- Aplica **solo a contratos en CLP**.
- El valor se reajusta cuando el contrato **cumple un año desde su `fecha_inicio`** (o la frecuencia pactada), no en una fecha global anual.
- Ejemplo: contrato iniciado el 2025-03-15 se reajusta cada 15 de marzo, con la variación acumulada del IPC de **ese** período de 12 meses.
- Requiere la **serie mensual del IPC (INE)** — no basta con la UF.

### Regla 3 — Períodos: mes completo, sin prorrateo
- Cada período se cobra **íntegro** al inicio del ciclo (en el `dia_vencimiento`). No se prorratea por días de ocupación.
- El calendario genera un período por ciclo entre `fecha_inicio` y `fecha_fin`.

### Regla 4 — Multa por término anticipado (configurable) — reemplaza al prorrateo
- Si el arrendatario se va **antes** de cumplir el plazo pactado, se genera una **multa** = `multa_meses` × valor de arriendo (mes completo).
- `multa_meses` lo configura el corredor por contrato (1 o más). Mismo mecanismo aplicará a arriendos diarios/semanales (Fase 2).
- Genera un asiento `CARGO_MULTA` en el ledger.

### Regla 5 — Interés por mora (configurable por contrato)
- Cada contrato define `mora_tasa` y `mora_dias_gracia`.
- El interés se calcula **solo si la FECHA REAL del pago** supera `dia_vencimiento + mora_dias_gracia`. → resuelve el fallo #1 (no más intereses por liquidación tardía del corredor).
- Genera un asiento `CARGO_INTERES`.

### Regla 6 — Canales de pago y conciliación (ver [ADR-0006](../decisiones/ADR-0006-canales-de-pago.md))
- **Canales oficiales (PAC, Pago Fácil)**: fuente confiable → conciliación **automática** con calce exacto.
- **Transferencia u otro (`transferencia_declarada`)**: entra `en_revision` y exige **comprobante + declaración jurada + confirmación del corredor** antes de impactar la contabilidad.
- Conciliación **por monto exacto**: un pago se asocia a un período solo si coincide exacto con lo adeudado (= renta + GC si aplica + interés a la fecha del pago). Si no, queda **para revisión manual**.
- Al conciliar se usa **la fecha real del pago**, no la de registro.

### Regla 7 — Gasto común (passthrough, cobro al arrendatario)
- La propiedad define si paga gastos comunes y su valor (CLP).
- El contrato define con `cobra_gasto_comun` si se le traspasa al arrendatario (cobro **flexible**: junto al arriendo o coordinado).
- Si aplica, cada período genera un asiento separado `CARGO_GASTO_COMUN`.
- **Passthrough**: el GC **no es ingreso** del corredor ni del propietario. Se imputa con `concepto = 'gasto_comun'` y queda **fuera de la billetera del propietario y de la comisión**.

### Regla 8 — Reserva de propiedad
- El corredor puede **reservar** una propiedad (`estado = reservada`).
- Mientras la propiedad no esté `disponible` (reservada o arrendada), su **publicación se baja**.

### Regla 9b — Portal de autoconsulta y documentos (ver [ADR-0007](../decisiones/ADR-0007-portal-autoconsulta-otp.md))
- Las partes acceden sin cuenta vía OTP: RUT + ID de propiedad **identifican**; el **código (enviado solo al contacto registrado) autentica**.
- Sesión de **solo lectura**, corta y acotada a sus arriendos.
- Documentos (contrato, anexos, comprobantes, certificado de reserva) por **URL firmada y expirable**; todo acceso **auditado**.
- Alcance: el arrendatario no ve comisión ni liquidaciones del propietario.

### Regla 9 — Notificaciones a las partes y cadencia de recordatorios
- **Arrendatario**: cobro (arriendo y/o gasto común), voucher de pago, recordatorio de próximo vencimiento.
- **Propietario**: liquidación/pago de su arriendo, salida anticipada, término de contrato, nuevo contrato, solicitud de firma.
- En el MVP el canal es email **simulado** (se registra la notificación, no se envía).

**Cadencia de recordatorios** (configurable a nivel de tenant con `recordatorio_dias_antes`, default 5):

| Momento | Destinatario | Mensaje |
|---|---|---|
| `recordatorio_dias_antes` antes del vencimiento | Arrendatario | Próximo vencimiento + monto |
| Día del vencimiento | Arrendatario | Vence hoy |
| Día siguiente sin pago registrado | Corredor | Período sin pago registrado |
| Último día de la ventana de liquidación | Corredor | Liquidaciones pendientes por cerrar |
| Al cerrar la liquidación | Arrendatario + Propietario | Voucher / aviso de liquidación |

### Regla 10 — Ledger inmutable (#5 y #8)
- Cada movimiento de dinero es un asiento **append-only**, ligado a `contrato_id + arrendatario_id + periodo`.
- Un voucher/asiento emitido **no se edita ni se borra**; se corrige con un asiento de reversa.
- Al cambiar de arrendatario, los vouchers del anterior quedan atados a *su* contrato y no contaminan al nuevo.
- Historial filtrable (rango de fechas, arrendatario, propiedad, estado).

### Regla 11 — Flujo de liquidación en dos pasos + ventana del corredor (ver [ADR-0008](../decisiones/ADR-0008-liquidacion-y-ajustes.md))
Liquidar, en la operación real del corredor, son **dos pasos distintos** que el sistema separa:

1. **Conciliar (confirmar pago)**: el corredor registra que el arrendatario pagó, con la **fecha real** del pago. → genera `PAGO_RECIBIDO`.
2. **Cerrar liquidación (settlement)**: revisa el período, agrega ajustes si los hay (regla 12), y cierra. → genera `COMISION_CORREDOR`, `LIQUIDACION_PROPIETARIO` (y `CARGO_AJUSTE` / `AJUSTE_LIQUIDACION` si aplica), emite el **voucher** del arrendatario y la **liquidación** del propietario, y notifica.

- Estados del período: `pendiente → pagado (conciliado) → liquidado (cerrado)`; `atrasado` si vence sin pago; `en_revision` si el pago no calza.
- **Ventana de liquidación** (`tenant.ventana_liquidacion_dias`, p. ej. hasta el día 10): plazo operativo para que el corredor cierre las liquidaciones del mes. **No afecta el cálculo de intereses** (eso depende solo de `fecha_pago_real`); sirve para alertas y orden. Resuelve el caso real: el corredor liquida entre el 5 y el 10, declarando la fecha real → cero intereses fantasma aunque cierre tarde.

### Regla 12 — Ajustes de liquidación (reparaciones, descuentos, retenciones)
El corredor puede agregar **ajustes** a un período antes de cerrarlo (caso real: "descuentos por reparaciones que debo agregar"):

| `tipo_ajuste` | Efecto | Asiento |
|---|---|---|
| `descuento_propietario` | Reduce lo que recibe el propietario (ej. reparación de su cargo) | `AJUSTE_LIQUIDACION` (−) en billetera |
| `cargo_arrendatario` | Aumenta la deuda del arrendatario (ej. daño, reposición) | `CARGO_AJUSTE` (+) en deuda |
| `retencion` | El corredor retiene un monto (ej. garantía) | `AJUSTE_LIQUIDACION` (−) en billetera |

- Cada ajuste lleva `monto_clp`, `descripcion` y queda trazado (`creado_por`, fecha). El detalle aparece en el voucher/liquidación.

### Regla 13 — Días corridos en el MVP
- Los plazos (vencimiento, gracia, ventana de liquidación) se cuentan en **días corridos** en el MVP, indicado en la interfaz.
- Los **días hábiles** (que requieren el calendario de feriados de Chile) quedan para Fase 2.

### Regla 14 — Mes de garantía (passthrough) — ver [ADR-0009](../decisiones/ADR-0009-garantia-y-reconocimiento-deuda.md)
- Contrato: `garantia_meses` (0–2, tope legal de 2 rentas) y `garantia_monto_clp` (recibido al inicio).
- La garantía **no es ingreso** del propietario ni deuda recurrente del arrendatario: es un **depósito retenido**.
- Ledger: `GARANTIA_RECIBIDA` (entra), `RETENCION_GARANTIA` y `DEVOLUCION_GARANTIA` (salen al término).
- Vista `v_garantia_retenida` por contrato, separada de deuda y billetera.

### Regla 15 — Reconocimiento de deuda (MVP light)
- Documento generado del ledger con la deuda vigente del arrendatario (períodos impagos + intereses + total).
- Base para cobranza; en Fase 2 alimenta el workflow de morosidad (Ley 21.461).

## Tipos de movimiento del ledger

```
CARGO_ARRIENDO          devengo de la renta del período (deuda del arrendatario)
CARGO_GASTO_COMUN       gasto común del período (si el contrato lo cobra)
CARGO_INTERES           interés por mora del período
CARGO_MULTA             multa por término anticipado
CARGO_AJUSTE            ajuste que aumenta la deuda del arrendatario (regla 12)
PAGO_RECIBIDO           pago entrante (con su FECHA REAL) → abona la deuda
COMISION_CORREDOR       comisión que retiene el corredor
AJUSTE_LIQUIDACION      ajuste que reduce lo recibido por el propietario (regla 12)
LIQUIDACION_PROPIETARIO pago/retiro al propietario (fin de mes)
GARANTIA_RECIBIDA       depósito de garantía recibido (passthrough, regla 14)
RETENCION_GARANTIA      monto de garantía retenido al término (por daños)
DEVOLUCION_GARANTIA     monto de garantía devuelto al arrendatario al término
```
> Una **reversa** no es un tipo aparte: es un asiento nuevo con `signo = -1` que referencia al original (`reversa_de`). Así el ledger sigue siendo append-only y los saldos se calculan solos. _(Refina la versión inicial del doc, que lo listaba como tipo `REVERSA`)._

## Saldos derivados (no se almacenan mutables; se calculan del ledger)
- **Deuda del arrendatario** = Σ cargos (arriendo + gasto común + interés + multa + ajuste) − Σ pagos.
- **Billetera/recaudadora del propietario** = Σ pagos (sin GC) − comisión − ajustes de liquidación − liquidaciones. → modela la "alcancía" que valoran de Leasity.
- **Garantía retenida** (por contrato) = Σ garantía recibida − retenciones − devoluciones. Passthrough, separada de deuda y billetera.

## Precisión y datos
- **CLP**: enteros (peso, sin centavos). La conversión UF→CLP redondea al peso.
- **UF**: `DECIMAL` con 2–4 decimales para el valor de renta; serie UF como CLP/UF con 2 decimales.
- Nunca `float`.
- **Multi-tenant**: toda fila lleva `tenant_id`; aislamiento por RLS.
- **Auditoría**: todo cambio sobre dinero queda registrado (quién, cuándo, qué).

## Extensibilidad (fuera del MVP)
- El modelo es **contrato-céntrico mensual** (arriendo largo).
- El **arriendo diario/semanal** (Fase 2) usará la misma idea de "período + multa configurable", pero con calendario de disponibilidad por-noche. Punto de extensión anotado para no acoplar el MVP.

## En el MVP local
- **Real**: denominación UF/CLP, reajuste IPC por aniversario, períodos mes completo, multa, interés por mora, conciliación por monto exacto, ledger inmutable, filtros.
- **Simulado**: serie de UF e IPC (datos de ejemplo cargados), "pago recibido" (botón que dispara la conciliación), envío de correos (se registran, no se envían), PAC.
