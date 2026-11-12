# ADR-0015 — Hosting: VM en Google Cloud Santiago con Cloud SQL

- **Fecha**: 2026-11-12
- **Estado**: Aceptada (condicionada a la prueba de concepto)
- **Cierra**: ADR-0001 (decisión de nube diferida) y la tarea H-01.

## Contexto
ADR-0001 difirió la nube hasta el despliegue. La evaluación de
[evaluacion-gcp-santiago.md](../gestion/evaluacion-gcp-santiago.md) comparó una VM
con Cloud SQL (A) contra Cloud Run con Cloud Storage (B). La app guarda cédulas,
contratos y comprobantes, y la Ley 21.719 pesa sobre dónde viven esos datos.

## Decisión
**Opción A: una VM `e2-medium` en `southamerica-west1` (Santiago) con Docker y
Caddy, más Cloud SQL para PostgreSQL 16 conectado por Cloud SQL Auth Proxy.**
Archivos en disco persistente con *snapshots* cada 4 horas.

## Justificación
- Datos en Chile: el hosting no es una transferencia internacional (la excepción,
  Groq, se declara aparte en la política de privacidad).
- **Cero cambios de código.** La app asume disco persistente y una sola instancia
  (archivos locales, límite de intentos en memoria); la VM lo cumple tal cual.
- Costo estimado ≈ US$ 115/mes frente a ≈ US$ 130–140 de Cloud Run.

## Consecuencias
- Hay que operar el sistema operativo (parches) y aceptar un punto único de falla
  (restauración desde *snapshot*, ≈ 30–60 min).
- **Condición:** la prueba de concepto de la evaluación debe pasar antes de
  desplegar: `setup.sql` aplica completo en Cloud SQL (roles, RLS, funciones), los
  archivos sobreviven a reinicios y se restaura un *snapshot* y un PITR.
- Si la prueba falla en Cloud SQL, se vuelve a evaluar (Cloud SQL alternativo o AWS).
- Queda pendiente reescribir `despliegue-produccion.md`, hoy redactado para AWS
  App Runner.
- Cloud Run (opción B) sigue siendo el destino cuando haga falta más de una
  instancia; exigirá mover los archivos a Cloud Storage y el límite de intentos a Redis.
