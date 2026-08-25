-- ════════════════════════════════════════════════════════════════════════
-- Plantillas de conocimiento: dueño por empresa.
--   tenant_id NULL  → plantilla BASE (de la agencia). Solo el super-admin la
--                     crea/edita/borra. Todos los clientes la ven y la pueden
--                     USAR o DUPLICAR (la copia queda con su tenant_id).
--   tenant_id = X    → plantilla propia de esa empresa. Solo ella la edita.
-- Correr en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════

alter table public.plantillas_conocimiento
  add column if not exists tenant_id uuid;
