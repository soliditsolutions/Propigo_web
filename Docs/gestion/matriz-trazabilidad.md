# Matriz de trazabilidad

> Conecta cada **requerimiento** ([PRD/SRS](../funcional/prd-srs.md)) con su **implementación** en el código y su **verificación**. Permite responder: *¿qué está hecho, dónde vive y cómo se comprobó?*

**Estado:** ✅ implementado · 🟡 parcial · 🔜 Fase 2. **Verificación:** `test` (automatizada, Vitest) · `manual` (Claude Preview / QA) · `n/a`.

## Requerimientos funcionales

| RF | Descripción breve | Estado | Implementación (módulo) | Verificación |
|---|---|---|---|---|
| RF-AUTH-01 | Registro de corredora | ✅ | `app/registro/` (`actions.ts`, `registro-form.tsx`) | test + manual |
| RF-AUTH-02 | Login + bloqueo por intentos | ✅ | `app/login/`, `lib/auth.ts` | manual |
| RF-AUTH-03 | Recuperación de contraseña | ✅ | `app/recuperar-contrasena/`, `app/nueva-contrasena/`, `ResetToken` | manual |
| RF-AUTH-04 | 2FA por dispositivo | ✅ | `app/verificar-dispositivo/`, `api/auth/dispositivo/*` | manual |
| RF-AUTH-05 | Gestión de dispositivos | ✅ | `app/panel/perfil/dispositivos-section.tsx`, `api/auth/dispositivos/*` | manual |
| RF-AUTH-06 | Logout seguro | ✅ | `api/auth/logout/route.ts` | manual |
| RF-AUTH-07 | Perfil obligatorio | ✅ | `app/panel/perfil/` | manual |
| RF-PROP-01 | Crear propiedad | ✅ | `app/panel/propiedades/actions.ts` (`crearPropiedad`) | test + manual |
| RF-PROP-02 | Editar propiedad | ✅ | `propiedades/actions.ts` (`actualizarPropiedad`) | manual |
| RF-PROP-03 | Ciclo de vida | ✅ | `activarPropiedad` / `desactivarPropiedad` | manual |
| RF-PROP-04 | Subir imágenes | ✅ | `api/upload/route.ts` (magic bytes) | test + manual |
| RF-PROP-05 | Listar propiedades | ✅ | `app/panel/propiedades/propiedades-client.tsx` | manual |
| RF-CONT-01..03 | Crear contrato + calendario | ✅ | `app/panel/contratos/nuevo/` | test + manual |
| RF-CONT-04 | Firma/activación | ✅ | `contratos/[id]/firma-section.tsx` | manual |
| RF-CONT-05 | Renovar contrato | ✅ | `contratos/[id]/renovar-section.tsx` + `lib/auto-extender.ts` | manual (E2E 12→24) |
| RF-CONT-06 | Término normal/anticipado | ✅ | `contratos/[id]/cierre-section.tsx`, `actions.ts` | manual |
| RF-CONT-07 | Cancelar borrador | ✅ | `firma-section.tsx` (`cancelarContratoBorrador`) | manual |
| RF-CONT-08 | Alerta de vencimiento | ✅ | `contratos/[id]/page.tsx` | manual |
| RF-CONT-09 | Validación con IA | ✅ | `api/contratos/[id]/validar*`, `validacion-panel.tsx` | test (anti-injection) |
| RF-CONT-10 | Anexos | ✅ | `contratos/[id]/anexos-section.tsx` | manual |
| RF-COB-01..02 | Registrar + conciliar pago | ✅ | `app/panel/cobros/actions.ts` (`simularPago`) | test (47/47 core) |
| RF-COB-03 | Reajuste IPC al conciliar | ✅ | `cobros/actions.ts` + `@propigo/core` | test |
| RF-COB-04 | Asistente de liquidación | ✅ | `app/panel/cobros/` (2 pasos) | manual |
| RF-COB-05 | Vouchers inmutables | ✅ | `Voucher` + snapshot | test |
| RF-COB-06 | Ledger append-only | ✅ | `AsientoLedger` + trigger SQL | test |
| RF-COB-07 | Mes de garantía, en UF o CLP (revalorizada al término) | ✅ | `contratos/[id]/actions.ts` (retención/devolución), `v_garantia_retenida` | test |
| RF-COB-08 | Reconocimiento de deuda | ✅ | `contratos/[id]/actions.ts` (`generarReconocimientoDeuda`) | manual |
| RF-COB-09 | Historial de vouchers | ✅ | `app/panel/vouchers/` | manual |
| RF-DASH-01..02 | Dashboard KPIs | ✅ | `app/panel/page.tsx`, `lib/queries.ts` | manual |
| RF-STATS-01 | Estadísticas y analítica por plan (básica/media/avanzada): resumen operativo, financiera, rendimiento de propiedades, proyecciones y riesgo | ✅ | `app/panel/estadisticas/`, `lib/queries.ts` (`getResumenOperativo`, `getAnaliticaFinanciera`, `getRendimientoPropiedades`, `getProyeccionesRiesgo`) | manual |
| RF-STATS-02 | Exportación CSV de estadísticas (plan Diamond) | ✅ | `api/panel/estadisticas/exportar` | manual |
| RF-PORTAL-01 | Acceso OTP | ✅ | `app/portal/`, `api/portal/*-otp` | manual |
| RF-PORTAL-02 | Ver contrato/pagos | ✅ | `app/portal/contrato/[contratoId]/` | manual |
| RF-PORTAL-03 | Filtro de pagos por año | ✅ | `components/portal/PagosSection.tsx` | manual |
| RF-PORTAL-04 | Descargar documentos | ✅ | `api/portal/documento/[id]/route.ts` | manual |
| RF-PORTAL-05 | Ver mensajes | ✅ | `components/portal/ComentariosSection.tsx` | manual |
| RF-PORTAL-06 | Valorar corredor | ✅ | `components/portal/ValoracionButton.tsx`, `api/marketplace/valoracion` | manual (5 casos QA) |
| RF-MKT-01..02 | Listar + ficha | ✅ | `app/marketplace/`, `app/marketplace/[id]/` | manual |
| RF-MKT-03 | Contacto | ✅ | `api/marketplace/contacto`, `ContactoModal` | manual |
| RF-MKT-04 | Denuncia | ✅ | `api/marketplace/denuncia`, `DenunciaModal` | manual |
| RF-MKT-05 | Valoraciones visibles | ✅ | `api/marketplace/valoraciones/[tenantId]` | manual |
| RF-COM-01 | Mensajes al arrendatario | ✅ | `api/panel/contratos/[id]/comentarios`, `ComentariosCorredorSection` | manual |
| RF-COM-02 | Notificaciones email | ✅ | `lib/email.ts` (Resend/simulado) | manual |
| RF-COM-03 | Recordatorios automáticos | ✅ | `api/cron/recordatorios`, `notificaciones/actions.ts` | manual |
| RF-FASE2 | FEA, morosidad, STR, pagos reales, billing | 🔜 | — | n/a |

