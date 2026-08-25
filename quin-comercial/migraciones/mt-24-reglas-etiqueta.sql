-- mt-24: reglas de etiquetas automáticas por empresa.
-- Cada empresa define, en lenguaje natural (hablando con Quino) o desde el panel,
-- cuándo el bot debe marcar una etiqueta. Ej: "cuando el cliente confirme el
-- pedido y dé sus datos → VENTA REALIZADA".
create table if not exists reglas_etiqueta (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid,
  condicion  text not null,   -- "el cliente confirmó el pedido y dio su dirección"
  etiqueta   text not null,   -- "VENTA REALIZADA"
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists reglas_etiqueta_tenant_idx on reglas_etiqueta (tenant_id, activo);
