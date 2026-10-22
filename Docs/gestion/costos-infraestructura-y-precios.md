# Costos de infraestructura AWS y validación de precios

> **Análisis, no decisión.** Verifica si los precios en UF ya fijados
> (ADR-0014 / rowMap de pagos) resisten el costo real de operar la plataforma.
>
> _Elaborado 2026-08-19. Precios de lista AWS us-east-1, UF $40.850, USD $912._
>
> ⏸️ **La implementación en AWS se difiere a la fase de release.** Hoy el proyecto
> sigue en desarrollo local y montar la nube no aporta nada todavía. Lo que este
> documento entrega y **sí es de uso inmediato** es la Parte II: la definición de
> precios, que necesitaba el costo de infraestructura como insumo.
>
> Queda diferido a release: el dimensionamiento de §2, la elección de región de §3
> y la migración a S3 de §5. Ninguno bloquea el desarrollo — el disco local
> funciona bien mientras no haya despliegue.

## Resumen ejecutivo

La pregunta que originó este análisis fue si los precios en UF se fijaron **sin
considerar el costo de infraestructura**. La respuesta corta es que **sí se
sostienen**: la infraestructura representa entre **1,9 % y 11 % del ingreso**
según la escala, y el margen bruto queda entre **84 % y 93 %**.

El motivo es estructural: **el costo de esta plataforma es casi todo fijo, no por
usuario.** Se paga la base de datos y el cómputo estén conectados 5 corredores o
500. El costo marginal de sumar un tenant es de centavos de dólar.

**El riesgo real no es la infraestructura.** Es (a) los compromisos humanos que
prometen los planes y (b) el cupo de IA como techo de responsabilidad. Ambos se
detallan al final.

---

## 1. Qué consume realmente la plataforma

Inventario levantado del código, no supuesto:

| Componente | Hoy | Implicancia en AWS |
|---|---|---|
| App web | Next.js 16 (SSR, `force-dynamic` en el panel) | Necesita cómputo permanente, no es sitio estático |
| Base de datos | PostgreSQL + Prisma, **RLS por tenant** | RDS PostgreSQL. RLS no cambia el costo, sí la CPU por query |
| Archivos subidos | **`writeFile` a disco local** (5 MB imágenes, 10 MB documentos) | 🔴 **Bloqueante** — ver §5 |
| IA | Groq `llama-3.3-70b-versatile` | Costo externo por token, **el único variable relevante** |
| Correo | Resend | Externo, por volumen |
| Tareas programadas | `api/cron/recordatorios` | Scheduler (EventBridge) |

---

## 2. Arquitectura mínima y óptima

### Mínimo — arranque (hasta ~25 corredores)

| Recurso | USD/mes |
|---|---:|
| ECS Fargate 1 × 0,5 vCPU / 1 GB | 18,02 |
| RDS `db.t4g.micro` Single-AZ | 11,68 |
| Almacenamiento RDS 20 GB | 2,30 |
| Application Load Balancer | 30,00 |
| S3 + CloudFront | 1,00 |
| CloudWatch + Secrets Manager | 3,30 |
| **Total** | **≈ $66** (≈ $60.000 CLP) |

Sin Multi-AZ y con una sola tarea: **si se cae la zona, se cae el servicio**.
Aceptable para validar mercado, no para prometer disponibilidad por contrato.

### Óptimo — producción estable (hasta ~250 corredores)

| Recurso | USD/mes |
|---|---:|
| ECS Fargate 2 × 1 vCPU / 2 GB (2 AZ) | 72,07 |
| RDS `db.t4g.small` **Multi-AZ** | 46,72 |
| Almacenamiento RDS 100 GB | 11,50 |
| Application Load Balancer | 30,00 |
| NAT Gateway | 33,00 |
| S3 + CloudFront | 3,00 |
| CloudWatch + Secrets Manager | 5,80 |
| **Total** | **≈ $202** (≈ $184.000 CLP) |

La diferencia con el mínimo es casi toda **redundancia**: segunda tarea, segunda
AZ de base de datos, failover automático.

### Escala (250-1000 corredores)

3 × 2 vCPU/4 GB + `db.t4g.medium` Multi-AZ ≈ **$464/mes**.

**El costo de infraestructura por tenant cae con la escala:**

