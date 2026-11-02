# Evaluación de implementación en Google Cloud (Santiago)

> _Elaborada 2026-11-01._ Responde a la decisión del mismo día de evaluar GCP
> en la región **southamerica-west1 (Santiago)** como hosting de Propigo.
> Cierra la tarea **H-01** de
> [tareas-gestion-lanzamiento-propigo.md](tareas-gestion-lanzamiento-propigo.md)
> una vez que la gerencia elija opción, y de ella dependen los bloqueantes 1, 2 y 4 de
> [despliegue-produccion.md](../tecnica/despliegue-produccion.md) (fotos y
> documentos, límites de intentos, respaldos) y el primer despliegue.
> Reemplaza como referencia de hosting al análisis AWS de
> [costos-infraestructura-y-precios.md](costos-infraestructura-y-precios.md),
> que asumía us-east-1 porque la región de AWS en Chile no operaba.

## 1. Por qué Santiago

- **Datos en Chile.** La app guarda cédulas, contratos y comprobantes. Con la
  Ley 21.719 vigente desde el **1 de diciembre de 2026**, tener la base y los
  archivos en Chile evita tratar el hosting como transferencia internacional.
- **Latencia** de un dígito de milisegundos para usuarios chilenos, contra
  ~110-130 ms a Virginia.
- **Excepción a tener presente:** la lectura del carnet y la validación de
  contratos con IA envían datos a la API de Groq, fuera de Chile. Eso sí es
  transferencia internacional y debe quedar declarado en la política de
  privacidad, sea cual sea el hosting.

## 2. Lo que la app exige hoy (verificado en el código)

| Requisito | Detalle | Consecuencia en GCP |
|---|---|---|
| Contenedor Node | Imagen `runtime` del `Dockerfile` (Next standalone, puerto 3000, `/api/salud`) | Sirve tal cual en una VM o en Cloud Run |
| PostgreSQL 16 con roles y RLS | `db:deploy` crea `propigo_app`, políticas RLS y funciones `SECURITY DEFINER` (`setup.sql`) | Cloud SQL lo permite (el usuario `postgres` tiene `CREATEROLE`); **probarlo en la prueba de concepto** antes de decidir |
| Disco persistente | Fotos en `public/uploads/`, documentos privados en `UPLOADS_PATH`. **Verificado el 2026-11-01** con el build de producción: un archivo agregado con el servidor ya en marcha se sirve (200), también por el optimizador de imágenes | Una VM con disco persistente funciona **sin cambios de código**; Cloud Run no tiene disco persistente y obliga a mover los archivos a Cloud Storage |
| Una sola instancia | El límite de intentos (login, recuperación, formularios públicos) vive en memoria | VM única: correcto. Cloud Run: fijar `max-instances=1` o pasar a Redis |
| Tarea diaria | `POST /api/cron/recordatorios` con `CRON_SECRET` | cron del sistema en la VM, o Cloud Scheduler |
| IP real del cliente | `PROXIES_CONFIABLES` = cantidad de proxies propios delante | Caddy en la VM: 1. Balanceador de Google delante: verificar (agrega su propio salto) |

## 3. Opciones

### A. VM (Compute Engine) + Cloud SQL — **recomendada para salir**

- 1 VM `e2-medium` (2 vCPU compartidas, 4 GB) con Docker; Caddy delante para
  HTTPS automático.
- Disco persistente para `public/uploads` y `UPLOADS_PATH`, montado como volumen
  del contenedor; *snapshots* programados.
- Cloud SQL para PostgreSQL 16, edición Enterprise, conectado por **Cloud SQL
  Auth Proxy** en la misma VM (cifra la conexión sin desactivar la verificación
  TLS, que la app rechaza en producción).
- **Cambios de código: ninguno.**
- **Contras:** hay que mantener el sistema operativo (parches automáticos o
  Container-Optimized OS) y la VM es un punto único de falla: si se cae,
  la recuperación es restaurar el disco desde un *snapshot* (del orden de 30-60 min).

### B. Cloud Run + Cloud SQL + Cloud Storage

- HTTPS, escalado y parches los maneja Google.
- **Cambios de código obligatorios:** subir y servir fotos y documentos desde
  Cloud Storage (`api/upload`, `lib/uploads.ts`, descarga de documentos con URL
  firmada de corta duración) y fijar `max-instances=1` hasta tener Redis.
- Más caro con tráfico bajo, porque para no tener arranques en frío ni perder el
  límite de intentos hay que dejar una instancia siempre encendida.
- Es el destino natural **cuando haga falta más de una instancia**.

### Descartada: Postgres dentro de la misma VM

La más barata (~US$ 40/mes), pero los respaldos, la restauración y los parches
de la base quedan a cargo propio. Con cédulas y contratos guardados, no compensa
el ahorro.

