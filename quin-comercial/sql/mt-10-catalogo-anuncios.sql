-- Fecha por cada ID de anuncio (para saber cuál es el más viejo) + mensaje de
-- bienvenida con precios por catálogo (lo que el bot envía a quien llega por ese anuncio).
alter table catalogos_bot add column if not exists anuncios_fechas    jsonb default '{}'::jsonb;
alter table catalogos_bot add column if not exists mensaje_bienvenida text;
