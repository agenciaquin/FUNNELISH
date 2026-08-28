-- Pie de página editable por embudo: nombre de la empresa que aparece abajo de
-- la página de venta (cada cliente pone el suyo, ya no queda fijo "Klixmant SAS").
-- Aditivo y retrocompatible: si está vacío, la página muestra solo
-- "Pago contra entrega en toda Colombia".
alter table funnels add column if not exists pie_empresa text;
