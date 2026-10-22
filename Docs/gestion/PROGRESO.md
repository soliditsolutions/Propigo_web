# PROGRESO — Estado vivo del proyecto

> Checklist que actualizamos en cada etapa. `[x]` hecho · `[~]` en curso · `[ ]` pendiente.

_Última actualización: 2026-10-21 — **Cambio de marca a Propigo** (dominio `propigo.cl`, eslogan "Publica más. Complica menos."): nombre, logo con isotipo, favicon, títulos, correos (`@propigo.cl`), PDFs y legales (con nueva fecha y re-aceptación del aviso anti-fraude, `pgo_tos_v3`) pasan a la marca nueva; SOLIDIT SpA queda solo como razón social. Toda la identidad vive en `apps/web/src/lib/marca.ts` y el logo en un único componente (antes estaba copiado a mano en 13 pantallas). 923/923 tests, typecheck y lint limpios; revisado en el navegador en desktop y mobile, temas claro y oscuro. Pendiente: archivos SVG oficiales del logo y las tareas de gestión de `tareas-gestion-lanzamiento-propigo.md`._

_Etapa anterior: 2026-08-26 — **Etapa 8**: Grupo 1 cerrado (rol de avalúo SII, cuentas de servicios y roles complementarios, visibles al corredor y a las partes del contrato, nunca al público) y blindaje del sitio público: se encontraron atacando la aplicación corriendo tres fallos reales — `?q=%` devolvía el catálogo completo porque Prisma no escapa los comodines de `LIKE`, doce parámetros del marketplace lo tumbaban con un 500, y la ficha daba 500 en vez de 404 con un id no válido. Ninguno ejecutó SQL. Cerrado el Grupo 1, un barrido de QA manejando la aplicación encontró **siete defectos más**, el peor: editar una propiedad descartaba el rol y las cuentas en silencio, con el diálogo cerrándose sin error. Además, los datos privados ahora salen **tapados** en el portal (se muestran con un botón) y el corredor decide cuáles comparte, con cuentas adicionales que puede agregar y quitar. Y un bug que reportó el cliente: el panel del corredor y el portal del arrendatario quedaban abiertos a la vez en el mismo navegador — ahora abrir una sesión cierra la otra, y ambas caducan por inactividad. Detalle en Etapa 8. 

_Etapa anterior: 2026-08-19 — **Etapa 7**: Fase A de billing (puerto, webhook, modelos) y Fase B0 completas — los cupos que venden los planes ahora se aplican de verdad, verificado con 10 consumos en paralelo contra Postgres real. Se encontraron y corrigieron dos fallos que llevaban meses invisibles: **cinco de ocho notificaciones nunca se enviaban** (se creaban como `simulada` y el despachador solo toma las `pendiente`) y **HTML sin escapar en los correos**, alcanzable desde los formularios públicos del marketplace. Precios en UF validados contra costo: se mantienen, con 96 % de margen de contribución. Detalle en Etapa 7 al final._

_Actualización anterior: 2026-07-30 — Cuentas multi-usuario Fases B-E completas (ver ADR-0013); revisión legal de las cláusulas de contrato contra la Ley 18.101 vigente y un contrato de arriendo real de referencia — se encontró y corrigió una cita legal fabricada ("art. 46, Ley 18.101" no existe) presente en 6 lugares del código/UI, y se rediseñó el término anticipado (renta del período faltante, Art. 1489 CC, en vez de una "multa" fija sin respaldo legal ni real — ver ADR-0009). **Ítem 9 completo**: borrador de contrato de arriendo descargable en PDF (plantilla fija + datos reales, sin redacción libre de IA — ver detalle abajo). Detalle en Etapa 6 al final._

_Actualización anterior: 2026-07-28 — Cuentas multi-usuario (Manager/Collaborator, ADR-0013) Fase A completa: rename de rol, `getActor()`, schema de invitación/auditoría/desactivación. Dos hallazgos de seguridad encontrados y corregidos en el mismo trabajo (RUT editable sin re-verificación en Mi perfil; crash en vez de expulsión limpia al desactivar un usuario con sesión activa). Detalle al final._

_Actualización anterior: 2026-07-27 — Ítem 2 (garantía UF/CLP) e Ítem 10 (estadísticas por plan) completos; Aurora tema dual extendido al sidebar del panel (antes era navy fijo en ambos temas — ver Etapa 6); UI/UX Pro Max (5 partes) + auditoría de accesibilidad (etapas 1-4) completas. Detalle en Etapa 6 al final._

_Actualización anterior: 2026-07-03 — Auditoría E2E adversarial con BD limpia (ver `Docs/gestion/auditoria-e2e-2026-07.md`). Se encontró y corrigió un **bug crítico (AUD-09)**: ningún código transicionaba un período de `pendiente` a `atrasado`, por lo que la conciliación era imposible para cualquier período real (el seed fabricaba ese estado a mano, ocultando el gap). Corregido con `marcarPeriodosAtrasados()` invocada en dashboard/cobros/detalle de contrato/portal/cron. Verificado E2E: ciclo completo crear contrato → conciliar con mora real → cerrar liquidación → voucher → portal. Además se corrigieron 8 hallazgos más (sesión de perfil expulsando a 2FA, rutas públicas sin rate-limit/try-catch, RUT canónico, etc.) — 236/236 tests + 47/47 core + `tsc` limpio._

_Actualización anterior: 2026-07-01 — Reconciliación del roadmap con el código real. El MVP está **~97 % completo** (núcleo + ampliación + pulido); solo resta el recorrido formal de demostración. Desde el 2026-06-11 se construyó, además del MVP: portal de autoconsulta OTP end-to-end, marketplace público B2C completo, validación de contratos con IA (Groq), 2FA por dispositivo confiable, valoraciones/denuncias/comentarios del corredor, filtro de pagos por año, páginas legales (Términos/Privacidad) y un refactor DRY (componentes/funciones compartidas). Ver bloque "Etapa 5" al final._

> **Nota de método:** este checklist quedó desfasado ~3 semanas respecto del código. Las marcas se reconciliaron el 2026-07-01 revisando la implementación real, no solo el historial del doc.

## Etapa 0 — Definición y documentación
- [x] Lectura del resumen ejecutivo y levantamiento de dolores (Leasity)
- [x] Definición de las 3 prioridades técnicas del MVP
- [x] Revisión del ecosistema de skills (cubierto con Anthropic + Vercel)
- [x] ADR-0001: decisión de nube (diferida, MVP portable)
- [x] ADR-0002: stack Next.js monolito modular + seguridad
- [x] ADR-0003: fidelidad del prototipo (dominio real, integraciones simuladas)
- [x] ADR-0004: reglas financieras del dominio (validadas con el cliente)
- [x] ADR-0005: modelo de acceso, partes, notificaciones y publicación
- [x] ADR-0006: canales de pago, validación y gasto común passthrough
- [x] ADR-0007: portal de autoconsulta de partes (acceso sin cuenta vía OTP)
- [x] ADR-0008: flujo de liquidación en 2 pasos, ventana del corredor y ajustes (caso real)
- [x] ADR-0009: mes de garantía y reconocimiento de deuda (validación de mercado)
- [x] ADR-0010: arriendos por días / STR — brecha técnica completa, marco legal (Ley 21.442, IVA SII), modelo Airbnb/Booking, decisión Fase 2. Ver `Docs/decisiones/ADR-0010-arriendos-por-dias.md`
- [x] Planificación final (06) con investigación de mercado, brechas y backlog priorizado
- [x] Documento de arquitectura de producción (01)
- [x] Modelo de dominio (02) — **validado**
- [x] Roadmap del MVP (03)
- [x] Esquema de BD (04) y guía de levantamiento local (05) + README raíz
- [x] Resumen ejecutivo v3 para el directorio (`Docs/Resumen Ejecutivo - Propigo (Actualizado).docx`)

## Etapa 1 — Andamiaje del prototipo
- [x] Monorepo (workspaces): `apps/web` + `packages/core`
- [x] Next.js 16 (App Router) + TypeScript
- [x] Tailwind v4 + shadcn/ui (Button + tema)
- [x] Paquete de dominio aislado `@propigo/core` (dinero, UF, IPC) cableado a la UI
- [x] Landing branded que calcula en vivo con el dominio real
- [x] Build de producción verde (typecheck OK)
- [x] `docker-compose.yml` para Postgres listo
- [ ] ⚠️ **Docker NO disponible en el equipo** — decidir motor de BD local (ver nota abajo)
- [ ] Prisma configurado (Etapa 2)

