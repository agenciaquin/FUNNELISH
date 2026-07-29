-- ============================================================
-- Ficha de venta con período de gracia (idea 1).
-- La ficha "VENTA CONFIRMADA — FUNNEL" se envía ~5 min después de confirmar,
-- para que los cambios de último minuto (color/talla) queden reflejados.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.clientes_funnelish
  add column if not exists registro_at timestamptz;
alter table public.clientes_funnelish
  add column if not exists registro_enviado boolean not null default false;

create index if not exists idx_cf_registro on public.clientes_funnelish (registro_enviado, registro_at);
