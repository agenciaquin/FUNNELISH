-- Papelera (borrado suave) para los embudos. Idempotente: se puede correr varias veces.
alter table funnels add column if not exists eliminado    boolean not null default false;
alter table funnels add column if not exists eliminado_at  timestamptz;

-- Índice para filtrar rápido activos vs. papelera.
create index if not exists funnels_eliminado_idx on funnels (eliminado, creado_at desc);
