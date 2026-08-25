-- ============================================================
-- Aprendizaje de Quino (asistente de conexión WhatsApp↔Meta).
-- Cerebro COMPARTIDO de la agencia: NO lleva tenant_id.
-- Solo se accede desde el servidor (service_role). RLS activo sin
-- policies = nadie del navegador (anon/authenticated) puede leerla.
-- ============================================================

create table if not exists quino_aprendizaje (
  id             uuid primary key default gen_random_uuid(),
  problema       text not null,
  solucion       text not null,
  estado         text not null default 'aprobada',   -- 'aprobada' | 'descartada'
  veces_util     int  not null default 1,
  origen_slug    text,
  revisada       boolean not null default false,
  creada_at      timestamptz not null default now(),
  actualizada_at timestamptz not null default now()
);

alter table quino_aprendizaje enable row level security;
-- (sin policies: solo service_role, que ignora RLS, puede acceder)

create index if not exists idx_quino_aprendizaje_uso
  on quino_aprendizaje (estado, veces_util desc, actualizada_at desc);
