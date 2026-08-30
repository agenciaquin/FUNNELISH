-- FOTO PREVIA — ejecutar y GUARDAR LA SALIDA antes de tocar nada.
-- Sin esto no hay rollback fiable.
--
-- Proyecto: quinchat (bjbjqmbuzpyjvcugbusx)

-- 1. Permisos actuales de anon/authenticated en el esquema public
select table_name,
       grantee,
       string_agg(distinct privilege_type, ', ' order by privilege_type) as permisos
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
group by table_name, grantee
order by table_name, grantee;

-- 2. Policies actuales
select tablename, policyname, permissive, roles::text, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename;

-- 3. Privilegios por defecto.
--    Si aquí aparece algo con `anon=arwd`, cada tabla nueva nacerá expuesta y
--    el REVOKE se deshará solo con el tiempo. Hay que limpiarlo también.
select r.rolname as otorgado_por,
       n.nspname as esquema,
       d.defaclobjtype as tipo,
       d.defaclacl::text as permisos_por_defecto
from pg_default_acl d
join pg_roles r on r.oid = d.defaclrole
left join pg_namespace n on n.oid = d.defaclnamespace;
