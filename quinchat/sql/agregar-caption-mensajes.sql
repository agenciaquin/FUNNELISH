-- ============================================================
-- Pie de foto/video: guardar el texto que acompaña las imágenes y videos
-- para que se vea en el panel también después de recargar.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.messages
  add column if not exists caption text;
