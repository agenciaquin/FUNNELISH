-- ============================================================
-- Foto del producto PEGADA al pedido.
-- La confirmación (al cliente y la ficha al admin) usa esta foto,
-- que se actualiza cada vez que se define o cambia el producto/color.
-- Así la foto SIEMPRE coincide con el "Nombre del Producto" del pedido.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

alter table public.clientes_funnelish
  add column if not exists foto_producto text;
