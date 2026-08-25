-- mt-22: registro de pasos del embudo (para ver dónde llega y dónde se cae la venta).
-- Cada visita a una página del embudo guarda una fila con su paso:
--   landing → página de venta · pedido → formulario · compra → página de gracias.
create table if not exists funnel_eventos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid,
  slug        text not null,
  paso        text not null,          -- 'landing' | 'pedido' | 'compra'
  referencia  text,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  referrer    text,
  created_at  timestamptz not null default now()
);

create index if not exists funnel_eventos_tenant_slug_idx on funnel_eventos (tenant_id, slug, created_at);
create index if not exists funnel_eventos_slug_paso_idx   on funnel_eventos (slug, paso, created_at);
