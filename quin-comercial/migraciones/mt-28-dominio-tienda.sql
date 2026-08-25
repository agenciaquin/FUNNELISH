-- mt-28: dominio propio por tienda (empresa). Cada cliente puede conectar su
-- dominio comprado (ej. en Hostinger) para que sus embudos se vean en su marca.
-- Si no tiene, usa el dominio genérico compartido.
--   dominio        → el dominio del cliente (ej. www.mitienda.com), sin http.
--   dominio_estado → 'pendiente' (falta DNS) | 'activo' (verificado) | null.
alter table tenants add column if not exists dominio text;
alter table tenants add column if not exists dominio_estado text;
-- Búsqueda rápida por dominio al servir la tienda.
create index if not exists tenants_dominio_idx on tenants (dominio);
