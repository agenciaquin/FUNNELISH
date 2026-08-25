-- ============================================================================
-- Vínculo embudo → producto del catálogo (para leer/obedecer su stock en vivo).
--   funnels.catalogo_id = id del producto (catalogos_bot) al que está vinculado.
--   null = embudo sin vínculo (usa su propio stock / ilimitado, como antes).
-- Aditivo, seguro de correr varias veces. No borra datos.
-- ============================================================================
alter table funnels add column if not exists catalogo_id text;
