-- Bandera para filtrar conversaciones cuyo último mensaje NO se pudo entregar.
-- El webhook la pone en true cuando WhatsApp reporta un envío fallido, y la
-- vuelve a false cuando un mensaje sí se entrega/lee o cuando el cliente escribe.
alter table conversations
  add column if not exists entrega_fallida boolean not null default false;

-- Índice para que el filtro "No entregado" sea rápido.
create index if not exists idx_conversations_entrega_fallida
  on conversations (entrega_fallida)
  where entrega_fallida = true;
