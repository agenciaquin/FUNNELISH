-- ════════════════════════════════════════════════════════════════════════
-- Contador de conversaciones por empresa (para estadísticas).
-- Sube +1 la primera vez que cada conversación es atendida por la IA de agencia.
-- Es acumulado: nunca baja. Sirve para ver el uso "como si se estuviera cobrando"
-- aunque el bot esté GRATIS en la fase de pruebas.
-- Correr en Supabase (confirma-ya) → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════

alter table public.tenants
  add column if not exists conversaciones_usadas integer not null default 0;
