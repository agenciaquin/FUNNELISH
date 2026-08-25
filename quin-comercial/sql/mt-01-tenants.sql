-- ════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT · FASE 1 — Registro de clientes (tenants) y usuarios
-- Ejecutar en la base COMERCIAL (confirma-ya) → SQL Editor → Run.
-- Es el cimiento: cada empresa cliente vive aquí, con su WhatsApp y su login.
-- ════════════════════════════════════════════════════════════════════════

-- 1. TENANTS = cada empresa que usa la app
create table if not exists tenants (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,                 -- nombre del negocio (ej. "Klixmant")
  slug         text unique not null,          -- identificador corto (ej. "klixmant")
  activo       boolean not null default true,

  -- WhatsApp del cliente (antes iban en variables de entorno; ahora por cliente)
  wa_phone_number_id        text,   -- línea principal / funnel
  wa_phone_number_id_ventas text,   -- línea de ventas (si tiene 2)
  wa_access_token           text,
  wa_waba_id                text,
  wa_app_id                 text,
  wa_verify_token           text,

  -- Config del bot por cliente (personalidad, ajustes, defaults)
  config       jsonb not null default '{}'::jsonb,

  creado_at    timestamptz not null default now()
);

-- Índices para enrutar los WhatsApp entrantes al cliente correcto
create index if not exists tenants_wa_pnid_idx        on tenants (wa_phone_number_id);
create index if not exists tenants_wa_pnid_ventas_idx on tenants (wa_phone_number_id_ventas);

-- 2. USUARIOS = quién entra al panel de cada cliente (login por empresa)
create table if not exists usuarios (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  email      text unique not null,
  password   text not null,             -- por ahora texto plano; luego se cifra (hash)
  nombre     text default '',
  rol        text default 'admin',      -- admin | vendedor | soporte…
  creado_at  timestamptz not null default now()
);
create index if not exists usuarios_tenant_idx on usuarios (tenant_id);

-- 3. Un tenant de PRUEBA para arrancar (tú, como primer cliente de demo)
insert into tenants (nombre, slug)
values ('Demo Quin', 'demo')
on conflict (slug) do nothing;

comment on table tenants  is 'Cada empresa cliente de la app comercial (multi-tenant).';
comment on table usuarios is 'Usuarios de login, cada uno pertenece a un tenant.';
