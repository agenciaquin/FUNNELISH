-- Tipo de etiqueta: 'estado' (una sola a la vez, reemplaza) o 'adicional' (se suma).
-- Lo elige el usuario al crear la etiqueta en la sección Etiquetas.
alter table etiquetas
  add column if not exists tipo text not null default 'adicional';

-- Las predeterminadas que son ESTADOS del pedido quedan marcadas como 'estado'.
update etiquetas
set tipo = 'estado'
where upper(nombre) in (
  'PENDIENTE POR CONFIRMACIÓN', 'VENTA REALIZADA', 'ABONO POR VERIFICAR',
  'ANULADO EN EFFI', 'PEDIDO PROGRAMADO', 'PEDIDO CANCELADO'
);