## 4. Costo estimado (USD/mes, sin IVA, tráfico de arranque)

| Recurso | Opción A | Opción B | Fuente |
|---|---:|---:|---|
| Cómputo | VM e2-medium **34,98** | Cloud Run 1 vCPU / 1 GiB, 1 instancia siempre activa **≈ 55-65** | VM: gcloud-compute.com (Santiago). Cloud Run: tarifa Tier 2 de CPU US$ 0,0000216/vCPU-s (oficial); la de memoria Tier 2 no se pudo confirmar |
| Disco de la VM | pd-balanced 30 GB **4,29** | — | gcloud-compute.com |
| Cloud SQL (`db-standard-1`: 1 vCPU, 3,75 GB, Enterprise) | **≈ 69** | **≈ 69** | Bytebase (Santiago). Solo cómputo; almacenamiento y respaldos aparte |
| Almacenamiento de la base y respaldos (20 GB) | ≈ 5 | ≈ 5 | Estimación; confirmar en la calculadora |
| Archivos | *snapshots* ≈ 1-2 | Cloud Storage Standard US$ 0,030/GB → ≈ 1 | Cloud Storage: tabla oficial de Santiago |
| **Total aproximado** | **≈ US$ 115** | **≈ US$ 130-140** | |

- **Base más chica:** `db-g1-small` (núcleo compartido, 1,7 GB) baja la opción A
  a ≈ US$ 80, pero **no tiene SLA** de Google. Aceptable para un piloto; no para
  prometer disponibilidad.
- **Descuento por uso comprometido:** la VM baja a US$ 22,04 con 1 año (US$ 15,74 con 3).
  Conviene después de 2-3 meses estables, no antes.
- Santiago cuesta ~40 % más que Iowa (por ejemplo, `db-standard-1`: US$ 69 contra US$ 49).
  Es el precio de tener los datos en Chile.
- **Todos los precios** vienen de agregadores o de páginas oficiales parciales.
  Antes de contratar, **confirmarlos en la calculadora oficial** con la región
  Santiago seleccionada.

## 5. Cómo quedan los bloqueantes con la opción A

| # | Bloqueante | Con la opción A |
|---|---|---|
| 7 | Fotos y documentos en disco efímero | **Resuelto sin código**: disco persistente montado como volumen (`-v` en `public/uploads` y en `UPLOADS_PATH`). Cloud Storage queda para cuando se pase a la opción B |
| 8 | Límite de intentos en memoria | **Resuelto**: una sola VM y una sola instancia del contenedor |
| 9 | Respaldos y RPO/RTO | Base: respaldos automáticos de Cloud SQL más recuperación a un punto en el tiempo (PITR), con retención de 14 días → pérdida máxima de minutos. Archivos: *snapshot* del disco **cada 4 horas**, retención de 14 días → pérdida máxima de 4 h. **Probar una restauración completa antes de abrir registros.** RTO objetivo: < 4 h |
| 10 | Primer despliegue | `PROXIES_CONFIABLES=1` (Caddy agrega la IP real del cliente). Verificar comparando la IP de `acceso_log` con la IP pública propia, según el runbook |

## 6. Siguiente paso: prueba de concepto (1-2 días de TI)

1. Proyecto GCP a nombre de SOLIDIT SpA con alerta de presupuesto (H-02).
2. Cloud SQL `db-g1-small` en Santiago → `npm run db:deploy` con el rol
   administrador. **Criterio:** `setup.sql` aplica completo (roles, RLS,
   funciones) y la app conecta como `propigo_app`.
3. VM `e2-medium` con la imagen `runtime`, Auth Proxy, Caddy y los volúmenes
   montados → subir una foto y un documento, reiniciar el contenedor y la VM, y
   comprobar que ambos siguen disponibles.
4. Restaurar un *snapshot* y un PITR de la base en instancias nuevas, y medir el tiempo.

Si los cuatro pasan: cerrar ADR-0001 con un ADR nuevo, actualizar
`despliegue-produccion.md` (hoy redactado para AWS App Runner) y desplegar.

## Fuentes

- [Cloud Run — ubicaciones y tiers de precio](https://docs.cloud.google.com/run/docs/locations)
- [Cloud Run — precios](https://cloud.google.com/run/pricing)
- [Cloud SQL — precios](https://cloud.google.com/sql/pricing)
- [Cloud Storage — precios](https://cloud.google.com/storage/pricing)
- [gcloud-compute.com — región southamerica-west1](https://gcloud-compute.com/southamerica-west1.html)
- [Bytebase — db-standard-1 por región](https://www.bytebase.com/dbcost/cloudsql/instance/db-standard-1.md)
- [Spare Cores — db-g1-small](https://sparecores.com/database/gcp/db-g1-small)