## Etapa 2 — Datos y dominio
- [x] Esquema de BD diseñado en papel (ver [modelo-datos-er.md](../tecnica/modelo-datos-er.md)) — **validado**
- [x] Esquema implementado en Prisma (`apps/web/prisma/schema.prisma`) — `prisma validate` OK
- [x] SQL de RLS + trigger inmutable + índice parcial + vistas (`prisma/sql/setup.sql`) — **autorado, falta aplicar**
- [x] Cliente Prisma generado
- [x] Núcleo: primitivas dinero / UF / IPC (Etapa 1)
- [x] Aplicado a la BD: Postgres (Docker, puerto 5433) → `db:push` → `db:setup` (18 tablas, 3 vistas, RLS x15, trigger, índice parcial)
- [x] Prisma 7 con driver adapter `@prisma/adapter-pg`
- [x] Seeds: corredora, corredor, personas, serie UF e IPC (26 meses), 2 contratos UF/CLP, 36 períodos, 81 asientos
- [x] Núcleo: generación de calendario de pagos (+ 8 tests verdes)
- [x] Núcleo: reajuste de IPC por aniversario — verificado en datos ($500.000 → $521.409 en período 13)
- [x] Núcleo: ledger inmutable (trigger) — verificado (UPDATE rechazado)
- [x] Vistas de saldos: deuda, billetera (GC excluido), gasto común passthrough — verificadas
- [x] Núcleo: motor de conciliación con fecha real (+ tests) — `simularPago` (cobros/actions.ts), 47/47 tests
- [x] Núcleo: emisión de vouchers — voucher de pago + liquidación, ledger inmutable

## Etapa 3 — Aplicación (panel del corredor)
- [x] Cliente Prisma compartido para la app (`src/lib/db.ts`) + Next `serverExternalPackages`
- [x] Layout del panel con navegación (`/panel`)
- [x] Dashboard del corredor: KPIs reales (por cobrar, en recaudación, GC, atrasados) + próximos vencimientos
- [x] Listado de propiedades (con estado y reserva)
- [x] Listado de contratos (UF/CLP, reajuste, períodos)
- [x] Detalle de contrato (`/panel/contratos/[id]`): header, garantía, calendario de períodos, ledger inmutable — verificado en vivo
- [x] Migración schema (`schema.prisma`): `AjusteLiquidacion`, garantía en `Contrato`, config en `Tenant`, 5 enums nuevos/ampliados — `prisma validate` OK + build OK
- [x] `setup.sql` actualizado: RLS de `ajuste_liquidacion`, vistas `v_deuda_arrendatario`/`v_billetera_propietario` con nuevos asientos, vista nueva `v_garantia_retenida`
- [x] Seed v2: garantía, ajuste demo (reparación cañería), flujo liquidado en 2 pasos
- [x] Migración aplicada a la BD (`db:push` + `db:setup` + `db:seed` v2) — **auditoría pasada**
- [x] Motor de dominio: mora, conciliación, cierre de liquidación y garantía — **47/47 tests verdes**
- [x] Asistente de liquidación: conciliar (paso 1) → cerrar con ajustes (paso 2) — `/panel/cobros`, verificado en vivo
- [x] Bug fix: serialización de `Decimal` de Prisma a Client Components (288 errores → 0)
- [x] **Design System v2** — `Docs/funcional/sistema-diseno-ui.md` (investigación + auditoría + plan)
- [x] **Fase A** — Tokens CSS `--pgo-*` definitivos, `div→button`, `aria-*`, `tabular-nums pgo-num`, `transition` explícitas, `prefers-reduced-motion`, `text-wrap:balance`, `min-w-0`
- [x] **Fase B** — Radix Dialog en modal propiedades, URL state en tab cobros (`?tab=`), `autocomplete`/`name`/`inputmode` en forms, `role="alert"` + `aria-live` en feedback
- [x] **Fase C** — Barra de progreso de liquidaciones del mes (cobros), badge "por vencer" en contratos, empty states con copy humano, `pgo-num` en todos los montos
- [x] **Auditoría UI/Seguridad** — 11 bugs corregidos: S1 type-constrained `sumView`, S2 validación server-side en actions, F1 `pgo-btn-transition`→`pgo-btn` (3 archivos), F2 fecha inconsistente Paso1Form, F3 `focusRingColor` inválido, F4 `notificaciones/page.tsx` creado + nav item agregado, A1 `aria-label` botones X (3 archivos), A2 `aria-pressed` filtros (4 archivos), A3 `aria-hidden` ShieldCheck, A4 `scope="col"` tablas (4 archivos), W1 `data-scroll-behavior` en layout
- [x] Mes de garantía (registro + retención/devolución) — asientos `RETENCION_GARANTIA`/`DEVOLUCION_GARANTIA` en `terminarContrato` (contratos/[id]/actions.ts), vista `v_garantia_retenida`
- [x] Recordatorios automáticos (cadencia ADR-0008, simulados) — `generarRecordatorios` + `enviarNotificacionesPendientes` (notificaciones/actions.ts) + cron `/api/cron/recordatorios` con `CRON_SECRET`
- [x] Reconocimiento de deuda (documento generado del ledger) — `generarReconocimientoDeuda` (contratos/[id]/actions.ts:271) + UI en `AnexosSection`
- [x] **CRUD Propiedades** — dialog "Nueva propiedad" en `/panel/propiedades` (`crearPropiedad` server action, busca/crea propietario por RUT)
- [x] **CRUD Contratos** — wizard 4 pasos en `/panel/contratos/nuevo`: Propiedad → Arrendatario → Condiciones → Vigencia + preview calendario. `crearContrato` genera 12 períodos (indefinido) o N períodos (plazo fijo), asiento `GARANTIA_RECIBIDA`, estado propiedad → arrendada, notificación simulada.
- [x] **Auditoría CRUD (2026-06-07)** — 13 bugs encontrados y corregidos en los 3 archivos del CRUD. `tsc --noEmit` = 0 errores.
  - **SC-CRIT-1** `crearContrato`: `propiedadId` no se verificaba contra `tenantId` → cross-tenant mutation. Fix: `findFirst({ tenantId, estado: in[disponible,reservada] })` dentro de la transacción (doble como BL1 anti race-condition).
  - **SC-CRIT-2** `crearContrato`: `propietarioId` no se verificaba contra `tenantId`. Fix: `findFirst({ tenantId })` dentro de la transacción.
  - **SC-CRIT-3** Todos los catch devolvían `e.message` verbatim (filtraba nombres de tablas/columnas Prisma). Fix: clase `DomainError` interna; solo errores de dominio controlados llegan al cliente.
  - **SC-CRIT-4** `crearContrato`: `arrendatarioId` existente no se verificaba contra `tenantId`. Fix: `findFirst({ tenantId })` antes de usarlo.
  - **V1** `garantiaMeses`: faltaba `Number.isInteger()` — flotante 1.5 pasaba. Fix: agregar check de entero.
  - **V2** `multaMeses`: sin validación server-side (podía ser NaN/negativo). Fix: `Number.isFinite` + ≥ 0.
  - **V3** `montoGastoComun`: sin validación cuando `cobraGastoComun=true` (podía ser 0). Fix: > 0 requerido.
  - **V4** `garantiaMontoCLP`: sin validación cuando `garantiaMeses>0`. Fix: > 0 requerido.
  - **V5** `moraDiasGracia`: sin validación alguna (faltaba por completo). Fix: entero 0–30.
  - **V6** `crearPropiedad`: `piezas`/`banos`/`m2Totales` sin validación (NaN/negativo). Fix: `Number.isInteger/isFinite` + ≥ 0.
  - **V7** `crearPropiedad`: `valorGastosComunes` sin validación cuando `pagaGastosComunes=true`. Fix: > 0 requerido.
  - **UI1** `INITIAL.fechaInicio` hardcodeado a `"2026-06-05"`. Fix: `useState(() => ({ ...INITIAL, fechaInicio: new Date().toISOString().slice(0,10) }))`.
  - **UI2** `parseFloat(multaMeses) || 1` convertía el 0 válido (sin multa) en 1. Fix: `Number.isFinite(v) ? v : 1`.
  - **UI3** Preview calendario usaba `d > 31` mientras validación usa `d > 28` → inconsistencia UX. Fix: `d > 28`.
