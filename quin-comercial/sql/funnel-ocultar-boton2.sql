-- Oculta el SEGUNDO botón "COMPRAR CONTRA ENTREGA" (el de abajo, después de las
-- estrellas) en la página de venta. Por defecto los dos botones se muestran.
--   false / null = se muestran los dos botones (como siempre).
--   true         = solo se muestra el primer botón; el segundo queda oculto.
alter table funnels add column if not exists ocultar_boton2 boolean default false;

comment on column funnels.ocultar_boton2 is
  'true = oculta el segundo botón COMPRAR (el de abajo) en la landing. false/null = se muestran los dos.';
