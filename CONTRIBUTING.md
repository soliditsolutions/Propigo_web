# Guía de contribución — Propigo

Gracias por contribuir. Estas reglas mantienen el repositorio consistente, revisable y seguro.

> **Nota:** el proyecto aún no está bajo control de versiones Git remoto. Esta guía define el **flujo objetivo** para cuando se conecte GitHub; adóptalo desde ya para minimizar fricción.

---

## 1. Flujo de trabajo (Git Flow simplificado)

- `main` — siempre desplegable. No se hace push directo; todo entra por Pull Request.
- `develop` — integración (opcional; si no se usa, las ramas salen de `main`).
- Ramas de trabajo: se crean desde `main`/`develop` y se fusionan por PR.

### Convención de nombres de ramas

```
<tipo>/<descripcion-corta-en-kebab-case>
```

| Tipo | Uso |
|---|---|
| `feat/` | Nueva funcionalidad |
| `fix/` | Corrección de bug |
| `refactor/` | Reestructura sin cambio de comportamiento |
| `docs/` | Solo documentación |
| `test/` | Solo tests |
| `chore/` | Tooling, dependencias, config |

Ejemplos: `feat/portal-filtro-por-anio`, `fix/reajuste-ipc-conciliacion`, `docs/api-reference`.

---

## 2. Commits — Conventional Commits

```
<tipo>(<ámbito opcional>): <descripción en imperativo, minúscula>
```

Tipos: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `build`, `ci`.

Ejemplos:
- `feat(portal): agrega filtro de pagos por año`
- `fix(cobros): aplica reajuste IPC al conciliar contratos CLP`
- `refactor(ui): extrae <Modal> compartido de los 3 modales del marketplace`

Reglas: un commit = un cambio lógico; mensaje en español; sin punto final.

---

## 3. Pull Requests

Antes de abrir un PR:

1. `npm run lint` — sin errores.
2. `npm test -w @propigo/web` y `npm test -w @propigo/core` — verdes.
3. `npm run build` — compila.
4. Si tocaste el schema: `npm run db:push` + revisar `prisma/sql/setup.sql` (RLS/vistas).
5. Verifica el cambio en el navegador si es observable (no solo "compila").

El PR debe incluir:
- **Qué** cambia y **por qué**.
- Cómo probarlo (pasos).
- Capturas si hay cambios de UI.
- Enlace al ítem del backlog / issue.

Regla de revisión: al menos **1 aprobación**. No fusionar con checks en rojo. Preferir *squash merge* para mantener el historial limpio.

---

## 4. Estilo de código

- **TypeScript estricto.** Nada de `any` salvo justificación; tipar bordes.
- **ESLint** (`eslint-config-next`) es la autoridad de estilo. `npm run lint` antes de commitear.
- **Nombres en español** para dominio, UI, rutas y copy (modelos, campos, componentes de negocio). Utilidades genéricas pueden ir en inglés.
- **Dinero:** `Decimal`/enteros, nunca `float`.
- **Componentes:** preferir Server Components; marcar `"use client"` solo cuando se necesite interactividad/estado.
- **DRY:** reutilizar `lib/format`, `lib/propiedad-meta`, `components/ui/*` (`<Modal>`, `<Spinner>`), `components/public/*` (`<Logo>`, `<PublicNavbar>`, `<PublicFooter>`). Ver `Docs/` y `BRAIN.md`.

---

## 5. Reglas de seguridad (obligatorias)

Ver `BRAIN.md` §4. En resumen, un PR **no se aprueba** si:

- Expone mensajes internos (Prisma/stack) al cliente.
- Introduce una query/mutación sin verificar `tenantId`.
- Pone secretos en el cliente o en el repo.
- Debilita la anti-enumeración del portal (ADR-0007) o el consentimiento (Ley 21.719).
- Activa `NODE_TLS_REJECT_UNAUTHORIZED=0` fuera de dev.

---

## 6. Documentación

- Si el cambio altera comportamiento, actualiza el doc correspondiente en `Docs/` y el checklist `Docs/gestion/PROGRESO.md`.
- Si resolviste un problema no obvio, agrega una nota a `BRAIN.md`.
- Decisiones de arquitectura relevantes → nuevo **ADR** en `Docs/decisiones/`.

---

## 7. CI/CD (objetivo)

El pipeline previsto (ver `Docs/tecnica/arquitectura-y-despliegue.md`) ejecuta en cada PR: `lint` → `test` → `build`. El merge a `main` dispara el despliegue. Ningún merge con checks en rojo.
