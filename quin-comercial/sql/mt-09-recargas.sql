-- ============================================================
-- Recargas de conversaciones (modelo prepago, estilo SellerChat).
-- Crédito por empresa + historial de recargas. Solo service_role.
-- ============================================================

-- Saldo de conversaciones por empresa
alter table tenants add column if not exists creditos      int not null default 0;
-- Referencia para la barra de cuota (saldo tras la última recarga)
alter table tenants add column if not exists creditos_tope int not null default 0;

create table if not exists recargas (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  cantidad         int not null,               -- conversaciones compradas
  monto            numeric not null,           -- COP
  estado           text not null default 'pendiente',  -- pendiente | aprobada | rechazada
  mp_preference_id text,
  mp_payment_id    text,
  creado_at        timestamptz not null default now(),
  aprobada_at      timestamptz
);

alter table recargas enable row level security;   -- sin policies: solo service_role
create index if not exists idx_recargas_tenant on recargas (tenant_id, creado_at desc);
