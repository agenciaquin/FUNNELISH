-- Segunda versión (BORRADOR) de la página del embudo.
-- Guarda la "versión nueva" que se arma en blanco desde el editor, aparte de la
-- versión actual (columna `layout`). No se publica: la página pública sigue
-- usando `layout`. Aditivo y opcional: si no se corre, el editor guarda igual
-- sin la versión nueva (fallback por columna en /api/funnels).
alter table funnels add column if not exists layout_borrador jsonb;
