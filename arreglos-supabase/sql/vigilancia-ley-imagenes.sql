-- =====================================================================================================
-- VIGILANCIA DE LA LEY DE IMÁGENES  (CLAUDE.md · "LEY · Toda imagen que se suba se comprime")
--
-- SOLO LECTURA. Solo hace SELECT sobre storage.objects; no escribe, no borra, no toca el bucket.
--
-- Marca que se vigila: toda imagen que pasa por el compresor del servidor se sube con
-- cacheControl = CACHE_UN_ANO ('31536000'), que Supabase guarda en metadata como 'max-age=31536000'.
-- Una imagen SIN esa marca entró por un camino que no comprime (chat, WhatsApp entrante, collage,
-- marca de agua, URL firmada, subida desde el navegador...).
--
-- Por carpeta (primer segmento de la ruta) y por semana (lunes) desde el 31-08-2026, en el bucket
-- chat-media: cuántas imágenes hay con y sin la marca, su peso medio y cuántas pasan de 500 kB.
-- Con la ley cumplida, desde su publicación "sin_marca" y "mas_500kb" deberían tender a 0.
--
-- Cómo usarlo: pegar en el editor SQL de Supabase del proyecto de producción y ejecutar.
-- =====================================================================================================

with imagenes as (
  select
    split_part(o.name, '/', 1)                                         as carpeta,
    date_trunc('week', o.created_at)::date                             as semana,
    coalesce((o.metadata->>'size')::bigint, 0)                         as bytes,
    (o.metadata->>'cacheControl') = 'max-age=31536000'                 as con_marca
  from storage.objects o
  where o.bucket_id = 'chat-media'
    and o.created_at >= timestamptz '2026-08-31 00:00:00-05'
    and (
      o.metadata->>'mimetype' like 'image/%'
      -- respaldo por extensión: algunas subidas antiguas guardan octet-stream
      or (coalesce(o.metadata->>'mimetype', '') in ('', 'application/octet-stream')
          and lower(o.name) ~ '\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$')
    )
)
select
  carpeta,
  semana,
  count(*)                                                             as imagenes,
  count(*) filter (where con_marca)                                    as con_marca,
  count(*) filter (where not con_marca)                                as sin_marca,
  round(100.0 * count(*) filter (where con_marca) / count(*), 1)       as pct_con_marca,
  round(avg(bytes) filter (where con_marca)     / 1024.0, 1)           as kb_medio_con_marca,
  round(avg(bytes) filter (where not con_marca) / 1024.0, 1)           as kb_medio_sin_marca,
  count(*) filter (where bytes > 500 * 1024)                           as mas_500kb,
  count(*) filter (where bytes > 500 * 1024 and con_marca)             as mas_500kb_con_marca,
  count(*) filter (where bytes > 500 * 1024 and not con_marca)         as mas_500kb_sin_marca,
  round(sum(bytes) / 1048576.0, 1)                                     as mb_total
from imagenes
group by carpeta, semana
order by semana desc, sin_marca desc, carpeta;

-- -----------------------------------------------------------------------------------------------------
-- Opcional (también solo lectura): el mismo resumen para TODOS los buckets, sin desglose semanal.
-- Útil porque el panel de plantillas sube desde el navegador al bucket 'plantillas-images', no a chat-media
-- (components/panel/PlantillasPanel.tsx:108 en las dos apps). Descomentar para ejecutar.
-- -----------------------------------------------------------------------------------------------------
-- select
--   o.bucket_id,
--   count(*)                                                                         as imagenes,
--   count(*) filter (where o.metadata->>'cacheControl' = 'max-age=31536000')         as con_marca,
--   count(*) filter (where o.metadata->>'cacheControl' is distinct from 'max-age=31536000') as sin_marca,
--   round(avg((o.metadata->>'size')::bigint) / 1024.0, 1)                            as kb_medio,
--   count(*) filter (where (o.metadata->>'size')::bigint > 500 * 1024)               as mas_500kb
-- from storage.objects o
-- where o.created_at >= timestamptz '2026-08-31 00:00:00-05'
--   and o.metadata->>'mimetype' like 'image/%'
-- group by o.bucket_id
-- order by sin_marca desc;
