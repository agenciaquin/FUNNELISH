-- ════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT · FASE 5 (sub-bloque 6) — RLS por empresa (2ª capa de seguridad)
-- Ejecutar en confirma-ya → SQL Editor → Run.
--
-- ⚠️ ORDEN OBLIGATORIO — corre esto SOLO DESPUÉS de:
--    1) poner SUPABASE_JWT_SECRET en Vercel (Supabase → Settings → API → JWT Secret),
--    2) desplegar el código nuevo (token por empresa), y
--    3) verificar que el panel SIGUE mostrando los chats.
--    Si lo corres antes, el panel (llave anónima) dejará de ver datos.
--
-- Qué hace: activa RLS en las tablas de datos. Con el token de empresa que ahora
-- manda el navegador, cada usuario SOLO ve/toca las filas de SU tenant, incluido
-- el tiempo real. Se revoca 'anon' (llave pública sin token → no ve nada). El
-- servidor usa service_role, que IGNORA RLS, así que las APIs siguen igual.
-- ════════════════════════════════════════════════════════════════════════

-- Trigger: al INSERTAR desde el navegador (rol authenticated) se rellena
-- tenant_id con el del token si viene vacío. El servidor (service_role) ya lo
-- manda explícito, así que ahí no cambia nada.
create or replace function public.set_tenant_id_from_jwt()
returns trigger language plpgsql as $fn$
begin
  if new.tenant_id is null then
    begin
      new.tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
    exception when others then
      null; -- sin JWT (service_role u otro contexto): dejar como está
    end;
  end if;
  return new;
end $fn$;

do $do$
declare
  t text;
  tablas text[] := array[
    'clientes_funnelish','conversations','messages','funnels','catalogos_bot',
    'catalogo_colores','etiquetas','plantillas','disparadores','contactos',
    'memoria_bot','faq_bot','objeciones_analisis','vendedor_reportes',
    'vendedor_preguntas','campanas_gasto','effi_guias','ajustes','configuracion',
    'bot_config','push_subscriptions'
  ];
begin
  foreach t in array tablas loop
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then
      -- Activar RLS
      execute format('alter table public.%I enable row level security', t);

      -- Política: cada empresa solo ve/toca lo suyo (rol authenticated con token)
      execute format('drop policy if exists tenant_aislado on public.%I', t);
      execute format(
        'create policy tenant_aislado on public.%I for all to authenticated '
        || 'using (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid) '
        || 'with check (tenant_id = (auth.jwt() ->> ''tenant_id'')::uuid)', t);

      -- Permisos: authenticated (con token) puede CRUD sobre lo suyo; anon nada
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      execute format('revoke all on public.%I from anon', t);

      -- Trigger para rellenar tenant_id en inserts del navegador
      execute format('drop trigger if exists trg_set_tenant_id on public.%I', t);
      execute format(
        'create trigger trg_set_tenant_id before insert on public.%I '
        || 'for each row execute function public.set_tenant_id_from_jwt()', t);
    end if;
  end loop;
end $do$;
