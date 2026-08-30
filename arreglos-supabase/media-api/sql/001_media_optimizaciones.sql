-- Registro de archivos ya optimizados.
--
-- Sirve para dos cosas: que el backfill sea idempotente (se puede cortar y
-- relanzar sin reprocesar nada) y para poder medir el ahorro real después.
--
-- Se crea con RLS activado y SIN policies: eso deja la tabla accesible solo
-- para `service_role`, que es quien ejecuta esta API. Es el mismo patrón que ya
-- usa `ai_integraciones` en el proyecto confirma-ya.

create table if not exists public.media_optimizaciones (
    ruta             text primary key,
    bucket           text        not null,
    clase            text        not null check (clase in ('imagen', 'video')),
    bytes_original   bigint      not null,
    bytes_final      bigint      not null,
    content_type     text        not null,
    respaldo         text,
    procesado_at     timestamptz not null default now()
);

alter table public.media_optimizaciones enable row level security;

revoke select, insert, update, delete on table public.media_optimizaciones from anon, authenticated;

-- IMPRESCINDIBLE: las tablas creadas por `postgres` en este proyecto dan solo
-- `Dxtm` a TODOS los roles, service_role incluido (ver pg_default_acl). Sin este
-- grant la API falla con "permission denied for table media_optimizaciones".
grant select, insert, update, delete on table public.media_optimizaciones to service_role;

create index if not exists media_optimizaciones_procesado_at_idx
    on public.media_optimizaciones (procesado_at desc);

comment on table public.media_optimizaciones is
    'Archivos de storage ya recomprimidos por media-api. Una fila por ruta procesada.';

-- Resumen del ahorro acumulado.
create or replace view public.media_optimizaciones_resumen
with (security_invoker = true) as
select
    clase,
    count(*)                                                        as archivos,
    pg_size_pretty(sum(bytes_original))                             as antes,
    pg_size_pretty(sum(bytes_final))                                as despues,
    pg_size_pretty(sum(bytes_original - bytes_final))               as ahorrado,
    round(100.0 * sum(bytes_original - bytes_final) / nullif(sum(bytes_original), 0), 1) as porcentaje
from public.media_optimizaciones
group by clase;

grant select on public.media_optimizaciones_resumen to service_role;