| Tramo | Infra/mes | Tenants | Infra por tenant |
|---|---:|---:|---:|
| Arranque | $66 | 25 | **$2,65** |
| Producción | $202 | 250 | **$0,81** |
| Escala | $464 | 1000 | **$0,46** |

---

## 3. Región: por qué NO São Paulo (todavía)

| Opción | Latencia a Chile | Costo relativo |
|---|---|---|
| **us-east-1** (Virginia) | ~120-180 ms | Base |
| **sa-east-1** (São Paulo) | ~30-40 ms | **+52 %** → óptimo sube a $307/mes |
| **cl-south-1** (Santiago) | ~5 ms | **No operativa** — AWS la anunció para fines de 2026 |

**Recomendación: us-east-1 ahora.** São Paulo es la región más cara de AWS a
nivel mundial y cuesta un 52 % más por la misma infraestructura. CloudFront tiene
presencia en Santiago, así que las imágenes y estáticos se sirven local de todas
formas; lo único que viaja a Virginia es el HTML del SSR y las queries.

Cuando la región de Chile entre en operación conviene reevaluar — pero asumiendo
que su precio se parecerá más a São Paulo que a Virginia.

---

## 4. Costo variable por plan

**Costo por revisión de contrato con IA:** input ~7.000 tokens (20.000 caracteres
de contrato, tope real del código, + prompt de sistema) a $0,59/M, output máx.
1.024 tokens a $0,79/M = **$0,00494 por revisión**.

### Si el cupo se consumiera al 100 %

| Plan | Ingreso/mes | IA (cupo lleno) | Storage | Correo | Variable total | % ingreso |
|---|---:|---:|---:|---:|---:|---:|
| Bronze | $11,20 | $0,44 | $0,00 | $0,01 | $0,46 | **4,1 %** |
| Silver | $22,40 | $1,48 | $0,01 | $0,04 | $1,52 | **6,8 %** |
| Gold | $40,31 | $4,45 | $0,02 | $0,09 | $4,55 | **11,3 %** |
| Diamond | $76,15 | $14,82 | $0,05 | $0,18 | $15,04 | **19,8 %** |

### Con uso plausible según cartera

Un Diamond con 200 propiedades genera del orden de 40 revisiones **al mes**, no
3.000. El cupo diario es un techo de abuso, no un consumo esperado:

| Plan | IA a cupo lleno | IA uso realista | Diferencia |
|---|---:|---:|---|
| Bronze | 4,0 % | **0,4 %** | 10× |
| Silver | 6,6 % | **0,7 %** | 9× |
| Gold | 11,0 % | **1,0 %** | 11× |
| Diamond | 19,5 % | **1,0 %** | 19× |

---

## 5. 🔴 Bloqueante antes de desplegar en AWS

**Las subidas de archivos escriben al disco local** (`src/app/api/upload/route.ts`,
`writeFile` a un directorio del servidor).

En Fargate el sistema de archivos es **efímero**: cada despliegue, reinicio o
escalado horizontal **destruye todo lo subido**. Con dos tareas corriendo, además,
una imagen subida en la tarea A no existe en la tarea B — el usuario la ve o no
según qué instancia le toque.

**No es un problema de costo, es de viabilidad**: la arquitectura óptima (2 tareas)
directamente no funciona con el código actual. Migrar a S3 es prerrequisito, no
mejora. El costo de S3 es despreciable ($0,023/GB — Diamond con 200 propiedades
≈ 2,4 GB ≈ **$0,05/mes**); lo que cuesta es el trabajo de migración.

---

## 6. Punto de equilibrio

Cuántos corredores se necesitan para que la suscripción cubra la infraestructura
(descontando 3,5 % de comisión de pasarela y el costo variable):

| Plan | Cubre el mínimo ($66) | Cubre el óptimo ($202) |
|---|---:|---:|
| Bronze | 7 | 20 |
| Silver | 4 | 11 |
| Gold | 2 | 6 |
| Diamond | 2 | 4 |

Con plan anual se necesitan 1-4 tenants más, porque el anual entrega 12 meses de
servicio cobrando 10.

### Margen con una cartera de mix realista

Mix supuesto: 45 % Bronze · 30 % Silver · 18 % Gold · 7 % Diamond.

| Tramo | Ingreso/mes | Infra | % del ingreso | Margen bruto |
|---|---:|---:|---:|---:|
| 25 tenants | $609 | $66 | 10,9 % | **$512 (84 %)** |
| 250 tenants | $6.086 | $202 | 3,3 % | **$5.583 (92 %)** |
| 1000 tenants | $24.344 | $464 | 1,9 % | **$22.679 (93 %)** |