- [x] **Término y cancelación de contratos (2026-06-07)**:
  - **G1/G2 — Término normal y anticipado**: `CierreSection` client component en `/panel/contratos/[id]` cuando estado = vigente. Selector normal/anticipado, multa informativa (multaMeses × valorArriendo, sin asiento), toggle devolución garantía, checkbox de confirmación irreversible. Botón rojo "Confirmar término".
  - **G3 — Propiedad vuelve a disponible**: `terminarContrato` action: contrato → `terminado` (normal) o `terminado_anticipado` (anticipado), propiedad → `disponible`, notificación `termino_contrato` / `salida_anticipada`. Atómico en `$transaction`.
  - **G7 — Cancelar contrato borrador**: Botón "Cancelar contrato (proceso no concretado)" en `FirmaSection`, con checkbox de confirmación. `cancelarContratoBorrador` action: contrato → `terminado`, propiedad → `disponible`. Ambas acciones verifican `tenantId` + estado dentro de transacción.
  - `tsc --noEmit` = 0 errores.
- [x] **Editar propiedad (2026-06-07)**:
  - Botón "Editar propiedad" en pie del modal de detalle: habilitado (borrador/disponible) o bloqueado con candado + mensaje (reservada/arrendada).
  - Dialog de edición con todos los campos pre-populados desde el objeto seleccionado.
  - Sección "Ciclo de vida": diagrama de nodos con estado activo resaltado + botones de transición manual:
    - `borrador` → "Activar → Disponible" (verde, llama `activarPropiedad`).
    - `disponible` → "← Volver a borrador" (ámbar, llama `desactivarPropiedad`).
    - `reservada`/`arrendada` → mensaje informativo (las transiciones son automáticas).
  - `actualizarPropiedad(propiedadId, data)` server action: verifica `tenantId` + estado editable dentro de `$transaction`, reemplaza imágenes en bloque (deleteMany + createMany), DomainError si no editable.
  - `desactivarPropiedad(propiedadId)` server action: disponible → borrador, verifica tenant.
  - `tsc --noEmit` = 0 errores después de la implementación.
- [x] **Upload local de imágenes (2026-06-07)**:
  - API route `POST /api/upload` (`apps/web/src/app/api/upload/route.ts`): valida MIME (JPG/PNG/WebP/GIF), tamaño ≤5 MB, genera nombre UUID, guarda en `public/uploads/propiedades/`. Reemplaza URLs externas que eran un riesgo de seguridad.
  - `ImagenesField` reescrito: file picker con preview de imagen una vez subida, spinner de carga por slot, mensaje de error inline, re-index seguro al eliminar slots.
  - Archivos servidos como static assets de Next.js (`/uploads/propiedades/[uuid].[ext]`). Schema y actions sin cambios.
  - `tsc --noEmit` = 0 errores.
- [x] **Funcionalidades 2026-06-07** — 5 features implementadas:
  - **Estado borrador en propiedades**: nuevas propiedades crean en `borrador`, botón "Activar propiedad" → `disponible`. Enum `EstadoPropiedad` extendido (`db:push` + client regenerado). Dashboard incluye conteo borrador.
  - **Imágenes en propiedades**: `ImagenPropiedad` ya estaba en schema. UI: hasta 5 URLs en el dialog "Nueva propiedad", galería horizontal en el modal de detalle, miniatura en el card.
  - **Firma de contrato**: wizard crea contrato en `borrador` (no `vigente`) + propiedad → `reservada`. Sección "Firma" aparece en `/panel/contratos/[id]` cuando estado = borrador. Botón "Activar contrato" (con checkbox de confirmación) → contrato `vigente` + propiedad `arrendada`. Notificación `solicitud_firma` al crear, `nuevo_contrato` al activar.
  - **Sidebar mobile**: `PanelShell` client component con hamburger (visible en mobile), drawer slide-in desde izquierda, overlay backdrop, cierra con Escape y clicks en nav. `layout.tsx` simplificado (solo RSC con props al shell).
  - **Validación RUT chileno**: `packages/core/src/rut.ts` — `validarRut(rut)` (mod-11) + `formatearRut(rut)` (XX.XXX.XXX-Y). Integrado en: `propiedades/actions.ts`, `contratos/nuevo/actions.ts`, `propiedades-client.tsx` (blur + autoformat), `nuevo-contrato-client.tsx` (NuevoArrendatarioForm con error inline).
- [x] **Sprint "MVP Sólido" (2026-06-11)** — contratos a plazo fijo/indefinido completos:
  - **Schema**: `cancelado` en `EstadoPeriodo` + `fechaTermino` en `Contrato` + `renovacion_contrato` en `TipoNotificacion` (`db:push` aplicado, cliente regenerado, clave `globalThis` rotada a v4).
  - **Bug fix períodos fantasma**: `terminarContrato` y `cancelarContratoBorrador` ahora cancelan los períodos pendientes/atrasados futuros en la misma transacción (antes quedaban como deuda falsa).
  - **Bug fix fechas hardcodeadas**: `contratos-client.tsx` y `notificaciones/actions.ts` usaban `Date.UTC(2026, 5, 5)` fijo — se rompían después de esa fecha. Ahora dinámicas.
  - **Renovar contrato** (`RenovarSection` + `renovarContrato` action): para vigentes a plazo fijo. Mini-form con nueva fechaFin + valor opcional; estimación de períodos en vivo; numeración continua desde el último período; montoGastoComun propagado; notificación `renovacion_contrato`. **Verificado E2E**: 12→24 períodos, sin duplicados, BD íntegra.
  - **Auto-extensión de indefinidos** (`src/lib/auto-extender.ts`): al ver el detalle de un contrato indefinido con < 90 días de calendario restante, genera 12 meses más. Doble verificación dentro de la TX (anti race-condition de dos tabs).
  - **Alerta de vencimiento**: banner clicable en el detalle (ámbar ≤ 90d, rojo ≤ 30d) que ancla a la sección de renovación. Verificado en vivo ("vence en 59 días").
- [x] **Validación integral del MVP (2026-06-11)** — seguridad, lógica, UI/UX:
  - **SEC-1 (alta)** Fuga de mensajes internos: `simularPago`, `cerrarLiquidacion` y `generarRecordatorios` devolvían `e.message` crudo (Prisma) al cliente. Fix: mensajes genéricos.
  - **SEC-2 (media)** `/api/upload` sin gate: ahora exige tenant válido (503 si no), pendiente auth real con Portal OTP.
  - **SEC-3 (media)** Upload validaba solo MIME declarado: ahora verifica **magic bytes** (JPEG/PNG/WebP/GIF). Probado: PNG falso → 400, PNG real → 200.
  - **SEC-4 (media)** `imagenes[]` en propiedades aceptaba cualquier string: ahora regex estricta `/uploads/propiedades/<uuid>.<ext>` server-side (bloquea URLs externas, `data:`, `javascript:`).
  - **SEC-5 (media)** Sin headers de seguridad: `next.config.ts` ahora envía `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` + CSP `sandbox` en `/uploads`. Verificado con curl.
  - **SEC-6 (baja)** Defensa en profundidad: 4 queries internas de cobros sin `tenantId` explícito — agregado.
  - **Lógica de negocio**: 47/47 tests de dominio verdes. **Gap encontrado**: el reajuste IPC (`esPeriodoDeReajuste`) existe en core pero ninguna action lo aplica al conciliar → próximos pasos.
  - **UI/UX**: pantallas auditadas contra Design System v2 (desktop + mobile 375px), 0 errores de consola. Decisión con cliente: **pulido moderno sin 3D** (three.js descartado para el panel operativo; candidato para landing V2).
  - **Pulido implementado**: animación de entrada por navegación (`template.tsx` + `.pgo-enter`), contadores animados en KPIs del dashboard (`AnimatedNumber`, respeta `prefers-reduced-motion`), skeleton loaders con shimmer (`loading.tsx` del panel). View Transitions API evaluada y descartada por experimental.
