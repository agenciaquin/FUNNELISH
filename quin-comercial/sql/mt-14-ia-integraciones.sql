-- IA multi-proveedor (BYOK) + respaldo con IA de agencia.
create table if not exists ai_integraciones (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  proveedor       text not null,            -- gemini | groq | cerebras | mistral | openrouter | github | openai | anthropic
  api_key_cifrada text not null,
  modelo          text,
  prioridad       int  not null default 1,  -- orden de failover (menor primero)
  activo          boolean not null default true,
  estado          text not null default 'activa', -- activa | agotada | error
  enfriada_hasta  timestamptz,              -- si está agotada, hasta cuándo se salta
  ultimo_ok       timestamptz,
  creado_at       timestamptz not null default now(),
  unique (tenant_id, proveedor)
);
alter table ai_integraciones enable row level security;  -- sin policies: solo service_role
create index if not exists idx_ia_tenant on ai_integraciones (tenant_id, prioridad);

-- Config de respaldo por empresa: creditos (default) | siempre | apagado
alter table tenants add column if not exists ia_respaldo text not null default 'creditos';
-- Marca para cobrar 1 crédito la primera vez que una conversación usa la IA de agencia
alter table conversations add column if not exists cobrada_agencia boolean not null default false;
