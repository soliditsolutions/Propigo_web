# ADR-0002 — Stack: Next.js como monolito modular, con foco en seguridad

- **Fecha**: 2026-06-03
- **Estado**: Aceptada

## Contexto
Propigo maneja datos financieros y personales **altamente sensibles**. Se evaluó si un stack Next.js full-stack es adecuado frente a ataques de terceros, o si conviene separar frontend y backend.

## Decisión
**Next.js (App Router) + TypeScript como monolito modular**, con:
- **Núcleo financiero en un paquete aislado** (sin imports de Next.js), extraíble como servicio privado en producción.
- **Separación del plano público (marketplace) y el plano financiero (admin B2B)** en despliegues distintos.
- **Autorización en la capa de acceso a datos**, no en el middleware.
- **Row-Level Security (RLS) en PostgreSQL** para aislamiento multi-tenant.

Complementos: Tailwind + shadcn/ui (UI), Prisma (ORM), PostgreSQL (datos), Docker (local).

## Justificación
- **Separar frontend/backend no aporta seguridad por sí solo**; añade superficie de ataque y handoffs de autenticación que suelen introducir huecos. La seguridad la definen los **límites de confianza** y **dónde se hace la autorización**, no la topología.
- **CVE-2025-29927**: el middleware de Next.js fue saltable con un header `x-middleware-subrequest` falsificado. Por eso la autorización se valida en cada Route Handler/Server Action sobre la capa de datos, y el middleware se usa solo para UX.
- **Defensa en profundidad**: RLS hace que el aislamiento entre tenants lo garantice la base de datos aunque exista un bug en el código.
- **Núcleo aislado**: permite endurecer y, en producción, mover la lógica de dinero a una red privada sin acceso a internet, a la que el marketplace público nunca habla directo.
- **Velocidad**: una sola tecnología y repo para B2B y B2C; graduable a producción sin reescritura.

## Alternativas consideradas
- **Frontend (React/Vite) + backend separado (NestJS/Python)**: descartado para el MVP por mayor complejidad operativa sin ganancia de seguridad real a esta escala.
- **Monolito acoplado** (lógica de dinero mezclada con Next.js): descartado; impide aislar el núcleo y endurecerlo.

## Consecuencias
- Disciplina obligatoria: el paquete de dominio no importa nada de Next.js.
- Autorización explícita en cada operación de datos (no confiar en middleware).
- Configurar RLS desde el esquema inicial.
- Camino claro a producción: extraer el núcleo como servicio privado cuando se requiera.

## Controles de seguridad asociados
Ver la sección Seguridad de [Arquitectura de producción](../tecnica/arquitectura-y-despliegue.md).
