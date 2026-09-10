# Plan de pruebas QA + Seguridad — cambios legales/billing (sesión 2026-09)

> **Alcance:** todo lo agregado entre los commits `d2c2dbb` (Grupo B) y `a896389`
> (L-DT6/L-DT7): Grupos A/B/C del rowMap legal, parte del F, la orquestación de
> billing y el ajuste de límites de plan. ~50 archivos de código.
>
> **Objetivo:** no dejar fugas de información —sobre todo números de cuenta
> bancaria, el dato más sensible que guarda la plataforma—, aperturas de
> autorización (IDOR), inyección, ni errores funcionales en el cálculo de plata.
>
> **Método:** cada punto se prueba de verdad (test automatizado contra Postgres
> real donde toca aislamiento/constraints; unitario para cálculo; navegador/DB
> para auth de rutas). Cualquier fallo se corrige en el acto (cero deuda técnica).
>
> _Creado 2026-09-10._

---

## Superficie de ataque nueva

| Categoría | Elementos |
|---|---|
| **Rutas API** | `/api/panel/vouchers/[id]/pdf`, `/api/portal/voucher/[id]/pdf`, `/api/panel/contratos/[id]/aviso-termino/pdf`, `/api/panel/contratos/[id]/estado-cuenta/pdf` |
| **Server actions** | `panel/corredora/actions` (3), `panel/propiedades/actualizarPropiedad` (cuentaPropietario), `panel/contratos/[id]/terminarContrato` (causal), `panel/contratos/nuevo/crearContrato` (amoblado/CBR), `registro/actions` (rut corredora) |
| **Tablas nuevas / columnas** | `cuenta_bancaria`, `folio_counter`, `Tenant.rut UNIQUE`, `Voucher.folio`, `Contrato.*` (causal, CBR, notario), `Propiedad.avaluoFiscal` |
| **Núcleo (`@housing/core`)** | `iva.ts` (5 fns), `desahucio.ts`, `liquidacion.ts` extendido |
| **Documentos PDF** | comprobante, liquidación, aviso de término, estado de cuenta |
| **Portal** | cuenta del propietario (L-DT7), comprobantes del arrendatario |

---

## Secciones del plan

### A. Autenticación y autorización

| ID | Prueba | Resultado esperado |
|---|---|---|
| A1 | Las 4 rutas PDF sin sesión | `401`, sin cuerpo revelador |
| A2 | IDOR horizontal: corredor de tenant X pide documento de tenant Y | `404` (no `403` — no revela existencia) |
| A3 | IDOR vertical portal: arrendatario pide `/api/portal/voucher/<id-de-liquidacion>` | `404` — el arrendatario solo ve `pago` |
| A4 | IDOR vertical portal: propietario pide `/api/portal/voucher/<id-de-pago>` | `404` — el propietario solo ve `liquidacion` |
| A5 | Colaborador pide documento de propiedad NO asignada | `404` |
| A6 | `/panel/corredora` con sesión de colaborador | redirect a `/panel` (proxy) + acción rechaza |
| A7 | `guardarDatosCorredora` / `guardarCuentaCorredora` llamadas como colaborador | `{ ok: false }` con mensaje de permiso |

### B. Aislamiento multi-tenant (RLS)

| ID | Prueba | Esperado |
|---|---|---|
| B1 | `cuenta_bancaria`: otra corredora lee/modifica/borra la cuenta señuelo | 0 filas / count 0 |
| B2 | `folio_counter`: otra corredora lo lee o lo altera | 0 filas / count 0 |
| B3 | Sin `app.current_tenant_id` seteado, `cuenta_bancaria.findMany` | 0 filas |
| B4 | Un `tenant_id` inventado en `set_config` no abre nada | 0 filas |
| B5 | `housing_app` tiene los GRANT (INSERT/SELECT/UPDATE/DELETE) sobre las tablas nuevas | sí |

### C. Fuga de información

| ID | Prueba | Esperado |
|---|---|---|
| C1 | El PDF de liquidación con `cuentaPropietario` — ¿lo puede pedir el arrendatario? | no (A3) |
| C2 | El portal del arrendatario — ¿aparece la cuenta del propietario en el HTML? | no |
| C3 | El portal del propietario con `visibleEnPortal=false` | la card no se renderiza |
| C4 | Superficies públicas (`marketplace`, home) — ¿aparece `cuentaBancaria`, `rutTitular`, `avaluoFiscal`, `rol:`? | no (guard de test) |
| C5 | Mensajes de error de las rutas — ¿filtran stack, Prisma, SQL? | no, mensajes genéricos |
| C6 | El snapshot del voucher — ¿trae datos de otro contrato/persona? | no, solo del suyo |

