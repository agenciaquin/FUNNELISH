-- ============================================================
-- Promo de cierre (chat de VENTAS): descuento de $10.000 antes de que se
-- cierre la ventana de 24h. Esta columna marca a quién ya se le envió, para
-- no repetirla, y sirve para que el bot aplique el descuento si el cliente
-- responde dentro de las 24h siguientes.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.conversations
  add column if not exists promo_cierre_at timestamptz;
