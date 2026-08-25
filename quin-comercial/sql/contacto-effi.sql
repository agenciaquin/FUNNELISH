-- Marca de "mensaje enviado al cliente" en el panel Estado en Effi.
-- contacto_at = cuándo se le escribió al cliente (null = aún no).
alter table clientes_funnelish
  add column if not exists contacto_at timestamptz;

comment on column clientes_funnelish.contacto_at is
  'Cuándo se le escribió al cliente desde el panel Estado en Effi (null = no contactado).';
