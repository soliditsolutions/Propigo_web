# Correo de Propigo: una bandeja central con alias y etiquetas

> _2026-11-12._ Reemplaza el plan de «2 cuentas» de las tareas C-01 y C-02.
> Decisión: **una sola cuenta de Google Workspace, `administracion@propigo.cl`**, y
> todas las demás direcciones son **alias** de esa cuenta. Todo llega a una bandeja y
> Gmail lo ordena con etiquetas.

## Por qué alias y no cuentas ni grupos

| Opción | Costo | Cuándo conviene |
|---|---|---|
| **Alias de la cuenta** (elegida) | Sin licencia extra | Una persona o un equipo pequeño lee todo |
| Cuentas separadas | Una licencia por dirección | Cuando cada buzón tiene un responsable distinto |
| Grupo de Google | Sin licencia | Cuando varias personas deben recibir y repartirse el trabajo |

Si el equipo crece, se pasa `soporte@` y `privacidad@` a grupos sin cambiar nada de
lo que ve el cliente.

## Direcciones

| Dirección | Tipo | Para qué |
|---|---|---|
| `administracion@propigo.cl` | Cuenta | Bandeja central; dueña del dominio |
| `soporte@` | Alias | Clientes (corredoras) y cambios de plan |
| `privacidad@` | Alias | **Derechos de datos personales (plazo legal).** Recibe el formulario `/derechos` |
| `legal@` | Alias | Términos, contratos, abogados |
| `denuncias@` | Alias | Denuncias del marketplace |
| `seguridad@` | Alias | Reportes de vulnerabilidades y brechas |
| `facturacion@`, `pagos@` | Alias | Boletas y facturas; Transbank y cobranza |
| `tecnologia@` | Alias | Contacto técnico del dominio, hosting, Resend, Groq |
| `dmarc@` | Alias | Reportes DMARC (automáticos) |
| `no-reply@`, `notificaciones@` | **Sin bandeja** | Solo salen por Resend; no son alias |

> Un `no-reply@` sin bandeja pierde las respuestas de los clientes. Conviene agregar
> `Reply-To: soporte@` en los correos del sistema (pendiente de código).

## Paso 1 — Crear los alias (administrador de Workspace)

1. Consola de administración → **Directorio → Usuarios** → `administracion@propigo.cl`.
2. **Información del usuario → Alias de correo electrónico → Agregar alias.**
3. Agrega cada alias de la tabla (salvo `no-reply@` y `notificaciones@`).
4. Los alias tardan unos minutos en funcionar. Pruébalos escribiendo desde una cuenta
   externa.

## Paso 2 — Poder **responder desde** el alias

Para que una respuesta salga como `soporte@` y no como `administracion@`:

1. Gmail → **Configuración → Ver todos los ajustes → Cuentas e importación**.
2. **Enviar como → Añadir otra dirección de correo electrónico**, y agrega cada alias
   (si Workspace los ofrece directamente, solo hay que activarlos).
3. Marca **«Responder desde la misma dirección a la que se envió el mensaje»**.

Verifica en tu consola cómo aparece cada paso; los nombres de las opciones cambian a
veces.

## Paso 3 — Etiquetas y filtros

El filtro usa `to:alias` y **no** `deliveredto:`: con alias, el encabezado
`Delivered-To` trae la dirección principal y todos los mensajes parecerían iguales.
`to:` cubre Para, Cc y Cco.

1. Gmail → **Configuración → Filtros y direcciones bloqueadas → Importar filtros**.
2. Elige el archivo [`gmail-filtros.xml`](gmail-filtros.xml) y marca **Aplicar nuevos
   filtros a las conversaciones existentes**.
3. Crea las etiquetas antes de importar (o deja que el importador las cree).

Resultado: cada alias queda con su etiqueta **Propigo/…**; `privacidad@` y
`seguridad@` además se marcan como importantes y con estrella; `dmarc@` se marca como
leído (son reportes automáticos) pero se conserva; ninguno se va a spam.

Las **categorías automáticas de Gmail** (Principal, Promociones, Social) no sirven
para esto: Gmail las asigna solo y no se pueden configurar a mano. Para separar la
bandeja usa las etiquetas y, si quieres verlas a la vez, **Configuración → Bandeja de
entrada → Tipo → Varias bandejas de entrada** con una sección por etiqueta
(`label:Propigo/Privacidad`, `label:Propigo/Soporte`, …).

## Regla de trabajo

- `Propigo/Privacidad`: **responder o derivar en 5 días hábiles.** Cada solicitud
  nueva trae su folio `DER-AAAA-XXXXXX` y su fecha límite; el sistema envía un aviso
  diario de las que están por vencer.
- `Propigo/Seguridad`: leer el mismo día. Si es un incidente, seguir
  [procedimiento-brechas.md](procedimiento-brechas.md).
- Nadie responde un correo de privacidad sin verificar identidad si va a entregar,
  corregir o eliminar datos.

## Seguridad de la cuenta

Verificación en dos pasos obligatoria (S-02), al menos un segundo administrador del
dominio (S-03) y llaves de acceso o autenticador, no SMS. Una sola bandeja concentra
todo el correo: es la cuenta más valiosa de la empresa.