---

## 7. Conclusión sobre los precios vigentes

**No hay que subirlos por infraestructura.** Los precios en UF ya fijados dejan un
margen bruto de 84-93 % después de cómputo, base de datos, almacenamiento, CDN,
correo e IA. La estructura de costos de un SaaS multi-tenant como este es
mayoritariamente fija, y se diluye rápido con cada cliente nuevo.

### Lo que sí amenaza el margen (y no es AWS)

1. **Los compromisos humanos de Diamond** (pregunta **N-08**, aún abierta:
   migración, onboarding y capacitación). Diamond factura $76/mes = **$914/año**.
   Una sola sesión de onboarding y migración asistida puede costar más que un mes
   de infraestructura de toda la plataforma. **Este es el costo que hay que
   acotar, no el de servidores.**

2. **El SLA de "soporte prioritario"** (**N-07**, abierta). Un SLA sin definir es
   un costo sin techo.

3. **El cupo de IA como techo de responsabilidad.** A uso realista cuesta ~1 % del
   ingreso; a cupo lleno, 19,8 % en Diamond. No quiebra el negocio, pero conviene
   saber que el peor caso existe y está acotado.

4. **Costos no modelados acá**: sueldos, proveedor de DTE, adquisición de clientes,
   soporte, y el trabajo de migrar las subidas a S3.

---

## Notas de método

- Precios de lista AWS **us-east-1** a agosto 2026, sin Savings Plans ni Free Tier
  (el Free Tier de 12 meses reduciría el arranque, pero no es base para planificar).
- Se excluyen WAF, Route 53, ECR y transferencia de datos del ALB a internet:
  suman del orden de $10-20/mes y no cambian ninguna conclusión.
- El costo de IA se calculó con los límites **reales del código**
  (`MAX_TEXT_CHARS = 20.000`, `max_tokens = 1024`), no con estimaciones.
- El "uso realista" de IA es un supuesto explícito derivado del tamaño de cartera
  de cada plan. Es la cifra menos firme del análisis y conviene reemplazarla por
  telemetría real en cuanto exista (`consumo_ia_diario` ya la está registrando).

### Fuentes

