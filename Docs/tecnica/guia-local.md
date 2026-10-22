# Guía de levantamiento local

Cómo correr el prototipo de Propigo en un computador para inspeccionarlo. Pensada para una demo con el directorio.

> El prototipo es **local**: el núcleo financiero es real (cálculos de verdad sobre PostgreSQL), y las integraciones externas (pagos, banco, correo) están simuladas.

---

## 1. Requisitos (instalar una vez)

| Herramienta | Para qué | Cómo verificar |
|---|---|---|
| **Node.js 20+** | Ejecutar la app | `node -v` |
| **Docker Desktop** | Base de datos PostgreSQL | `docker --version` (y el ícono de la ballena activo) |

> En Windows, abre Docker Desktop al menos una vez para que el motor quede corriendo.

---

## 2. Levantar el prototipo (primera vez)

Desde la carpeta raíz del proyecto (`Propigo/`), en una terminal:

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar la base de datos (PostgreSQL en Docker, puerto 5433)
npm run db:up

# 3. Crear el esquema (migraciones) y aplicar seguridad (RLS), reglas, vistas
#    y el rol de la app — lo mismo que corre producción
npm run db:deploy -w @propigo/web

# 4. Cargar datos de ejemplo (corredora, propiedades, 2 contratos)
npm run db:seed   -w @propigo/web

# 5. Iniciar la aplicación
npm run dev
```

Luego abre el navegador en **http://localhost:3000**.

---

## 3. Qué inspeccionar

| Pantalla | URL | Qué se ve |
|---|---|---|
| **Inicio (landing)** | http://localhost:3000 | Presentación + el núcleo financiero calculando en vivo (UF→CLP, IPC). |
| **Panel · Resumen** | http://localhost:3000/panel | Por cobrar, en recaudación, gasto común (passthrough), próximos vencimientos. |
| **Panel · Propiedades** | http://localhost:3000/panel/propiedades | Inventario con estado (arrendada / disponible / reservada). |
| **Panel · Contratos** | http://localhost:3000/panel/contratos | Contratos en UF y CLP, con su reajuste y períodos. |

**Para la demo:** fíjate en el contrato en CLP — su renta sube de **$500.000** a **$521.409** en el período 13 (reajuste de IPC en el aniversario), exactamente el problema que el competidor hace mal.

---

## 4. Uso diario (ya instalado)

```bash
npm run db:up     # arrancar la base de datos (si Docker se reinició)
npm run dev       # iniciar la app  → http://localhost:3000
```

Para detener:

```bash
# Ctrl+C en la terminal del 'npm run dev'
npm run db:down   # apagar la base de datos
```

Para volver a cargar los datos de ejemplo desde cero:

```bash
npm run db:seed -w @propigo/web
```

---

## 5. Comandos útiles

```bash
npm test -w @propigo/core            # tests del núcleo financiero (deben pasar 8/8)
npm run build -w @propigo/web        # compilación de producción (verifica que todo cierra)
docker ps                            # ver la base de datos corriendo
```

---

## 6. Solución de problemas

- **"docker: command not found" / no conecta la base**: abre Docker Desktop y espera a que el motor esté activo; luego `npm run db:up`.
- **El puerto 5432 ya está ocupado**: ya está contemplado — usamos el **5433** para no chocar con un PostgreSQL preinstalado.
- **`P1000` / falla de autenticación**: confirma que `apps/web/.env` tenga
  `DATABASE_URL="postgresql://propigo:propigo_dev@localhost:5433/propigo?schema=public"`.
- **No aparecen datos en el panel**: corre el seed → `npm run db:seed -w @propigo/web`.
- **El puerto 3000 está ocupado**: cierra la otra app o ejecuta `npm run dev -- -p 3001`.

---

## 7. Qué es real y qué está simulado (para la conversación con el directorio)

| Real (funciona de verdad) | Simulado (en el prototipo) |
|---|---|
| Cálculo de UF→CLP y reajuste de IPC por aniversario | Envío de correos |
| Calendario de pagos, comisiones, gasto común | Pasarela de pago (PAC / Pago Fácil) |
| Contabilidad inmutable (ledger) y saldos | Detección automática del banco |
| Aislamiento de datos por corredora (RLS) | Serie de UF/IPC (datos de ejemplo) |
