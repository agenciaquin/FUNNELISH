-- mt-27: número de WhatsApp del DUEÑO de cada empresa. Es donde el bot envía
-- los avisos de venta y las solicitudes de traspaso a un humano. Se vincula
-- desde el panel (Chats → tarjeta "Mi WhatsApp"). Si está vacío, los avisos van
-- a los números de respaldo de la agencia (para no perder nada durante el setup).
alter table tenants add column if not exists wa_numero_dueno text;