- [x] Historial de vouchers con filtros — `/panel/vouchers` + `FiltrosClient` (tipo, rango de fechas, contrato)
- [x] Portal de autoconsulta de partes (OTP + sesión de solo lectura) — `/portal` (RUT → OTP → `/portal/verificar` → `/portal/contrato/[id]`), cookie JWT `pgo_portal`, anti-enumeración (ADR-0007)
- [x] Documentos del arriendo + descarga autenticada — `/api/portal/documento/[id]` (verifica tenant + contrato, audit log, `Cache-Control: no-store`)

### Próximos pasos — Contratos (arriendo mensual) — **reconciliado 2026-07-01**

| Estado | Ítem | Nota |
|---|---|---|
| ✅ Hecho | **Portal OTP arrendatario/propietario** | `/portal` end-to-end + auth de `/panel` (JWT `pgo_session`) y gate en `/api/upload` |
| ✅ Hecho | **Recordatorios automáticos** | `generarRecordatorios` + cron `/api/cron/recordatorios` (cadencia ADR-0008) |
| ✅ Hecho | **Aplicar reajuste IPC al conciliar** | Gap cerrado: `simularPago` usa `esPeriodoDeReajuste` + `aplicarReajusteIpc` para CLP con reajuste activo |
| ✅ Hecho | **Anexos de contrato** | `AnexosSection` + `adjuntarAnexo` (documento `tipo=anexo` a contrato vigente) |
| ✅ Hecho | **Reconocimiento de deuda** | `generarReconocimientoDeuda` desde el ledger (ADR-0009) |
| ✅ Hecho | **CSP con nonces** | `proxy.ts` inyecta nonce; `layout.tsx` lo propaga a scripts de hidratación |
| 🟢 Baja | **Workflow de morosidad** | Fase 2 — marcado `moroso`, avisos escalonados, reconocimiento formal |
| 🟢 Baja | **Rate limiting en `/api/upload`** | Pendiente — con auth real, limitar por usuario |

> ✅ ~~Renovación de calendario~~ — completado 2026-06-11 (botón "Renovar" para plazo fijo + auto-extensión de indefinidos).

### Próximos pasos — Arriendos por días (STR / "Renta Corta")

> Ver análisis completo en `Docs/decisiones/ADR-0010-arriendos-por-dias.md`

**El schema actual NO soporta STR.** La brecha es estructural. Decisión: Fase 2.

Cuando se inicie la Fase 2, el orden de implementación propuesto es:

| Sprint | Contenido |
|---|---|
| **STR-1** | Campo `modalidadArriendo` en Propiedad; modelo `BloqueoFecha`; reserva STR con anticipo % configurable (mín. 30 % recomendado); calendario visual de disponibilidad |
| **STR-2** | Estadía con IVA en ledger (`CARGO_IVA`); cargo de limpieza; depósito de daños; factura básica |
| **STR-3** | Políticas de cancelación (flexible/moderada/estricta); dashboard RevPAR/ADR/ocupación |
| **STR-4** | Channel manager (Airbnb API / Booking API sync); boleta electrónica SII |

## Etapa 4 — UI/UX y cierre
- [x] Pulido visual y responsividad — animación de entrada, contadores animados, skeletons, mobile verificado (2026-06-11)
- [x] Revisión de accesibilidad — `prefers-reduced-motion`, `aria-label` en contadores, `aria-busy` en skeletons; auditoría previa (A1–A4) vigente
- [ ] **Recorrido de demostración del criterio "MVP terminado"** — único pendiente formal del MVP (guion de demo end-to-end)

## Etapa 5 — Plano público, portal y extras (2026-06-12 → 2026-07-01)

> Trabajo posterior al Sprint "MVP Sólido". Buena parte estaba planeada como Fase 2; se adelantó.

### Portal de autoconsulta (ADR-0007) — completo
- [x] `/portal`: ingreso por RUT → solicita OTP (`/api/portal/solicitar-otp`), respuesta anti-enumeración (idéntica exista o no el RUT)
- [x] `/portal/verificar`: código de un solo uso, TTL 10 min, máx. 3 intentos; sesión JWT `pgo_portal` (30 min, solo lectura)
- [x] `/portal/contrato/[id]`: contrato, pagos con **filtro por año**, documentos descargables, mensajes del corredor, datos registrados
- [x] Descarga segura `/api/portal/documento/[id]`: verifica tenant + acceso al contrato, audit log `acceso_log`, `Cache-Control: no-store, private`

### Marketplace público B2C — completo (era "esbozo si da tiempo")
- [x] `/marketplace`: listado con búsqueda + filtros (tipo, región/comuna, piezas/baños, m², estacionamiento, mascotas, GC, precio, recientes)
- [x] `/marketplace/[id]`: ficha con galería, amenidades, panel del corredor
- [x] Modales: **Contactar al corredor**, **Denunciar** (anti-fraude), **Valorar al corredor** (token de un solo uso)
- [x] Páginas legales: **Términos de uso** y **Política de privacidad** (Ley 21.719, 19.496, marco chileno 2026) + aviso T&C anti-fraude en primer acceso

### Seguridad y cuentas
- [x] **2FA por dispositivo confiable** — cookie UUID + código por email; `/verificar-dispositivo`, `/api/auth/dispositivo/{enviar,confirmar}`, gestión en `/panel/perfil` (`dispositivos-section`). (La memoria lo listaba como "feature futura"; ya está construido.)
- [x] Recuperación de contraseña (`/recuperar-contrasena` → email → `/nueva-contrasena`), medidor de fuerza de contraseña
- [x] CSP con nonce (`proxy.ts` + `layout.tsx`), cabeceras de seguridad, cierre de sesión con `Clear-Site-Data`

### Comunicación corredor ↔ arrendatario
- [x] **Comentarios del corredor**: el corredor deja mensajes (tab "Mensajes" en el contrato) con adjuntos opcionales; el arrendatario los ve en su portal; email de notificación al publicar
- [x] **Valoraciones** del corredor (marketplace) y **denuncias** con registro

### Validación de contratos con IA (bonus, no estaba en el roadmap)
- [x] `/api/contratos/[id]/validar` y `validar-doc`: revisión del contrato con IA (Groq); panel `validacion-panel.tsx`; tests de seguridad anti prompt-injection

### Calidad de código
- [x] **Auditoría UX/copy (2026-07-01)**: unificación de nomenclatura (`/portal` tenía 4 etiquetas), enlaces legales muertos (`href="#"`) corregidos, pluralización, ortografía
- [x] **Refactor DRY (2026-07-01)**: `lib/format` (`clpOrUf`, `plural`), `lib/propiedad-meta`, `<Spinner>`, `<Modal>`/`<ModalSuccess>`, `<PublicNavbar>`/`<PublicFooter>`/`<Logo>`, y fachada única de RUT sobre `@propigo/core`. Verificado en Claude Preview.

## Etapa 6 — Garantía UF/CLP, estadísticas por plan, UI/UX Pro Max y tema Aurora en el panel (2026-07-03 → 2026-07-27)

> Trabajo no reflejado hasta ahora en este documento pese a estar implementado y verificado. Reconciliado el 2026-07-27.

### Ítem 2 — Garantía en UF o CLP en contrato nuevo — completo
- [x] **Schema**: `garantiaDenominacion` (UF/CLP) + `garantiaMontoBase` en `Contrato`, migración con backfill de contratos existentes (CLP, monto = `garantiaMontoCLP` actual)
- [x] **Captura**: wizard de contrato nuevo permite fijar la garantía en UF o CLP; snapshot en CLP al día de inicio (asiento `GARANTIA_RECIBIDA`, inmutable)
- [x] **Devolución revalorizada**: al terminar el contrato, si la garantía se pactó en UF se revaloriza a la UF del día de término (mismo criterio que el arriendo); asiento de reajuste cubre la diferencia entre lo recibido y lo restituido/retenido — sin este asiento `v_garantia_retenida` no cerraba a cero para una garantía UF
- [x] **Vistas**: detalle de contrato, listado y validación IA de contrato muestran la denominación de la garantía; regression test para el bug de doble signo detectado en `v_garantia_retenida`

### Ítem 10 — Estadísticas por plan (panel `/panel/estadisticas`) — completo
Sistema de analítica con 3 niveles de acceso por plan del corredor (básica/media/avanzada, mapeados desde `Tenant.plan` vía `getAnalyticsTier()`), 4 pestañas: Resumen Operativo, Analítica Financiera, Rendimiento de Propiedades, Proyecciones y Riesgo.

