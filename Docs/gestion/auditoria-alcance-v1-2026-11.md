# Auditoría de alcance V1 — qué falta o está a medias

> _2026-11-09._ Contrasta lo que la documentación describe como alcance de la **V1**
> con el código real y con los rowmaps. No se ejecutó nada contra producción.

## Qué se entiende por V1

El documento de lanzamiento ([tareas-gestion-lanzamiento-propigo.md](tareas-gestion-lanzamiento-propigo.md))
define la salida en tres pasos: **V0** (sitio publicado con Webpay Plus en ambiente
de integración, solo para validar con Transbank), **V1** (mismo código con credenciales
productivas: **cobro de suscripción por Webpay Plus, pago manual por período**) y **V2**
(Oneclick). Sumado a eso, la V1 hereda: los bloqueantes de
[despliegue-produccion.md](../tecnica/despliegue-produccion.md), la Ley 21.719 (vigente
**2026-12-01**) y el producto del PRD (todo ✅ en el PRD; esa parte está cerrada).

**Veredicto:** el producto para corredores y partes (RF-* del PRD) está completo. Lo que
falta es el **cobro del propio SaaS**, la **operación en producción** y el **cumplimiento
de la Ley 21.719**. Hoy no se puede cobrar a nadie ni abrir registros con seguridad.

Leyenda — **Prioridad:** P0 impide la V1 · P1 conviene tenerlo en la V1 · P2 puede salir después.
**Dificultad** (solo ingeniería, sin contar esperas de terceros): Baja ≤ 2 días · Media ~1–2 semanas · Alta > 2 semanas o riesgo legal.

## A. Cobro de la suscripción (núcleo de la V1)

| # | Funcionalidad | Estado real | Bloqueante | Qué necesitamos | Dific. | Prior. |
|---|---|---|---|---|---|---|
| A1 | **Adaptador Webpay Plus** (P-B2) | Solo existe `fake-gateway.ts`; el puerto `BillingGateway` está listo | Afiliación a Transbank (P-01) y código de comercio de integración; empresa con inicio de actividades y cuenta corriente (E-01, E-02) | Trámite de gerencia; luego implementar el adaptador contra el ambiente de integración y correr los casos de prueba de Transbank | Media | P0 |
| A2 | **Alta de suscripción y checkout** (P-B3) | No existe. Mi Plan solo manda una solicitud a soporte; no hay pantalla de pago | A1; decisiones D-08 (sin trial, recomendado) y D-09 (qué pasa con los tenants "Gratuito") | Pantalla de pago, activación del plan y retorno desde Webpay; decidir D-09 | Media | P0 |
| A3 | **Cobro por período y conversión UF→CLP** (P-B4) | No existe; el precio se muestra en UF pero nada lo convierte ni lo cobra | N-03 (¿con qué UF se convierte y qué pasa si la fuente falla?) y fuente de UF (ver C1) | Confirmar la recomendación (UF del día de emisión, congelada en el cargo; si la fuente falla, no cobrar). Reloj inyectable para probar | Media | P0 |
| A4 | **Cobranza y suspensión por mora** (P-B5) | No existe (D-10 ya decidida: 10 días de gracia desde la notificación) | A3 | Aviso previo al vencimiento, gracia de 10 días, suspensión sin borrar datos | Media | P0 |
| A5 | **`Tenant.plan` derivado de la suscripción** (P-B8) | `plan` es un texto libre; todo registro nuevo queda "Gratuito" | A2; D-09 | Migración y cambio de lectura en `lib/plans.ts` | Baja | P0 |
| A6 | **Boleta / factura electrónica** (P-B9) | No existe. Mi Plan ofrece una «boleta demo» en PDF | D-07b (elegir proveedor: Haulmer/OpenFactura o Bsale), E-01 y E-05 (contratar API de DTE) | Elegir y contratar proveedor; integrar emisión por cobro y envío por correo. Un cobro real sin documento tributario no es viable | Alta | P0 |
| A7 | **Cambio de plan** (P-B6) | A medias: las reglas de precio están en `cambio-plan.ts`; la solicitud llega a soporte y un humano la aplica | A3 (para cobrar la diferencia); D-19 (plan anual, no urgente) | Conectar las reglas al cobro | Baja | P1 |
| A8 | **Devolución del 100 % en 10 días** (P-C1…C4) | No existe; nada llama a `reembolsar()`. El texto público promete lo que no se puede cumplir (hallazgo H-01) | D-06 (revisión legal) y D-15 (condiciones objetivas); A3 | Texto reescrito como garantía comercial con condiciones objetivas; motor de elegibilidad, reembolso y cola manual; anti-abuso por RUT | Media | P0 (o retirar la promesa) |
| A9 | **Panel interno de cobros** (P-A6) | No existe | A3 | Vista de cargos, fallos y eventos del gateway | Baja | P1 |

