-- VERIFICACION POSTERIOR a 001_revocar_tablas_sin_uso.sql

-- 1. Permisos que quedan.
--    RESULTADO ESPERADO: exactamente 8 filas -> bot_config, clientes_funnelish,
--    conversations y messages, cada una para anon y para authenticated.
--    Nada mas. Esas cuatro son las de la fase 2.
select table_name,
       grantee,
       string_agg(distinct privilege_type, ', ' order by privilege_type) as permisos
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
group by table_name, grantee
order by table_name, grantee;

-- 2. Policies que quedan.
--    RESULTADO ESPERADO: 2 filas -> `allow_all` en bot_config y
--    `panel_authenticated_all` en clientes_funnelish. La de plantillas ya no.
select tablename, policyname, roles::text, cmd, qual
from pg_policies
where schemaname = 'public'
order by tablename;