- [x] Base: Recharts, 4 funciones tier-gated en `queries.ts`, 4 pestañas con exportación CSV (plan Diamond)
- [x] **Ampliación inspirada en un informe de referencia de analítica para PMS** (3 pilares: Financiero, Ocupación/Comercialización, Mantenimiento — este último fuera de alcance, sin sistema de tickets):
  - Vacancy loss estimado (lucro cesante de propiedades vacías)
  - Collection rate (% de períodos pagados dentro de la ventana de gracia)
  - Motor de comparables de mercado: mediana de renta por tipo+comuna sobre publicaciones activas del marketplace (cross-tenant, vía la política RLS pública de `publicacion`), exige ≥3 muestras, banda ±10% para clasificar bajo/en/sobre mercado
  - Turnover y retención de cartera
  - Ranking de arrendatarios sin atrasos (fidelización)
  - Proyección de ingresos con motor IPC real (`esPeriodoDeReajuste` + `aplicarReajusteIpc` de `@propigo/core`, solo si hay ≥13 meses de serie IPC — sin dato fabricado)
  - Stress-test simple de cartera (escenarios +10/25/40% de mora)
  - Riesgo por arrendatario heurístico basado en historial propio de atrasos (**rotulado explícitamente como heurística, no un credit score real**, para no sobre-representar la capacidad predictiva del sistema)
- [x] 3 bugs de integridad de datos encontrados y corregidos vía verificación contra SQL directo (no solo "compila"):
  - Contratos `cancelado` (borrador nunca firmado) contaminaban vacancia/turnover/comparables — `fecha_termino` se fija también para `cancelado`, no solo para `terminado`/`terminado_anticipado`. Fix: filtrar por `estado: {in: [...]}` en vez de `fechaTermino: {not: null}` en 3 queries.
  - Períodos `atrasado` huérfanos de contratos ya terminados inflaban la proyección de ingresos (~2x en un mes). Fix: `getProyeccionesRiesgo` exige `contrato.estado: "vigente"` en `periodosFuturos` (deliberadamente NO aplicado a las queries de morosidad histórica, que sí deben reflejar toda la deuda sin importar el estado actual del contrato).
  - `MiniDonut` (gráfico de dona) colapsaba a 0×0 dentro de una fila flex sin ancho propio — `ResponsiveContainer width="100%"` no tenía de dónde medir. Fix: `width: height` fijo + `shrink-0`.
- [x] **Bug de concurrencia en `pg`** encontrado durante la verificación (ver `BRAIN.md` §6): `getUfCLP` (cliente Prisma global) llamado desde dentro de `withTenant` en 8 sitios (incluidas las 6 funciones nuevas de este ítem) disparaba una query fuera de la transacción activa. Fix: `getUfCLPTx(tx, fecha)`.

### Ítem 9 — Borrador de contrato de arriendo en PDF — completo (2026-07-30)
Antes bloqueado ("requiere definición") por la duda de qué tan "legal" debía ser el resultado. Definición confirmada con el usuario: el generador produce un **borrador de trabajo** — el flujo real siempre pasa por revisión y legalización de un abogado antes de firmarse, así que el estándar es realismo y ausencia de citas legales falsas, no certificación legal (ver ADR-0009, sección "Revisión legal").

- [x] **Plantilla fija + datos reales** (`lib/contrato-pdf.tsx`, `@react-pdf/renderer`) — sin redacción libre de IA (decisión confirmada con el usuario): la estructura de cláusulas sigue el mismo criterio que un contrato de arriendo real usado como referencia, parafraseada (no copiada textual), rellenada con los datos del `Contrato`/`Persona`/`Propiedad` en BD.
- [x] Correcciones deliberadas respecto al contrato de referencia: término anticipado = renta del período faltante (Art. 1489 CC), no una multa fija; espacio para firma manuscrita, sin mencionar un proveedor de firma electrónica que Propigo no tiene integrado; protección de datos actualizada a Ley 21.719 (la vigente).
- [x] Datos que el sistema no captura (domicilio de las partes, estado civil, inscripción CBR) se dejan como placeholder entre corchetes en el propio PDF — nunca se inventan.
- [x] Ruta `GET /api/contratos/[id]/pdf` — mismo guard de ownership que el resto de `/panel/contratos` (ADR-0013 Fase D: 404, no 403, para un Colaborador sin acceso a la propiedad). Botón "Descargar borrador (PDF)" en el detalle del contrato.
- [x] **Bug encontrado y corregido durante la verificación**: si el contrato no tenía garantía pactada, la cláusula NOVENO se omitía por completo y la numeración saltaba de OCTAVO a DÉCIMO — un vacío que se lee como un error en un documento legal real. Corregido para que la cláusula siempre esté presente, con texto distinto según haya o no garantía.
- [x] Verificado generando PDFs reales con los 3 caminos condicionales de la plantilla (con garantía, sin garantía, plazo fijo/indefinido) + prueba end-to-end en navegador (200 OK con sesión real). 5 tests nuevos (guard de ownership), `tsc` limpio, 348 tests en verde.

### UI/UX Pro Max — auditoría y rediseño integral (5 partes) — completo
Auditoría de las 5 superficies del producto (Home público, Marketplace + ficha, Autenticación, Portal de autoconsulta, Panel corredor) contra checklist de accesibilidad/UX, seguida de una implementación por etapas:
- [x] **Etapa 1** — hit-areas de 44×44px (Button, filtros, sidebar, toggle contraseña), error persistente inline en OTP del portal
- [x] **Etapa 2** — breakpoints unificados hero/features del Home, `aria-current` en navbar público, labels asociados en filtros, `inert` en drawer cerrado
- [x] **Etapa 3** — contraste del overlay en feature cards, duración de `.pgo-scroll-reveal`, stagger en cards, remoción de hover-lift engañoso
- [x] **Etapa 4** — `.pgo-num` (tabular-nums) en contadores del Home
- [x] Rediseño de **Home 2026**: walkthrough de scroll fijado con 4 "paradas" (crossfade cinematográfico con scrub/lerp), navbar sincronizado por scroll-spy, sección "Nuestros Planes" (pricing cards + política de cancelación), snap automático a la parada más cercana al soltar el scroll — **suavizado el 2026-07-27** (el snap saltaba instantáneo; ahora usa `behavior: "smooth"`, confirmado con muestreo de `scrollY` mostrando desaceleración gradual en ~700ms)
- [x] Botones secundarios del hero ("Ver propiedades disponibles", "Consulta tu arriendo") rediseñados el 2026-07-27: el fondo (`--pgo-surface-glass`, ~4% opacidad) era casi invisible sobre el panel de vidrio del hero (`--pgo-glass-card`, ~42-48%) — se leían como solo un borde con texto flotando. Ahora usan `--pgo-glass-card` + tinte de marca (`.pgo-cta-secondary` en `globals.css`).

### Tema Aurora Dark/Light — rollout completo al sidebar del panel (2026-07-27)
El tema dual Aurora (glassmorphism + fondo animado) ya cubría sitio público, autenticación, legales y portal (ver `Docs/gestion/fase2-aurora-sitio-completo-2026-07.md`). El sidebar del **panel** corredor quedaba pendiente y usaba los tokens `--pgo-sidebar*`, que son **intencionalmente fijos** (navy en ambos temas — pensados para el aside de marca de login, no para navegación de trabajo diaria):
- [x] Fondo del sidebar: de sólido plano a `.pgo-panel-aside` (vidrio esmerilado) sobre `.pgo-beams-layer` (franjas de luz, aproximación **CSS-only** — sin three.js/WebGL — de un componente "Beams" evaluado y descartado por costo: ~250 KB de bundle adicional y sin soporte nativo de `prefers-reduced-motion`, ver detalle de la evaluación en el historial de sesión)
- [x] Interactividad del sidebar: `--pgo-sidebar-hover` estaba definido en los tokens desde el diseño original pero **sin ningún consumidor** — el hover no hacía nada. Conectado vía clase `.pgo-sidebar-link`.
- [x] **Diseño real para tema claro** (no solo "aclarar la paleta oscura"): tokens nuevos `--pgo-panel-nav-*` (themeados, paralelos a `--pgo-sidebar-*` que sigue intacto para login/registro) — en claro, vidrio blanco real (`--pgo-surface`) + texto oscuro + acento índigo en el ítem activo, en vez de overlays blancos que sobre una base clara no se veían. Ver `BRAIN.md` §2 para la lección de arquitectura de tokens.
- [x] Ajuste de contraste/intensidad de `.pgo-beams-layer` en ambos temas (opacidad y saturación de color bajadas ~35-40%) tras verificación visual — la primera versión resultaba demasiado intensa, en particular en la esquina del header.
- [x] Verificado en navegador: ambos temas, desktop + mobile (drawer), hover, estado colapsado, `tsc`/`eslint` limpios.

