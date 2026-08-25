-- ============================================================================
-- VENTAS POR EMBUDO: guarda en cada pedido el embudo (slug) del que entró,
-- para poder contar cuántas ventas trae cada embudo y filtrar por fecha.
--
-- Es seguro correrla varias veces (IF NOT EXISTS). No borra ni cambia datos.
-- Los pedidos viejos quedan con funnel_slug vacío (el contador empieza a sumar
-- desde que se despliega el cambio que llena esta columna).
-- ============================================================================

ALTER TABLE clientes_funnelish ADD COLUMN IF NOT EXISTS funnel_slug text;

-- Para agrupar rápido las ventas por embudo y tenant dentro de un rango de fechas.
CREATE INDEX IF NOT EXISTS clientes_funnelish_funnel_slug_idx
  ON clientes_funnelish (tenant_id, funnel_slug, created_at);
