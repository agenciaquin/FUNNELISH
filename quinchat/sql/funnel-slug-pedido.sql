-- Guarda de qué EMBUDO (slug) vino cada pedido, para atribución exacta en el panel.
-- Idempotente: se puede correr varias veces sin romper nada.
alter table clientes_funnelish add column if not exists funnel_slug text;

-- (Opcional) índice para filtrar/agrupar ventas por embudo más rápido.
create index if not exists idx_clientes_funnelish_funnel_slug
  on clientes_funnelish (funnel_slug);