### Cuentas multi-usuario (Manager/Collaborator) — Fase A completa (2026-07-28)
Ver `Docs/decisiones/ADR-0013-cuentas-multiusuario.md` para el diseño completo y `Docs/gestion/plan-de-pruebas-roles-multiusuario.md` para la vara de aceptación. Fase A es la fundación invisible (sin cambio de comportamiento para el Manager único de hoy) — Fases B-E (invitación, asignación de propiedad, cascada de filtrado, cupos) quedan pendientes.

- [x] Rename de enum `RolUsuario`: `admin`/`operador` → `manager`/`colaborador` (`ALTER TYPE ... RENAME VALUE`, sin backfill)
- [x] Schema: `Propiedad.asignadoAId`, `Usuario.desactivadoEn`, modelos `InvitacionColaborador` y `AuditoriaEquipo` (este último agregado tras hallazgo `ROL-INFO-4` del plan de pruebas — auditoría de invitar/asignar/desasignar/desactivar/reactivar)
- [x] `setup.sql`: `auth_lookup_usuario_by_email` devuelve `desactivado_en`; RLS de `auditoria_equipo`
- [x] `getActor()` nuevo en `lib/queries.ts`; `getTenant()` pasa a ser wrapper delgado — los 17+ call sites existentes siguen funcionando igual
- [x] `login/actions.ts` rechaza el login (mensaje genérico anti-enumeración) si el usuario está desactivado
- [x] `tsc`/`eslint` limpios, 299/301 tests verdes (2 fallos pre-existentes sin relación — `nav.test.tsx` y `marcar-periodos-atrasados.test.ts`, no tocados esta sesión)

**Dos hallazgos de seguridad encontrados y corregidos en el mismo trabajo** (no diferidos — ver memoria de sesión `feedback-security-in-implementation`):
- **RUT editable sin re-verificación** en `/panel/perfil`: el RUT es la clave de la verificación de identidad contra la cédula (`/registro`), pero quedaba libremente editable después — cualquier corredor podía cambiarlo a otro RUT válido no reclamado. Corregido: RUT, nombre y fecha de nacimiento inmutables de por vida (chequeado server-side contra la fila real, no solo oculto en la UI); teléfono y correo ahora requieren un código de 6 dígitos enviado al correo **actual** antes de aceptar el cambio (`CodigoCambioContacto`, mismo patrón que `CodigoDispositivo` de la verificación de dispositivo nuevo).
- **Crash en vez de expulsión limpia (ROL-SEC-9)**: al desactivar a un usuario con sesión activa, la siguiente request crasheaba con una pantalla de error de Next.js en vez de redirigir a `/login` — `clearSessionCookie()` no puede llamarse desde un Server Component en render, solo desde una Server Action o Route Handler. Corregido: el chequeo vive en `panel/layout.tsx` (choke point de todo `/panel/*`) y redirige a un nuevo handler `GET /api/auth/logout` que sí puede limpiar la cookie (evita además un loop de redirects con el proxy, que solo valida la firma del JWT).
- Regression test agregado: `src/lib/__tests__/auth-jwt-tamper.test.ts` (ROL-SEC-5 — manipulación de JWT).

---

## Etapa 7 — Billing, cupos de plan y corrección de notificaciones (2026-08-06 → 2026-08-19)

### Fase A de pagos — fundación sin proveedor (ADR-0014) — completo
- [x] Puerto `BillingGateway` con categorías de error de dominio y `esReintentable()` — solo rechazo y fallo temporal se reintentan
- [x] Adaptador *fake* en memoria, que se niega a construirse si `NODE_ENV === "production"`
- [x] Webhook: firma verificada **antes** de parsear el cuerpo, tope de 64 KB, ventana anti-replay de 24 h, idempotencia apoyada en el UNIQUE de Postgres
- [x] Modelos `SuscripcionTenant`, `CargoBilling`, `ComisionPlataforma`, `EventoGatewayPago` + migración + RLS
- [ ] **P-A6** panel interno de observabilidad — diferido: aún no hay cobros que observar

Verificado con `curl` contra el endpoint real (no mock): 7 escenarios, incluido el
que importa — **el mismo evento repetido responde 200 `duplicado` y deja una sola
fila**, que es justo lo que un test con `prisma` mockeado no puede demostrar.

### Fase B0 — los límites que venden los planes ahora se aplican — completo
Hallazgo que reordenó el trabajo: **los planes vendían cupos que el software no
aplicaba**. Un Bronze podía cargar 500 propiedades y consumir IA sin tope. No se
pueden cobrar precios diferenciados por límites que no existen, así que esto pasó
a ser prerrequisito de cobrar y no una mejora posterior.

- [x] `lib/plans.ts` migrado de USD a **UF + IVA** (0,25 / 0,50 / 0,90 / 1,70) con cupos reales y fallback conservador a Bronze
- [x] `verificarCupoPropiedades()` dentro de la transacción que crea
- [x] `consumirTokenIa()` que chequea e incrementa en **una sola sentencia** (`ON CONFLICT ... WHERE usados < max`)
- [x] `puedeExportar(plan)` reemplaza el `=== "diamond"` hardcodeado, en UI y API
- [x] `CupoBadge` compartido, con aviso en ámbar desde el 80 % (no solo rojo al tope)

**Prueba de concurrencia contra Postgres real:** 10 consumos de IA en paralelo
contra un cupo de 3 → exactamente **3 otorgados**, sin sobregiro. Es la evidencia
de que la compuerta atómica elimina la carrera que tendría un "leer, comparar,
escribir" en pasos separados.

### Correcciones de esta etapa

- [x] **Cinco de ocho notificaciones nunca se enviaban.** Se creaban con `estado: "simulada"` y el despachador solo toma las `"pendiente"`. El propietario nunca recibía su liquidación; el arrendatario, ninguno de los avisos sobre su propio contrato. Corregido + glosa con el desglose que ya existía en el `snapshot` del voucher pero no se usaba. **Verificado end-to-end en el navegador:** activar contrato → fila `pendiente` en BD → cron → `enviada` con fecha, y el correo en la consola del servidor.
- [x] **HTML sin escapar en los correos** (hallazgo no reportado, encontrado al revisar). Los formularios de contacto y denuncia del marketplace son públicos y sin autenticar: quien enviaba el formulario decidía el HTML de un correo saliendo de nuestro dominio. 27 interpolaciones escapadas.
- [x] **Contraste de botones.** El botón sólido teal tenía texto blanco sobre `#5EEAD4`: **1,48:1** donde AA exige 4,5:1 — el texto llegaba a verse invisible. Par de tokens nuevo: ahora 10,3:1 en oscuro y 5,47:1 en claro, medido en el navegador.
- [x] **Notificaciones agrupadas por categoría** en pestañas (Cobros / Pagos / Contratos / Mensajes), separando el eje "¿ya salió?" del eje "¿de qué se trata?".
- [x] `public/uploads/**` agregado a `.gitignore` — antes las fotos de clientes se commiteaban al repositorio.

### Documentación producida
- `ADR-0014` — decisiones estructurales de pagos: la plataforma nunca toca el dinero del arriendo; ledger de contratos y de billing son libros separados.
- `rowmap-pagos.md` — filas, preguntas con recomendación por defecto, bitácora, hallazgos, y anexo comparativo de pasarelas (**D-02 pospuesta** por decisión del cliente; bloquea toda la Fase B).
- `costos-infraestructura-y-precios.md` — dimensionamiento AWS y **definición de precios**. Los precios en UF se mantienen: el margen de contribución es 96 % con uso realista y 77 % en el peor caso. **La infraestructura no amenaza el margen; los compromisos humanos de Diamond sí.** AWS diferido a release.
- `rowmap-producto.md` — trabajo de producto (Rol SII, cuentas de servicio, garantía, avisos de reajuste), con el rol de especialista desde el que se aborda cada grupo.
- `revision-2026-08-19.md` y `look-back-2026-08-19.md` — revisión de temas y barrido de pendientes.
- `cuentas-de-prueba.md` — cuenta de corredor persistente e idempotente para pruebas manuales.

