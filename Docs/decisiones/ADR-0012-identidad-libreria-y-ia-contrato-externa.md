# ADR-0012 — Verificación de identidad por librería (offline) y análisis de contrato con IA externa sobre datos minimizados

- **Fecha**: 2026-07-12
- **Estado**: Aceptada

## Contexto

La auditoría pre-producción encontró que las dos funciones de IA enviaban datos personales sensibles a un proveedor externo (Groq, EE.UU.) de forma no conforme:

- **Verificación de carnet**: se enviaba la imagen completa de la Cédula de Identidad a un modelo de visión externo.
- **Validación de contrato**: se enviaba el texto completo del contrato, con PII de **terceros** (la otra parte del arriendo), a un modelo externo.
- El modal de identidad afirmaba **falsamente** "No se almacena ni se comparte con terceros".
- La clave era de **tier gratuito** (garantías de datos débiles: posible retención/entrenamiento).
- `NODE_TLS_REJECT_UNAUTHORIZED=0` en el entorno deshabilitaba la verificación TLS de la conexión saliente.
- Sin rate-limit en los endpoints de IA (DoS financiero).

Se evaluó **auto-hospedar un LLM local** para no transferir datos al extranjero. Se descartó por **costo**: la carga real es esporádica y en ráfagas (un corredor valida un contrato ocasionalmente, no de forma continua), y una GPU de 16-24 GB encendida 24/7 —on-prem o en cloud— es cara en idle para ese perfil. Además no hay región GPU de hyperscaler en Chile, lo que choca con el objetivo de "no salir del país". Para carga esporádica, el pago-por-token de una API externa es órdenes de magnitud más barato.

Se hicieron **POCs con documentos reales** (cédula + contrato) que definieron el diseño:

- **Cédula**: el **reverso trae un QR** (no un PDF417, como se suponía) con una URL del Registro Civil que incluye `RUN` (con dígito verificador) y `name`. Se decodifica con librería (`zxing-wasm`), se valida el RUN con módulo 11 y se cruza contra el formulario. **100% offline, sin IA.** Las 3 líneas MRZ del reverso son un fallback (checksums propios); el frente por OCR es el último recurso.
- **Contrato**: la redacción de contratos **subidos** es imperfecta —una POC filtró número de domicilio, condominio y comuna de la contraparte— y, peor, un scanner de fuga ingenuo dio falso "limpio". Los domicilios de las partes **no están en la BD** (`Persona` no tiene campo dirección), así que la redacción por valores conocidos no alcanza para documentos externos.

## Decisión

**Identidad (cédula) — 100% por librería, offline, sin IA.**
QR del reverso (`zxing-wasm`) → `RUN`+DV+nombre → validación módulo 11 (`@propigo/core`) + cross-check contra el formulario de registro. Fallback: MRZ (OCR-B + checksums); último recurso: OCR del frente. Captura por cámara con marco guía + upload como fallback; la **extracción y validación autoritativas son server-side** (nunca confiar en el valor decodificado por el cliente). Opción futura: verificación de autenticidad online contra el Registro Civil (servicio chileno, sin egress a IA extranjera).

**Contrato — híbrido:**
- **Datos sensibles** (presencia/formato de RUT, nombres, montos, cláusulas): por **librería/reglas**, local, determinístico. El motor de reglas cubre casi todo el checklist legal (garantía ≤ 2 meses art. 46, mora ≤ 1.5%, plazo, multa 1-3 meses, día 1-28, coherencia).
- **¿Firmado o borrador?**: parseo de la **firma digital del PDF** (`/Sig`, `ByteRange`) — determinístico, más confiable que visión.
- **Análisis legal** (legalidad, cláusulas faltantes, sugerencias de robustez): **IA externa**, en un **paso intermedio opcional "Validación de borrador de contrato"**. El corredor sube un **borrador SIN PII** (plantilla con marcadores), bajo un disclaimer que le indica que no debe contener información personal/confidencial, qué se evalúa y cómo se tratan los datos; acepta la responsabilidad y recién ahí se ejecuta. Tras la validación, el corredor genera el **contrato final con los datos reales — que NO pasa por la IA** — y lo activa. Proveedor bajo **DPA + no-training + tier pago**.

  Flujo: `Subir borrador` → **[opcional] Validación de borrador** (disclaimer + aceptar → scanner fail-closed → IA revisa cláusulas) → `Generar contrato final (sin IA)` → `Activar`.

