# Plan de pruebas y QA

> Escenarios que deben probarse para asegurar que el sistema no falle. Combina **pruebas automatizadas** (Vitest) y **pruebas manuales** (Claude Preview / navegador). Trazabilidad de requerimientos en [matriz-trazabilidad.md](matriz-trazabilidad.md).

## 1. Estrategia

| Nivel | Herramienta | Alcance |
|---|---|---|
| **Unitario (dominio)** | `node:test` / Vitest en `@propigo/core` | Cálculos financieros puros: calendario, IPC, ledger, garantía, RUT. |
| **Unitario/integración (app)** | Vitest + Testing Library (`@propigo/web`) | Server Actions, seguridad de IA, sanitización, startup checks. |
| **End-to-end manual** | Claude Preview / navegador | Flujos completos por la UI real (crear contrato → conciliar → portal). |
| **Seguridad** | Revisión + tests dirigidos | Multi-tenant, anti-enumeración, prompt-injection, uploads. |

**Comandos:** `npm test -w @propigo/core` · `npm test -w @propigo/web` · cobertura: `npm run test:coverage -w @propigo/web`.

**Criterio de aceptación de un PR:** lint + tests verdes + build + verificación manual del cambio si es observable (ver [CONTRIBUTING](../../CONTRIBUTING.md)).

## 2. Pruebas automatizadas (existentes)

| Suite | Archivo | Cubre |
|---|---|---|
| Núcleo financiero | `packages/core/**` | Calendario de pagos, reajuste IPC por aniversario, ledger inmutable, conciliación, garantía, RUT (referencia: **47/47 verdes**). |
| Cobros | `app/panel/cobros/__tests__/cobros-actions.test.ts` | `simularPago`, conciliación, reajuste. |
| Propiedades | `app/panel/propiedades/__tests__/propiedades-actions.test.ts` | Validaciones y tenant isolation. |
| Seguridad IA | `api/contratos/[id]/validar/__tests__/ai-security.test.ts` | Resistencia a prompt-injection. |
| Sanitización doc | `api/contratos/[id]/validar-doc/__tests__/sanitize-doc.test.ts` | Limpieza de texto extraído de PDF. |
| Arranque | `lib/__tests__/startup-check.test.ts` | Variables de entorno críticas, bloqueo de TLS inseguro en prod. |
| Navegación panel | `components/panel/__tests__/` | Shell y nav. |

## 3. Matriz de pruebas manuales (por módulo)

Formato: **ID · escenario · resultado esperado**. Prioridad 🔴/🟡/🟢.

### Autenticación
| ID | Escenario | Resultado esperado | Pri |
|---|---|---|---|
| QA-AUTH-1 | Registro sin aceptar consentimiento | Bloquea envío; mensaje de error | 🔴 |
| QA-AUTH-2 | Login con contraseña incorrecta ×N | Bloqueo temporal por intentos | 🔴 |
| QA-AUTH-3 | Ingreso desde dispositivo nuevo | Pide código; con código válido recuerda el dispositivo | 🔴 |
| QA-AUTH-4 | Recuperar contraseña con email inexistente | Respuesta idéntica (anti-enumeración) | 🟡 |
| QA-AUTH-5 | Revocar dispositivo actual | Fuerza re-verificación | 🟡 |

### Propiedades y contratos
| ID | Escenario | Resultado esperado | Pri |
|---|---|---|---|
| QA-PROP-1 | Subir archivo no-imagen renombrado a .png | Rechazo (magic bytes) | 🔴 |
| QA-PROP-2 | Editar propiedad `arrendada` | Bloqueado con candado | 🟡 |
| QA-CONT-1 | Crear contrato UF y CLP | Calendario correcto; propiedad → reservada | 🔴 |
| QA-CONT-2 | Renovar contrato plazo fijo | Períodos continuos, sin duplicados | 🔴 |
| QA-CONT-3 | Terminar contrato | Propiedad → disponible; períodos futuros cancelados | 🔴 |
| QA-CONT-4 | Cancelar borrador | Contrato → cancelado; propiedad → disponible | 🟡 |

### Cobros y liquidación (núcleo)
| ID | Escenario | Resultado esperado | Pri |
|---|---|---|---|
| QA-COB-1 | Conciliar pago con fecha real | Período pagado con esa fecha; sin interés fantasma; voucher emitido | 🔴 |
| QA-COB-2 | Conciliar período de reajuste (CLP) | Aplica IPC; asiento CARGO_AJUSTE; actualiza valor | 🔴 |
| QA-COB-3 | Cerrar liquidación con ajuste | Comisión + ajuste + liquidación; voucher inmutable | 🔴 |
| QA-COB-4 | Intentar editar un asiento del ledger | Rechazado por el trigger | 🔴 |
| QA-COB-5 | Terminar contrato con garantía y daños | Asientos de retención/devolución (≤ 2 rentas) | 🟡 |

### Portal (arrendatario/propietario)
| ID | Escenario | Resultado esperado | Pri |
|---|---|---|---|
| QA-PORT-1 | Acceso con RUT válido | OTP al contacto; sesión de solo lectura | 🔴 |
| QA-PORT-2 | OTP expirado / >3 intentos | Rechazo; no da acceso | 🔴 |
| QA-PORT-3 | Descargar documento de otro contrato | 403 / no accesible; queda en audit log | 🔴 |
| QA-PORT-4 | Arrendatario > 1 año | Selector de año filtra períodos | 🟡 |
| QA-PORT-5 | Valorar dos veces con el mismo token | Segunda vez rechazada (token quemado) | 🟡 |

### Marketplace
| ID | Escenario | Resultado esperado | Pri |
|---|---|---|---|
| QA-MKT-1 | Filtros combinados | Solo publicaciones publicadas/disponibles que cumplen | 🟡 |
| QA-MKT-2 | Enviar contacto | Consulta registrada; corredor notificado | 🟡 |
| QA-MKT-3 | Denuncia sin declaraciones obligatorias | Bloqueada | 🟡 |

### Regresión / UI
| ID | Escenario | Resultado esperado | Pri |
|---|---|---|---|
| QA-UI-1 | Landing logueado vs deslogueado | "Ir al panel"/"Cerrar sesión" vs "Ingresar" | 🟢 |
| QA-UI-2 | Enlaces legales (login/registro) | Resuelven a /terminos-uso y /privacidad | 🟢 |
| QA-UI-3 | Pluralización "1 pieza / 1 baño" | Singular correcto | 🟢 |
| QA-UI-4 | Mobile (375px) + `prefers-reduced-motion` | Sin overflow; anima reducido | 🟢 |

## 4. Pendiente de automatizar

- Tests E2E de UI (Playwright) para los flujos 🔴 (hoy verificados manualmente).
- Cobertura de los endpoints del portal y marketplace.

---

> Historial de auditorías (seguridad, CRUD, UX): [PROGRESO.md](PROGRESO.md). Plan de pruebas específico de la feature de cuentas multi-usuario (Manager/Collaborator, en diseño): [plan-de-pruebas-roles-multiusuario.md](plan-de-pruebas-roles-multiusuario.md).
