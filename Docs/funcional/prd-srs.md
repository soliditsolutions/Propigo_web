# Especificación de Requerimientos (PRD / SRS)

> Qué **debe hacer** el sistema (funcional) y **cómo debe comportarse** (no funcional). Cada requerimiento tiene un ID para trazabilidad (ver [gestion/PROGRESO.md](../gestion/PROGRESO.md) y la futura matriz de trazabilidad). Estado: ✅ implementado · 🟡 parcial · 🔜 Fase 2.

## 1. Propósito y alcance

Propigo digitaliza la gestión de arriendos de una corredora chilena y conecta su oferta con el público. Cubre el ciclo completo: publicar → arrendar → cobrar → conciliar → liquidar, más el autoservicio de las partes. El MVP prioriza el **núcleo financiero real**; las integraciones externas (pago, banco, correo, UF/IPC) se **simulan** (ver [ADR-0003](../decisiones/ADR-0003-fidelidad-prototipo.md)).

## 2. Actores / roles

| Rol | Acceso | Descripción |
|---|---|---|
| **Corredor — admin** | `/panel` (cuenta) | Dueño de la cuenta de la corredora. Todo el panel + perfil/dispositivos. |
| **Corredor — operador** | `/panel` (cuenta) | Staff operativo de la corredora. |
| **Arrendatario** | `/portal` (OTP, sin cuenta) | Consulta su arriendo, pagos y documentos (solo lectura). |
| **Propietario** | `/portal` (OTP, sin cuenta) | Consulta la propiedad y liquidaciones (solo lectura). |
| **Visitante / interesado** | `/marketplace` (público) | Busca propiedades, contacta al corredor, denuncia, valora. |
| **Sistema (cron)** | `/api/cron` | Genera recordatorios y envía notificaciones. |

---

## 3. Requerimientos funcionales (RF)

### RF-AUTH — Autenticación y cuentas (corredor)
- **RF-AUTH-01** ✅ Registro de corredora: crea Tenant (plan "Gratuito") + Usuario admin, con consentimiento explícito Ley 21.719.
- **RF-AUTH-02** ✅ Login con email + contraseña (PBKDF2), bloqueo por intentos fallidos.
- **RF-AUTH-03** ✅ Recuperación de contraseña por email (token de un solo uso, anti-enumeración).
- **RF-AUTH-04** ✅ 2FA por **dispositivo confiable**: verificación por código al email; el dispositivo queda recordado.
- **RF-AUTH-05** ✅ Gestión de dispositivos confiables (listar / revocar) desde el perfil.
- **RF-AUTH-06** ✅ Cierre de sesión seguro (borra cookies + `Clear-Site-Data`).
- **RF-AUTH-07** ✅ Perfil del corredor obligatorio para operar (datos personales completos).

### RF-PROP — Propiedades
- **RF-PROP-01** ✅ Crear propiedad (busca/crea propietario por RUT). Nace en estado `borrador`.
- **RF-PROP-02** ✅ Editar propiedad (bloqueada si `reservada`/`arrendada`).
- **RF-PROP-03** ✅ Ciclo de vida con transiciones manuales (`borrador`↔`disponible`) y automáticas (`reservada`/`arrendada`).
- **RF-PROP-04** ✅ Subir imágenes (validación por magic bytes, ≤ 5 MB, almacenamiento UUID).
- **RF-PROP-05** ✅ Listar propiedades por estado con datos y galería.

### RF-CONT — Contratos
- **RF-CONT-01** ✅ Crear contrato (wizard 4 pasos): propiedad → arrendatario → condiciones → vigencia, con preview del calendario.
- **RF-CONT-02** ✅ Soportar UF y CLP, día de vencimiento, % comisión, reajuste, mora, multa, gasto común y garantía configurables.
- **RF-CONT-03** ✅ Generar calendario de pagos automático (plazo fijo N períodos o indefinido 12 + auto-extensión).
- **RF-CONT-04** ✅ Firma/activación del contrato (`borrador` → `vigente`, propiedad → `arrendada`).
- **RF-CONT-05** ✅ Renovar contrato a plazo fijo (numeración continua, nuevo valor opcional).
- **RF-CONT-06** ✅ Término normal y anticipado (multa informativa, devolución de garantía, propiedad → `disponible`).
- **RF-CONT-07** ✅ Cancelar contrato en borrador.
- **RF-CONT-08** ✅ Alerta de vencimiento (banner ámbar ≤ 90 d / rojo ≤ 30 d).
- **RF-CONT-09** ✅ Validación del contrato con IA (detecta cláusulas faltantes/riesgos).
- **RF-CONT-10** ✅ Anexos: adjuntar documentos a un contrato vigente.

### RF-COB — Cobros, conciliación y liquidación
- **RF-COB-01** ✅ Registrar/simular un pago recibido con su **fecha real**.
- **RF-COB-02** ✅ Conciliar el pago contra el calendario (sin intereses fantasma) → marca período `pagado`.
- **RF-COB-03** ✅ Aplicar **reajuste IPC** al conciliar (contratos CLP con reajuste activo).
- **RF-COB-04** ✅ Asistente de liquidación en 2 pasos: conciliar → cerrar con ajustes (reparaciones/daños).
- **RF-COB-05** ✅ Emitir vouchers inmutables (pago y liquidación) con snapshot.
- **RF-COB-06** ✅ Registrar todo en **ledger append-only** (asientos + reversas).
- **RF-COB-07** ✅ Mes de garantía: recepción, retención y devolución al término.
- **RF-COB-08** ✅ Reconocimiento de deuda: documento generado desde el ledger.
- **RF-COB-09** ✅ Historial de vouchers con filtros (tipo, rango de fechas, contrato).

