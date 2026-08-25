-- Cantidad de prendas por pedido (un PACK X2 son 2, PACK X3 son 3, etc.).
-- La usa el monedero de "Tus metas" para sumar bien los packs.
alter table clientes_funnelish
  add column if not exists cantidad int not null default 1;

-- Rellena los pedidos viejos: si el nombre del producto trae "PACK X2"/"PACK X3"
-- o "2 COLORES"/"3 COLORES", pone la cantidad correcta; el resto queda en 1.
update clientes_funnelish
set cantidad = case
  when producto ~* 'PACK\s*X?\s*3' or producto ~* '\b(TRES|3)\s+COLORES\b' then 3
  when producto ~* 'PACK\s*X?\s*2' or producto ~* '\b(DOS|2)\s+COLORES\b'  then 2
  else 1
end
where cantidad = 1;
