# Propigo — instrucciones para agentes

Monorepo: `apps/web` (Next.js 16 + Prisma; ver `apps/web/AGENTS.md`) y `packages/core`. Documentación de producto y decisiones en `Docs/`.

## Marca
El producto se llama **Propigo** (dominio `propigo.cl`, eslogan "Publica más. Complica menos."). El nombre anterior, "Housing", ya no se usa en ninguna parte: paquetes `@propigo/*`, base `propigo` con roles `propigo`/`propigo_app`, contenedor `propigo-db`, tokens CSS `--pgo-*`, clases `pgo-*` y cookies/claves `pgo_*`. Todo texto visible usa las constantes de `apps/web/src/lib/marca.ts` (nombre, eslogan, razón social, correos) y el componente `Logo`/`Isotipo` de `components/public/Logo.tsx`; nunca escribir la marca o un correo a mano. SOLIDIT SpA es la razón social: solo en legales, pie de página y documentos, nunca en el logo.

## Precedencia sobre skills globales (ponytail, graphify)
Las reglas de este proyecto prevalecen sobre ponytail y graphify. Choques resueltos:
- **Comentarios `shortcut:`** — no se usan. Este proyecto exige cero deuda técnica: lo que se detecta se corrige en el acto, no se deja anotado como atajo.
- **Tests** — toda lógica no trivial lleva su prueba con Vitest (`npm test --workspace @propigo/web`); no es opcional aunque ponytail sugiera omitirla.
- **Idioma** — chat y documentación en español; identificadores y textos del producto en español, como el código existente.

## Grafo de código (graphify)
- Reconstruir: `graphify update .` (CLI en `~/.local/bin`; respeta `.graphifyignore`, solo código).
- Consultar un símbolo: `graphify explain "withTenant"`; camino entre dos: `graphify path "A" "B"`.
- Salida en `graphify-out/` (ignorada por git). Los `.sql` no aportan nodos (falta `tree_sitter_sql`).

Config global verificada: 2026-10
