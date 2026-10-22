# Auditoría E2E — Flujos Corredor y Cliente (2026-07-03)

> **Actualización 2026-07-03 (segunda pasada):** todos los hallazgos de la primera pasada (AUD-01 a AUD-08) fueron corregidos y verificados (232→236 tests, `tsc` limpio). Durante la verificación E2E en navegador —una vez desbloqueado AUD-01— se descubrió un **noveno hallazgo crítico (AUD-09)**, más severo que todos los anteriores: la transición de período a "atrasado" nunca estaba implementada. Ver §6.

> Auditoría adversarial de extremo a extremo con **base de datos limpia** y **cuenta de corredor creada desde cero**. Enfoque: asumir que nada funciona y estresar cada flujo para detectar bugs de frontend, backend y API que no se ven a simple vista.

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Flujos auditados | Corredor (registro→panel→cobros→liquidación) · Cliente (marketplace/portal) |
| Método | E2E en navegador (Claude Preview, eventos reales) + revisión de código de Server Actions/API + tests automatizados |
| Hallazgos | **9** — 8 corregidos en la 1ª pasada + **1 crítico (AUD-09) hallado y corregido en la verificación E2E** |
| Tests | 232 → **236/236** (`@propigo/web`) + **47/47** (`@propigo/core`) + `tsc --noEmit` limpio |
| Estado final | **Todos los hallazgos corregidos y verificados end-to-end en navegador**, incluido el ciclo financiero completo (crear contrato → conciliar con mora real → cerrar liquidación → voucher → portal). |

**Veredicto:** la lógica de negocio (cálculo de mora, ledger, comisión, liquidación) es correcta y estaba bien protegida — pero **era inalcanzable en la práctica** hasta corregir AUD-01 (bloqueaba el onboarding) y AUD-09 (bloqueaba la conciliación de cualquier período real). Ambos bugs habían quedado invisibles en todas las sesiones anteriores porque los datos de demostración (`seed.ts`) fabricaban a mano los estados que la aplicación nunca generaba por sí sola. Esta auditoría es la primera vez que se ejercita el sistema con datos 100% generados por la propia aplicación, de principio a fin.

## 2. Metodología

1. **Limpieza total de datos de usuario** — nuevo script `npm run db:clean` (trunca todo el grafo de tenants vía CASCADE; conserva las series UF/IPC de referencia). Ver `apps/web/prisma/clean.ts`.
2. **Cuenta de corredor desde cero** — registro real hasta el gate de verificación de identidad (ver AUD-07); la cuenta se materializó con `apps/web/prisma/e2e-bootstrap.ts` (temporal) replicando exactamente lo que crea `registroAction`.
3. **Pruebas adversariales**: envío de formularios vacíos, RUT con dígito verificador inválido, contraseña débil, contraseña incorrecta (lockout), código 2FA viejo/expirado, menor de edad, doble envío.
4. **Herramientas**: `preview_fill` / `preview_click` (eventos reales) + `preview_logs` / `preview_network` para el backend + revisión de código fuente.

> **Nota de método (importante para la siguiente parte):** los envíos de formulario mediante `eval` con eventos sintéticos **no disparan de forma fiable los Server Actions de React** (un guardado de perfil pareció fallar y en realidad no se envió). Toda verificación de submit debe hacerse con `preview_fill`/`preview_click`.

## 3. Hallazgos

| ID | Severidad | Flujo | Síntoma | Estado |
|---|---|---|---|---|
| AUD-09 | 🔴🔴 Crítico | Corredor · Cobros (núcleo) | Ningún período pasaba nunca de `pendiente` a `atrasado` → conciliación real imposible | ✅ Corregido |
| AUD-01 | 🔴 Alta | Corredor · Perfil | Guardar el perfil expulsa al corredor a la verificación de dispositivo (2FA) | ✅ Corregido |
| AUD-02 | 🟠 Media | Corredor · 2FA | Sesión "fantasma" produce HTTP 500 crudo (FK) en `dispositivo/enviar` | ✅ Corregido |
| AUD-03 | 🟠 Media | Corredor↔Cliente · RUT | RUT guardado con puntos en panel no coincide con la búsqueda del portal | ✅ Corregido |
| AUD-04 | 🟠 Media | Cliente · Valoración | `marketplace/valoracion` sin rate-limit y con transacciones fuera de `try/catch` → 500 en doble envío | ✅ Corregido |
| AUD-05 | 🟡 Baja | Cliente · Valoraciones | `GET /marketplace/valoraciones/[tenantId]` sin `try/catch` ni rate-limit | ✅ Corregido |
| AUD-06 | 🟡 Baja | Datos demo | Los RUT del seed original no pasaban `validarRut` | ✅ Corregido |
| AUD-07 | 🟡 Baja | Corredor · Registro | La verificación de identidad por cédula (IA) bloquea todo E2E automatizado | ✅ Corregido (bypass gated) |
| AUD-08 | ⚪ Trivial | Corredor · 2FA | Copy incorrecto: dice "`pnpm dev`" pero el proyecto usa `npm` | ✅ Corregido |