### D. Inyección y validación de entrada

| ID | Prueba | Esperado |
|---|---|---|
| D1 | UUID malformado en `[id]` de las rutas (`' OR 1=1`, `../`, `%00`, uuid falso) | `404`/`400`, nunca `500` ni fuga |
| D2 | Payloads SQL en `numero`, `titular`, `banco`, `giro`, `rutTitular` de la cuenta | se guardan como texto, no ejecutan; `validarCuentaBancaria` rechaza RUT/numero inválido |
| D3 | Año CBR fuera de rango, causal fuera del enum | rechazado por el servidor (no confía en el cliente) |
| D4 | El folio no se puede inyectar (viene del contador atómico, no de input) | confirmado por diseño + test |
| D5 | `avaluoFiscal` con `NaN`, negativo, decimales, dedazo de ceros | rechazado por `validarAvaluoFiscal` |

### E. Integridad de datos / constraints

| ID | Prueba | Esperado |
|---|---|---|
| E1 | Registrar dos corredoras con el mismo RUT (secuencial y concurrente) | la segunda falla (UNIQUE + chequeo `auth_rut_corredora_existe`) |
| E2 | 10 folios concurrentes del mismo (tenant, tipo, año) | 10 distintos, sin saltos |
| E3 | Segunda cuenta bancaria de la corredora / del mismo propietario | rechazada (índice único parcial + `@@unique`) |
| E4 | Cuadre de la liquidación: `arriendo = neto + comisión + IVA comisión + descuentos` | exacto, para varios casos |
| E5 | `ivaArriendoIncluido`: `exento + neto + iva = renta` | exacto |

### F. Correctitud funcional

| ID | Prueba | Esperado |
|---|---|---|
| F1 | IVA comisión: natural exenta, jurídica 19%, redondeo al peso | correcto |
| F2 | IVA amoblado incluido: total no cambia, deducción 11% prorrateada | correcto |
| F3 | Plazo restitución: 2 base, +1 por año completo, tope 6, desde notificación | correcto |
| F4 | Estado de cuenta: línea por concepto, total = Σ líneas, mora dentro de gracia no genera línea | correcto |
| F5 | Folio: formato `CP-2026-00042`, correlativo, series por tipo/año | correcto |
| F6 | Recordatorio: incluye transferencia si hay cuenta + cierre "si ya pagaste" | correcto |
| F7 | Dedup de avisos de ciclo: la firma queda `reemplazada` si sale el "vigente" | correcto |
| F8 | Límites: Bronze/Silver 1 usuario, Gold 5, Diamond 10; el enforcement usa el número | correcto |
| F9 | `terminarContrato` sin causal / desahucio sin fecha | rechazado |
| F10 | Contrato amoblado sin avalúo en la propiedad | rechazado al crear |

### G. Documentos PDF

| ID | Prueba | Esperado |
|---|---|---|
| G1 | Inyección en PDF: dirección/nombre con `<script>`, `</Text>`, `&` | no rompe el render ni ejecuta nada (react-pdf escapa) |
| G2 | Regeneración: pedir el mismo PDF dos veces | mismo folio, mismo contenido (viene del snapshot) |
| G3 | Voucher previo al folio (`folio` null) | `409` con mensaje claro, no `500` |
| G4 | Pie "No constituye documento tributario" (L-CP10) | presente |
| G5 | Headers de las 4 rutas | `application/pdf` + `Cache-Control: no-store, private` + `X-Content-Type-Options: nosniff` |

### H. Errores comunes de seguridad web

| ID | Prueba | Esperado |
|---|---|---|
| H1 | `/api/portal/voucher` registra el acceso (`acceso_log`) — Ley 21.719 | sí |
| H2 | Los server actions verifican rol/ownership en el servidor | sí (no solo UI oculta) |
| H3 | Un `Colaborador` no puede editar la cuenta del propietario de una propiedad ajena | `actualizarPropiedad` lanza DomainError |
| H4 | El JWT de sesión no se puede manipular para cambiar de tenant/rol | ya cubierto por `auth-jwt-tamper.test.ts` (regresión) |

---

## Resultados

_Ejecutado 2026-09-10. ✅ pasó · 🔧 falló y se corrigió en el acto · ⚠️ hallazgo._

### Método aplicado

- **DB real bajo RLS** (`housing_app`): `apps/web/src/lib/__tests__/qa-seguridad-cambios-legales.test.ts`
  — 17 casos (B, D, E, C, y **A3/A4 nuevos**). Corre contra Postgres levantado; se salta si no hay base.
