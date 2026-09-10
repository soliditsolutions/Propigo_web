# Guía: cómo calcular el costo de Housing en AWS elástico

> **Estimación inicial, no cotización.** El objetivo es tener un orden de
> magnitud del costo mensual con afluencia **moderada-alta** y **todo lo
> pendiente implementado**, y —más importante— el **método** para recalcularlo
> con tus propios números y para medir el uso real una vez en producción.
>
> _Elaborado 2026-09-07. Precios de lista AWS **us-east-1**, aproximados. Verificar
> siempre con el [AWS Pricing Calculator](https://calculator.aws) antes de
> comprometer presupuesto. Tipo de cambio referencial: USD $950, UF $39.000._
>
> **Complementa** a [costos-infraestructura-y-precios.md](costos-infraestructura-y-precios.md),
> que modela una arquitectura de **capacidad fija** (Fargate con tareas fijas +
> RDS de instancia fija) y analiza el margen vs. los precios en UF. Esta guía
> modela la variante **elástica** (pagar por lo que se usa) y agrega el método de
> cálculo. Ambas asumen la nube diferida a release ([ADR-0001](../decisiones/ADR-0001-nube.md)).

---

## 0. Resumen ejecutivo

- Con **~500 corredoras**, **~12.000 contratos vigentes** y un **marketplace
  público con tráfico moderado-alto (~300.000 visitas/mes)**, el costo AWS
  estimado es **≈ US$540/mes en us-east-1** (rango **$450–750** según cuánto
  crezca el tráfico público). En São Paulo, ~+50 %: **$680–1.100/mes**.
- **El costo ya no es "casi todo fijo".** En la arquitectura de capacidad fija lo
  era; en la elástica, dos partidas escalan con el público y son las que hay que
  vigilar: **el egreso de datos del marketplace (CloudFront)** y **los ACU de la
  base Aurora Serverless**. Juntas son más de la mitad del total en este escenario.
- **La palanca de costo #1 es el marketplace público**, no el panel. El panel lo
  usan cientos de corredoras; el marketplace lo puede visitar cualquiera, y cada
  visita descarga fotos de propiedades. Ahí está la sensibilidad a la "afluencia".
- **Nada de esto bloquea el desarrollo.** Es un insumo de planificación para
  cuando se decida el release y la nube.

---

## 1. Qué genera costo (inventario del código, con lo pendiente incluido)

Levantado del repositorio, no supuesto. Se marca lo que **agrega lo pendiente**.

| Componente | Implementación | Driver de costo en AWS |
|---|---|---|
| App web SSR | Next.js 16 (`force-dynamic` en panel y portal) | Cómputo permanente/elástico. No es sitio estático. |
| Base de datos | PostgreSQL + Prisma, **RLS por tenant** | Aurora Serverless v2. La RLS no cambia el precio, sí la CPU por query. |
| Marketplace público | Listado + detalle + mapa (Leaflet), anónimo | **Egreso CloudFront** (fotos) + ACU de Aurora (búsquedas). El mayor driver variable. |
| Generación de PDF | `@react-pdf` server-side: comprobantes, liquidaciones, aviso de término, estado de cuenta | **CPU por documento** (~1-3 s cada uno). Se regeneran desde snapshot (L-CP7), no se almacenan. |
| Lectura de carnet | `zxing-wasm` + visión IA en registro | CPU (wasm) + IA externa. |
| IA | Groq `llama-3.3-70b` (contrato), visión (carnet) | **Externo por token** (no AWS). |
| Correo | Resend hoy → **SES** recomendado en AWS | Por volumen. Barato. |
| Archivos | `writeFile` a disco local → **S3** | Storage + requests. Fotos de propiedades y cédulas subidas. |
| Cron | `api/cron/recordatorios`, purga de retención | EventBridge Scheduler. Casi gratis. |
| **Billing / suscripciones** *(pendiente)* | Cobro al registrarse, cron de renovación, webhooks de pasarela (`EventoGatewayPago`) | Cómputo menor + **comisiones de la pasarela** (externas, % por transacción). |
| **Analítica BI** *(pendiente, obs. #5)* | Resúmenes mensuales/anuales, exportables | **ACU de Aurora** (queries pesadas) — sube el promedio. Conviene rollups nocturnos. |
| **Fuentes UF/IPC oficiales** *(pendiente, Grupo G)* | Carga periódica Banco Central / INE | EventBridge + Lambda pequeña. Negligible. |
| **Derechos Ley 21.719** *(pendiente, Grupo E)* | Export de datos por persona | Cómputo ocasional. Negligible. |

---

## 2. Arquitectura elástica propuesta (pagar por uso)

La diferencia con la capacidad fija está en tres piezas que **escalan a la baja
cuando no hay tráfico**:

| Capa | Servicio elástico | Por qué |
|---|---|---|
| Cómputo | **ECS Fargate con auto-scaling** (mín. 2 tareas, sube a 6-8 en peak) | Paga vCPU/GB-hora de lo que corre. Alternativa más elástica abajo. |
| Base de datos | **Aurora Serverless v2 (PostgreSQL)** | Paga por ACU-hora; baja a 0,5 ACU de madrugada, sube con el marketplace. |
| Estáticos y fotos | **S3 + CloudFront** | Paga storage + egreso real. CloudFront tiene POP en Santiago. |
| Correo | **SES** | $0,10 por 1.000 correos. |
| Colas/programado | **EventBridge Scheduler** | Cron sin servidor. |
| Secretos, logs, red | Secrets Manager, CloudWatch, **NAT Gateway** | Casi todo fijo (ver §3.6). |

**Alternativa "máximamente elástica" (Lambda + CloudFront vía OpenNext/SST):**
cómputo por request en vez de por tarea-hora. Baja el piso a casi cero con poco
tráfico, pero introduce cold-starts y complejidad en el render de PDF (2 GB,
2-4 s). **Recomendación:** Fargate con auto-scaling como base (equilibrio
simplicidad/elasticidad); evaluar Lambda solo si el tráfico es muy intermitente.

> **Región:** us-east-1 para arrancar (São Paulo cuesta ~+50 %; la región de
> Santiago aún no opera — ver el doc de costos fijos §3). CloudFront sirve las
> fotos desde Santiago igual, así que a Virginia solo viaja el HTML del SSR y las
> queries.

---

## 3. Método de cálculo por servicio

Para cada servicio: **el driver** (qué lo hace subir), **la fórmula**, y **el
número del escenario** (§4). Reemplaza los supuestos por los tuyos y recalcula.

### 3.1 Cómputo (ECS Fargate con auto-scaling)

- **Driver:** requests concurrentes → nº de tareas activas. El marketplace y la
  generación de PDF son los que más CPU piden.
- **Fórmula:**
  `costo = Σ_tareas (vCPU × $0,04048 + GB × $0,004445) × horas_activas`
- **Cómo dimensionar las tareas:** una tarea de 1 vCPU/2 GB atiende del orden de
  20-40 req/s de SSR liviano, bastante menos si son páginas con muchas queries o
  PDFs. Regla práctica: **1 tarea por cada ~50-100 req/s de peak sostenido**, con
  mínimo 2 (redundancia entre AZ).
- **Escenario:** promedio ponderado ~3 tareas de 1 vCPU/2 GB (2 de base + picos a
  6). `3 × (0,04048 + 2×0,004445) × 730 h ≈ **$108/mes**`. Con los picos reales,
  presupuestar **$110-160**.

### 3.2 Base de datos (Aurora Serverless v2)

- **Driver:** consultas por segundo y su costo de CPU. El panel es liviano; el
  **marketplace y la BI** son los que suben los ACU.
- **Fórmula:** `costo = ACU_promedio × $0,12 × 730 h + storage_GB × $0,10 + I/O`
- **Cómo estimar los ACU:** 1 ACU ≈ 2 GB RAM y una fracción de vCPU. Un panel B2B
  con cientos de tenants vive en 1-2 ACU; el marketplace público empuja a 3-4 ACU
  en horario diurno y baja a 0,5 de madrugada. **Promedio ponderado 2-3 ACU** en
  este escenario.
- **Escenario:** `2,5 ACU × $0,12 × 730 ≈ $219` + storage 50 GB ($5) ≈ **$180-320/mes**.
  Es la partida más grande y la más sensible a la eficiencia de las queries y a
  la BI. **Palanca:** mover los resúmenes mensuales/anuales a rollups nocturnos y
  a réplicas de lectura evita que la BI infle el ACU del horario productivo.

### 3.3 Egreso de datos y CDN (CloudFront) — el driver del "público"

- **Driver:** cada visita al marketplace descarga fotos de propiedades. Esto
  escala **linealmente con la afluencia**, y es lo que hace variable el costo.
- **Fórmula:** `costo ≈ GB_egreso × $0,085 (primeros 10 TB) + requests × $0,0075/10.000`
- **Cómo estimar el egreso:** `visitas × páginas_por_visita × MB_por_página / 1024`.
  El peso por página lo domina el nº y tamaño de las fotos; comprimir a WebP y
  servir tamaños responsivos es la mayor palanca.
- **Escenario:** 300.000 visitas × 5 páginas × ~1 MB = ~1,5 TB/mes.
  `1.500 GB × $0,085 ≈ **$128/mes**`. Si el tráfico se duplica, esta partida se
  duplica —de ahí que sea la que hay que vigilar—.

### 3.4 Almacenamiento (S3)

- **Driver:** fotos de propiedades + documentos subidos (cédulas). Los PDF de
  comprobantes **no se almacenan** (se regeneran del snapshot, L-CP7).
- **Fórmula:** `costo = GB × $0,023 + PUT/1000 × $0,005 + GET/1000 × $0,0004`
- **Escenario:** ~15.000 propiedades × 5 fotos × ~0,5 MB ≈ 37 GB + documentos ≈
  50-150 GB total → **$5-15/mes**.

### 3.5 Correo (SES)

- **Driver:** recordatorios de pago + notificaciones de ciclo + OTP del portal.
- **Fórmula:** `costo = correos/1000 × $0,10`
- **Escenario:** ~3-4 correos/contrato/mes × 12.000 ≈ 40.000/mes → **≈ $4/mes**.
  (Resend cobra bastante más a este volumen; SES es la opción nativa.)

### 3.6 Fijos de operación (no elásticos)

Existen conectado o no, así que son el "piso":

| Recurso | USD/mes |
|---|---:|
| Application Load Balancer | ~$20 |
| NAT Gateway (Aurora/Fargate en subred privada) | ~$32 + datos |
| CloudWatch (logs + métricas, a esta escala) | ~$15-30 |
| Secrets Manager | ~$2 |
| Route 53 | ~$1 |
| **Subtotal fijo** | **≈ $75-90/mes** |

> El NAT Gateway es el fijo "sorpresa": ~$32 solo por existir, más $0,045/GB. Si
> el cómputo pasara a Lambda fuera de VPC, se puede evitar; con Fargate + Aurora
> en subred privada, se paga.

---

## 4. Escenario moderado-alto (todo implementado)

Supuestos — **cámbialos por los tuyos**:

| Driver | Valor |
|---|---:|
| Corredoras activas (tenants) | 500 |
| Propiedades (≈30/corredora) | 15.000 |
| Publicadas en marketplace | ~10.000 |
| Contratos vigentes | 12.000 |
| Usuarios de portal (arrendatarios+propietarios) | ~24.000 |
| Usuarios de panel (managers + colaboradores) | ~1.250 |
| **Visitas marketplace/mes (público)** | **300.000** |
| Cobros conciliados/mes | ~12.000 |
| PDF generados/mes (comprobante+liquidación+descargas) | ~30.000 |
| Correos/mes | ~40.000 |
| Revisiones IA/mes (realista, no cupo lleno) | ~1.000 |
| Cobros de suscripción/mes (pasarela) | ~500 |

### Total AWS estimado

| Servicio | USD/mes |
|---|---:|
| Cómputo (Fargate auto-scaling) | 130 |
| Aurora Serverless v2 | 200 |
| CloudFront / egreso | 130 |
| S3 | 10 |
| SES | 4 |
| Fijos de operación (§3.6) | 85 |
| **Total us-east-1** | **≈ $560/mes** (≈ $530.000 CLP) |
| **Total sa-east-1 (São Paulo, +50 %)** | **≈ $840/mes** |

**Costo por corredora:** ~$1,1/mes (us-east-1). Sigue siendo bajísimo frente al
ingreso (el plan más barato son ~$11/mes), pero **más alto que en el modelo de
capacidad fija** porque acá el marketplace público pesa: es el precio de tener
"afluencia moderada-alta".

### Externos (no AWS, presupuestar aparte)

| Concepto | USD/mes | Nota |
|---|---:|---|
| Groq (IA) | ~$5 | ~1.000 revisiones × $0,005. Escala con uso, no con tenants. |
| Pasarela de pago (Flow/Transbank) | variable | Comisión por transacción (~1-3 % + fijo) sobre los ~500 cobros de suscripción. **Es la partida externa más grande.** |
| Resend (si no se migra a SES) | ~$20-90 | Por eso se recomienda SES. |
| Tiles de mapa (si el proveedor cobra) | variable | Leaflet es gratis; el proveedor de tiles puede cobrar por volumen. |

---

## 5. Análisis de sensibilidad

Qué se mueve si cambia la afluencia (lo demás constante):

| Cambio | Efecto en el total AWS |
|---|---|
| Tráfico marketplace ×2 (600k visitas) | +$130 aprox. (CloudFront + algo de ACU) → **~$690/mes** |
| Tráfico marketplace ×5 | +$520 aprox. → **~$1.080/mes** — el egreso manda |
| Duplicar contratos (24.000) | +$40-70 (más ACU, PDF, correo); el panel escala barato |
| BI sin rollups (queries en vivo) | +$50-150 en Aurora — por eso conviene precalcular |
| Fotos sin optimizar (2 MB/página) | Duplica el egreso de CloudFront (~+$130) |

**Conclusión:** la variable que define el costo es **el egreso del marketplace**,
seguida de **los ACU de Aurora**. Ambas se controlan con optimización de imágenes
y caché/rollups, no comprando más servidor.

---

## 6. Cómo medir el uso REAL en producción

La estimación es el punto de partida; en producción se mide, no se supone:

1. **Cost Explorer + tags.** Etiquetar cada recurso con `app=housing` y
   `componente=<compute|db|cdn|storage>`. Cost Explorer agrupa el gasto por tag y
   muestra la tendencia diaria — ahí se ve qué partida crece.
2. **AWS Budgets con alertas.** Un presupuesto mensual (p. ej. $800) con alarma al
   80 % y al 100 % avisa por correo antes de una sorpresa.
3. **CloudWatch, métricas clave por driver:**
   - Cómputo: `CPUUtilization` y `RunningTaskCount` de ECS → si el auto-scaling
     vive en el máximo, faltan tareas o hay queries lentas.
   - Aurora: `ServerlessDatabaseCapacity` (ACU) y `ACUUtilization` → el promedio
     real reemplaza el supuesto de §3.2.
   - CloudFront: `BytesDownloaded` → el egreso real del marketplace.
   - SES: correos enviados; S3: `BucketSizeBytes`.
4. **Regla de recálculo:** una vez con un mes de datos, sustituir en §3 los
   promedios reales (ACU, GB de egreso, tareas activas) y el total deja de ser
   estimación.

---

## 7. Palancas de optimización (de mayor a menor impacto)

1. **Imágenes del marketplace en WebP + tamaños responsivos + caché larga en
   CloudFront.** Es el mayor ahorro porque ataca el driver #1 (egreso).
2. **Rollups nocturnos para la BI** en vez de queries en vivo: baja el ACU del
   horario productivo.
3. **Savings Plans / Compute Savings Plan** sobre la base de Fargate (la parte que
   siempre corre): ~20-30 % de descuento comprometiendo 1 año.
4. **Aurora I/O-Optimized** si el I/O resultara caro (tarifa plana de I/O).
5. **SES en vez de Resend** a este volumen.
6. **Migrar a Lambda** solo si el tráfico es muy intermitente (elimina el piso de
   Fargate y el NAT, a cambio de cold-starts).

---

## 8. Relación con los precios en UF

Con ingreso de ~500 corredoras (mix de planes ≈ US$15.000-20.000/mes) y un costo
AWS de ~$560, la **infraestructura es ~3 % del ingreso** en este escenario —
coherente con el margen 84-93 % del doc de capacidad fija. El marketplace sube el
costo variable, pero el modelo de negocio lo absorbe con holgura. El riesgo de
margen no está en AWS: está en la pasarela de pago (comisión por transacción) y
en el cupo de IA como techo de abuso, ya señalados en el doc de precios.

---

_Actualizar esta guía cuando: (a) se decida la nube y la región (ADR nuevo),
(b) haya un mes de datos reales en Cost Explorer, o (c) cambien los supuestos de
tráfico de §4._
