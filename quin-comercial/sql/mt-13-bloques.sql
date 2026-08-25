-- Fase: Constructor por bloques del embudo (foto / video / texto / botón).
-- Guarda una lista ordenada de bloques de contenido que se muestran ARRIBA
-- del producto en la página de venta. Formato: JSON [{id,tipo,...}].
alter table funnels add column if not exists bloques jsonb not null default '[]'::jsonb;