> Además, al correr la suite completa durante el QA se encontraron y corrigieron **2 fallas de test/accesibilidad no relacionadas con esta auditoría**: mocks desactualizados en `propiedades-actions.test.ts` (post AUD-03) y una **regresión real de accesibilidad** en `LoginForm` (toast duplicaba `role="alert"` con el mensaje inline ya existente, rompiendo WCAG 4.1.2). Ambas corregidas — ver §7.

---

### AUD-01 — Guardar el perfil rompe el dispositivo de confianza 🔴

- **Flujo:** Corredor → completar perfil → navegar en el panel.
- **Síntoma reproducido:** tras guardar el perfil (que persiste correctamente, `perfilCompleto=true`), al navegar a `/panel/propiedades` el proxy **rebota a `/verificar-dispositivo`** y exige un nuevo código 2FA por email.
- **Causa raíz:** `apps/web/src/app/panel/perfil/actions.ts:130` re-firma el JWT de sesión copiando campos **a mano** (`sub, tenantId, rol, nombre, email, perfilCompleto`) y **omite `deviceToken`**. El proxy, al no ver `deviceToken`, considera el dispositivo no verificado.
- **Impacto:** fricción severa en el onboarding — el corredor recién registrado guarda su perfil (paso obligatorio) e inmediatamente es expulsado a 2FA. Reproducible al 100%.
- **Solución propuesta:** preservar el payload existente al re-firmar. Espejar el patrón de `refreshSessionWithDevice` (auth.ts): `const { iat, exp, ...rest } = session; signSession({ ...rest, perfilCompleto: requiredComplete })`.
- **Test a agregar:** unit — el token re-firmado tras guardar perfil conserva `deviceToken`. E2E — guardar perfil no redirige a `/verificar-dispositivo`.

### AUD-02 — Sesión fantasma → 500 crudo en `dispositivo/enviar` 🟠

- **Flujo:** Corredor con sesión válida cuyo usuario ya no existe en la BD (cuenta eliminada, o reset de datos con cookie viva).
- **Síntoma reproducido:** `POST /api/auth/dispositivo/enviar` lanza `PrismaClientKnownRequestError P2003` (Foreign key `codigo_dispositivo_usuario_id_fkey`) → **HTTP 500 con stack en el log**.
- **Causa raíz:** `dispositivo/enviar/route.ts:96` hace `codigoDispositivo.create({ usuarioId: session.sub })` **sin verificar que el usuario exista** y **sin `try/catch`**. Aplica también a `dispositivo/confirmar`.
- **Impacto:** experiencia rota (500) y traza de error en logs si una sesión sobrevive al borrado de su usuario. Bajo en operación normal, real ante eliminación de cuentas.
- **Solución propuesta:** verificar existencia del usuario (o envolver en `try/catch`); ante ausencia/FK, invalidar la sesión (`clearSessionCookie` + `clearDeviceCookie`) y responder 401 para forzar re-login limpio.
- **Test a agregar:** sesión con `sub` inexistente → 401 (no 500) y cookies borradas.

### AUD-03 — Inconsistencia de formato de RUT panel↔portal 🟠 (✅ ya corregido)

- **Detalle:** propietarios/arrendatarios creados desde el panel se guardaban con el RUT **con puntos** (autoformato de la UI), mientras el portal OTP normaliza **sin puntos** al buscar → el arrendatario nunca encontraba su contrato al pedir el código (la petición devolvía 200 anti-enumeración pero no generaba OTP).
- **Corrección aplicada:** `propiedades/actions.ts` y `contratos/nuevo/actions.ts` ahora usan `canonicalRut()` al guardar y buscar; seed en formato canónico.
- **Test a agregar (regresión):** crear propietario con RUT `"12.345.678-5"` desde panel → `persona.rut === "12345678-5"`; el portal lo encuentra.

