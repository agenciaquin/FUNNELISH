-- =====================================================================
-- Cruce de referencias · SOLO LECTURA (todo son SELECT)
-- Proyecto: quinchat (bjbjqmbuzpyjvcugbusx) · 30-09-2026
--
-- Los scripts de esta carpeta cruzan los archivos contra todas las tablas que
-- expone PostgREST con la clave service_role. Eso deja DOS huecos que solo se
-- cierran con SQL (editor de Supabase o herramienta MCP, que entra como postgres):
--
--   1. `catalogo_categorias` y `catalogo_variables` existen pero service_role no
--      tiene SELECT sobre ellas (403). Son del módulo de catálogos de
--      quin-comercial; el código de quinchat no las usa.
--   2. PostgREST solo enseña el esquema `public`. Aquí se mira information_schema
--      entero por si hay columnas de texto en otros esquemas.
--
-- Ejecutar JUSTO ANTES de cada borrado (observación 6 bis de CLAUDE.md), no antes.
-- =====================================================================

-- 1 · Columnas de texto o JSON de TODOS los esquemas de la aplicación.
--     Si sale alguna tabla que no esté en `columnas-con-storage.csv` y pueda
--     guardar URLs, hay que añadirla al cruce.
select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema', 'pg_toast', 'storage', 'auth', 'realtime',
                           'supabase_functions', 'supabase_migrations', 'extensions', 'graphql', 'graphql_public',
                           'pgsodium', 'pgsodium_masks', 'vault', 'net', 'cron', 'pgbouncer')
  and data_type in ('text', 'character varying', 'character', 'json', 'jsonb', 'ARRAY', 'USER-DEFINED')
order by 1, 2, 3;

-- 2 · Las dos tablas que service_role no puede leer: ¿nombran algún archivo de Storage?
--     Esperado: 0 y 0. Si sale algo, NO ejecutar A2 ni A1 hasta mirarlo.
select 'catalogo_categorias' as tabla, count(*) as filas_con_archivo
from catalogo_categorias t
where to_jsonb(t)::text ~* '(supabase\.co/storage|chat-media|catalogo-imagenes|plantillas-images|\.(mp4|mov|webm|jpe?g|png|webp)\M)'
union all
select 'catalogo_variables', count(*)
from catalogo_variables t
where to_jsonb(t)::text ~* '(supabase\.co/storage|chat-media|catalogo-imagenes|plantillas-images|\.(mp4|mov|webm|jpe?g|png|webp)\M)';

-- 3 · A2: los 18 vídeos huérfanos contra TODAS las columnas de texto de TODOS
--     los esquemas de la aplicación (no solo public), en una sola consulta.
--     `query_to_xml` ejecuta un SELECT por columna: no escribe nada.
--     Esperado: 0 filas. Cualquier fila = ese vídeo NO es huérfano.
with videos(base) as (values
  ('media-1785985978220-qgyzc.mp4'), ('media-1785989890192-4rk49.mp4'), ('media-1785899223019-vguxt.mp4'),
  ('media-1785963174256-nny7b.mp4'), ('media-1784683090961-fxb20.mp4'), ('media-1784739357167-3aejg.mp4'),
  ('media-1786202622088-l19ii.mp4'), ('media-1784756449641-91tg9.mp4'), ('media-1784739453910-sfvs4.mp4'),
  ('media-1785199923167-jnpw7.mp4'), ('media-1785188327947-fnnr3.mp4'), ('media-1785200811824-7b81g.mp4'),
  ('media-1785985936137-isa01.mp4'), ('media-1785985949467-jnyo4.mp4'), ('media-1785200000041-ncmoy.mp4'),
  ('media-1786201990033-xoym5.mp4'), ('media-1786741108680-tifxn.mp4'), ('media-1786202838265-jqlon.mp4')
),
cols as (
  select table_schema, table_name, column_name
  from information_schema.columns
  where table_schema not in ('pg_catalog', 'information_schema', 'pg_toast', 'storage', 'auth', 'realtime',
                             'supabase_functions', 'supabase_migrations', 'extensions', 'graphql', 'graphql_public',
                             'pgsodium', 'pgsodium_masks', 'vault', 'net', 'cron', 'pgbouncer')
    and data_type in ('text', 'character varying', 'character', 'json', 'jsonb', 'ARRAY', 'USER-DEFINED')
    and table_name not in ('media_optimizaciones', 'media_optimizaciones_resumen')  -- registro de agosto, no sirve archivos
),
hits as (
  select v.base, c.table_schema, c.table_name, c.column_name,
         (xpath('/row/n/text()', query_to_xml(format(
            'select count(*) as n from %I.%I where %I::text ilike %L',
            c.table_schema, c.table_name, c.column_name, '%' || v.base || '%'), false, true, '')))[1]::text::int as n
  from videos v cross join cols c
)
select * from hits where n > 0 order by base;

-- 4 · A1: ¿alguna columna (fuera del registro de agosto) contiene «_originales/»?
--     Esperado: 0 filas.
with cols as (
  select table_schema, table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and data_type in ('text', 'character varying', 'json', 'jsonb', 'ARRAY')
    and table_name not in ('media_optimizaciones', 'media_optimizaciones_resumen')
)
select table_name, column_name, n from (
  select c.table_name, c.column_name,
         (xpath('/row/n/text()', query_to_xml(format(
            'select count(*) as n from %I.%I where %I::text like %L',
            c.table_schema, c.table_name, c.column_name, '%\_originales/%'), false, true, '')))[1]::text::int as n
  from cols c
) x where n > 0;

-- 5 · Caché que tiene hoy cada zona (para el plan de caché de A3/A4/A5).
select bucket_id,
       case when name like '\_originales/%' then '_originales'
            when name like 'embudos/chat/%' then 'embudos/chat'
            when name ~ '^\d{8,}' then 'chat-saliente'
            else split_part(name, '/', 1) end as zona,
       metadata->>'cacheControl' as cache_control,
       count(*) as archivos,
       round(sum((metadata->>'size')::bigint) / 1048576.0, 1) as mb
from storage.objects
group by 1, 2, 3
order by 1, 2, 3;