### RF-DASH — Dashboard
- **RF-DASH-01** ✅ KPIs reales: por cobrar, en recaudación, contratos vigentes, gasto común, atrasados.
- **RF-DASH-02** ✅ Próximos vencimientos y propiedades por estado.

### RF-PORTAL — Portal de autoconsulta (arrendatario/propietario)
- **RF-PORTAL-01** ✅ Acceso por RUT → OTP al contacto registrado (sin cuenta), sesión de solo lectura.
- **RF-PORTAL-02** ✅ Ver contrato, calendario de pagos y estado.
- **RF-PORTAL-03** ✅ Filtrar pagos por año (arriendos de > 1 año).
- **RF-PORTAL-04** ✅ Descargar documentos (contrato, comprobantes) por acceso autenticado y auditado.
- **RF-PORTAL-05** ✅ Ver mensajes del corredor.
- **RF-PORTAL-06** ✅ Valorar al corredor (token de un solo uso).

### RF-MKT — Marketplace público
- **RF-MKT-01** ✅ Listar propiedades publicadas con búsqueda y filtros (tipo, ubicación, m², piezas/baños, precio, mascotas, GC, recientes).
- **RF-MKT-02** ✅ Ver ficha de propiedad con galería y datos.
- **RF-MKT-03** ✅ Contactar al corredor (formulario) → notificación al corredor.
- **RF-MKT-04** ✅ Denunciar propiedad/corredor (anónima o identificada, con consentimientos).
- **RF-MKT-05** ✅ Mostrar valoraciones del corredor.

### RF-COM — Comunicación y notificaciones
- **RF-COM-01** ✅ El corredor deja mensajes al arrendatario (con adjuntos) visibles en el portal.
- **RF-COM-02** ✅ Notificaciones por email (simuladas en dev / Resend en prod) en eventos clave.
- **RF-COM-03** ✅ Recordatorios automáticos de vencimiento (cadencia ADR-0008) vía cron.

### RF-FASE2 — Fuera del MVP (🔜 Fase 2)
- Firma electrónica avanzada (FEA) + Ley 21.461 · Workflow de morosidad · Pagos reales (PAC/Pago Fácil/Fintoc) · Sindicación a portales · Arriendos por días (STR) · Billing SaaS.

---

## 4. Requerimientos no funcionales (RNF)

### RNF-SEG — Seguridad
- **RNF-SEG-01** Aislamiento multi-tenant por `tenant_id` (RLS en BD + verificación en cada operación de datos).
- **RNF-SEG-02** Autorización en la capa de datos, nunca solo en el proxy (CVE-2025-29927).
- **RNF-SEG-03** Nunca exponer errores internos (Prisma/stack) al cliente.
- **RNF-SEG-04** Secretos y tokens siempre como hash (SHA-256/PBKDF2), nunca en claro; JWT firmados.
- **RNF-SEG-05** Anti-enumeración en portal y recuperación (respuesta y timing uniformes).
- **RNF-SEG-06** Uploads validados por magic bytes; cabeceras de seguridad (`X-Frame-Options`, `nosniff`, CSP con nonce).
- **RNF-SEG-07** Ledger inmutable garantizado por trigger de BD.

### RNF-LEG — Cumplimiento legal (Chile)
- **RNF-LEG-01** Ley 21.719 (protección de datos): consentimiento explícito, derechos ARCO, minimización.
- **RNF-LEG-02** Ley 18.101 (arriendo): garantía topada a 2 rentas.
- **RNF-LEG-03** Ley 19.496 (consumidor) y Art. 211 CP (denuncia calumniosa) en el marketplace.

### RNF-USA — Usabilidad y accesibilidad
- **RNF-USA-01** UI responsiva (desktop + mobile) pensada para usuarios no técnicos.
- **RNF-USA-02** Accesibilidad: `aria-*`, foco visible, `prefers-reduced-motion`, navegación por teclado.
- **RNF-USA-03** Consistencia visual vía Design System (ver [sistema-diseno-ui.md](sistema-diseno-ui.md)).

### RNF-REND — Rendimiento
- **RNF-REND-01** Dinero en `Decimal`/enteros; cálculos exactos, nunca `float`.
- **RNF-REND-02** Marketplace cacheable/SSR; panel transaccional separado.

### RNF-MANT — Mantenibilidad y portabilidad
- **RNF-MANT-01** Núcleo financiero aislado y testeado (`@propigo/core`), sin dependencias de framework.
- **RNF-MANT-02** Diseño portable (Docker + PostgreSQL estándar); nube diferida (ADR-0001).
- **RNF-MANT-03** Trazabilidad: toda acción sobre dinero queda en el ledger; accesos en `acceso_log`.

---

> Detalle de reglas de negocio: [modelo de dominio](modelo-dominio.md). Interacciones concretas: [historias de usuario](historias-de-usuario.md). Rutas y flujos: [flujos y navegación](flujos-y-navegacion.md).