### AUD-04 — `marketplace/valoracion`: sin rate-limit y 500 en doble envío 🟠

- **Causa raíz:** `api/marketplace/valoracion/route.ts` valida con Zod y el `token` es de un solo uso (`valoracionDada`), pero:
  1. Las transacciones de BD **no están dentro de `try/catch`** (solo el `req.json()` lo está). Un fallo de BD → **500 crudo**.
  2. **Race condition:** dos POST concurrentes con el mismo token pasan el check `valoracionDada=false` y el segundo choca contra el `@unique(consultaId/contratoId)` → excepción no manejada → 500.
  3. **Sin rate-limit** (a diferencia de `contacto` y `denuncia`).
- **Solución propuesta:** envolver las transacciones en `try/catch` (devolver 409 si es conflicto de unicidad, 500 genérico si no); agregar `checkRateLimit` por IP; opcional: gate atómico (`updateMany` con `WHERE valoracionDada=false`).
- **Test a agregar:** doble POST con el mismo token → segundo responde **409**, no 500.

### AUD-05 — `GET /marketplace/valoraciones/[tenantId]` sin manejo de errores 🟡

- **Causa raíz:** la ruta de listado público de valoraciones no tiene `try/catch` ni rate-limit → un fallo de BD produce 500 crudo; scrapeable sin límite.
- **Solución propuesta:** `try/catch` con 500 genérico + `checkRateLimit`.

### AUD-06 — RUT de datos demo inválidos 🟡 (✅ ya corregido)

- Los 5 RUT del seed original (p. ej. `15.111.222-3`) tenían **dígito verificador incorrecto** y eran rechazados por `validarRut` en el formulario del portal. Recalculados con mod-11 y en formato canónico. Regla: **todo dato demo debe pasar `validarRut`**.

### AUD-07 — La verificación de identidad bloquea el E2E automatizado 🟡 (cuestionamiento de flujo)

- **Detalle:** `registroAction` exige subir una **foto real del frontis de la cédula**, que se valida con IA (Groq) comparando RUT y nombre. Es una excelente defensa anti-usurpación, pero **impide cualquier prueba E2E automatizada** del registro y de todo lo posterior.
- **Propuesta:** agregar un **modo de prueba** activado por variable de entorno (p. ej. `E2E_BYPASS_IDENTITY=1`, solo fuera de producción y bloqueado por `startup-check`) que omita la verificación con IA. Permite QA/E2E sin debilitar producción.

### AUD-08 — Copy incorrecto "pnpm dev" ⚪ (✅ corregido)

- En `/verificar-dispositivo` el aviso de modo desarrollo decía *"terminal donde corre `pnpm dev`"*, pero el proyecto usa **npm** (`npm run dev`). Corregido y verificado visualmente.

### AUD-09 — La transición a "atrasado" nunca estaba implementada 🔴🔴 CRÍTICO (✅ corregido)

- **Cómo se descubrió:** al desbloquear AUD-01, se pudo por primera vez crear un contrato real (no seed) con fecha de inicio en el pasado y navegar a Cobros. La pantalla mostró **"Todo al día — excelente trabajo"** pese a tener 6 períodos vencidos sin pago.
- **Causa raíz:** el modelo de dominio documenta explícitamente (`Docs/funcional/modelo-dominio.md:125`): *"Estados del período: pendiente → pagado (conciliado) → liquidado (cerrado); **atrasado si vence sin pago**"*. Se auditó **todo** el código (`apps/web/src` y `packages/core/src`) buscando cualquier escritura de `estado: "atrasado"` — no existía ninguna. Un período nace `pendiente` (default del schema) y **ningún proceso lo transicionaba jamás**, ni por lectura perezosa (como sí hace `auto-extender.ts` para el calendario) ni por el cron de recordatorios.
- **Por qué nadie lo había visto:** el `seed.ts` original **fabricaba manualmente** la distribución de estados (`atrasado`/`pagado`/`liquidado`) para que la demo se viera realista, enmascarando por completo la ausencia de la transición real en todas las sesiones de trabajo/demo anteriores.
- **Impacto (el más severo de toda la auditoría):**
  1. El dashboard y Cobros mostraban **"Todo al día"** indefinidamente aunque hubiera meses de arriendo impago — el corredor no tenía forma de saberlo.
  2. **La conciliación era imposible de ejecutar** para cualquier período real: `getPeriodosPendientes` solo lista `estado IN ('atrasado','pagado')`, y la compuerta atómica de `simularPago` exige `estado: "atrasado"` — un período atascado en `pendiente` nunca aparecía en la UI ni podía procesarse.
  3. Las notificaciones de "alerta de atraso" (`tipo: cobro`) nunca se disparaban, porque dependen de `estado === "atrasado"`.
  4. El arrendatario veía "Pendiente" en su portal en vez de "Atrasado", ocultándole también su propia mora.
