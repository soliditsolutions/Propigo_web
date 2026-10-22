# Documentación de Propigo — Hub central

Fuente de verdad del proyecto. Todo lo que decidimos, por qué, qué hace el sistema y qué falta, vive aquí — no en la cabeza ni solo en el chat.

La documentación se organiza en **tres bloques** (Técnico, Funcional, Gestión), más un bloque de **decisiones** (ADRs) y el **contexto de desarrollo** (`BRAIN.md`, en la raíz del repo).

> **Estado (2026-07-28):** MVP **~97 %** completo (núcleo + ampliación + pulido; resta el recorrido de demostración). Extras de Fase 2 ya adelantados: portal OTP, marketplace B2C, validación con IA, 2FA por dispositivo, garantía en UF/CLP, estadísticas por plan (analítica multi-nivel), tema dual Aurora en todo el sitio incluido el panel. En curso: cuentas multi-usuario Manager/Collaborator ([ADR-0013](decisiones/ADR-0013-cuentas-multiusuario.md)), Fase A completa. Detalle en [gestion/PROGRESO.md](gestion/PROGRESO.md).

---

## 📑 Bloque Técnico — el "Cómo"

Para instalar, entender y colaborar en el código.

| Documento | Para qué sirve |
|---|---|
| [README del repositorio](../README.md) | Descripción, prerrequisitos, instalación, comandos y variables de entorno. |
| [Arquitectura y despliegue](tecnica/arquitectura-y-despliegue.md) | Diseño técnico objetivo (nube, seguridad, escalabilidad) + estado de implementación + CI/CD y despliegue. |
| [Referencia de la API](tecnica/api-reference.md) | Contrato de los endpoints REST: rutas, métodos, parámetros, respuestas y códigos HTTP. |
| [Modelo de datos y ER](tecnica/modelo-datos-er.md) | Diccionario de datos y diagrama entidad-relación: tablas, campos, tipos, relaciones, RLS, ledger. |
| [Guía de levantamiento local](tecnica/guia-local.md) | Cómo correr e inspeccionar el prototipo (para demos y desarrollo). |
| [CONTRIBUTING](../CONTRIBUTING.md) | Ramas, commits, PRs, estilo de código y reglas de seguridad. |

## ⚙️ Bloque Funcional — el "Qué"

Alinea negocio y sistema: qué debe hacer la plataforma.

| Documento | Para qué sirve |
|---|---|
| [Visión y alcance](funcional/vision-y-alcance.md) | El problema, los dolores de Leasity y la propuesta de valor. |
| [PRD / SRS](funcional/prd-srs.md) | Requerimientos funcionales (RF) y no funcionales (RNF) con IDs de trazabilidad. |
| [Historias de usuario](funcional/historias-de-usuario.md) | Casos de uso "Como…quiero…para…" con criterios de aceptación. |
| [Flujos y navegación](funcional/flujos-y-navegacion.md) | Mapa de rutas + diagramas de flujo (Mermaid) de los procesos clave. |
| [Modelo de dominio](funcional/modelo-dominio.md) | Reglas de negocio del núcleo financiero: contrato, calendario, ledger, UF/IPC, garantía. |
| [Sistema de diseño UI](funcional/sistema-diseno-ui.md) | Tokens, componentes y guía visual (referencia de interfaz; no hay Figma). |

## 📈 Bloque Gestión — el "Cuándo y Quién"

Control de tiempos, alcance y calidad.

| Documento | Para qué sirve |
|---|---|
| [Roadmap del MVP](gestion/roadmap-mvp.md) | Alcance del prototipo, fases y criterios de "hecho". |
| [Planificación final](gestion/planificacion-final.md) | Investigación de mercado, brechas y backlog priorizado (MoSCoW). |
| [PROGRESO](gestion/PROGRESO.md) | Checklist vivo: qué está hecho y qué falta, por etapa. |
| [Matriz de trazabilidad](gestion/matriz-trazabilidad.md) | RF/RNF → estado → implementación en el código → verificación. |
| [Plan de pruebas y QA](gestion/plan-de-pruebas-qa.md) | Matriz de testing (automatizado + manual) y criterios de aceptación. |
| [Plan de pruebas — Roles multi-usuario](gestion/plan-de-pruebas-roles-multiusuario.md) | Vara de aceptación de seguridad/flujo/UX para Manager/Collaborator, antes de implementar. |
| [Matriz de riesgos](gestion/matriz-de-riesgos.md) | Riesgos técnicos, de seguridad, legales y de negocio + mitigaciones. |
| [Manual de usuario](gestion/manual-de-usuario.md) | Guía de operación para corredor, arrendatario e interesado. |
| [Auditoría E2E (2026-07)](gestion/auditoria-e2e-2026-07.md) | Auditoría adversarial de los flujos corredor y cliente: hallazgos, causas raíz, soluciones y tests. |
| [Auditoría UI/UX (2026-07)](gestion/auditoria-ui-ux-2026-07.md) | Auditoría de interfaz contra checklist de accesibilidad/UX (touch targets, contraste, navegación, forms) — roadmap por etapas. |

