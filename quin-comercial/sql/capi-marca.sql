-- ============================================================
-- CAPI: marca de cuándo se envió la venta a Meta (para no duplicar).
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.conversations
  add column if not exists capi_enviado_at timestamptz;
