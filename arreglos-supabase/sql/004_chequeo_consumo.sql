-- CHEQUEO DE CONSUMO — quinchat (bjbjqmbuzpyjvcugbusx)
--
-- Ejecutar una vez al mes en el editor SQL del dashboard.
--
-- POR QUE ESTE Y NO UNA ALERTA DE EGRESS
-- --------------------------------------
-- El egress es el sintoma; llega tarde y ya facturado. La causa es que entran
-- archivos pesados al bucket, y eso se ve semanas antes. Este chequeo mira la
-- causa.
--
-- Ademas es SQL puro sobre `storage.objects`, asi que **no depende de la API de
-- logs** que Supabase retira el 23 de septiembre de 2026. Seguira funcionando.
--
-- COMO LEERLO: si el bloque 2 devuelve filas, algo se esta colando sin
-- comprimir. Cada fila es un archivo que no deberia pesar lo que pesa.


-- =====================================================================
-- 1. CRECIMIENTO MES A MES  ·  la tendencia
-- =====================================================================
-- QUE MIRAR: `peso_medio`. Con la compresion activa deberia bajar de ~860 kB
-- a menos de 150 kB. Si sigue alto, algo sube por un camino sin comprimir.
select to_char(created_at, 'YYYY-MM')                                as mes,
       count(*)                                                      as archivos,
       pg_size_pretty(sum((metadata->>'size')::bigint))              as subido,
       pg_size_pretty(avg((metadata->>'size')::bigint)::bigint)      as peso_medio,
       count(*) filter (where metadata->>'mimetype' like 'image/%'
                          and (metadata->>'size')::bigint > 500000)  as imagenes_pesadas
from storage.objects
where bucket_id = 'chat-media'
  and metadata->>'size' is not null
  and name not like '\_originales/%'
group by 1
order by 1 desc
limit 12;


-- =====================================================================
-- 2. FUGAS  ·  imagenes pesadas subidas en los ultimos 30 dias
-- =====================================================================
-- RESULTADO ESPERADO TRAS LA INTEGRACION: **cero filas**.
--
-- Una imagen que pasa por `optimizarImagen()` no deberia superar los 500 kB.
-- Si aparece alguna, la subida esquivo la compresion. Los sospechosos, por
-- orden de probabilidad:
--   1. Enlace firmado (`funnels/upload-url`): archivos que siguen pasando de
--      4 MB tras comprimir en el navegador, o subidas desde `ChatArea`.
--   2. Una ruta de subida nueva que no llama a `optimizarImagen()`.
--   3. Un PNG con transparencia real: se comprime sin perdida y puede quedar
--      grande legitimamente. Se reconoce porque sigue siendo `image/png`.
select name                                              as archivo,
       pg_size_pretty((metadata->>'size')::bigint)       as peso,
       metadata->>'mimetype'                             as tipo,
       coalesce(metadata->>'cacheControl', '(sin dato)') as cache,
       created_at::date                                  as subido_el
from storage.objects
where bucket_id = 'chat-media'
  and created_at > now() - interval '30 days'
  and metadata->>'mimetype' like 'image/%'
  and (metadata->>'size')::bigint > 500000
  and name not like '\_originales/%'
order by (metadata->>'size')::bigint desc
limit 40;


-- =====================================================================
-- 3. CACHE  ·  cuantos archivos siguen con la caducidad de una hora
-- =====================================================================
-- Supabase pone `max-age=3600` por defecto. Con una hora, el navegador vuelve
-- a pedir la misma foto al origen constantemente. Las rutas de subida ya piden
-- un ano; los archivos viejos solo se arreglan con el backfill.
select coalesce(metadata->>'cacheControl', '(sin dato)') as cache,
       count(*)                                          as archivos,
       pg_size_pretty(sum((metadata->>'size')::bigint))  as peso
from storage.objects
where bucket_id = 'chat-media'
  and name not like '\_originales/%'
group by 1
order by count(*) desc;


-- =====================================================================
-- 4. RESPALDOS  ·  cuanto ocupa `_originales/`
-- =====================================================================
-- El backfill deja ahi cada original antes de sustituirlo. Cuando hayas
-- verificado que todo se ve bien, se borra ese prefijo y ahi se materializa
-- el ahorro de almacenamiento.
select count(*)                                         as archivos,
       pg_size_pretty(coalesce(sum((metadata->>'size')::bigint), 0)) as ocupan
from storage.objects
where bucket_id = 'chat-media'
  and name like '\_originales/%';


-- =====================================================================
-- 5. VEREDICTO  ·  una sola fila, para leer de un vistazo
-- =====================================================================
with u as (
  select (metadata->>'size')::bigint as bytes,
         metadata->>'mimetype'       as tipo
  from storage.objects
  where bucket_id = 'chat-media'
    and created_at > now() - interval '30 days'
    and metadata->>'size' is not null
    and name not like '\_originales/%'
)
select count(*)                                                as archivos_30d,
       pg_size_pretty(coalesce(sum(bytes), 0))                 as subido_30d,
       pg_size_pretty(coalesce(avg(bytes), 0)::bigint)         as peso_medio,
       count(*) filter (where tipo like 'image/%' and bytes > 500000) as fugas,
       case
         when count(*) = 0                                              then 'SIN SUBIDAS EN 30 DIAS'
         when count(*) filter (where tipo like 'image/%' and bytes > 500000) = 0
              and avg(bytes) < 200000                                   then 'BIEN — la compresion esta actuando'
         when count(*) filter (where tipo like 'image/%' and bytes > 500000) = 0
                                                                        then 'ACEPTABLE — sin fugas, pero el peso medio sigue alto'
         else 'REVISAR — hay imagenes sin comprimir, mirar el bloque 2'
       end                                                      as veredicto
from u;