- **Unitario**: `packages/core` (74) + suites de `apps/web` (839) — cubren toda la sección F.
- **Rutas / navegador**: `curl` + sesión real de panel/portal para A1/A2/A5–A7 y headers.
- **Inspección de código**: H2/H3/H1 (los `actions` y las rutas del portal).

### A. Autenticación y autorización

| ID | Resultado |
|---|---|
| A1 | ✅ Las 5 rutas PDF sin sesión → `401 {"error":"No autorizado."}`, sin cuerpo revelador. |
| A2 | ✅ Documento de otro tenant → `404 "no encontrado"` (RLS + filtro `tenantId`; nunca `403`). |
| A3 | ✅ El arrendatario NO alcanza la liquidación (`tipo: "pago"` fijo + contrato por `arrendatarioId`). Test `A3`/`A3b`. |
| A4 | ✅ El propietario NO alcanza el comprobante de pago. Test `A4`. |
| A5 | ✅ Colaborador → documento de propiedad no asignada → `404` (`asignadoAId !== usuarioId`). |
| A6 | ✅ `/panel/corredora` con sesión de colaborador → redirect a `/panel` (`proxy.ts:166`). |
| A7 | ✅ `guardarDatosCorredora` / `guardarCuentaCorredora` / `eliminarCuentaCorredora` como colaborador → `{ ok:false, error:"Solo el administrador…" }` (chequeo en la función, no solo en el proxy). |

### B. Aislamiento multi-tenant (RLS)

| ID | Resultado |
|---|---|
| B1 | ✅ `cuenta_bancaria` no cruza de corredora (RLS activa + índice). |
| B2 | ✅ `folio_counter`: otra corredora lo lee → 0 filas; lo altera → `count 0`; el de A queda intacto. |
| B3 | ✅ Sin `app.current_tenant_id` → `folio_counter` / `cuenta_bancaria` devuelven vacío. |
| B4 | ✅ `tenant_id` inventado no abre nada (política `nullif(current_setting…)::uuid`). |
| B5 | ✅ `housing_app` tiene `SELECT/INSERT/UPDATE/DELETE` sobre ambas tablas nuevas; RLS habilitada. |

### C. Fuga de información

| ID | Resultado |
|---|---|
| C1 | ✅ = A3. |
| C2 | ✅ El número de cuenta señuelo (`SECRETO-CUENTA-QA-999`) no aparece por ninguna vía del arrendatario (test `A3b`). |
| C3 | ✅ `visibleEnPortal=false` ⇒ la card no se renderiza (rama en el portal del propietario). |
| C4 | ✅ Superficies públicas: `marketplace/__tests__/no-expone-datos-privados.test.ts` bloquea `cuentaBancaria`, `rutTitular`, `avaluoFiscal`, `rol:`. |
| C5 | ✅ Errores de las rutas: mensajes genéricos en español, sin stack/SQL/Prisma (revisado en las 5 rutas + `logError` server-only). |
| C6 | ✅ El snapshot del voucher solo trae RUT/dirección de su propio contrato (test C). |

### D. Inyección y validación de entrada

| ID | Resultado |
|---|---|
| D1 | 🔧 **Hallazgo #1**: id malformado en `[id]` → `500` con cuerpo vacío (Prisma valida el `uuid` y lanza). No filtraba stack, pero es un vector de fingerprinting (`500` vs `404`). **Corregido**: guard `idFiltro(id)` → `404` limpio en **11 rutas** (5 del alcance + 6 preexistentes con el mismo patrón: `documentos/[id]`, `portal/documento/[id]`, `auth/dispositivos/[id]`, `panel/contratos/[id]/comentarios`, `contratos/[id]/validar`, `contratos/[id]/validar-doc`). Test de regresión en `pdf-route.test.ts`. |
| D2 | ✅ Payloads SQL/`<script>` en `banco`/`titular` se guardan como texto literal (Prisma parametriza); las tablas y los tenants sobreviven. `validarCuentaBancaria` rechaza RUT/número/tipo malformados. |
| D3 | ✅ Causal fuera del enum y año CBR fuera de rango → rechazados por el servidor (`actualizarPropiedad` / `terminarContrato` validan, no confían en el cliente). |
| D4 | ✅ El folio viene del contador atómico (`siguienteFolio`), nunca de input. |
| D5 | ✅ `avaluoFiscal` con `NaN`/negativo/decimales → `validarAvaluoFiscal` lo rechaza antes de tocar la fila. |

### E. Integridad de datos / constraints

