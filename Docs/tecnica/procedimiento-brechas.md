# Procedimiento ante una brecha de seguridad (L-DP9)

> _2026-11-12. Borrador operativo para revisión del abogado._ La regla legal que se
> aplica (Ley 21.719) se conoce por fuentes secundarias: notificar a la Agencia de
> Protección de Datos Personales **«por los medios más expeditos posibles y sin
> dilaciones indebidas»** cuando la vulneración genera un riesgo razonable para las
> personas, y avisar **directamente a los afectados** cuando se trata de datos
> sensibles, financieros o de menores. La ley no fija un número de horas. Los plazos
> de abajo son **metas internas** más estrictas que la ley, no plazos legales.
> Queda por confirmar con el abogado el texto exacto, si corresponde además la
> Ley 21.663 (ciberseguridad) y nuestro rol (L-07: responsable o encargado).

## Qué es una brecha

Cualquier hecho que exponga, altere, borre o deje inaccesibles datos personales sin
autorización, esté o no confirmado el daño. Ejemplos en Propigo: acceso a la base o
a los archivos de otra persona, una corredora viendo datos de otra (falla de RLS),
credenciales o `AUTH_SECRET` filtrados, un respaldo expuesto, un correo con datos
enviado al destinatario equivocado, un ataque que descargó el padrón de personas.

## Quién hace qué

| Rol | Persona | Función |
|---|---|---|
| Responsable del incidente | _a designar (C-05)_ | Decide, coordina y firma las notificaciones |
| Técnico | _responsable de TI_ | Contiene, investiga y repara |
| Legal | _abogado externo_ | Valida si notificar y revisa los textos |
| Contacto | `seguridad@` y `privacidad@` (llegan a administracion@) | Recibe reportes de terceros e investigadores |

## Pasos

**1. Detectar y registrar (en la primera hora).** Quien lo detecta avisa a
`seguridad@propigo.cl`. Se abre un registro con hora de detección (se mide desde
ahí, no desde que empezó). No se borra ni se «arregla» nada antes de guardar la
evidencia.

**2. Contener (meta: 4 horas).** Cortar el acceso: rotar `AUTH_SECRET` (invalida
todas las sesiones), claves de Resend, Groq y del Banco Central, revocar el usuario
comprometido, cerrar el puerto o apagar la ruta afectada. Conservar logs y un
*snapshot* del disco antes de tocar la VM.

**3. Evaluar (meta: 24 horas desde la detección).** Responder por escrito:

- ¿Qué datos, de cuántas personas y de qué corredoras?
- ¿Eran legibles? (las contraseñas están con hash; los tokens se guardan con SHA-256)
- ¿Hay datos sensibles, financieros (cuentas bancarias, comprobantes), de menores o
  cédulas?
- ¿Hay **riesgo razonable** para las personas? Ante la duda, se asume que sí.

**4. Notificar a la Agencia (meta: 72 horas desde la detección, sin esperar a tener
todo).** Si hay riesgo razonable. Se informa lo que se sabe y se completa después.
Contenido: naturaleza de la vulneración, categorías y número aproximado de personas y
registros, datos de contacto, consecuencias probables y medidas adoptadas.

**5. Avisar a los afectados (sin dilación).** Obligatorio si hay datos sensibles,
financieros o de menores; recomendado siempre que haya riesgo. Lenguaje simple:
qué pasó, qué datos, qué hacer (cambiar contraseña, vigilar su cuenta), qué hicimos y
a quién escribir. Si somos encargados frente a una corredora (L-07), se avisa
**primero a la corredora**, sin demora, para que ella notifique si le corresponde.

**6. Remediar y cerrar.** Corregir la causa raíz, agregar una prueba que la cubra,
anotar el aprendizaje en `BRAIN.md` (§8) y actualizar este procedimiento.

**7. Registro permanente.** Cada brecha, aunque no se notifique, queda registrada:
fecha de detección, descripción, datos afectados, evaluación de riesgo, decisión de
notificar o no (con su motivo), notificaciones enviadas y medidas. El registro se
guarda mientras dure la obligación legal; lo confirma el abogado.

## Plantillas

**A la Agencia** — Asunto: «Notificación de vulneración de seguridad — SOLID IT SpA».
Cuerpo: fecha y hora de detección; descripción; categorías y número de personas y
registros; corredoras afectadas; consecuencias probables; medidas de contención y
corrección; persona de contacto (`privacidad@propigo.cl`); compromiso de ampliar la
información.

**A las personas afectadas** — «Detectamos el [fecha] un incidente de seguridad que
pudo exponer [datos]. Lo contuvimos el [fecha]. Qué te recomendamos: [acciones]. Qué
estamos haciendo: [medidas]. Si tienes dudas, escribe a privacidad@propigo.cl o usa
propigo.cl/derechos.»

**A una corredora** — mismo contenido, con el listado de sus personas afectadas y
una oferta de ayuda para su propia notificación.

## Prevención ya en el producto (no sustituye este procedimiento)

Aislamiento por RLS probado contra Postgres real, cookies `__Host-` httpOnly,
secretos solo en variables de entorno, tokens con hash, límites de intentos, CSP con
nonce, errores internos nunca expuestos, retención automática de registros, respaldos
y alerta de caída (pendientes del despliegue, ADR-0015).

## Ensayo

Una vez antes de abrir registros: simular una brecha (ej. «un colaborador exportó
datos de otra corredora») y recorrer los siete pasos con reloj. Anotar cuánto tardó
cada uno.