## B. Operación en producción

| # | Funcionalidad | Estado real | Bloqueante | Qué necesitamos | Dific. | Prior. |
|---|---|---|---|---|---|---|
| B1 | **Archivos en S3** (fotos, cédulas, contratos) | Todo se escribe en disco local (`public/uploads`, `private-uploads`). En App Runner es efímero: se pierde en cada despliegue | Decisión de nube (B6) | Cambio en `api/upload/route.ts`, `lib/uploads.ts` y las rutas de lectura; URL firmada corta para privados | Media | P0 |
| B2 | **Programador del cron** | El endpoint `/api/cron/recordatorios` existe (recordatorios, correos, purga de retención, reintento de consultas), pero nada en el repo lo programa | Definir el servicio de hosting | Un job diario (EventBridge o similar) con `CRON_SECRET`. Sin él no hay recordatorios ni cumplimiento de retención | Baja | P0 |
| B3 | **Correo real** | En desarrollo se simula en consola; Resend sin dominio verificado | C-01…C-04 (Workspace, DNS, Resend) | Dominio verificado con SPF, DKIM y DMARC; clave en el gestor de secretos | Baja | P0 |
| B4 | **Respaldos y restauración** | Sin política ni prueba | H-04 y proveedor elegido | Definir RPO/RTO, activar respaldos de RDS y probar una restauración | Baja | P0 |
| B5 | **Rate limit en memoria** | Cada instancia tiene su contador | — | Mantener 1 instancia, o Redis antes de escalar | Baja | P1 |
| B6 | **Decisión de nube** (ADR-0001 / H-01) | Abierta: AWS us-east-1 vs. Google Cloud Santiago | Gerencia | Decidir, crear la cuenta de la empresa con alerta de presupuesto | — | P0 |
| B7 | **Clave de IA de producción** | `startup-check` aborta si falta `GROQ_API_KEY`; hoy es clave de desarrollo | H-03 | Contratar a nombre de la empresa con límite de gasto | Baja | P0 |
| B8 | **Datos reales de la empresa** | `privacidad` aún tiene el RUT de relleno `77.000.000-0`; los términos dicen que la plataforma «nunca solicita pagos» | E-03, E-04 | Entregar RUT y teléfono; abogado revisa términos y privacidad con el cobro incluido | Baja | P0 |
| B9 | **Runbook de incidentes y piloto** (P-F1…F3) | No existe | D-17 | Escribir el runbook; piloto con conciliación manual | Baja | P1 |

## C. Datos de referencia (UF e IPC)

| # | Funcionalidad | Estado real | Bloqueante | Qué necesitamos | Dific. | Prior. |
|---|---|---|---|---|---|---|
| C1 | **Carga periódica de UF e IPC** (L-FU1/2) | ✅ **Hecho 2026-11-09**: cargador dentro del cron diario (`lib/indicadores/`), con la API del Banco Central. Pendiente solo el token | `BCCH_API_TOKEN`: registrar la cuenta en si3.bcentral.cl | Gerencia obtiene el token; probar la primera carga contra la API real | Media | **P0** |
| C2 | **Negarse a reajustar con serie incompleta** (L-FU3) | ✅ **Hecho 2026-11-09**: la conciliación se rechaza nombrando el mes que falta. **Abierto L-10**: con datos reales el IPC del mes del pago aún no existe, así que habría que reajustar con el mes anterior | L-10 (decisión de dominio y legal) | Definir el mes de referencia del reajuste | Baja | **P0** |
| C3 | **Documento de reajuste con fuente y fecha** (L-FU4, L-CM4) | No existe el aviso de reajuste en PDF | C2; G-04 | PDF con los 12 meses de IPC y la fuente | Media | P1 |

