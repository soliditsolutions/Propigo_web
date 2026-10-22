-- Solo desarrollo local: lo ejecuta la imagen oficial de Postgres UNA vez, al
-- crear un volumen vacío (docker-entrypoint-initdb.d). Crea el rol de runtime
-- de la app con la contraseña de desarrollo que usa .env.example.
-- setup.sql nunca fija contraseñas (en producción viene del gestor de secretos).
create role propigo_app with login password 'propigo_app_dev';
