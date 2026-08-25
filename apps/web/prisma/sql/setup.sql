-- Housing — objetos que Prisma no modela en el schema.
-- Se aplica DESPUÉS de crear las tablas (prisma migrate / db push).
-- Idempotente: se puede correr varias veces.

-- ─────────────── 1. Índices únicos parciales ───────────────
-- Solo un contrato 'vigente' por propiedad (regla #5 / publicación).
create unique index if not exists uniq_contrato_vigente_por_propiedad
  on contrato (propiedad_id)
  where estado = 'vigente';

-- Billing (ADR-0014).
-- 1a. Una sola suscripción "viva" por tenant. Los estados terminales
-- (cancelada/expirada) quedan fuera del índice para conservar el historial:
-- un tenant puede tener muchas suscripciones pasadas, pero solo una vigente.
create unique index if not exists uniq_suscripcion_viva_por_tenant
  on suscripcion_tenant (tenant_id)
  where estado in ('trial','activa','pago_pendiente','suspendida');

-- 1b. Un solo cargo NO fallido por (tenant, tipo, período). Es la defensa de
-- último recurso contra cobrar dos veces el mismo mes: aunque la lógica de
-- aplicación falle, la base lo rechaza. Los 'fallido' quedan fuera para poder
-- reintentar un cobro que no prosperó sin chocar con el registro anterior.
create unique index if not exists uniq_cargo_por_tenant_tipo_periodo
  on cargo_billing (tenant_id, tipo, periodo)
  where estado <> 'fallido';

-- ─────────────── 2. Ledger inmutable (append-only) ───────────────
create or replace function prevent_mutation() returns trigger as $$
begin
  raise exception 'asiento_ledger es inmutable (append-only)';
end;
$$ language plpgsql;

drop trigger if exists trg_ledger_no_update on asiento_ledger;
create trigger trg_ledger_no_update
  before update or delete on asiento_ledger
  for each row execute function prevent_mutation();

-- ─────────────── 3. Row-Level Security (multi-tenant) ───────────────
-- El aislamiento lo fija la app con:  set local app.current_tenant_id = '<uuid>';
-- current_setting(..., true) => si NUNCA se seteó en esta conexión, devuelve NULL.
--
-- OJO — trampa real de Postgres (encontrada probando esto, no teórica): una vez
-- que una conexión pooleada ejecuta un SET LOCAL de este parámetro y la
-- transacción termina, current_setting deja de devolver NULL y pasa a devolver
-- '' (string vacío) — el parámetro "nace" en esa sesión aunque su valor local
-- se revierta. Comparar tenant_id = ''::uuid lanza una excepción de casteo en
-- vez de simplemente no calzar ninguna fila, lo que rompería cualquier consulta
-- SIN tenant (ej. marketplace anónimo) que reutilice una conexión del pool que
-- antes sí tuvo un tenant seteado. `nullif(..., '')` normaliza ambos casos
-- (nunca seteado / vacío tras revertir) a NULL antes de castear.


-- ADR-0011: para que RLS REALMENTE restrinja, la app debe conectarse con un rol
-- SIN privilegios de dueño ni de superusuario — ambos bypassan RLS siempre,
-- FORCE ROW LEVEL SECURITY incluido (FORCE solo afecta al dueño, nunca a un
-- superusuario). El rol 'housing' es superusuario (lo crea así la imagen oficial
-- de Postgres vía POSTGRES_USER) — se reserva para migraciones. El rol de runtime
-- de la app es 'housing_app' (sección 6 de este archivo), que no es dueño ni
-- superusuario, por lo que queda sujeto a esta política sin configuración extra.

do $$
declare t text;
begin
  foreach t in array array[
    'usuario','persona','propiedad','imagen_propiedad','publicacion','reserva',
    'contrato','periodo_pago','ajuste_liquidacion','pago_entrante','asiento_ledger',
    'voucher','notificacion','documento','acceso_otp','acceso_log','auditoria_equipo',
    'consentimiento_ia',
    -- Cupo de IA por plan (Fase B0): el consumo de un tenant no debe ser
    -- visible ni alterable por otro.
    'consumo_ia_diario',
    -- Billing (ADR-0014). Contabilidad Housing↔corredor, separada del ledger
    -- del arriendo, pero igual de multi-tenant: un corredor jamás debe ver los
    -- cobros ni las comisiones de otro.
    'suscripcion_tenant','cargo_billing','comision_plataforma',
    -- Alertas personalizadas: las define el admin de UNA corredora y solo esa
    -- corredora debe verlas. Sin esto quedarían visibles entre tenants.
    'alerta_personalizada'
    -- invitacion_colaborador NO va aquí a propósito (ADR-0013): sin tenant_id,
    -- la página de aceptación no tiene sesión todavía cuando la consulta —
    -- mismo motivo por el que reset_token tampoco está en este arreglo.
    -- evento_gateway_pago tampoco va: cuando llega el webhook todavía no se
    -- sabe de qué tenant es (se resuelve después, desde la referencia del
    -- proveedor). Es tabla de infraestructura; ninguna consulta con cara al
    -- corredor debe leerla.
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists tenant_isolation on %I;', t);
    execute format($f$
      create policy tenant_isolation on %I
        using (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid)
        with check (tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
    $f$, t);
  end loop;
end $$;

-- ─────────────── 3b. Lectura pública del marketplace (excepción a RLS) ───────────────
-- ADR-0011 Fase 2: publicacion/propiedad/imagen_propiedad están en la lista de RLS
-- estricta de la sección 3 (una fila solo es visible si tenant_id = el tenant de la
-- sesión). Eso es correcto para el panel del corredor, pero el marketplace público
-- (sin sesión, sin tenant) necesita ver publicaciones de TODOS los tenants a la vez
-- — es su función. Postgres combina políticas del mismo comando con OR: agregamos
-- una segunda política de solo-lectura para el subconjunto ya publicado/público,
-- que se suma a tenant_isolation en vez de reemplazarla. Un corredor autenticado
-- sigue viendo sus propias filas (publicadas o no) vía tenant_isolation, y además
-- las publicadas de otros vía esta política — igual que vería el marketplace si
-- navegara sin iniciar sesión. Ninguna de las dos políticas habilita escritura:
-- solo aplican a SELECT, así que crear/editar sigue exigiendo el tenant correcto.

drop policy if exists public_read_publicacion on publicacion;
create policy public_read_publicacion on publicacion
  for select
  using (estado = 'publicada');

drop policy if exists public_read_propiedad on propiedad;
create policy public_read_propiedad on propiedad
  for select
  using (exists (
    select 1 from publicacion p
    where p.propiedad_id = propiedad.id and p.estado = 'publicada'
  ));

drop policy if exists public_read_imagen_propiedad on imagen_propiedad;
create policy public_read_imagen_propiedad on imagen_propiedad
  for select
  using (exists (
    select 1 from publicacion p
    where p.propiedad_id = imagen_propiedad.propiedad_id and p.estado = 'publicada'
  ));

-- ─────────────── 3c. Funciones de autenticación cross-tenant (excepción a RLS) ───────────────
-- ADR-0011 Fase 2: un puñado de operaciones son legítimamente cross-tenant por
-- diseño — buscan un registro ANTES de saber a qué tenant pertenece (login por
-- email, duplicados de email/RUT al registrarse, token de valoración del
-- marketplace). Con RLS estricto y housing_app sin bypass, esas consultas
-- devolverían siempre 0 filas (current_setting sin tenant = NULL = ninguna fila
-- calza). La solución NO es darle a housing_app un privilegio amplio — es exponer
-- funciones SECURITY DEFINER: corren con los privilegios de quien las creó
-- (el rol dueño, que sí bypassa RLS) pero solo hacen exactamente la consulta
-- puntual para la que fueron escritas, y housing_app solo puede EJECUTARLAS, no
-- leer las tablas subyacentes por su cuenta. `set search_path = public` evita el
-- ataque clásico de hijacking de search_path sobre funciones SECURITY DEFINER.

-- desactivado_en (ADR-0013): login/actions.ts rechaza el login (mensaje
-- genérico, mismo criterio anti-enumeración del resto de este archivo) si
-- viene no-nulo. Sin este campo un colaborador desactivado podría igual
-- loguearse — la sesión JWT es stateless, este es el único punto de control.
-- Postgres no permite CREATE OR REPLACE cuando cambia el tipo de retorno
-- (columna OUT nueva) — hay que borrar la versión anterior primero.
drop function if exists auth_lookup_usuario_by_email(text);
create or replace function auth_lookup_usuario_by_email(p_email text)
returns table (
  id uuid, tenant_id uuid, rol text, nombre text, email text,
  password_hash text, perfil_completo boolean,
  failed_attempts int, locked_until timestamptz, desactivado_en timestamptz
)
language sql security definer set search_path = public as $$
  select id, tenant_id, rol::text, nombre, email,
         password_hash, perfil_completo, failed_attempts, locked_until, desactivado_en
  from usuario where email = p_email limit 1;
$$;

-- nueva-contrasena: el token de reset (tabla reset_token, sin tenant_id, sin
-- RLS) identifica un usuario_id, pero para actualizar su password_hash bajo
-- RLS necesitamos saber su tenant_id primero. Esta función es de solo LECTURA
-- (no escribe nada) — la escritura real sigue el camino normal vía withTenant()
-- una vez resuelto el tenant, no a través de una función privilegiada.
create or replace function auth_tenant_de_usuario(p_usuario_id uuid) returns uuid
language sql security definer set search_path = public as $$
  select tenant_id from usuario where id = p_usuario_id;
$$;

-- nueva-contrasena: además del tenant, necesitamos nombre/email/rut del
-- usuario para rechazar contraseñas que contengan su propia información
-- personal (política de contraseña 2026-07-31) — el flujo de reset no tiene
-- sesión, por lo que no hay otra forma de leerlos bajo RLS.
create or replace function auth_lookup_usuario_por_id(p_usuario_id uuid)
returns table (nombre text, email text, rut text)
language sql security definer set search_path = public as $$
  select nombre, email, rut from usuario where id = p_usuario_id;
$$;

create or replace function auth_email_existe(p_email text) returns boolean
language sql security definer set search_path = public as $$
  select exists(select 1 from usuario where email = p_email);
$$;

create or replace function auth_rut_existe(p_rut text) returns boolean
language sql security definer set search_path = public as $$
  select exists(select 1 from usuario where rut = p_rut);
$$;

-- Variante para "Mi perfil": el usuario puede volver a guardar su PROPIO RUT sin
-- que cuente como colisión — solo interesa si el RUT pertenece a otra cuenta.
-- usuario.rut es único global (setup.sql sección 4), por eso este chequeo, igual
-- que los anteriores, es legítimamente cross-tenant.
create or replace function auth_rut_pertenece_a_otro_usuario(p_rut text, p_excluir_usuario_id uuid) returns boolean
language sql security definer set search_path = public as $$
  select exists(select 1 from usuario where rut = p_rut and id <> p_excluir_usuario_id);
$$;

-- Token de valoración del marketplace: puede venir de ConsultaContacto (interesado
-- que llenó el formulario de contacto) o de Contrato (arrendatario con contrato
-- vigente) — ver /api/marketplace/valoracion. Dos funciones, una por origen.

create or replace function marketplace_lookup_valoracion_consulta(p_token uuid)
returns table (id uuid, tenant_id uuid, valoracion_dada boolean, nombre text, apellido text)
language sql security definer set search_path = public as $$
  select id, tenant_id, valoracion_dada, nombre, apellido
  from consulta_contacto where token_valoracion = p_token limit 1;
$$;

create or replace function marketplace_lookup_valoracion_contrato(p_token uuid)
returns table (id uuid, tenant_id uuid, valoracion_dada boolean, arrendatario_nombre text)
language sql security definer set search_path = public as $$
  select c.id, c.tenant_id, c.valoracion_dada, p.nombre
  from contrato c join persona p on p.id = c.arrendatario_id
  where c.token_valoracion = p_token limit 1;
$$;

grant execute on function auth_lookup_usuario_by_email(text) to housing_app;
grant execute on function auth_tenant_de_usuario(uuid) to housing_app;
grant execute on function auth_lookup_usuario_por_id(uuid) to housing_app;
grant execute on function auth_email_existe(text) to housing_app;
grant execute on function auth_rut_existe(text) to housing_app;
grant execute on function auth_rut_pertenece_a_otro_usuario(text, uuid) to housing_app;
grant execute on function marketplace_lookup_valoracion_consulta(uuid) to housing_app;
grant execute on function marketplace_lookup_valoracion_contrato(uuid) to housing_app;

-- Portal de autoconsulta: buscar persona por RUT es cross-tenant por diseño
-- (un arrendatario no sabe ni le importa a qué "tenant" pertenece su corredor
-- al pedir su código de acceso). Devuelve, si existe, el contrato VIGENTE más
-- reciente de esa persona — priorizando el rol arrendatario sobre propietario,
-- igual que la lógica original en TypeScript (contratoArrendatario ?? contratoPropietario).
create or replace function portal_lookup_persona_por_rut(p_rut text)
returns table (
  persona_id uuid, tenant_id uuid, nombre text, email text,
  contrato_id uuid, propiedad_id uuid, direccion text, rol text
)
language sql security definer set search_path = public as $$
  select p.id, p.tenant_id, p.nombre, p.email,
         c.id, c.propiedad_id, prop.direccion,
         case when c.arrendatario_id = p.id then 'arrendatario' else 'propietario' end
  from persona p
  left join lateral (
    select * from contrato c2
    where (c2.arrendatario_id = p.id or c2.propietario_id = p.id) and c2.estado = 'vigente'
    order by (c2.arrendatario_id = p.id) desc, c2.created_at desc
    limit 1
  ) c on true
  left join propiedad prop on prop.id = c.propiedad_id
  where p.rut = p_rut
  limit 1;
$$;
grant execute on function portal_lookup_persona_por_rut(text) to housing_app;

-- Verificar OTP: el otpId es el "credencial" que el cliente ya trae consigo
-- (se lo devolvimos al solicitar el código) — no sabemos su tenant hasta
-- resolverlo. Igual patrón que los anteriores: lectura vía SECURITY DEFINER,
-- las escrituras posteriores usan withTenant() una vez conocido el tenant.
create or replace function portal_lookup_acceso_otp(p_id uuid)
returns table (
  id uuid, tenant_id uuid, persona_id uuid, propiedad_id uuid,
  codigo_hash text, expira_en timestamptz, intentos smallint,
  max_intentos smallint, usado_en timestamptz
)
language sql security definer set search_path = public as $$
  select id, tenant_id, persona_id, propiedad_id,
         codigo_hash, expira_en, intentos, max_intentos, usado_en
  from acceso_otp where id = p_id limit 1;
$$;
grant execute on function portal_lookup_acceso_otp(uuid) to housing_app;

-- Marketplace /contacto: si el tenant no configuró un email de contacto fijo,
-- se usa el email del primer usuario admin como respaldo. Cross-tenant por
-- diseño (el visitante anónimo no tiene sesión de ningún tenant).
create or replace function marketplace_lookup_corredor_email_fallback(p_tenant_id uuid) returns text
language sql security definer set search_path = public as $$
  select email from usuario where tenant_id = p_tenant_id order by rol asc, created_at asc limit 1;
$$;
grant execute on function marketplace_lookup_corredor_email_fallback(uuid) to housing_app;

-- Marketplace /denuncia: a propósito NO filtra por estado='publicada' — se
-- puede denunciar una publicación ya dada de baja (ver revisión de
-- auditoría). La política pública de "3b" solo cubre publicadas, así que este
-- caso necesita su propio acceso de solo lectura, sin condición de estado.
create or replace function marketplace_lookup_publicacion_titulo(p_id uuid) returns text
language sql security definer set search_path = public as $$
  select titulo from publicacion where id = p_id;
$$;
grant execute on function marketplace_lookup_publicacion_titulo(uuid) to housing_app;

-- ─────────────── 4. RUT único por usuario y único compuesto por tenant+persona ───────────────
-- Se corre idempotente: si ya existe el índice/constraint, no falla.

-- RUT del corredor: único global (una persona = un RUT)
alter table usuario add column if not exists rut text;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'usuario_rut_unique'
  ) then
    alter table usuario add constraint usuario_rut_unique unique (rut);
  end if;
end $$;

-- Persona: RUT único dentro del tenant (arrendatario/propietario no se duplica en misma corredora)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'persona_tenant_id_rut_unique'
  ) then
    alter table persona add constraint persona_tenant_id_rut_unique unique (tenant_id, rut);
  end if;
end $$;

-- ─────────────── 5. Vistas de saldos derivados ───────────────
-- Deuda del arrendatario = Σ cargos − Σ pagos (signo maneja reversas).
-- Incluye CARGO_AJUSTE (cargo directo al arrendatario, ej. daños).
create or replace view v_deuda_arrendatario as
select tenant_id, contrato_id, arrendatario_id,
  sum(signo * monto_clp *
      case tipo
        when 'CARGO_ARRIENDO'    then 1 when 'CARGO_GASTO_COMUN' then 1
        when 'CARGO_INTERES'     then 1 when 'CARGO_MULTA'       then 1
        when 'CARGO_AJUSTE'      then 1
        when 'PAGO_RECIBIDO'     then -1
        else 0 end) as saldo_clp
from asiento_ledger
group by tenant_id, contrato_id, arrendatario_id;

-- Billetera del propietario = Σ pagos (SIN gasto común ni garantía) − comisión − ajustes − liquidaciones.
create or replace view v_billetera_propietario as
select tenant_id, propietario_id,
  sum(signo * monto_clp *
      case
        when tipo = 'PAGO_RECIBIDO'
          and concepto is distinct from 'gasto_comun'
          and concepto is distinct from 'garantia'    then 1
        when tipo = 'COMISION_CORREDOR'               then -1
        when tipo = 'AJUSTE_LIQUIDACION'              then -1
        when tipo = 'LIQUIDACION_PROPIETARIO'         then -1
        else 0 end) as saldo_clp
from asiento_ledger
group by tenant_id, propietario_id;

-- Gasto común recaudado (passthrough), por contrato.
create or replace view v_gasto_comun_recaudado as
select tenant_id, contrato_id,
  sum(signo * monto_clp) filter (
    where tipo = 'PAGO_RECIBIDO' and concepto = 'gasto_comun'
  ) as recaudado_clp
from asiento_ledger
group by tenant_id, contrato_id;

-- Garantía retenida (passthrough), por contrato = recibida − retenciones − devoluciones.
create or replace view v_garantia_retenida as
select tenant_id, contrato_id,
  sum(signo * monto_clp *
      case tipo
        when 'GARANTIA_RECIBIDA'   then 1
        -- Reajuste UF: suma como la recepción. Al liquidar una garantía UF,
        -- recibida + reajuste = monto restituido hoy, así retención+devolución
        -- lo consumen por completo y la garantía cierra a 0 (ver terminarContrato).
        when 'REAJUSTE_GARANTIA'   then 1
        when 'RETENCION_GARANTIA'  then -1
        when 'DEVOLUCION_GARANTIA' then -1
        else 0 end) as retenida_clp
from asiento_ledger
group by tenant_id, contrato_id;

-- ─────────────── 6. Rol de aplicación en runtime (ADR-0011) ───────────────
-- 'housing_app' es el rol con el que la app Next.js debe conectarse en TODO
-- entorno (local incluido, una vez migrado DATABASE_URL). No es dueño de las
-- tablas ni superusuario — por eso la política tenant_isolation (sección 3)
-- sí lo restringe de verdad. 'housing' queda reservado para migraciones
-- (prisma migrate/db push, este mismo archivo) y tareas administrativas.
--
-- DEV: password fijo solo para este entorno local (mismo criterio que
-- POSTGRES_PASSWORD=housing_dev en docker-compose.yml). En producción, generar
-- un secreto real vía el gestor de secretos del proveedor — nunca reusar este valor.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'housing_app') then
    create role housing_app with login password 'housing_app_dev';
  end if;
end $$;

grant connect on database housing to housing_app;
grant usage on schema public to housing_app;

-- Tablas/secuencias/funciones existentes.
grant select, insert, update, delete on all tables in schema public to housing_app;
grant usage, select on all sequences in schema public to housing_app;
grant execute on all functions in schema public to housing_app;

-- Privilegios por defecto: toda tabla/secuencia/función que se cree DESPUÉS
-- (nuevas migraciones) queda accesible para housing_app automáticamente, sin
-- tener que editar este archivo cada vez que el schema crece. Se define con
-- 'for role housing' porque las migraciones corren como ese rol.
alter default privileges for role housing in schema public
  grant select, insert, update, delete on tables to housing_app;
alter default privileges for role housing in schema public
  grant usage, select on sequences to housing_app;
alter default privileges for role housing in schema public
  grant execute on functions to housing_app;