- [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/) · [desglose 2026](https://fortem.dev/blog/aws-fargate-pricing-real-costs/)
- [RDS `db.t4g.small` — Vantage](https://instances.vantage.sh/aws/rds/db.t4g.small)
- [CloudFront pricing 2026](https://egresscost.com/aws/cloudfront-pricing/)
- [Groq pricing 2026](https://www.cloudzero.com/blog/groq-pricing/)
- [Resend pricing 2026](https://www.stackscored.com/pricing/transactional-email/resend/)
- [AWS región Chile — anuncio](https://aws.amazon.com/blogs/aws/coming-soon-aws-south-america-chile-region/) · [São Paulo +52 %](https://www.concurrencylabs.com/blog/choose-your-aws-region-wisely/)
- [Valor UF agosto 2026](https://valoruf.cl/)

---

# Parte II — Definición de precios

> _Agregada 2026-08-19, tras confirmarse que AWS se implementa recién en release._
> La infraestructura no se monta todavía, pero su costo sí es insumo de esta
> definición: es lo que permite saber cuánto margen hay de verdad.

## Un costo que faltaba: el DTE

El análisis original no incluía la emisión de documentos tributarios. Resulta
ser **costo fijo, no por documento**: el plan PYME de OpenFactura cuesta
**$9.990 CLP/mes con emisión ilimitada**.

Eso cambia el modelo a favor: no encarece los planes chicos. El fijo mensual
queda en **$77 en arranque** y **$233 en producción** (AWS + DTE + correo).

## Margen de contribución real

| Plan | Precio | Pasarela | IA (uso real) | IA (cupo lleno) | Margen real | Peor caso |
|---|---:|---:|---:|---:|---:|---:|
| Bronze | $11,20 | $0,39 | $0,04 | $0,44 | **96 %** | 93 % |
| Silver | $22,40 | $0,77 | $0,16 | $1,48 | **96 %** | 90 % |
| Gold | $40,31 | $1,39 | $0,40 | $4,45 | **96 %** | 86 % |
| Diamond | $76,15 | $2,62 | $0,79 | $14,82 | **96 %** | 77 % |

Incluso con el cupo de IA consumido al 100 % todos los días, el peor plan
(Diamond) conserva **77 % de margen**. No hay ningún plan en riesgo.

## Precio piso

Cuánto tendría que cobrar cada plan para cubrir su costo variable más 1/40 del
fijo de producción — es decir, asumiendo una cartera mínima viable de 40
corredores:

| Plan | Precio hoy | Piso | Holgura |
|---|---:|---:|---:|
| Bronze | $11,20 | $6,47 | **1,7×** |
| Silver | $22,40 | $6,99 | **3,2×** |
| Gold | $40,31 | $7,88 | **5,1×** |
| Diamond | $76,15 | $9,56 | **8,0×** |

**Conclusión: los precios actuales se mantienen.** No hay razón de costo para
moverlos. La holgura va de 1,7× a 8×.

## 🔴 El problema no es el precio, es un hueco en la escalera

Comparando contra Leasity a igual tamaño de cartera:

| Propiedades | Leasity | Propigo | Propigo es |
|---:|---:|---:|---|
| 15 | 0,80 UF | 0,50 UF | 38 % más barato |
| 50 | 1,70 UF | 0,90 UF | 47 % más barato |
| **100** | **2,50 UF** | **1,70 UF** | **32 % más barato** ⚠️ |
| 200 | 3,50 UF | 1,70 UF | 51 % más barato |

**La ventaja se desploma justo en 100 propiedades**, que es el segmento que la
estrategia dice perseguir.

La causa: Gold topa en 75 y el siguiente escalón es Diamond con 200. Quien
tiene 100 propiedades **paga por 200 y usa la mitad**. En precio por propiedad:

| Plan | UF por propiedad | Salto |
|---|---:|---:|
| Bronze | 0,0250 | — |
| Silver | 0,0200 | −20 % |
| Gold | 0,0120 | −40 % |
| Diamond | 0,0085 | −29 % |

**Recomendación:** subir el tope de Gold de 75 a ~120 propiedades, sin tocar su
precio. Cuesta $0 en infraestructura (una propiedad más son centavos) y
convierte el 32 % en ~45 %, alineando la ventaja competitiva justo donde hoy es
más débil. Es la intervención de mayor retorno de todo este análisis.

## Enterprise (responde N-01)

Extrapolando la curva de precio por propiedad:

| Propiedades | Precio sugerido | CLP/mes | USD/mes |
|---:|---:|---:|---:|
| 350 | **2,40 UF** | $98.040 | $108 |
| 500 | **3,10 UF** | $126.635 | $139 |
| 1000 | **4,80 UF** | $196.080 | $215 |

A 1000 propiedades Propigo costaría 4,80 UF donde Leasity ni siquiera ofrece
tramo. El costo marginal de servir ese tenant sigue siendo de centavos, así que
es margen casi puro.

**Sugerencia de implementación:** publicar hasta 500 con precio de lista y de
ahí en adelante "a convenir" con CTA de contacto — no por costo, sino porque un
cliente de ese tamaño necesita conversación de migración de todas formas.

## Lo que de verdad limita el margen

No es la infraestructura, que es 1,9-11 % del ingreso. Es lo humano:

1. **Servicios de Diamond (N-08, abierta).** Una sola sesión de migración y
   onboarding puede costar más que un mes de infraestructura completa. **Mientras
   no se acote, es el único ítem capaz de dar vuelta el margen de un cliente.**
2. **SLA de "soporte prioritario" (N-07, abierta).** Sin definición, es costo sin techo.

Con 96 % de margen de contribución, la rentabilidad de Propigo se decide en
cuántas horas humanas consume cada cliente, no en cuánto cuesta el servidor.

## Decisiones que esta definición deja tomadas

| Decisión | Resultado |
|---|---|
| ¿Subir precios por costo de infraestructura? | **No.** Holgura de 1,7× a 8× sobre el piso |
| ¿Bronze a 0,25 UF es viable? | **Sí**, 96 % de margen. Su límite es humano, no técnico |
| ¿Cupo de IA de Diamond es sostenible? | **Sí**, 77 % de margen incluso al tope |
| **N-01 — tramo Enterprise** | **Sí**: 350/500 con precio de lista, >500 a convenir |
| **Hueco de la escalera** | **Subir Gold de 75 a ~120 propiedades** |

