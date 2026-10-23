-- Enumeracion fiable de objetos de Storage para el backfill.
--
-- POR QUE HACE FALTA
-- ------------------
-- El API `list()` de Supabase agrupa las carpetas SIN distinguir mayusculas. En
-- el bucket `chat-media` conviven `embudos/SPIDERMAN/` (1 archivo) y
-- `embudos/spiderman/` (27), y el listado devuelve los hijos de una bajo el
-- prefijo de la otra. Las descargas fallan con "Object not found" y, lo que es
-- peor, los archivos de la carpeta en minusculas son invisibles: el backfill
-- nunca supo que existian.
--
-- Consultando `storage.objects` directamente eso desaparece, y de paso se quita
-- la paginacion carpeta a carpeta.
--
-- SEGURIDAD
-- ---------
-- Es SECURITY DEFINER porque `storage.objects` no es accesible desde PostgREST.
-- Solo lectura, y con EXECUTE revocado a `anon` y `authenticated`: unicamente
-- `service_role` puede llamarla. Es el mismo criterio que la auditoria pedia
-- para las funciones expuestas como RPC en master-quin.

create or replace function public.listar_objetos_storage(
  p_bucket  text,
  p_prefijo text default ''
)
returns table (ruta text, bytes bigint, content_type text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select o.name,
         (o.metadata->>'size')::bigint,
         o.metadata->>'mimetype'
  from storage.objects o
  where o.bucket_id = p_bucket
    and (p_prefijo = '' or o.name like p_prefijo || '%')
    and o.metadata->>'size' is not null
$$;

revoke execute on function public.listar_objetos_storage(text, text) from public;
revoke execute on function public.listar_objetos_storage(text, text) from anon, authenticated;
grant  execute on function public.listar_objetos_storage(text, text) to service_role;

comment on function public.listar_objetos_storage(text, text) is
  'Enumeracion fiable de storage.objects para el backfill de media-api. El API list() no distingue mayusculas en los nombres de carpeta.';
