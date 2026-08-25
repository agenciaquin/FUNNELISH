-- ============================================================================
-- CARRITOS ABANDONADOS: datos completos (JSON) + nota privada del asesor.
--   datos jsonb → todo lo que escribió el cliente + selección + fotos elegidas.
--   nota  text  → nota interna del asesor sobre ese carrito.
-- Segura de correr varias veces (IF NOT EXISTS). No borra datos.
-- ============================================================================

ALTER TABLE carritos_abandonados ADD COLUMN IF NOT EXISTS datos jsonb;
ALTER TABLE carritos_abandonados ADD COLUMN IF NOT EXISTS nota  text;
