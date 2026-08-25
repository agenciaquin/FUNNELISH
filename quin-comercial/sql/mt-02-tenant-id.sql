-- ════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT · FASE 2 — Agregar tenant_id a todas las tablas de datos
-- Ejecutar en confirma-ya → SQL Editor → Run. (Seguro: columnas nuevas)
-- Cada fila de datos quedará "marcada" con la empresa dueña.
-- ════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  tablas text[] := array[
    'clientes_funnelish','conversations','messages','funnels',
    'catalogos_bot','catalogo_colores','etiquetas','plantillas',
    'disparadores','contactos','memoria_bot','faq_bot',
    'objeciones_analisis','vendedor_reportes','vendedor_preguntas',
    'campanas_gasto','effi_guias','ajustes','configuracion',
    'bot_config','push_subscriptions'
  ];
begin
  foreach t in array tablas loop
    -- Solo si la tabla existe (por si alguna tiene otro nombre)
    if exists (select 1 from information_schema.tables
               where table_schema='public' and table_name=t) then
      execute format(
        'alter table public.%I add column if not exists tenant_id uuid references tenants(id) on delete cascade',
        t);
      execute format(
        'create index if not exists %I on public.%I (tenant_id)',
        t || '_tenant_idx', t);
    end if;
  end loop;
end $$;
