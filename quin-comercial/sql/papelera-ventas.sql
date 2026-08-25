-- ============================================================
-- Papelera de ventas (borrado suave, 30 días).
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.clientes_funnelish
  add column if not exists papelera_at timestamptz;

create index if not exists idx_cf_papelera on public.clientes_funnelish (papelera_at);
