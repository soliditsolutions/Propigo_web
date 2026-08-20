# Guía de estilo editorial — Housing

Documento normativo. Toda la copy visible del producto debe cumplirlo: interfaz, mensajes de error,
notificaciones, correos y textos de marketing.

**Variedad:** español de Chile.
**Última revisión:** 2026-08-05.

---

## Por qué existe este documento

Sin un criterio único, cada pantalla se escribe aislada y el producto termina hablando con varias
voces. La auditoría de agosto de 2026 encontró voseo rioplatense en un producto chileno, `email` y
`correo electrónico` conviviendo en el mismo formulario, y un mismo molde de frase repetido en casi
todas las descripciones del panel. Nada de eso es un error de ortografía. Es falta de norma.

### Fuentes

La guía se apoya en tres referencias, no en preferencias personales:

1. **ISO 24495-1:2023**, *Plain language — Part 1: Governing principles and guidelines*. Define el
   lenguaje claro como aquel en que el lector **encuentra** lo que necesita, lo **entiende** y puede
   **usarlo**. Es el criterio de fondo de todo lo que sigue.
2. **RAE/ASALE**, *Ortografía de la lengua española* y *Diccionario panhispánico de dudas*. Norma
   ortotipográfica.
3. **Uso chileno culto**. Cuando la norma panhispánica admite varias formas, se elige la que un
   profesional chileno escribiría.

---

## 1. Voz y tratamiento

### Tuteo en el producto, «usted» en lo legal

| Contexto | Tratamiento | Ejemplo |
|----------|-------------|---------|
| Interfaz, correos, notificaciones | **Tuteo** | «Revisa los datos antes de continuar.» |
| Términos de uso, política de privacidad, consentimientos | **Usted** | «Al aceptar, usted declara haber leído…» |

La cercanía funciona en el producto. La formalidad pesa donde hay efectos jurídicos. Lo que no
funciona es mezclarlos dentro de un mismo texto.

### Prohibido el voseo rioplatense

`revisá`, `podés`, `tenés`, `hacé`, `ingresá` no pertenecen a la variedad del producto. Se escribe
`revisa`, `puedes`, `tienes`, `haz`, `ingresa`.

### Pretérito simple, no compuesto

En Chile lo natural para un hecho puntual y concluido es el pretérito simple.

| Escribir | No escribir |
|----------|-------------|
| El código expiró. | El código ha expirado. |
| Bloqueamos tu cuenta por seguridad. | Tu cuenta ha sido bloqueada por seguridad. |
| La invitación ya se usó. | La invitación ya ha sido utilizada. |

### Quién habla

El sistema usa la primera persona del plural **solo cuando ejecuta una acción**: «Bloqueamos tu
cuenta», «No pudimos procesar el pago». Nunca se disculpa («Lo sentimos mucho»), nunca se
antropomorfiza («Estoy trabajando en ello») y nunca celebra («¡Genial!»).

---

## 2. Títulos y encabezados

**Mayúscula solo en la primera palabra y en los nombres propios.** Es la norma de la RAE. Poner en
mayúscula cada palabra significativa es un calco del inglés.

| Escribir | No escribir |
|----------|-------------|
| Rendimiento por colaborador | Rendimiento por Colaborador |
| Concentración de riesgo por propietario | Concentración de Riesgo por Propietario |

Reglas adicionales:

- Sin punto final.
- Máximo 40 caracteres.
- El título **nombra** el contenido; no lo vende ni lo interpreta.

---

## 3. Descripciones y bajadas

Esta sección corrige el defecto más visible del producto.

### La regla del guion largo

El molde «Concepto — matiz explicativo» se había vuelto el patrón por defecto de casi toda
descripción del panel. Repetido, deja de leerse como estilo y pasa a leerse como plantilla.

**El guion largo queda restringido a un uso por pantalla.** Cuando se necesita añadir una precisión,
hay dos salidas mejores: una segunda oración, o un paréntesis si el dato es secundario.

| En vez de | Escribir |
|-----------|----------|
| `Renta vigente / m² totales — solo propiedades con m² cargado` | `Renta mensual dividida por los metros cuadrados totales. Solo aparecen las propiedades con superficie registrada.` |
| `Historial propio de atrasos — no un credit score real` | `Se calcula con el historial de pagos de cada arrendatario en tu cartera. No es una evaluación crediticia.` |
| `Inventario de la corredora — haz clic en una card para ver el detalle` | `Inventario de la corredora. Abre cualquier propiedad para ver su detalle.` |

### Forma

- Una oración. Dos como máximo.
- Hasta 140 caracteres.
- Con punto final (a diferencia de los títulos).

### Prohibida la coordinación tripartita decorativa

«Rápido, simple y confiable» no informa. Si los tres elementos no aportan datos distintos, sobran
dos.

---

## 4. Números, plurales y unidades

### Prohibido el plural entre paréntesis

`día(s)`, `mes(es)`, `período(s) atrasado(s)`, `error(es)`.

La RAE admite esta construcción en formularios administrativos, donde el redactor no conoce la
cantidad. **En una interfaz esa condición no se cumple: el sistema sí conoce el número.** Escribir
«1 día(s)» delata que nadie resolvió la concordancia.

Se resuelve con el helper `plural()` de `apps/web/src/lib/format.ts`:

```ts
import { plural } from "@/lib/format";

plural(1, "día", "días")   // "1 día"
plural(3, "día", "días")   // "3 días"
plural(0, "día", "días")   // "0 días"
```

En textos legales de plantilla (por ejemplo el borrador de contrato en PDF), donde el paréntesis sí
es convención del género, se reformula la frase para evitarlo.

### Cifras

