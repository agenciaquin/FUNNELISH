-- ============================================================================
-- ETIQUETAS: soporte para "estados del pedido" editables desde el panel de chat.
--
-- Agrega dos columnas a la tabla `etiquetas`:
--   • es_estado : true  = ESTADO del pedido (uno solo a la vez; poner uno
--                          reemplaza al anterior en la conversación).
--                 false = etiqueta ADICIONAL (se suma encima del estado).
--   • base_id   : cuando el cliente PERSONALIZA (renombra/recolorea) una
--                 etiqueta por defecto, aquí queda el id de la fija que
--                 reemplaza (ej. 'procesado'). null = etiqueta nueva del cliente.
--
-- Es seguro correrla varias veces (IF NOT EXISTS). No borra ni cambia datos.
-- ============================================================================

ALTER TABLE etiquetas ADD COLUMN IF NOT EXISTS es_estado boolean NOT NULL DEFAULT false;
ALTER TABLE etiquetas ADD COLUMN IF NOT EXISTS base_id   text;

-- Para buscar rápido la personalización de una etiqueta por defecto por tenant.
CREATE INDEX IF NOT EXISTS etiquetas_base_id_idx ON etiquetas (tenant_id, base_id);