## Requerimientos no funcionales

| RNF | Descripción | Estado | Dónde se garantiza |
|---|---|---|---|
| RNF-SEG-01 | Aislamiento multi-tenant | ✅ | `tenant_id` en queries + RLS (`setup.sql`) |
| RNF-SEG-02 | Autorización en capa de datos | ✅ | Server Actions / Route Handlers |
| RNF-SEG-03 | No exponer errores internos | ✅ | `DomainError` (auditoría CRUD) |
| RNF-SEG-04 | Hash de secretos + JWT | ✅ | PBKDF2 / SHA-256 / `jose` |
| RNF-SEG-05 | Anti-enumeración | ✅ | `api/portal/solicitar-otp`, recuperación |
| RNF-SEG-06 | Uploads + cabeceras seguridad | ✅ | `api/upload` (magic bytes), `next.config.ts`, `proxy.ts` (CSP nonce) |
| RNF-SEG-07 | Ledger inmutable | ✅ | Trigger SQL (`setup.sql`) |
| RNF-LEG-01 | Ley 21.719 (consentimiento/ARCO) | 🟡 | Registro + `/privacidad`; ejercicio ARCO por email (manual) |
| RNF-LEG-02 | Garantía ≤ 2 rentas | ✅ | Validación en `crearContrato` |
| RNF-LEG-03 | Ley 19.496 + Art. 211 CP | ✅ | `/terminos-uso`, denuncia con declaraciones |
| RNF-USA-01..03 | Responsivo, accesible, DS | ✅ | Design System v2 + auditoría A1–A4 |
| RNF-REND-01 | Dinero exacto (Decimal) | ✅ | `@propigo/core`, schema `Decimal` |
| RNF-MANT-01..03 | Núcleo aislado, portable, auditable | ✅ | `@propigo/core`, Docker, `acceso_log` |

---

> Estado global y cronología: [PROGRESO.md](PROGRESO.md). Escenarios de prueba: [plan-de-pruebas-qa.md](plan-de-pruebas-qa.md).
