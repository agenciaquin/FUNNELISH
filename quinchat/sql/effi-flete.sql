-- ============================================================
-- Effi: guardar el flete de cada guía (para la utilidad neta por campaña).
-- El estado ahora es el real: entregada / en_camino / devuelta / novedad / anulada.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.effi_guias
  add column if not exists flete integer not null default 0;
