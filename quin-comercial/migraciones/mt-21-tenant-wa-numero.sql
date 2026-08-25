-- mt-21: guardar el número visible del bot (display_phone_number) por empresa.
-- Se llena solo, tomándolo de cada mensaje entrante de WhatsApp (value.metadata),
-- así el panel lo muestra sin pedir permisos extra a Meta.
alter table tenants add column if not exists wa_numero text;
