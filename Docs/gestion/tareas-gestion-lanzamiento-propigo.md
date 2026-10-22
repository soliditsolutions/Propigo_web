# Tareas de gestión para el lanzamiento — Propigo

> _Elaborado 2026-10-21._ Tareas **no técnicas** (trámites, contrataciones,
> decisiones) que habilitan el despliegue público, el cobro con Transbank y el
> cambio de marca de "Housing SOLIDIT" a **Propigo**. Lo técnico (código,
> servidor, DNS) lo ejecuta el equipo de desarrollo una vez resueltas estas.
>
> Responsable: **G** = gerencia · **L** = asesoría legal/contable · **TI** = tecnología.
> Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

## Ruta crítica

```
G-01 dominio ──► C-01..C-05 correos ──► H-01..H-04 hosting ──► P-03 validación Transbank
     │                                                          ▲
     └─► M-01..M-03 marca (INAPI)        E-01..E-04 empresa ────┘
```

Dos fechas que mandan:
- **Validación de Transbank:** exige el sitio publicado, con dominio, HTTPS,
  términos, privacidad y datos reales de la empresa.
- **Ley 21.719 (datos personales): vigente desde el 1 de diciembre de 2026**
  (ver `rowmap-documentos-legales.md`, Grupo E).

---

## 1. Dominio

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| G-01 | Registrar **propigo.cl** en [NIC Chile](https://www.nic.cl), a nombre de **SOLIDIT SpA** (RUT de la empresa, no de una persona). Registrado (confirmado el 2026-10-21); verificar que el titular sea la empresa. | G | — | `[x]` |
| G-02 | Comprar **propigo.com** como respaldo si está libre (no verificado: el WHOIS de NIC Chile solo cubre `.cl`). | G | — | `[ ]` |
| G-03 | Activar renovación automática y anotar fecha de vencimiento de ambos dominios. Un dominio vencido bota el sitio y los correos. | G | G-01 | `[ ]` |
| G-04 | Dejar como contacto técnico del dominio una cuenta de la empresa (`tecnologia@propigo.cl`), no un correo personal. | G | C-02 | `[ ]` |

Descartados en la búsqueda: `housing.cl` (de un tercero, vence 2027-03-12),
`easyhome.cl` (Easy Retail S.A.), y las combinaciones directas de "hogar/arriendo
+ fácil/simple/ya/listo".

## 2. Marca (INAPI)

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| M-01 | Búsqueda de anterioridad en [INAPI](https://www.inapi.cl): que "Propigo" (y variantes fonéticas) no esté registrada en clases relacionadas. | L | — | `[ ]` |
| M-02 | Solicitar registro de la marca "Propigo" a nombre de SOLIDIT SpA. Clases a evaluar con el abogado: **42** (software como servicio), **36** (servicios inmobiliarios/arriendo), **35** (publicidad/marketplace), **9** (software descargable, solo si habrá app). El costo es por clase. | L | M-01 | `[ ]` |
| M-03 | Reservar el usuario **@propigo** en Instagram, LinkedIn, Facebook y TikTok, aunque no se usen aún. | G | — | `[ ]` |
| M-04 | Identidad visual: logo e isotipo definidos (casa con forma de "P", azul) y eslogan **"Publica más. Complica menos."**. Ya aplicados en el sitio con una versión vectorial aproximada; falta recibir los **archivos oficiales en SVG** del diseñador para reemplazarla. | G | — | `[~]` |
| M-05 | "SOLIDIT" sale del logo; SOLIDIT SpA queda solo como responsable en legales, pie de página y documentos. Decidido y aplicado el 2026-10-21. | G | — | `[x]` |

## 3. Empresa y legal

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| E-01 | Confirmar **inicio de actividades** en el SII con un giro coherente (servicios de software / plataforma inmobiliaria). Transbank lo exige. | L | — | `[ ]` |
| E-02 | **Cuenta corriente** a nombre del RUT de SOLIDIT SpA, sin morosidades en el boletín comercial (requisito Transbank). | G | — | `[ ]` |
| E-03 | Entregar a TI el **RUT real y el teléfono** de la empresa: hoy términos y privacidad muestran valores de relleno (`77.000.000-0`, `+56 2 0000 0000`) y Transbank los revisa. | G | — | `[ ]` |
| E-04 | Revisión de abogado de **términos y privacidad** con: la marca nueva, el cobro de la suscripción a corredores (hoy dicen que la plataforma "nunca solicita pagos") y las promesas de retención de datos que aún no se cumplen (Ley 21.719, Grupo E del rowmap legal). | L | M-05 | `[ ]` |
| E-05 | Contratar proveedor de **facturación electrónica** con API (boletas y facturas al SII por la suscripción). Las pasarelas de pago no emiten documentos tributarios. | G/L | E-01 | `[ ]` |

## 4. Correos (Google Workspace, 2 licencias)

Decidido el 2026-10-21. Todas las direcciones en `@propigo.cl`.

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| C-01 | Contratar Google Workspace con el dominio `propigo.cl` y verificarlo (registro TXT en el DNS). | G/TI | G-01 | `[ ]` |
| C-02 | Crear 2 cuentas a nombre de personas responsables: **Operaciones** (alias: soporte@, denuncias@, dmarc@) y **Administración** (alias: legal@, privacidad@, facturacion@, pagos@, seguridad@, tecnologia@). | G | C-01 | `[ ]` |
| C-03 | Registros de correo en el DNS: MX de Google, SPF y DKIM (Google + Resend), DMARC con reportes a dmarc@. | TI | C-01 | `[ ]` |
| C-04 | Crear cuenta de **Resend** con tecnologia@ y verificar el dominio para no-reply@ y notificaciones@ (solo envío, sin buzón). | TI | C-03 | `[ ]` |
| C-05 | Asignar quién responde privacidad@ y en qué plazo: las solicitudes de datos personales tienen plazo legal. | G | C-02 | `[ ]` |

## 5. Hosting

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| H-01 | **Decidir proveedor y región.** Hay dos análisis distintos que conciliar: `costos-infraestructura-y-precios.md` recomienda AWS us-east-1 (la región Chile de AWS no estaba operativa); la evaluación del 2026-10-21 recomienda un servidor en Google Cloud Santiago para salir sin cambios de código y con los datos en Chile. | G | — | `[ ]` |
| H-02 | Crear la cuenta del proveedor a nombre de la empresa, con tecnologia@ como dueño, tarjeta de la empresa y **alerta de presupuesto** mensual. | G | H-01, C-02 | `[ ]` |
| H-03 | Contratar la **API de IA (Groq)** a nombre de la empresa, con límite de gasto. Hoy se usa una clave de desarrollo. | G | C-02 | `[ ]` |
| H-04 | Definir la política de **respaldos**: frecuencia, cuánto tiempo se guardan y quién prueba restaurarlos. | G/TI | H-01 | `[ ]` |

## 6. Pagos (Transbank)

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| P-01 | Afiliarse a Transbank para **Oneclick** (cobro automático de la suscripción), no solo Webpay Plus (pago manual). Nombre de fantasía: **Propigo**, igual al del sitio. Se puede iniciar ya. | G | E-01, E-02 | `[ ]` |
| P-02 | Decidir las preguntas abiertas de cobro: **D-18** (cambio de plan al próximo ciclo, sin prorrateo) y política de cobranza (reintentos y días de gracia). Ver `rowmap-pagos.md`. | G | — | `[ ]` |
| P-03 | Enviar a Transbank la **validación de la integración** con evidencia de transacciones de prueba. Requiere el sitio publicado. | TI | P-01, H-01, E-03, E-04 | `[ ]` |
| P-04 | Recibir la llave secreta de producción y hacer una compra real de prueba. | G/TI | P-03 | `[ ]` |

## 7. Accesos y seguridad

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| S-01 | Gestor de contraseñas de la empresa para todas las cuentas (NIC, Workspace, hosting, Resend, Groq, Transbank). | G | — | `[ ]` |
| S-02 | **Verificación en dos pasos** obligatoria en todas esas cuentas. | G | S-01 | `[ ]` |
| S-03 | Al menos **dos personas** con acceso de administrador a dominio, correo y hosting, para no depender de una sola. | G | C-02, H-02 | `[ ]` |

---

## Fuentes

- [NIC Chile — WHOIS](https://www.nic.cl/registry/Whois.do?d=propigo.cl)
- [INAPI](https://www.inapi.cl)
- [Transbank Developers — Cómo empezar](https://www.transbankdevelopers.cl/documentacion/como_empezar)
- [Klevo — Requisitos de Webpay para PYMEs 2026](https://klevo.cl/blog/webpay-pymes-requisitos-2026/)
- Análisis internos: `costos-infraestructura-y-precios.md`, `rowmap-pagos.md`, `rowmap-documentos-legales.md`.