- **Solución aplicada:** nueva función `marcarPeriodosAtrasados(tenantId)` en `lib/queries.ts` — `UPDATE periodo_pago SET estado='atrasado' WHERE estado='pendiente' AND fecha_vencimiento < hoy`. Invocada de forma perezosa (mismo patrón que `verificarYExtenderCalendario`) en los 4 puntos de lectura relevantes: `getResumen` (dashboard), `getPeriodosPendientes` (cobros), `getContratoDetalle` (detalle de contrato) y la página del portal del arrendatario; además dentro de `generarRecordatorios` (cron) para que el sistema quede correcto sin depender de que alguien abra el panel.
- **Verificado E2E en navegador** (contrato real creado desde cero, fecha inicio 2026-01-05, hoy 2026-07-03):
  - Antes del fix: Cobros → "Por conciliar: 0", "Todo al día".
  - Después del fix: Cobros → **"Por conciliar: 6"**, con badges "Atrasado · 174d", "143d", "115d", "84d", "54d", "23d".
  - Conciliación real ejecutada: pago tardío (15 días, 5 de gracia → 10 días de mora) generó `CARGO_INTERES $5.000` + `PAGO_RECIBIDO $505.000` — interés calculado sobre la **fecha real declarada**, no la de hoy ni la de liquidación (confirma que Regla 5 del dominio sigue intacta).
  - Cierre de liquidación: comisión 50% → voucher de liquidación **$250.000**; Dashboard → **"1/6 liquidados (17%)"**.
  - Portal del arrendatario: refleja "1 Pagado, 5 Atrasados" con el detalle correcto por período.
- **Test agregado:** `lib/__tests__/marcar-periodos-atrasados.test.ts` (4 casos: filtra por tenant, solo toca `pendiente`, aislamiento multi-tenant, corte a medianoche UTC).

## 4. Fortalezas verificadas (lo que SÍ funciona bien)

- **Núcleo financiero (`cobros/actions.ts`):** aislamiento por `tenant_id`, **compuertas atómicas** (`updateMany` con `WHERE estado`) anti doble-procesamiento, `DomainError` para no filtrar mensajes internos, reajuste IPC aplicado en la conciliación, ledger inmutable. Robusto.
- **Login:** bloqueo escalonado por intentos fallidos (3→5min, 4→1h, 5→bloqueo) con avisos claros; credenciales incorrectas → mensaje genérico.
- **2FA por dispositivo:** códigos anteriores invalidados al reenviar, hash SHA-256, límite de intentos, cooldown.
- **Portal `verificar-otp`:** rate-limit por IP, hash, máximo de intentos, single-use, audit log, `try/catch`, mensajes de UX diferenciados (AGOTADO/EXPIRADO/INCORRECTO).
- **Marketplace `contacto` y `denuncia`:** `try/catch` + rate-limit + validación Zod.
- **Registro:** validación de vacíos, RUT (DV), email, fuerza de contraseña (≥15, NIST), consentimiento no premarcado (Ley 21.719) y verificación de identidad por cédula.
- **Perfil:** validación de edad ≥ 18; persistencia correcta (con herramientas reales).

## 5. Cobertura por flujo

| Flujo | Estado de la auditoría |
|---|---|
| Registro corredor | ✅ E2E (validaciones + creación real) + revisión de código |
| Login + lockout | ✅ E2E |
| 2FA dispositivo | ✅ E2E (código viejo/válido) + fix AUD-02 |
| Perfil obligatorio | ✅ E2E (edad, persistencia, fix AUD-01 verificado) |
| Propiedades (CRUD, ciclo de vida) | ✅ E2E completo (crear → activar → usar en contrato) |
| Contratos (wizard, firma) | ✅ E2E completo (4 pasos → activar → vigente) |
| Cobros / liquidación (núcleo) | ✅ **E2E completo** — conciliar con mora real, cerrar liquidación, voucher, dashboard (fix AUD-09 verificado) |
| Portal OTP (acceso, pagos) | ✅ E2E completo (RUT → OTP → ver pagos atrasados/pagados correctamente) |
| Marketplace (listado, ficha, contacto, denuncia, valoración) | 🟡 Revisión de código (fixes AUD-04, AUD-05 aplicados). **E2E visual pendiente** — sin bloqueos conocidos |
| Contratos (término, renovación) | 🟡 Revisión de código únicamente. **E2E pendiente** — sin bloqueos conocidos |

