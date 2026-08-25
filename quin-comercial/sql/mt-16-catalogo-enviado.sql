-- Guarda qué catálogos ya se enviaron por chat, para mandar las fotos del
-- catálogo (por patrón/palabra clave) SOLO la primera vez en cada conversación.
alter table conversations add column if not exists catalogos_enviados jsonb not null default '[]'::jsonb;