**Cumplimiento — la de-identificación es el control primario:**
El análisis de IA solo necesita la **estructura de las cláusulas** (legalidad, completitud, sugerencias), NO la identidad de las partes: ninguna verificación legal (garantía, mora, plazo, multa, día, cláusulas faltantes) necesita saber quién es la parte, y el RUT se valida por librería (módulo 11), no por la IA. Por eso se **ofusca TODA la PII** antes de enviar (nombres, RUTs, domicilios de las partes, **dirección del inmueble**, emails, teléfonos → placeholders estructurales). Lo que cruza es **texto de cláusulas de-identificado, no dato personal**, con lo que la preocupación por transferencia internacional de datos personales se disuelve en gran medida (validar la caracterización legal exacta con asesor — no es asesoría legal).

- **Responsabilidad del corredor (por diseño del flujo):** el corredor sube un borrador que **atesta** no contiene PII y acepta la responsabilidad. Esto reparte la responsabilidad hacia el responsable del dato, pero **no la elimina**: un disclaimer no sustituye medidas técnicas (accountability, Ley 21.719), y en la práctica los usuarios suben el documento real pese a la advertencia.
- **Red técnica — scanner _fail-closed_ (obligatoria, no opcional):** aunque el corredor acepte, el scanner corre igual y **detecta PII de alta confianza** (RUT validado por módulo 11, email, teléfono) → avisa o **bloquea** antes de enviar. Es lo que hace defendible el disclaimer ("dijimos Y prevenimos lo obvio"). Nombres/direcciones genéricos quedan bajo responsabilidad del corredor; nosotros atrapamos los identificadores duros. Esto **simplifica** el componente: de "redactor confiable de contratos arbitrarios" (difícil) a "**detector de PII + gate**" (alta precisión), con auto-enmascarado como ayuda opcional.
- **Defensa en profundidad (liviana):** transparencia al corredor + **DPA** con el proveedor (no-training, tier pago). El dato personal se procesa **local**; a la IA solo llega texto de-identificado.
- **Dos disclaimers distintos:** (a) de datos — "no subas PII; se envía a IA externa; esto se evalúa"; (b) de asesoría — "observaciones informativas, la decisión final es del corredor, no es certificación legal" (ya en el prompt).

**Baseline siempre-on:** las validaciones por librería corren **sin consentimiento** (son locales, no envían nada). Solo la prosa asesora de IA queda detrás del gate opt-in.

**Cadena de responsabilidad:** Propigo es *encargado* del corredor (*responsable*); el proveedor de IA es *sub-encargado*. Se requiere DPA con el proveedor + T&C que autoricen sub-encargados + transparencia del corredor hacia su cliente.

## Alternativas consideradas

- **LLM auto-hospedado local**: descartado por costo (GPU idle vs carga esporádica; sin región GPU en Chile).
- **IA externa con solo consentimiento, sin redacción**: descartado — no cubre al tercero ni minimiza; deja PII de terceros cruzando la frontera sin necesidad.
- **Solo reglas, sin IA**: viable como baseline (de hecho es el baseline siempre-on), pero se pierde la prosa asesora → la IA queda como capa opcional premium.

## Consecuencias

- **Componente crítico nuevo — el redactor:** requiere un **scanner de fuga de PII independiente y completo por categoría** como *gate* previo a todo envío externo, más una **suite de tests adversariales**. La POC demostró que un redactor/scanner ingenuo **falla en silencio** (reportó "limpio" con PII residual). Este es el mayor riesgo del diseño.
- **Contrato generado por la app** → redacción limpia (valores conocidos de BD). **Contrato subido externo** → redacción best-effort + el gate del scanner decide si bloquea o advierte antes de enviar.
- **Proveedor**: seleccionar uno con **DPA firmado + no-training + tier pago** (no free tier). Centralizar la config en un `ai-client.ts` (elimina la duplicación de los 3 `fetch`).
- **Cumplimiento/UX**: actualizar T&C y política de privacidad (nombrar sub-encargado, transferencia internacional, propósito, retención, revocación); corregir el texto "no se comparte con terceros"; consentimiento opt-in versionado.
- **Fixes de higiene (van en la misma implementación, no en una fase posterior):** quitar `NODE_TLS_REJECT_UNAUTHORIZED=0` en prod + `startup-check` que lo prohíba; rate-limit del endpoint IA; cero PII en logs; anti-inyección (sanitización + delimitadores + "trata como datos") — se mantiene por defecto.
- **Cédula**: nueva dependencia de librería (`zxing-wasm` para QR) + módulo 11 (ya existe). Sin costo de IA. `E2E_BYPASS_IDENTITY` deja de ser necesario para saltear un servicio externo (la lectura es local).