## 🧠 Contexto de desarrollo

| Documento | Para qué sirve |
|---|---|
| [BRAIN.md](../BRAIN.md) | Contexto vivo: gotchas resueltos, convenciones, restricciones de seguridad, errores/soluciones. Guía para retomar el proyecto o para asistentes de IA. |

## 📚 Referencias / investigación

Estudios de fondo que informaron el diseño (no son documentación del sistema actual; parte describe opciones aspiracionales para Fase 2).

| Documento | Para qué sirve |
|---|---|
| [Investigación — autenticación (Ley 21.719)](referencias/investigacion-autenticacion-ley-21719.md) | WebAuthn/FIDO2, gestión de sesiones y cumplimiento; informó el diseño de acceso. |
| [Investigación — registro y recuperación](referencias/investigacion-registro-y-recuperacion.md) | Consentimiento, Argon2id, CWE-640, ClaveÚnica; informó el diseño de registro/recuperación. |

## 🧭 Decisiones de arquitectura (ADRs)

Registro cronológico de decisiones. Una decisión = un archivo en [`decisiones/`](decisiones/).

| ADR | Tema |
|---|---|
| [0001](decisiones/ADR-0001-nube.md) | Decisión de nube (diferida, MVP portable) |
| [0002](decisiones/ADR-0002-stack-y-seguridad.md) | Stack Next.js + seguridad |
| [0003](decisiones/ADR-0003-fidelidad-prototipo.md) | Fidelidad del prototipo (dominio real, integraciones simuladas) |
| [0004](decisiones/ADR-0004-reglas-financieras.md) | Reglas financieras del dominio |
| [0005](decisiones/ADR-0005-acceso-partes-y-publicacion.md) | Acceso de partes y publicación |
| [0006](decisiones/ADR-0006-canales-de-pago.md) | Canales de pago y conciliación |
| [0007](decisiones/ADR-0007-portal-autoconsulta-otp.md) | Portal de autoconsulta por OTP |
| [0008](decisiones/ADR-0008-liquidacion-y-ajustes.md) | Liquidación en 2 pasos y ajustes |
| [0009](decisiones/ADR-0009-garantia-y-reconocimiento-deuda.md) | Mes de garantía y reconocimiento de deuda |
| [0010](decisiones/ADR-0010-arriendos-por-dias.md) | Arriendos por días (STR) — Fase 2 |
| [0011](decisiones/ADR-0011-roles-bd-y-rls.md) | Roles de BD (`propigo`/`propigo_app`) y RLS |
| [0012](decisiones/ADR-0012-identidad-libreria-y-ia-contrato-externa.md) | Verificación de identidad por librería + IA externa sobre contrato de-identificado |
| [0013](decisiones/ADR-0013-cuentas-multiusuario.md) | Cuentas multi-usuario (Manager/Collaborator) — Fase A |

---

## Cómo trabajamos

1. **Cada decisión relevante se registra como ADR** en `decisiones/`. Una decisión = un archivo.
2. **Cada cambio de comportamiento se refleja** en [gestion/PROGRESO.md](gestion/PROGRESO.md).
3. **La arquitectura de producción vive en papel** ([tecnica/arquitectura-y-despliegue.md](tecnica/arquitectura-y-despliegue.md)) aunque el MVP sea local.
4. **El MVP es local y de alta fidelidad selectiva**: lógica de dominio real, integraciones externas simuladas (ver [ADR-0003](decisiones/ADR-0003-fidelidad-prototipo.md)).
5. **Lo no obvio se anota en [BRAIN.md](../BRAIN.md).**

_Estructura reorganizada en 3 bloques el 2026-07-01._