### Nota de método
Un diagnóstico **se refutó al verificarlo**: se había atribuido un problema de
estado que sobrevivía entre contratos a la falta de `key`, y al quitarlo en el
navegador el problema no reapareció — Next.js ya remonta al cambiar el parámetro
de ruta. El `key` se mantiene como defensa explícita, pero el comentario en el
código se corrigió para no afirmar algo que no se pudo demostrar. Queda anotado
en BRAIN.md §2 para que nadie "arregle" un problema inexistente.



## Etapa 8 — Grupo 1: rol de avalúo, cuentas de servicios y blindaje del sitio público (2026-08-25 → 2026-08-26)

**Grupo 1 cerrado por completo** (P-PR1 a P-PR10). La propiedad ahora exige el
rol de avalúo del SII y las cuatro cuentas de servicios básicos, ambos editables
por el corredor a cargo o el administrador, y ambos visibles para el corredor, el
propietario y el arrendatario — nunca para el público.

### Qué se construyó
- **Rol de avalúo obligatorio** en `Propiedad`, con validación compartida entre
  servidor y cliente (`lib/propiedad-datos.ts`). El formato oficial es
  `comuna–manzana–predio`; no lleva dígito verificador, eso es el RUT.
- **Cuentas de servicios obligatorias**: agua, luz, gas y gastos comunes se
  muestran siempre, y "no aplica" es una respuesta válida y distinta de dejar en
  blanco — una cabaña sin gas de red es el caso normal, no un dato faltante.
- **Roles complementarios** (estacionamiento, bodega, otras unidades), opcionales:
  en un edificio cada unidad tiene rol propio.
- **Presentación compartida** entre panel y portal (`components/propiedad/datos-privados.tsx`),
  con el texto de visibilidad distinto según quién mira. Un componente y no dos
  copias, para que no ocurra que una superficie muestre lo que la otra decidió
  ocultar.
- **Rol en el borrador de contrato** (P-PR7): la cláusula PRIMERO individualiza el
  inmueble por rol antes de remitir al Conservador, y suma las unidades accesorias
  al objeto del arriendo cuando existen.

### Seguridad: tres fallos reales encontrados atacando el sitio
El barrido no fue una revisión de código, fue un ataque a la aplicación corriendo.

1. **`?q=%` devolvía el catálogo completo del marketplace.** Prisma entrega el
   texto de `contains` al `LIKE` de Postgres **sin escapar**, así que el `%` del
   usuario dejaba de ser un carácter y pasaba a ser un comodín. Comprobado contra
   la base: sin escapar, buscar `Zeta%Zeta` calzaba con `Zeta%Zeta` **y** con
   `ZetaXZeta`. Afectaba también al buscador de personas del panel.
2. **Doce parámetros tumbaban el marketplace público con un 500.**
   `?precioMin=abc` llegaba a Prisma como `NaN`; `?corredor=x` a una columna
   `uuid`; `?tipo=x` a un enum inexistente, vía un `as` que `tsc` daba por bueno.
   Ruta pública y sin sesión.
3. **`/marketplace/<texto-no-uuid>` daba 500 en vez de 404.** Un enlace mal
   copiado bastaba.

Ninguno llegó a ejecutar SQL — las tablas quedaron intactas en cada barrido. Eran
caída de disponibilidad y, en desarrollo, exposición del error de Prisma.

**Arreglo:** `lib/busqueda.ts` (`terminoBusqueda`, `numeroFiltro`, `enteroFiltro`,
`idFiltro`, `opcionFiltro`). Lo que no se entiende, no se aplica.

**Dónde estaba el hueco, que es la parte que generaliza:** las rutas de API ya
tenían su capa de validación (Zod + rate limit) y aguantaron todo lo que se les
tiró — inyección, JSON roto, anidamiento raro — devolviendo 400/422/429 y nunca un
500. El hueco estaba entero en las **páginas Server Component**, que leen
`searchParams` y `params` sin pasar por ningún esquema. Una API sin validar se
nota enseguida; una página sin validar no, porque el 500 se lee como "se cayó el
sitio" y no como "falta validar un parámetro".

### Verificación
- **Aislamiento entre corredoras contra Postgres real** (28 casos): fila señuelo
  con un valor inconfundible; otra corredora no la lee, no la modifica, no la
  borra, ni sin contexto de tenant ni con un tenant inventado. Las consultas van a
  propósito **sin filtrar por `tenantId`**: si algo apareciera, el aislamiento lo
  estaría dando el código y no la base.
- **Rol y cuentas en el HTML servido**: se pidieron las 9 páginas públicas reales
  y se buscaron los 10 roles y 13 números de cuenta del seed en el cuerpo de la
  respuesta. Cero apariciones. Los 7 endpoints privados devuelven 401; panel y
  portal cortan en el guard antes de tocar la base.
- **180 combinaciones de basura e inyección** en todos los parámetros públicos →
  cero respuestas distintas de 200. Y los filtros legítimos comprobados en
  positivo **y en negativo** (`tipo=cabana`→1 / `tipo=casa`→0), para no haberlos
  anulado al blindarlos.
- **PDF real generado desde la base**, con el texto extraído del binario: el rol
  aparece en la cláusula, con el valor exacto de la propiedad.

694 tests verdes, `tsc` y `eslint` limpios.


### Sesiones privadas únicas y con caducidad (2026-08-26)

Reportado por el cliente: en el mismo navegador quedaban vivas la sesión del
corredor y la del arrendatario. Volver atrás mostraba el panel y avanzar entraba
al portal, sin que ninguna se cerrara. Reproducido: `/panel` y
`/portal/contrato/…` devolvían 200 desde el mismo navegador.

**La causa.** `pgo_session` y `pgo_portal` son cookies independientes por diseño
—dominios de autenticación separados, ADR-0007— y nada cerraba una al abrir la
otra. En el computador de la oficina, donde el arrendatario firma, eso deja dos
identidades activas.

**El arreglo va en los setters de cookie**, no en cada pantalla de login. Hay
cuatro entradas al panel (login, registro, invitación, confirmación de
dispositivo) y una al portal: repartir la regla entre las cinco es cinco
oportunidades de olvidarla, y la sexta que alguien agregue nace rota. El proxy
además barre la cookie contraria en cada request, para las sesiones que ya
estaban abiertas.

Detalle que importa: **cerrar una sesión no cierra la otra**. La exclusión es al
entrar. Si salir del portal cerrara también el panel, un corredor que nunca
estuvo en el portal quedaría fuera de su propio panel.

**Caducidad por inactividad.** Antes el panel duraba 8 horas y el portal 30
minutos, ambas absolutas: dejar la pantalla abierta no costaba nada. El
comentario del módulo prometía un "refresh pasivo en cada request" que nunca se
había implementado.

| | Inactividad | Máximo absoluto |
|---|---|---|
| Panel | 30 min | 8 h |
| Portal | 15 min | 30 min |

La inactividad es el `exp` del JWT, así que la sesión muere sola. El proxy la
re-firma mientras haya navegación, como mucho una vez por minuto. El tope
absoluto se mide contra un claim `ini` nuevo, que sobrevive a las renovaciones
—`iat` se mueve con cada una y por eso no servía—. La renovación vive en el
proxy porque un Server Component no puede escribir cookies.

**Un fallo latente encontrado de paso.** La cookie del portal usaba
`path: "/portal"` junto al prefijo `__Host-`. Ese prefijo exige `Path=/`, así que
en producción el navegador habría rechazado la cookie entera y el portal no
habría funcionado. Nunca se vio en local porque el prefijo solo se aplica cuando
`NODE_ENV` es production.

#### Verificación
- **Los dos sentidos, en el navegador**: entrar al panel deja el portal
  redirigiendo; entrar al portal deja `/panel`, `/panel/perfil` y `/panel/cobros`
  redirigiendo.