| ID | Resultado |
|---|---|
| E1 | ✅ `Tenant.rut` es `UNIQUE`: poner a B el RUT de A → rechazado. `auth_rut_corredora_existe()` detecta el duplicado antes del insert. |
| E2 | ✅ 10 folios concurrentes del mismo (tenant, tipo, año) → exactamente `1..10`, sin saltos ni repetidos. |
| E3 | ✅ Segunda cuenta de la corredora (`personaId` nulo) → rechazada por el índice único parcial. |
| E4 | ✅ Cuadre de la liquidación (`dominio.test.ts` + `comprobante.test.ts`). |
| E5 | ✅ `ivaArriendoIncluido`: `exento + neto + iva === renta` (`dominio.test.ts`). |

### F. Correctitud funcional

| ID | Resultado (suite) |
|---|---|
| F1 | ✅ `ivaComision` natural exenta / jurídica 19% / redondeo (`packages/core/src/dominio.test.ts`). |
| F2 | ✅ IVA amoblado incluido + deducción 11% prorrateada (`dominio.test.ts` `deduccionAvaluo`, `ivaArriendoIncluido`). |
| F3 | ✅ `plazoRestitucionDesahucio`: base 2, +1 por año completo, tope 6, desde la notificación (`dominio.test.ts`). |
| F4 | ✅ Estado de cuenta línea por concepto, total = Σ, gracia sin línea de mora (`estado-cuenta.test.ts`). |
| F5 | ✅ Folio `CP-2026-00042`, correlativo, series por tipo/año (`folio.test.ts`). |
| F6 | ✅ Recordatorio con transferencia + cierre "si ya pagaste" (`recordatorio-pago.test.ts`). |
| F7 | ✅ Dedup de avisos de ciclo (`notificaciones-ciclo.test.ts`). |
| F8 | ✅ Límites de plan 1/1/5/10 y el enforcement usa el número (`plan-limits.test.ts`). |
| F9 | ✅ `terminarContrato` sin causal / desahucio sin fecha → rechazado (`contract-rules.test.ts`, `cobros-actions.test.ts`). |
| F10 | ✅ Contrato amoblado sin avalúo en la propiedad → rechazado al crear. |

### G. Documentos PDF

| ID | Resultado |
|---|---|
| G1 | ✅ `<script>`/`</Text>`/`&` en dirección/nombre → react-pdf escapa, el render no rompe (2 971 bytes con payload). |
| G2 | ✅ El PDF se regenera desde el snapshot: dos descargas → mismo folio, mismo contenido. |
| G3 | ✅ Voucher sin folio → `409 "Este comprobante es anterior al formato PDF"`, no `500`. |
| G4 | ✅ Pie "No constituye documento tributario" presente (`comprobante-pdf.test.ts`). |
| G5 | ✅ Las 5 rutas: `application/pdf` + `Cache-Control: no-store, private` + `X-Content-Type-Options: nosniff`. |

### H. Errores comunes de seguridad web

| ID | Resultado |
|---|---|
| H1 | ✅ `/api/portal/voucher/[id]/pdf` y `/api/portal/documento/[id]` registran `acceso_log` (`portal_descarga_comprobante` / `portal_documento_descargado`). |
| H2 | ✅ Los `actions` verifican rol/ownership en el servidor (`actor.rol`, `asignadoAId`), no solo la UI. |
| H3 | ✅ Colaborador editando la cuenta del propietario de una propiedad ajena → `DomainError "No tienes acceso a esta propiedad."` **antes** de tocar la cuenta (`actualizarPropiedad`, línea 533). |
| H4 | ✅ `auth-jwt-tamper.test.ts` sigue verde (regresión). |

### Hallazgos y correcciones

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Baja (fingerprinting, sin fuga de datos) | id no-UUID en rutas `[id]` → `500` con cuerpo vacío en vez de `404`. | Guard `idFiltro(id)` en 11 rutas + test de regresión. |
| 2 | Baja (funcional, sin brecha) | `portal_lookup_persona_por_rut`: con el mismo RUT en dos corredoras, `limit 1` sin `order by` era no determinista y podía devolver una ficha sin contrato vigente, bloqueando el acceso al portal de la persona que sí tenía uno. | `order by (c.id is not null) desc, p.created_at asc` en `setup.sql` — se prefiere la ficha con contrato vigente. No era una fuga (mismo RUT = misma persona; el OTP va a su correo). |

### Cobertura nueva permanente

- `apps/web/src/lib/__tests__/qa-seguridad-cambios-legales.test.ts` — 17 casos (auto-seed + limpieza).
- `pdf-route.test.ts` — caso de regresión del guard `idFiltro`.

Suites completas tras los cambios: **`apps/web` 839 ✅ · `@housing/core` 74 ✅**.
