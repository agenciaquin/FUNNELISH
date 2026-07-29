-- ============================================================
-- Seguimiento IA: reactivar leads del chat de ventas que quedaron a medias.
-- Correr en Supabase -> SQL Editor -> Run (idempotente).
-- ============================================================

alter table public.conversations
  add column if not exists seguimiento_at timestamptz;
alter table public.conversations
  add column if not exists seguimiento_n  integer not null default 0;

create index if not exists idx_conv_seguimiento on public.conversations (linea, last_message_time);
