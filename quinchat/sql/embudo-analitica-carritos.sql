-- Analítica de embudos (pasos granulares) + carritos abandonados. Single-tenant.

-- 1) Pasos del embudo: cada visita a una página guarda su paso.
--    landing · scroll_fin · pedido · talla · datos · boton · compra
create table if not exists funnel_eventos (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null,
  paso         text not null,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  referrer     text,
  created_at   timestamptz not null default now()
);
create index if not exists funnel_eventos_slug_paso_idx on funnel_eventos (slug, paso, created_at);

-- 2) Carritos abandonados: escribió nombre + teléfono pero no completó la compra.
create table if not exists carritos_abandonados (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  nombre        text,
  telefono      text not null,
  producto      text,
  talla         text,
  valor         numeric,
  recuperado    boolean not null default false,
  recuperado_at timestamptz,
  notificado_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists carritos_abandonados_uniq on carritos_abandonados (slug, telefono);
create index if not exists carritos_abandonados_idx on carritos_abandonados (recuperado, created_at desc);

-- SIN ESTE GRANT el server da "permission denied" al guardar/leer y la lista sale
-- vacía (no registra nada). Toda tabla nueva del proyecto necesita este grant.
grant all on table carritos_abandonados to service_role;