- Se escriben en dígitos: `3 propiedades`, `12 meses`.
- En prosa corrida, del cero al nueve pueden ir en palabras si la frase lo pide.
- Montos: siempre con `clp()` de `lib/format.ts`. Nunca se concatena `$` a mano.
- Fechas: siempre con `fecha()` de `lib/format.ts`.
- Porcentajes: `52,2 %` con coma decimal, según uso chileno.

---

## 5. Botones y acciones

- **Infinitivo, con el verbo primero:** «Guardar cambios», «Terminar contrato», «Enviar código».
- **El botón nombra lo que va a ocurrir.** En una acción con consecuencias, «Aceptar» y «OK» no
  sirven: el usuario no sabe qué está aceptando.

  | En vez de | Escribir |
  |-----------|----------|
  | Aceptar | Cancelar contrato |
  | OK | Entendido |
  | Confirmar | Terminar el arriendo |

- **El botón y la confirmación posterior usan el mismo verbo.** Si el botón dice «Terminar
  contrato», el mensaje de éxito dice «Contrato terminado», no «Operación exitosa».

---

## 6. Mensajes de error

Estructura obligatoria: **qué pasó, y qué puede hacer el lector.**

### Prohibido abrir con «Error al…»

Nombra la operación que falló, no la causa ni la salida. El lector queda igual de perdido.

| En vez de | Escribir |
|-----------|----------|
| Error al crear la cuenta. Intenta de nuevo. | No pudimos crear tu cuenta. Vuelve a intentarlo en unos minutos. |
| Error al conectar con el servidor. | No pudimos conectar con el servidor. Revisa tu conexión y reintenta. |
| Error al generar recordatorios. | No pudimos generar los recordatorios. Vuelve a intentarlo. |

### Otras reglas

- **Nunca se culpa al usuario.** «El correo no tiene un formato válido», no «Escribiste mal el
  correo».
- **Nunca se filtra detalle técnico** (nombres de tabla, stack traces, mensajes de Prisma). Esto ya
  se cumple por política de seguridad y se mantiene.
- **Si hay una salida, se indica.** Un error sin siguiente paso es un callejón.
- El error va **junto al campo** que lo provoca, no solo al inicio del formulario.

---

## 7. Notificaciones y correos

### Asuntos

- Máximo 60 caracteres, porque más se corta en el cliente de correo.
- **El dato accionable va primero.** El código, el monto o la dirección antes que la marca.

  | En vez de | Escribir |
  |-----------|----------|
  | `Tu arriendo vence en 3 día(s) — Av. Providencia 2020` | `Tu arriendo vence en 3 días: Av. Providencia 2020` |

- Sin urgencia artificial («¡ÚLTIMO AVISO!»), sin mayúsculas de énfasis, sin emojis.

### Cuerpos

Tres oraciones como máximo, en este orden:

1. Qué pasó.
2. El dato concreto: monto, fecha, dirección.
3. Qué se espera del lector, si se espera algo.

---

## 8. Glosario cerrado

Un concepto, un término. No se alternan sinónimos por variedad estilística: en una interfaz, dos
palabras distintas hacen pensar en dos cosas distintas.

| Usar | No usar |
|------|---------|
| correo electrónico (primera mención), correo | email, e-mail, mail |
| arrendatario | inquilino, arrendador (¡es el otro!) |
| propietario | dueño, arrendador |
| corredor | agente, broker |
| garantía | depósito, mes de garantía |
| cobro dentro de plazo | Collection Rate |
| escenarios de estrés | stress-test |
| rotación de arrendatarios | turnover |
| historial de pago | credit score, scoring |
| vacancia | vacancy, desocupación |
| liquidación | settlement, rendición |
| marketplace | *(se conserva: nombre de producto)* |
| PropTech | *(se conserva: categoría de mercado)* |

`marketplace` y `PropTech` se mantienen deliberadamente. Funcionan como nombre de producto y como
categoría de industria, y son de uso corriente en el negocio inmobiliario chileno. El resto de los
anglicismos se traduce.

---

## 9. Lista de verificación antes de publicar copy

1. ¿Tutea (o ustedea, si es legal) de forma consistente en todo el texto?
2. ¿Hay algún `(s)` o `(es)`?
3. ¿Hay más de un guion largo en la pantalla?
4. ¿El título está en mayúscula inicial solamente?
5. ¿Los botones dicen qué va a pasar?
6. ¿Los errores dicen qué hacer?
7. ¿Algún término está fuera del glosario?
8. ¿Hay algún «ha sido» o «ha expirado» donde cabría el pretérito simple?

### Búsquedas de regresión

```bash
# Voseo rioplatense
rg '\b(podés|revisá|tenés|hacé|ingresá|querés|debés|enviá|completá)\b' apps/web/src

# Plural entre paréntesis
rg '\(s\)|\(es\)' apps/web/src --glob '*.tsx' --glob '*.ts'

# Anglicismos fuera del glosario
rg 'Collection Rate|[Ss]tress-test|turnover|credit score' apps/web/src

# Pretérito compuesto en mensajes
rg 'ha expirado|ha sido bloquead|han sido' apps/web/src
```

---

## Referencias

- ISO. (2023). *ISO 24495-1:2023 Plain language — Part 1: Governing principles and guidelines*.
  https://www.iso.org/standard/78907.html
- Real Academia Española y ASALE. *Ortografía de la lengua española*. https://www.rae.es/ortografía
- Real Academia Española y ASALE. *Diccionario panhispánico de dudas*. https://www.rae.es/dpd
- Real Academia Española. *Las mayúsculas en los títulos*.
  https://www.rae.es/buen-uso-español/las-mayúsculas-en-los-títulos
