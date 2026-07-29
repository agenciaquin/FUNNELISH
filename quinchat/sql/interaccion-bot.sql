-- ============================================================
-- Marca "interacción con el bot": se pone en true cuando el cliente RESPONDE
-- después de que el bot ya le había escrito (o sea, hubo diálogo real). Sirve
-- para el filtro "🤖 Interacción bot" del Chat WhatsApp y hacer seguimiento.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.conversations
  add column if not exists interaccion_bot boolean not null default false;
