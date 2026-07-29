-- ============================================================
-- Motivo de anulación de Effi. Se muestra en rojo en las ventas anuladas
-- del panel "Estado en Effi", para saber por qué la anularon.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.effi_guias
  add column if not exists motivo text;
