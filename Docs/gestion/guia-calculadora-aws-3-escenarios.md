# Guía paso a paso: estimar Propigo en la calculadora de AWS (3 escenarios)

> **Para usar con [calculator.aws](https://calculator.aws).** Esta guía te dice
> **qué servicios agregar y qué valores escribir** para reproducir tú mismo la
> estimación en tres niveles de afluencia: **Baja, Mediana y Alta**.
>
> _Elaborado 2026-09-07. Precios de lista **us-east-1**, aproximados. La UI de la
> calculadora cambia; los nombres de campo son orientativos. Verifica siempre el
> total que arroje la calculadora — este documento da los valores de entrada y el
> total esperado para contrastar._
>
> Contexto y método detrás de estos números: [costos-aws-elastico-y-calculo-de-uso.md](costos-aws-elastico-y-calculo-de-uso.md).

---

## 0. Antes de empezar

1. Entra a **calculator.aws** → **Create estimate**.
2. Arriba, fija la región: **US East (N. Virginia) us-east-1**. (São Paulo cuesta
   ~+50 %; si quieres esa cifra, repite el ejercicio en `sa-east-1` o multiplica
   el total por ~1,5.)
3. Por cada servicio de las secciones siguientes: **Add service** → busca el
   nombre → **Configure** → llena los campos con la columna de tu escenario.
4. Al terminar, **Save and share** genera un enlace público con el desglose.
   Guárdalo; es la forma de versionar la estimación.

> **Consejo:** crea **tres estimaciones separadas** (una por escenario), o un solo
> estimate con tres *groups* ("Baja", "Mediana", "Alta"). Los groups permiten
> comparar los tres totales en una vista.

---

## 1. Los tres escenarios (drivers)

Estos son los supuestos de negocio. **Cámbialos por los tuyos** si tienes mejores
números; todo lo demás se deriva de aquí.

| Driver | Baja | Mediana | Alta |
|---|---:|---:|---:|
| Corredoras activas | 50 | 200 | 500 |
| Propiedades | 1.500 | 6.000 | 15.000 |
| Contratos vigentes | 1.000 | 5.000 | 12.000 |
| Usuarios de portal | 2.000 | 10.000 | 24.000 |
| **Visitas marketplace/mes** | **20.000** | **100.000** | **300.000** |
| Correos/mes | 3.500 | 17.000 | 40.000 |
| PDF generados/mes | 2.500 | 12.000 | 30.000 |
| Revisiones IA/mes | 100 | 400 | 1.000 |

---

## 2. Para qué sirve cada servicio (y por qué Propigo lo usa)

Antes de escribir números conviene entender **qué se está contratando y por qué**.
Cada servicio cubre una necesidad concreta de la plataforma; si alguno no aportara
a una función real, no debería estar en la estimación.

### Servicios AWS

- **Cómputo — App Runner / ECS Fargate.** Es el "servidor" que ejecuta la app
  Next.js: el **panel del corredor**, el **portal de autoconsulta**, el
  **marketplace público** (renderizado en el servidor) y las **APIs**, incluida la
  **generación de PDF** (comprobantes, liquidaciones, aviso de término, estado de
  cuenta). *Por qué se usa:* la app es dinámica (SSR, `force-dynamic`), no un sitio
  estático — necesita cómputo corriendo, no solo archivos servidos.

- **Base de datos — Aurora Serverless v2 / RDS PostgreSQL.** Guarda **todo el
  estado**: corredoras, propiedades, contratos, períodos de pago, el **ledger
  contable inmutable**, personas, vouchers, notificaciones. Con **aislamiento por
  corredora (RLS)**. *Por qué PostgreSQL:* el multi-tenant por RLS y las
  transacciones del ledger exigen una base relacional; el código ya la usa estándar
  (sin lock-in). *Por qué Serverless v2 al crecer:* la carga varía en el día y el
  modelo por ACU se ajusta solo en vez de pagar un servidor sobredimensionado.

- **Almacenamiento — Amazon S3.** Guarda los **archivos** que la plataforma sube o
  recibe: fotos de propiedades y cédulas del registro. *Por qué se usa:* el
  contenedor de cómputo es efímero (se reemplaza en cada deploy) y la base no es
  para binarios — los archivos necesitan un almacén durable y aparte.

- **CDN — Amazon CloudFront.** Entrega fotos y estáticos desde un punto cercano al
  visitante (tiene POP en Santiago) y **cachea el marketplace**. *Por qué se usa:*
  el marketplace es público y con imágenes; sin CDN cada visita golpearía el origen
  y tanto la latencia como el costo de egreso subirían. Es también la capa de caché
  que abarata el cómputo (ver §7).

- **Correo — Amazon SES.** Envía los **correos transaccionales**: recordatorios de
  pago, avisos del ciclo del contrato (firma, vigencia, término) y los **códigos
  OTP** con que las partes entran al portal. *Por qué se usa:* la plataforma
  notifica y autentica por correo; SES es el emisor a escala más barato.

- **Balanceador — Application Load Balancer.** Reparte el tráfico entrante entre
  las tareas de cómputo, en varias zonas, y saca de rotación una que falle
  (health-checks). *Por qué se usa:* con más de una tarea en más de una zona, algo
  tiene que distribuir y dar alta disponibilidad. *(Con App Runner no se contrata:
  trae su propio ingress.)*

- **NAT Gateway.** Permite que la app, estando en una **subred privada**, salga a
  internet para hablar con servicios externos (IA de Groq, pasarela de pago) sin
  quedar ella misma expuesta a conexiones entrantes. *Por qué se usa:* seguridad de
  red — ni la base ni la app deben ser alcanzables desde afuera, pero sí necesitan
  salida controlada.

- **EventBridge Scheduler.** Dispara las **tareas programadas**: recordatorios de
  pago, purga de retención de datos (Ley 21.719) y la carga periódica de UF/IPC.
  *Por qué se usa:* son trabajos que corren solos, sin que nadie los gatille.

- **CloudWatch.** Recolecta **logs y métricas** (CPU, ACU, egreso) y dispara
  alarmas. *Por qué se usa:* sin observabilidad no se sabe cuándo escalar ni dónde
  se va el costo — es lo que convierte esta estimación en medición (ver §5).

- **Secrets Manager.** Guarda **credenciales cifradas** (base de datos,
  `AUTH_SECRET`, llaves de Groq/pasarela/SES) fuera del código. *Por qué se usa:*
  los secretos nunca se hardcodean ni viajan en la imagen del contenedor.

- **Route 53.** DNS del dominio. *Por qué se usa:* apunta el dominio público a
  CloudFront/ALB y resuelve los nombres internos.

### Servicios externos (no AWS, pero parte del costo del servicio)

- **Groq (IA).** Verifica el **carnet** en el registro (visión) y revisa el
  **contrato** (texto). *Por qué:* identidad del corredor y validación del contrato.
- **Pasarela de pago (Flow / Transbank).** Inscribe la tarjeta y cobra la
  **suscripción** al plan. *Por qué:* es el cobro del negocio; su comisión por
  transacción es la mayor partida externa.
- **Resend.** Emisor de correo alternativo a SES (el que usa el código hoy). *Por
  qué se menciona:* a volumen conviene migrar a SES; se estima uno u otro, no ambos.

---

## 3. Servicio por servicio (qué escribir)

### 3.1 Cómputo — **Amazon ECS (Fargate)**

Busca **"AWS Fargate"**. Campos:

| Campo en la calculadora | Baja | Mediana | Alta |
|---|---:|---:|---:|
| Number of tasks | 2 | 3 | 3 |
| Average duration | 730 horas/mes (siempre activo) | 730 | 730 |
| vCPU per task | 0.5 | 1 | 1 |
| Memory per task (GB) | 1 | 2 | 2 |

> El nº de tareas es el **promedio** con auto-scaling (base + picos). Si quieres
> modelar el peak, agrega una segunda línea de Fargate con +2-3 tareas por unas
> 120 h/mes (horario diurno de mayor tráfico).
>
> **Subtotal esperado:** Baja ~$36 · Mediana ~$90 · Alta ~$110-160.

### 3.2 Base de datos — **Amazon Aurora PostgreSQL (Serverless v2)**

Busca **"Amazon Aurora"** → PostgreSQL-Compatible → modo **Serverless v2**.

| Campo | Baja | Mediana | Alta |
|---|---:|---:|---:|
| Average ACUs | 1 | 1.75 | 2.5 |
| Usage (horas/mes) | 730 | 730 | 730 |
| Storage (GB) | 20 | 35 | 50 |
| I/O | usa **I/O-Optimized** si el estimador de I/O te da alto; si no, deja el estándar | — | — |

> **Ojo con la Baja.** Aurora Serverless v2 tiene un piso (~0,5-1 ACU ≈ $44-88/mes)
> que la hace **más cara que una instancia fija pequeña** cuando hay poco tráfico.
> Para el escenario Baja, compara contra **RDS PostgreSQL `db.t4g.micro`** (~$12/mes
> + storage): a esa escala conviene la instancia fija. Aurora Serverless recién
> gana en Mediana/Alta, donde la carga varía y baja de madrugada.
>
> **Subtotal esperado (Aurora v2):** Baja ~$90 · Mediana ~$155 · Alta ~$180-220.
> (Baja con t4g.micro: ~$15.)

### 3.3 CDN y egreso — **Amazon CloudFront** *(el driver del "público")*

Busca **"Amazon CloudFront"**. Es el que más se mueve con la afluencia.

| Campo | Baja | Mediana | Alta |
|---|---:|---:|---:|
| Data transfer out to internet (GB/mes) | 100 | 500 | 1.500 |
| Number of requests (HTTPS) | 2.000.000 | 10.000.000 | 30.000.000 |

> Cómo salen los GB: `visitas × páginas × MB_por_página / 1024`. Se asumió ~1 MB
> por página (dominado por fotos). **Si comprimes a WebP y sirves tamaños
> responsivos, este número —y su costo— baja a la mitad.**
>
> **Subtotal esperado:** Baja ~$9 · Mediana ~$42 · Alta ~$128.

### 3.4 Almacenamiento — **Amazon S3 (Standard)**

Busca **"Amazon S3"**. Guarda fotos de propiedades y cédulas subidas (los PDF de
comprobantes **no se guardan**, se regeneran del snapshot).

| Campo | Baja | Mediana | Alta |
|---|---:|---:|---:|
| S3 Standard storage (GB) | 20 | 60 | 150 |
| PUT/POST requests/mes | 20.000 | 80.000 | 200.000 |
| GET requests/mes | 500.000 | 2.500.000 | 6.000.000 |

> **Subtotal esperado:** Baja ~$1 · Mediana ~$3 · Alta ~$10.

### 3.5 Correo — **Amazon SES**

Busca **"Amazon Simple Email Service"**.

| Campo | Baja | Mediana | Alta |
|---|---:|---:|---:|
| Emails/mes | 3.500 | 17.000 | 40.000 |

> $0,10 por 1.000 correos. **Subtotal:** Baja ~$0,35 · Mediana ~$1,7 · Alta ~$4.
> (Si sigues con Resend, presupuéstalo aparte: cobra bastante más a volumen.)

### 3.6 Balanceador — **Application Load Balancer (ELB)**

Busca **"Elastic Load Balancing"** → Application Load Balancer. Cobra base +
**LCU** (unidades de capacidad). El dimensión que domina acá es *processed bytes*.

| Campo | Baja | Mediana | Alta |
|---|---:|---:|---:|
| New connections/segundo | 10 | 50 | 150 |
| Active connections/minuto | 200 | 1.000 | 3.000 |
| Processed bytes por hora (GB) | 0.2 | 1 | 3 |
| Rule evaluations/segundo | 10 | 50 | 150 |

> **Subtotal esperado:** ~$18-30 en los tres (la base pesa más que las LCU a esta
> escala). Si migras cómputo a Lambda + CloudFront, este servicio desaparece.

### 3.7 Salida a internet privada — **NAT Gateway**

Busca **"NAT Gateway"** (dentro de VPC). Necesario si Fargate/Aurora están en
subred privada.

| Campo | Baja | Mediana | Alta |
|---|---:|---:|---:|
| Number of NAT Gateways | 1 | 1 | 1 |
| Usage (horas/mes) | 730 | 730 | 730 |
| Data processed (GB/mes) | 20 | 60 | 150 |

> **Subtotal esperado:** ~$33-40. Es el "fijo sorpresa": ~$32 solo por existir.

### 3.8 Observabilidad y secretos

- **Amazon CloudWatch** → Logs ingested: Baja 5 GB · Mediana 20 GB · Alta 40 GB
  ($0,50/GB) + un puñado de métricas/alarmas. Subtotal ~$5 / ~$12 / ~$25.
- **AWS Secrets Manager** → 3-5 secretos × $0,40 = ~$2 en los tres.
- **Amazon Route 53** → 1 hosted zone = ~$0,50 + queries. ~$1.

---

## 4. Totales esperados (para contrastar con la calculadora)

| Partida | Baja | Mediana | Alta |
|---|---:|---:|---:|
| Fargate | 36 | 90 | 130 |
| Aurora Serverless v2 | 90 | 155 | 200 |
| CloudFront | 9 | 42 | 128 |
| S3 | 1 | 3 | 10 |
| SES | 0 | 2 | 4 |
| ALB | 20 | 24 | 28 |
| NAT Gateway | 34 | 36 | 40 |
| CloudWatch + Secrets + R53 | 8 | 15 | 28 |
| **Total us-east-1 (USD/mes)** | **≈ $200** | **≈ $370** | **≈ $560** |
| **En CLP (≈$950/USD)** | ~$190.000 | ~$350.000 | ~$530.000 |
| **São Paulo (+50 %)** | ~$300 | ~$555 | ~$840 |

> Si en Baja usas RDS `t4g.micro` en vez de Aurora Serverless, el total baja a
> **~$125/mes**. Es la optimización más grande en ese tramo.

**Externos, no salen en la calculadora AWS** (presupuéstalos aparte):
Groq/IA (~$0,5 / $2 / $5), pasarela de pago (comisión % por transacción sobre los
cobros de suscripción — la partida externa más grande), y tiles de mapa si el
proveedor cobra.

---

## 5. Cómo leer el resultado

- **Lo que más mueve el total es CloudFront (egreso del marketplace) y los ACU de
  Aurora.** Si tu total real difiere mucho del esperado, revisa primero esos dos:
  suelen ser un supuesto de tráfico o de peso de imágenes mal calibrado.
- **El piso (ALB + NAT + CloudWatch + Secrets ≈ $65-90) no baja con menos
  usuarios.** Por eso el costo por corredora es alto en Baja ($4) y cae en Alta
  ($1,1). Si el objetivo es minimizar el piso, la ruta es Lambda + CloudFront
  (elimina ALB y NAT) — a cambio de cold-starts.
- **Guarda el enlace "Save and share"** de cada escenario. Cuando tengas tráfico
  real, reemplaza los drivers de §1 por los medidos (Cost Explorer + CloudWatch,
  ver el doc de método §6) y la estimación deja de ser un supuesto.

---

## 6. Arquitectura recomendada: lanzar barato y crecer sin rehacer

La idea es partir con el **piso de costo más bajo posible** mientras la plataforma
se da a conocer (poco tráfico), pero sobre servicios que **escalan sin obligar a
rehacer** cuando llegue el público. El principio: no pagar hoy por redundancia y
capacidad que nadie usa, y tener un camino de crecimiento ya trazado.

### 5.1 Fase de lanzamiento (bajo uso)

**Objetivo:** validar mercado gastando lo mínimo, con despliegue simple.

| Capa | Servicio recomendado | Por qué en lanzamiento |
|---|---|---|
| Cómputo | **AWS App Runner** (1 instancia, 1 vCPU / 2 GB, auto-scaling activado) | Trae su propio ingress HTTPS: **sin ALB**. Escala solo con el tráfico y deployea desde el repo/imagen. Menos ops que Fargate. |
| Base de datos | **RDS PostgreSQL `db.t4g.micro`, Single-AZ** | Piso ~$12 vs. ~$44-88 de Aurora Serverless. A este tráfico la instancia fija chica gana. |
| Fotos y estáticos | **S3 + CloudFront** | Igual que en todos los escenarios; el egreso a este volumen es centavos. |
| Correo | **SES** | Centavos. |
| Red privada | **VPC connector + 1 NAT Gateway** | Para que App Runner llegue a la RDS privada y a las APIs externas (Groq, pasarela). Es el fijo inevitable. |
| Operación | Secrets Manager, CloudWatch, Route 53 | Mínimos. |

**Costo estimado de lanzamiento:**

| Recurso | USD/mes |
|---|---:|
| App Runner (1 inst., tráfico bajo) | ~$40 |
| RDS `db.t4g.micro` + 20 GB | ~$14 |
| S3 + CloudFront | ~$8 |
| SES | ~$1 |
| NAT Gateway | ~$33 |
| CloudWatch + Secrets + Route 53 | ~$6 |
| **Total us-east-1** | **≈ $100/mes** (≈ $95.000 CLP) |

> **Si quieres bajar aún más el piso:** sin VPC connector, App Runner usa su
> egress gestionado (llega a internet sin NAT) y podrías dejar la RDS accesible
> solo por security group estricto. Ahorras el NAT (~$33) → **~$70/mes**, a costa
> de una postura de red menos limpia. Recomendado solo para un piloto muy inicial.

**Qué se está aceptando en esta fase:** **Single-AZ** — si AWS tiene un problema
en esa zona, el servicio se cae hasta que se recupere. Es aceptable mientras
validas mercado; no lo es si ya firmaste disponibilidad con un cliente.

### 5.2 Señales de que "se está haciendo conocida" (cuándo actuar)

No se escala por corazonada, se escala por métrica. Dispara la acción cuando
**cualquiera** de estas se sostenga por días (todas visibles en CloudWatch):

| Señal | Umbral | Acción que gatilla |
|---|---|---|
| App Runner en el máximo de instancias | recurrente en horario diurno | → Fase de tracción (más cómputo) |
| RDS `CPUUtilization` | > 70 % sostenido | → subir instancia / Multi-AZ |
| RDS conexiones | cerca del límite de la clase | → subir instancia |
| CloudFront `BytesDownloaded` | creciendo >30 % mes a mes | → optimizar imágenes (WebP) |
| Latencia p95 | subiendo notoriamente | → revisar cómputo y queries |

### 5.3 Fase de tracción (empieza a llegar público)

**Acciones:**
1. **RDS `t4g.micro` → `t4g.small`** y **activar Multi-AZ** (redundancia: ya hay
   algo que perder). 
2. Si App Runner se queda corto o quieres control fino de auto-scaling entre
   zonas, **migrar el cómputo a ECS Fargate (2 tareas, 2 AZ) + ALB**. Si App
   Runner aún da abasto, basta con subirle el máximo de instancias.
3. Mantener CloudFront, S3, SES.

| Recurso | USD/mes |
|---|---:|
| Fargate 2× (1 vCPU/2 GB, 2 AZ) **o** App Runner escalado | ~$72-90 |
| RDS `t4g.small` Multi-AZ + 35 GB | ~$50 |
| ALB (si se pasó a Fargate) | ~$20 |
| CloudFront + S3 + SES | ~$47 |
| NAT + CloudWatch + Secrets + R53 | ~$55 |
| **Total us-east-1** | **≈ $300-370/mes** |

Corresponde al escenario **Mediana** de §4.

### 5.4 Fase "conocida" (afluencia alta)

**Acciones (en orden de impacto):**
1. **Cachear el marketplace** (ISR / `Cache-Control: s-maxage` en CloudFront). Es
   lo primero porque es gratis y ataca los dos drivers de cómputo: baja los ACU de
   Aurora y las tareas de Fargate al servir las fichas públicas desde el edge sin
   tocar la base. Ver §7.
2. **Optimizar imágenes del marketplace (WebP + responsivos)** — la palanca contra
   el egreso, que el caché no puede bajar (ver §7).
3. **Migrar la base a Aurora Serverless v2 (Multi-AZ).** Recién ahora conviene:
   la carga varía a lo largo del día y crece, que es donde el modelo por ACU gana
   frente a una instancia fija que habría que sobredimensionar para el peak.
4. **Fargate con auto-scaling 3-8 tareas** en 2-3 AZ.
5. **Réplica de lectura** (o los ACU de Aurora) para aislar la **BI/analítica** del
   horario productivo; precalcular resúmenes mensuales/anuales de noche.

| Recurso | Sin caché | **Con caché de marketplace** |
|---|---:|---:|
| Fargate auto-scaling | ~$130 | ~$90 |
| Aurora Serverless v2 Multi-AZ | ~$200 | ~$140 |
| CloudFront (egreso; caché baja ~15 % por vistas repetidas) | ~$130 | ~$110 |
| S3 + SES | ~$14 | ~$14 |
| ALB + NAT + CloudWatch + Secrets + R53 | ~$85 | ~$85 |
| **Total us-east-1** | **≈ $560/mes** | **≈ $440/mes** |

El escenario **Alta** de §4 está calculado **sin caché** (a propósito, para no
sobrestimar el ahorro antes de que exista). Con la caché de §7 —que es
esencialmente gratis— el total realista baja a **~$440/mes**.

### 5.5 Resumen del camino

| Fase | Cómputo | Base de datos | Redundancia | Total us-east-1 | Cuándo saltar |
|---|---|---|---|---:|---|
| **Lanzamiento** | App Runner 1 inst. | RDS t4g.micro Single-AZ | No | **~$100** | — |
| **Tracción** | Fargate 2× / App Runner escalado | RDS t4g.small Multi-AZ | Sí | **~$300-370** | RDS >70 % CPU o cómputo al máximo |
| **Conocida** | Fargate auto-scaling 3-8 | Aurora Serverless v2 Multi-AZ | Sí | **~$560+** | ACU/egreso creciendo sostenido |

> **Lo que hace que este camino no obligue a rehacer:** el código ya evita SDKs
> propietarios ([ADR-0001](../decisiones/ADR-0001-nube.md)) y usa PostgreSQL
> estándar, así que pasar de RDS fijo a Aurora Serverless es un cambio de motor,
> no de aplicación. App Runner → Fargate es cambiar el envoltorio de despliegue,
> no la app. Cada salto es de infraestructura, con la misma imagen de contenedor
> y la misma base Postgres.

> **Nota sobre São Paulo:** todos los totales de §6 son us-east-1. Si por
> residencia de datos o latencia se elige `sa-east-1`, multiplica por ~1,5
> (lanzamiento ~$150, tracción ~$500, conocida ~$840).

---

## 7. Caché: la palanca que más abarata el marketplace

Los escenarios de §4 se calcularon **sin caché de las páginas del marketplace**,
a propósito: es el peor caso, y así el ahorro de habilitar caché es explícito y no
un supuesto optimista. En producción, la caché es lo primero que hay que activar —
porque es casi gratis y ataca a los dos drivers de cómputo. Hay **dos cosas
distintas que cachear, con ahorros distintos**:

### 6.1 Caché de las páginas y datos del marketplace (lo que más ahorra)

- **Hoy el marketplace es `force-dynamic`:** cada visita anónima ejecuta SSR
  (Fargate) + queries (Aurora). Pero es **público, de solo lectura, y muchas
  personas ven las mismas fichas** → el caso ideal para cachear.
- **Cómo:** `revalidate` de Next.js (ISR) o `Cache-Control: s-maxage` en
  CloudFront sobre el listado y las fichas. Una ficha cambia poco (cuando el
  corredor la edita), así que un TTL corto (1-5 min) —o invalidación on-demand al
  editar— da un *hit ratio* alto.
- **Qué ahorra:** la mayoría de las visitas se sirven desde el edge **sin tocar
  cómputo ni base**. En Alta, baja Aurora de ~2,5 a ~1,7 ACU y Fargate de ~3 a ~2
  tareas → **~$100-120/mes**. Bonus: mejora la latencia y la resiliencia (si la
  base tose, el marketplace cacheado sigue de pie).
- **Costo de habilitarlo:** **~$0.** ISR es de Next.js; la política de caché de
  CloudFront ya viene incluida. No agrega ningún servicio.

### 6.2 Caché de imágenes (edge + navegador)

- **Parte ya estaba asumida:** al poner CloudFront delante, las imágenes se
  cachean en el edge y el estimado usa su tarifa. Lo que faltaba acreditar es el
  **caché del navegador**: con `Cache-Control` largo, las visitas repetidas y los
  assets compartidos (logo, CSS, JS, fotos ya vistas) no se vuelven a descargar →
  menos requests y ~10-20 % menos egreso.
- **Lo que el caché NO baja:** la **primera entrega** de cada imagen única a cada
  visitante nuevo. Ese byte lo cobra CloudFront igual, haya caché o no, porque es
  egreso **hacia el usuario**, no hacia el origen. Ese piso se ataca con **WebP +
  tamaños responsivos** (menos bytes por imagen), no con más caché.

### 6.3 Regla mental

| Palanca | Qué costo baja | Qué costo NO baja |
|---|---|---|
| **Caché de páginas** (ISR/CloudFront) | Aurora (ACU) y Fargate (renders); egreso repetido | El egreso de primera entrega |
| **WebP + responsive** | Egreso de primera entrega (bytes por imagen) | El costo de cómputo |

Son **complementarias**: la caché mata el costo de *cómputo y base* del
marketplace; WebP baja el egreso que la caché no puede tocar. Juntas es donde está
el ahorro grande (Alta: de ~$560 a ~$440).

### 6.4 ¿Y ElastiCache (Redis)?

Solo si alguna query compartida cara no se puede cachear en la capa HTTP. En
general, **ISR + CloudFront cubren el marketplace sin agregar ese servicio**
(~$12-30/mes por un nodo chico). Dejarlo para cuando una métrica lo justifique, no
por defecto.

> **En la arquitectura de §6, la caché va desde el lanzamiento:** activar ISR en
> el marketplace no cuesta nada y hace que el cómputo y la base crezcan más lento
> a medida que llega el público. Es, de hecho, lo que hace que el salto entre
> fases se posponga.

---

_Actualizar cuando cambien los supuestos de §1, se decida región/nube (ADR nuevo),
o AWS cambie precios de lista._
