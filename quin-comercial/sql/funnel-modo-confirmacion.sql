-- Modo de confirmación por embudo.
--   'solo'   = el bot envía la confirmación del pedido y se APAGA (bot_enabled=false).
--              Si el cliente responde, lo atiende una persona. Queda "PENDIENTE POR CONFIRMACIÓN".
--   'agente' = el bot envía la confirmación y SIGUE atendiendo hasta cerrar la venta él mismo.
--   NULL     = comportamiento por defecto (igual que 'agente').
-- Es por embudo, así que solo aplica donde el cliente lo marque (empezando por Skioo).
alter table funnels add column if not exists modo_confirmacion text;

comment on column funnels.modo_confirmacion is
  'solo = bot envía la confirmación y se apaga (humano atiende); agente/null = bot confirma y cierra la venta.';
