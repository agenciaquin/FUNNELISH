-- ============================================================
-- Apagar el bot 30 min después de marcar VENTA REALIZADA.
-- Guarda la hora de la venta en cada conversación.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.conversations
  add column if not exists vendido_at timestamptz;

create index if not exists idx_conv_vendido_at on public.conversations (vendido_at);
