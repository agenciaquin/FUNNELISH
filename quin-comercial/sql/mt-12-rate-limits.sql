-- Rate limiting con la base de datos (login, recargas). Solo service_role.
create table if not exists rate_limits (
  id        uuid primary key default gen_random_uuid(),
  clave     text not null,
  creado_at timestamptz not null default now()
);
alter table rate_limits enable row level security;
create index if not exists idx_rate_limits on rate_limits (clave, creado_at);
