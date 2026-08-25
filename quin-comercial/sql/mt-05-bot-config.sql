-- ════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT · bot_config con clave por empresa (tenant_id, key)
-- Ejecutar en confirma-ya → SQL Editor → Run. Seguro.
--
-- Motivo: bot_config guarda el prompt del bot por empresa (key='system_prompt').
-- Hoy la clave es global sobre 'key' → dos empresas colisionarían y el guardado
-- de "Entrenamiento" fallaría. La volvemos única por (tenant_id, key).
-- ════════════════════════════════════════════════════════════════════════

-- Quitar cualquier PK/único que esté sobre 'key' (o global) en bot_config
do $do$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and rel.relname = 'bot_config' and con.contype in ('p','u')
  loop
    execute format('alter table public.bot_config drop constraint %I', c.conname);
  end loop;
end $do$;

-- Clave única compuesta: cada empresa tiene su propio 'system_prompt'
create unique index if not exists bot_config_tenant_key_uq
  on public.bot_config (tenant_id, key);
