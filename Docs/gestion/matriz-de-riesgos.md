# Matriz de riesgos

> Identifica problemas posibles y sus planes de mitigación. **Probabilidad** e **Impacto**: Alto / Medio / Bajo. **Severidad** = combinación (prioriza los Alto/Alto). Revisar en cada hito.

## Riesgos técnicos

| ID | Riesgo | Prob. | Impacto | Mitigación | Estado |
|---|---|---|---|---|---|
| R-T1 | `public/uploads/` no persiste entre deploys → pérdida de documentos/imágenes | Alta | Alto | Migrar a almacenamiento de objetos (S3/R2) con URL firmada antes de producción; sin cambios de schema/UI | Pendiente (documentado) |
| R-T2 | RLS sin enforcement real (rol dueño bypassa en dev) | Media | Alto | Usar rol no-dueño `propigo_app` en producción; la aislación en código es defensa complementaria | Mitigado en código |
| R-T3 | Serie UF/IPC sin fuente oficial → reajustes incorrectos | Media | Alto | Integrar fuente oficial (SII / Banco Central); si faltan datos, el reajuste procede sin cambio (no bloquea) | Parcial |
| R-T4 | Prisma 7 / Next 16 son versiones nuevas con cambios de API | Media | Medio | Fijar versiones; leer `node_modules/next/dist/docs`; gotchas en `BRAIN.md` | Mitigado |
| R-T5 | Caché de Turbopack muestra errores obsoletos | Baja | Bajo | Reiniciar dev server tras regenerar cliente Prisma; documentado en `BRAIN.md` | Conocido |
| R-T6 | Cobertura E2E automatizada insuficiente (flujos críticos verificados a mano) | Media | Medio | Introducir Playwright para los flujos 🔴 del plan de QA | Pendiente |

## Riesgos de seguridad

| ID | Riesgo | Prob. | Impacto | Mitigación | Estado |
|---|---|---|---|---|---|
| R-S1 | Fuga de datos entre tenants | Baja | Alto | Verificación de `tenant_id` en cada operación + RLS; auditoría CRUD (4 críticos corregidos) | Mitigado |
| R-S2 | Enumeración de RUT/usuarios | Baja | Medio | Respuestas y timing uniformes en portal y recuperación (ADR-0007) | Mitigado |
| R-S3 | Prompt-injection en validación de contratos con IA | Media | Medio | Sanitización + tests de seguridad de IA | Mitigado |
| R-S4 | Exposición de secretos en el repo/cliente | Baja | Alto | Secretos solo por env/vault; startup-check; nada de secretos en cliente | Mitigado |
| R-S5 | `NODE_TLS_REJECT_UNAUTHORIZED=0` filtrado a producción | Baja | Alto | El startup-check lo bloquea fuera de dev | Mitigado |
| R-S6 | Sin rate limiting en `/api/upload` y endpoints públicos | Media | Medio | Gate de tenant hoy; agregar rate limiting por usuario/IP | Pendiente |

## Riesgos legales / cumplimiento (Chile)

| ID | Riesgo | Prob. | Impacto | Mitigación | Estado |
|---|---|---|---|---|---|
| R-L1 | Incumplimiento Ley 21.719 (vigencia plena dic-2026; multas hasta ~USD 1.5M) | Media | Alto | Consentimiento explícito versionado, minimización, derechos ARCO, `/privacidad`; asesoría legal antes de prod | Parcial |
| R-L2 | Operar dinero de terceros sin perímetro regulatorio (CMF) | Media | Alto | Definir modelo de cuenta recaudadora (recaudación vs. custodia) con abogados antes de pagos reales | Pendiente (Fase 2) |
| R-L3 | Denuncia calumniosa / mal uso del marketplace | Baja | Medio | Declaración de veracidad obligatoria (Art. 211 CP) + aviso anti-fraude | Mitigado |
| R-L4 | Regulación STR municipal cambiante | Baja | Medio | Monitorear legislación; STR es Fase 2 (ADR-0010) | Vigilado |

## Riesgos operacionales / negocio

| ID | Riesgo | Prob. | Impacto | Mitigación | Estado |
|---|---|---|---|---|---|
| R-O1 | Caída de proveedor externo (Resend / Groq / pasarela) | Media | Medio | Degradación elegante: emails se simulan si no hay Resend; IA opcional; colas + reintentos en prod | Parcial |
| R-O2 | Integraciones simuladas dan falsa sensación de "listo" | Media | Medio | Documentar claramente qué es real vs. simulado (ADR-0003); criterio de "MVP terminado" | Mitigado |
| R-O3 | Sin proveedor de identidad definido para producción | Media | Medio | Evaluar Cognito / Auth0 / ClaveÚnica (OIDC) antes de escalar | Pendiente |
| R-O4 | Deuda técnica acumulada por velocidad | Baja | Medio | Refactor DRY aplicado; auditorías periódicas; `BRAIN.md` como memoria | Mitigado |
| R-O5 | Sin estrategia de respaldos / RPO-RTO | Media | Alto | Definir backups automáticos + RPO/RTO antes de producción | Pendiente |

---

## Top 3 a atender antes de producción

1. **R-T1 / R-O5** — Almacenamiento persistente de documentos + respaldos.
2. **R-L1 / R-L2** — Cierre de cumplimiento Ley 21.719 y modelo legal de recaudación (asesoría).
3. **R-T3** — Fuente oficial de UF/IPC.

> Estos riesgos se cruzan con los "Pendientes de definición" de [arquitectura-y-despliegue.md](../tecnica/arquitectura-y-despliegue.md) y las notas de [PROGRESO.md](PROGRESO.md).