## D. Ley 21.719 — vigente 2026-12-01

| # | Funcionalidad | Estado real | Bloqueante | Qué necesitamos | Dific. | Prior. |
|---|---|---|---|---|---|---|
| D1 | **Derecho de supresión** (L-DP5) | No existe. Hecho: acceso, portabilidad, rectificación, oposición, registro de tratamiento y retención | L-05: cómo anonimizar sin romper el ledger inmutable (propuesta: anonimizar la persona y conservar los asientos) — requiere revisión legal | Decisión legal; luego anonimización irreversible con pruebas contra Postgres real | Alta | **P0** |
| D2 | **Canal para ejercer derechos, con acuse y plazo** (L-DP7) | No existe | L-06 (plazo legal) y C-05 (quién responde privacidad@) | Formulario con folio, acuse por correo y vencimiento visible | Media | P0 |
| D3 | **Brechas y delegado de datos** (L-DP9/10) | No existe | L-07: ¿responsable o encargado? Requiere abogado | Procedimiento escrito y decisión sobre el delegado | Baja | P0 |
| D4 | **Realinear la política** (L-DP12) | Pendiente | D1–D3 | Reescribir al final | Baja | P1 |

## E. Producto a medias o sin hacer (no bloquea el cobro)

| # | Funcionalidad | Estado real | Bloqueante | Qué necesitamos | Dific. | Prior. |
|---|---|---|---|---|---|---|
| E1 | **Voucher de liquidación al propietario** (P-GA2) | El voucher guarda siempre `arrendatarioId`, aunque la liquidación es del propietario | G-03 (¿`personaId` + destinatario?) | Migración y ajuste de comprobantes | Baja | P1 |
| E2 | **Aviso anticipado de reajuste** (P-NT1…3) | No existe | G-04 (propuesta: 30 días antes) | Nuevo tipo de notificación, plantilla antes/después | Media | P1 |
| E3 | **Promesas de planes sin respaldo** (N-07, N-08) | Soporte prioritario y servicios de Diamond (migración, capacitación) no tienen capacidad definida. Plan Enterprise (N-01) sin hacer | Negocio | Definir SLA y límites, o quitar el texto; decidir Enterprise | Baja | P1 |
| E4 | **Declaración Jurada 1835** (L-DJ1) | No existe | L-09 (campos oficiales) | Leer el formulario oficial; exportador y recordatorio anual | Media | P2 |
| E5 | **Subsidio de arriendo** (L-SB1…6) | No existe | Rediseño del origen de pago por período | Modelo de pago de terceros y copago | Alta | P2 |
| E6 | **Logo oficial en SVG** (M-04) | Hay una versión vectorial aproximada | Diseñador | Recibir los archivos | Baja | P2 |

## Fuera del alcance V1 (confirmado, no es deuda)

Firma electrónica avanzada y Ley 21.461, workflow de morosidad, arriendos por días,
sindicación a portales, canal de pago A2A/PAC y comisión por pago (Fase D–E del rowmap
de pagos), Oneclick (V2) y app móvil. El Free Tier se evalúa para después de poder cobrar.

## Ruta crítica sugerida

1. **Esta semana, sin código:** decisiones D-06, D-15, D-07b, L-05, L-06, L-07, L-08, N-03 y D-09; afiliación Transbank, dominio de correo, nube y RUT real. Casi todo lo P0 espera esto.
2. **Código que ya se puede hacer sin esperar a nadie:** C1 (cargador de UF/IPC con la fuente recomendada), C2 (no reajustar en silencio), B1 (S3), B2 (cron), A5 y el motor de elegibilidad de A8 contra el adaptador falso.
3. **Con credenciales de Transbank:** A1 → A2 → A3 → A4 → A6 → A8.
4. **Antes del 2026-12-01:** D1–D3, y mientras tanto mantener los registros cerrados (decisión V0 de 2026-11-02). Hoy `/registro` sigue abierto y asigna plan «Gratuito»; conviene cerrarlo con un interruptor hasta cumplir D y B.