- **Inactividad, acortando la ventana a 10 s**: con actividad cada 4 s la sesión
  sobrevive; tras 14 s de silencio expulsa. Medido en una sola corrida, y luego
  restaurados los valores reales.
- Prueba de mutación: al quitar el cierre cruzado fallan exactamente los dos
  tests que lo cubren.
- 694 tests verdes, `tsc` y `eslint` limpios.

**Fuera de alcance.** La unicidad es por navegador. Que un mismo corredor tenga
sesión abierta en dos equipos distintos sigue siendo posible: eso requiere un
registro de sesiones en el servidor y no se abordó acá.

### Visibilidad de los datos privados (2026-08-26)

Mirando el portal quedó claro que los datos quedaban a la vista de cualquiera
que pasara por detrás de la pantalla, y que el corredor no tenía forma de
decidir qué compartía. Se resolvieron las dos cosas.

**En el portal, los datos salen tapados.** El rol, los roles de las unidades,
los números de cuenta y el titular aparecen como `••••••••` hasta que la persona
pulsa **Mostrar**. La empresa queda a la vista porque "Aguas Andinas" no
identifica a nadie. El relleno conserva el ancho a propósito: un bloque que
salta al mostrar y ocultar delata tanto como el dato.

**En el panel, el corredor decide qué comparte.** Hay un interruptor
Visible/Oculto en cada cuenta, cada rol complementario y el rol principal. Dice
el estado en palabras y no solo con un ícono, porque un ojo tachado es ambiguo:
¿está oculto, o hago clic para ocultarlo? Además puede agregar y quitar cuentas
adicionales con nombre propio —internet, alarma, TV cable—; las cuatro básicas
siguen fijas y se marcan "no aplica", como se decidió al abrir el Grupo 1.

En el detalle, cada dato que no se comparte lleva un distintivo **Oculto**. Sin
eso el interruptor sería a ciegas: habría que abrir el formulario de edición
para saber qué se está compartiendo.

**Ocultar afecta solo al portal.** El borrador de contrato sigue nombrando todas
las unidades —uno que omite la bodega deja esa bodega sin cubrir—, y el panel
tampoco filtra: el corredor ve sus propios datos completos. Hay un test que
comprueba las tres cosas por separado, para que nadie agregue el filtro al PDF
"por consistencia".

Cuando un dato está oculto, en el portal **no aparece nada**: ni el valor ni la
fila. Se eligió así para no revelar siquiera que existe algo escondido. Tiene
una consecuencia conocida: si el arrendatario lo había visto antes, va a notar
que desapareció sin explicación.

#### Verificación
- **El filtro es del servidor, no cosmético.** Se pidió el HTML crudo de la
  página del portal y los datos ocultos (`871-244`, `Bodega B-12`, `SEG-88120`,
  `Alarma`) **no viajan en la respuesta**. El tapado con puntos es contra
  miradas ajenas; el filtrado es el límite real.
- **Viaje completo por la interfaz**: se creó una propiedad desde el panel con
  una cuenta adicional y tres elementos ocultos, se comprobó en la base, se
  reabrió la edición —los interruptores llegaron con su estado guardado—, se
  invirtieron dos y se volvió a comprobar en la base.
- 678 tests verdes, `tsc` y `eslint` limpios, sin fugas en las cinco superficies
  públicas y sin errores de Prisma en el log del servidor.

#### Nota de método
`prisma generate` con el dev server arriba deja el proceso sirviendo el cliente
anterior, y el síntoma es un 500 con `Unknown field` que parece un error de
código. Es la trampa que ya está en BRAIN.md §2. Se intentó esquivarla
levantando un segundo servidor en otro puerto: **Next.js no lo permite** —
rechaza un segundo `next dev` sobre el mismo directorio e imprime él mismo el
`taskkill` necesario. No hay atajo: hay que reiniciar el proceso.

### Barrido de QA sobre la aplicación corriendo (2026-08-26)

Después de cerrar el Grupo 1 se hizo un barrido manejando la aplicación —
seguridad, interfaz, flujo y búsqueda de errores—. Aparecieron **siete
defectos**, y el más grave no lo habría encontrado ningún test.

**Editar una propiedad descartaba el rol y las cuentas en silencio.** La acción
de actualizar no recibía esos campos. El formulario sí los mostraba, la
corredora los cambiaba, el diálogo se cerraba **sin error** y la base conservaba
el valor anterior. Contradecía el requisito explícito de que ambos son editables
por el corredor a cargo o el administrador. Los tests de esa acción existían
desde antes y tampoco los cubrían: el fixture omitía los mismos campos, así que
el test estaba de acuerdo con el error.

Los otros seis:

- Una bodega podía llevar **el mismo rol que la propiedad**. Se creó así desde
  la UI, sin manipular nada.
- El aviso "eso parece un RUT" solo se disparaba con los RUT terminados en K —
  uno de cada once—; con el resto llegaba el mensaje genérico.
- `0-0` se aceptaba como rol, y `0-0` es justamente el valor con que la
  migración rellenó las filas existentes.
- El portal devolvía **500 con un id inválido, pero solo estando autenticado**:
  sin sesión el guard corta antes y el problema no se ve.
- Cuatro campos del formulario de propiedad (Región, Comuna, Orientación,
  Colaborador asignado) sin nombre accesible, preexistentes.
- La sección de servicios y rol quedaba sin tarjeta en el portal mientras sus
  cuatro vecinas sí la tenían.

**Lo que se midió, no se estimó:** cero desbordes horizontales en 375 px, cero
textos bajo 4,5:1 de contraste en tema claro y oscuro, cero errores de consola,
42 combinaciones de basura e inyección en el marketplace público sin una sola
respuesta distinta de 200, y el aislamiento del portal comprobado pidiendo los
contratos de otras dos corredoras (404, sin filtrar nada).

**Una regla que se propuso y se retiró.** Se agregó una validación que rechazaba
dos cuentas del mismo servicio; un test existente falló y explicaba por qué:
*una propiedad subdividida tiene dos medidores*. La decisión previa estaba
documentada y era correcta, así que la regla se quitó y quedó solo la validación
del tipo contra el enum.

### Nota de método
Dos hallazgos salieron de investigar un fallo en vez de ajustar lo esperado:

- Un test de seguridad falló con 3 filas donde esperaba 0. **No era una fuga** —
  eran filas propias de esa corredora, y lo mal supuesto era el escenario del
  test. La conclusión real estaba al lado: Prisma no escapa `%`.
- Generar un PDF con datos reales mostró la cláusula diciendo "el estacionamiento
  **Estacionamiento 216**". El formulario sugiere escribir "Estacionamiento 43" en
  la descripción, así que la duplicación estaba garantizada en producción. Con los
  datos inventados del test nunca habría aparecido.

## Notas / decisiones pendientes
- Proveedor de identidad para producción (sin definir).
- Pasarela de pago (**D-02**, pospuesta explícitamente el 2026-08-19). Bloquea toda la Fase B. El comparativo Flow / Transbank / Mercado Pago / Fintoc, con el costo real de la diferencia a cada escala, está en el anexo de `rowmap-pagos.md`.
- Fuente oficial de UF/IPC para producción (SII / Banco Central).
- **Upload de imágenes en producción**: `public/uploads/` no persiste entre deploys. Migrar a S3/R2 antes de lanzar — **diferido a la fase de release** (2026-08-19, decisión del cliente: en desarrollo el disco local funciona). Lo que sí se resolvió: el directorio ya está en `.gitignore`, porque las fotos de clientes se estaban commiteando al repositorio.
- **Regulación STR municipal**: vacío legal activo en Chile (jun 2026). Monitorear legislación futura que podría afectar a propietarios STR de la corredora.
- **Identidad/contrato — pendientes de la línea de verificación por IA**: captura de cédula por cámara (marco guía + fallback a upload manual — hoy solo lectura de QR del reverso), detección de contrato firmado vs. borrador por firma digital del PDF, consentimiento opt-in con T&C/política versionados (modal actual a corregir), fixes de higiene de seguridad pendientes en las llamadas a IA externa. Sin fecha objetivo.
- **Ítems 8, 9 y 11** del backlog de mejoras: requieren definición de alcance antes de poder implementarse.
