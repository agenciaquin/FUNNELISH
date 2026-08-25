-- ============================================================================
-- STOCK por variante (color/talla) del catálogo.
--   catalogo_colores.stock int          → unidades disponibles de esa variante.
--   catalogo_colores.stock_politica text → qué pasa al llegar a 0:
--        'bloquear' = no se puede elegir para la venta · 'seguir' = se sigue vendiendo.
--   catalogos_bot.stock_activo boolean   → si el producto controla stock (opcional).
--        false/null = ilimitado: se vende todo (comportamiento por defecto).
--   catalogos_bot.stock_aviso int        → avisar en rojo cuando una variante quede
--        en esta cantidad o menos (umbral de stock bajo).
-- Aditivo, seguro de correr varias veces. No borra datos.
-- ============================================================================
alter table catalogo_colores add column if not exists stock int;
alter table catalogo_colores add column if not exists stock_politica text;
-- stock_tallas: unidades por talla, ej. {"S":50,"M":25}. Si existe, stock = suma.
alter table catalogo_colores add column if not exists stock_tallas jsonb;

alter table catalogos_bot add column if not exists stock_activo boolean default false;
alter table catalogos_bot add column if not exists stock_aviso int;
-- stock_vid: id de la variable por la que se cuentan las unidades (ej. Talla). null = total por variante.
alter table catalogos_bot add column if not exists stock_vid text;
