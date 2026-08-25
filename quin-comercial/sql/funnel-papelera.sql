-- ============================================================================
-- PAPELERA DE EMBUDOS: al "eliminar" un embudo NO se borra de una; queda marcado
-- como eliminado (papelera). Desde la papelera se puede RESTAURAR o ELIMINAR
-- DEFINITIVAMENTE (ahí sí se borra de verdad de la base de datos).
--
-- Segura de correr varias veces (IF NOT EXISTS). No borra datos.
-- ============================================================================

ALTER TABLE funnels ADD COLUMN IF NOT EXISTS eliminado    boolean NOT NULL DEFAULT false;
ALTER TABLE funnels ADD COLUMN IF NOT EXISTS eliminado_at timestamptz;

CREATE INDEX IF NOT EXISTS funnels_eliminado_idx ON funnels (tenant_id, eliminado);
