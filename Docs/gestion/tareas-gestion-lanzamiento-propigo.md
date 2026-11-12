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

### Plan de salida V0 → V1 (revisado 2026-11-01 contra transbankdevelopers.cl)

Transbank valida **una integración ya hecha**: el orden oficial es afiliación →
integración en el ambiente de integración → formulario de validación con
evidencias de transacciones de prueba (soporte las cruza con sus registros) →
llave secreta → compra real de $50. Un sitio publicado **sin flujo de pago no
tiene nada que validar**. Por eso:

| Versión | Qué sale | Cobro |
|---|---|---|
| **V0** | Sitio en producción (dominio, HTTPS, legales con datos reales) **con Webpay Plus ya integrado**, apuntando al **ambiente de integración** (llaves y tarjetas de prueba públicas). Desde ahí se corren los casos de prueba y se envía la validación (P-03) | Ninguno real. El flujo de pago no se ofrece a clientes |
| **V1** | Mismo código con el código de comercio productivo y la llave secreta (solo cambian variables de entorno), compra de $50 (P-04) | Webpay Plus manual por período |
| **V2** | Oneclick, cargo automático (P-05), cuando haya volumen | Automático |

**Decidido 2026-11-02 — alcance de la V0:** el sitio queda publicado **solo para la validación de Transbank**. No se abren registros de corredoras ni hay plan gratuito. El plan **Free Tier** (1 propiedad, para conocer la herramienta) se evalúa para la **V1**, cuando ya se pueda cobrar el paso a un plan pagado. Motivo: registros reales son datos personales bajo la Ley 21.719 (vigente desde 2026-12-01) y exigen antes respaldos, almacenamiento de archivos fuera del servidor y soporte operando; además, un Free Tier sin upgrade pagable no tiene salida.

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
| C-01 | Contratar Google Workspace con el dominio `propigo.cl` y verificarlo (registro TXT en el DNS). | G/TI | G-01 | `[~]` Workspace ya contratado, con `administracion@propigo.cl` (2026-11-12). Falta verificar el DNS |
| C-02 | **Una sola cuenta**, `administracion@propigo.cl`, con todas las demás direcciones como **alias** (soporte@, privacidad@, legal@, denuncias@, seguridad@, facturacion@, pagos@, tecnologia@, dmarc@) ordenadas con etiquetas de Gmail. Guía y filtros: [correo-workspace.md](../tecnica/correo-workspace.md). `no-reply@` y `notificaciones@` solo envían por Resend, sin bandeja. | G | C-01 | `[~]` Decidido 2026-11-12; falta crear los alias e importar los filtros |
| C-03 | Registros de correo en el DNS: MX de Google, SPF y DKIM (Google + Resend), DMARC con reportes a dmarc@. | TI | C-01 | `[ ]` |
| C-04 | Crear cuenta de **Resend** con tecnologia@ y verificar el dominio para no-reply@ y notificaciones@ (solo envío, sin buzón). | TI | C-03 | `[ ]` |
| C-05 | Asignar quién responde privacidad@ y en qué plazo: las solicitudes de datos personales tienen plazo legal. | G | C-02 | `[ ]` |

## 5. Hosting

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| H-01 | **Decidir proveedor y región.** Hay dos análisis distintos que conciliar: `costos-infraestructura-y-precios.md` recomienda AWS us-east-1 (la región Chile de AWS no estaba operativa); la evaluación del 2026-10-21 recomienda un servidor en Google Cloud Santiago para salir sin cambios de código y con los datos en Chile. **2026-11-01:** se evalúa GCP (región Santiago) como opción principal: ver [evaluacion-gcp-santiago.md](evaluacion-gcp-santiago.md) (recomienda VM + Cloud SQL y una prueba de concepto antes de cerrar). | G | — | `[x]` 2026-11-12: VM + Cloud SQL en Santiago, ver [ADR-0015](../decisiones/ADR-0015-hosting-gcp-santiago-vm.md) (condicionada a la prueba de concepto) |
| H-02 | Crear la cuenta del proveedor a nombre de la empresa, con tecnologia@ como dueño, tarjeta de la empresa y **alerta de presupuesto** mensual. | G | H-01, C-02 | `[ ]` |
| H-03 | Contratar la **API de IA (Groq)** a nombre de la empresa, con límite de gasto. Hoy se usa una clave de desarrollo. | G | C-02 | `[ ]` |
| H-04 | Definir la política de **respaldos**: frecuencia, cuánto tiempo se guardan y quién prueba restaurarlos. | G/TI | H-01 | `[ ]` |

## 6. Pagos (Transbank)

| ID | Tarea | Resp. | Depende de | Estado |
|---|---|---|---|---|
| P-01 | Afiliarse a Transbank para **Webpay Plus** (pago manual de cada período). Decidido el 2026-11-01: se sale sin cargo automático; **Oneclick** se pide después, cuando haya movimiento de clientes y pagos, porque Transbank lo exige. Nombre de fantasía: **Propigo**, igual al del sitio. Se puede iniciar ya. | G | E-01, E-02 | `[ ]` |
| P-02 | ~~Decidir D-18~~ → decidida el 2026-11-01: el Manager elige entre upgrade al próximo ciclo o inmediato pagando la diferencia del mes. Queda abierta la **cobranza** de un pago manual: aviso antes del vencimiento, días de gracia (D-10) y suspensión. Ver `rowmap-pagos.md`. | G | — | `[~]` |
| P-05 | Afiliarse a **Oneclick** (cargo automático con tarjeta guardada) cuando Transbank lo permita por volumen. | G | P-04 | `[ ]` |
| P-03 | Enviar a Transbank la **validación de la integración** con evidencia de transacciones de prueba (formulario en línea, logo GIF/PNG de 130×59 px). Requiere el sitio publicado y el código de comercio productivo. El desarrollo previo no lo requiere: Webpay Plus no llama al servidor del comercio (sin webhook), el retorno pasa por el navegador, así que se integra y prueba en local con el ambiente de integración. La integración debe estar **terminada antes** de validar (ver "Plan de salida V0 → V1"). | TI | P-01, H-01, E-03, E-04 | `[ ]` |
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