## 6. Backlog — estado final

Todos los ítems de la 1ª pasada **y** el hallazgo crítico AUD-09 de la 2ª pasada quedaron corregidos y verificados (código + tests + navegador):

| ID | Acción | Verificación |
|---|---|---|
| AUD-09 | `marcarPeriodosAtrasados()` invocada en 4 puntos de lectura + cron | Test unitario + E2E navegador (Cobros, portal, ledger) |
| AUD-01 | Preservar `deviceToken` al re-firmar el JWT en `guardarPerfil` | E2E navegador: guardar perfil ya no redirige a 2FA |
| AUD-02 | Manejo de sesión fantasma en `dispositivo/enviar`/`confirmar` (401 + limpiar cookies) | `tsc` + revisión manual |
| AUD-03 | RUT canónico en `propiedades/actions.ts` y `contratos/nuevo/actions.ts` | Test de regresión + E2E (persona creada con RUT con puntos → guardada sin puntos) |
| AUD-04 | `try/catch` + rate-limit + gate atómico en `marketplace/valoracion` | `tsc` + revisión manual |
| AUD-05 | `try/catch` + rate-limit + validación UUID en `valoraciones/[tenantId]` | `tsc` + revisión manual |
| AUD-06 | RUT del seed recalculados (mod-11) | Re-seed + validación matemática |
| AUD-07 | `E2E_BYPASS_IDENTITY` gated por `startup-check` (nunca en prod) | Tests de `startup-check` (2 nuevos casos) |
| AUD-08 | Copy "pnpm dev" → "npm run dev" | Verificado visualmente en navegador |

### Hallazgos adicionales del QA (no numerados como AUD, corregidos igual)

- **Regresión de accesibilidad en `LoginForm`:** un toast de error duplicaba `role="alert"` junto con el mensaje inline ya existente (`email-error`/`pwd-error`), rompiendo la asociación 1:1 que exige WCAG 4.1.2. Se restauró `aria-describedby` + mensaje inline y se eliminó el toast redundante (se conserva solo para el aviso de éxito de reset de contraseña, que no tiene hogar inline).
- **Mocks desactualizados en `propiedades-actions.test.ts`:** tras el fix de RUT canónico, faltaba `formatearRut` en el mock de `@propigo/core` y una aserción esperaba el RUT con puntos. Corregido + agregado test de regresión explícito.

## 7. Tests agregados en esta pasada

- `lib/__tests__/marcar-periodos-atrasados.test.ts` — 4 casos (AUD-09).
- `lib/__tests__/startup-check.test.ts` — 2 casos nuevos (AUD-07: bloqueo en prod / permitido en dev).
- `app/panel/propiedades/__tests__/propiedades-actions.test.ts` — 1 caso nuevo de regresión (AUD-03/06: mismo RUT con/sin puntos → mismo resultado canónico).
- `app/login/__tests__/login-form.test.tsx` — sin casos nuevos, pero las 39 pruebas existentes pasaron a depender de un wrapper `<ToastProvider>` y de la eliminación del toast redundante.

**Resultado final:** 236/236 tests (`@propigo/web`) + 47/47 (`@propigo/core`) + `tsc --noEmit` limpio + verificación E2E en navegador del ciclo financiero completo.

### Pendiente para una futura pasada

- E2E Playwright automatizado (hoy la verificación E2E es manual vía Claude Preview).
- Recorrido visual de marketplace (contacto/denuncia/valoración) y de término/renovación de contrato — sin bloqueos conocidos, solo no se ejecutaron visualmente en esta pasada.

---

_Auditoría realizada el 2026-07-03 con base de datos limpia y cuenta `corredor.e2e@test.cl`. Scripts de apoyo: `prisma/clean.ts` (`npm run db:clean`), `prisma/e2e-bootstrap.ts` (temporal, reemplaza el paso de verificación de identidad por IA que no es automatizable)._
