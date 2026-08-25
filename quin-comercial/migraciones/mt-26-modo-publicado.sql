-- mt-26: cada embudo puede tener DOS versiones editables (crear de cero = bloques,
-- o plantilla recomendada = clásico). `modo_publicado` decide cuál se muestra en la
-- página pública, sin borrar la otra (reversible).
--   'cero'      → se publica la versión de bloques (layout)
--   'plantilla' → se publica la versión clásica (campos del embudo)
--   null        → comportamiento anterior (layout si existe, si no clásico)
alter table funnels add column if not exists modo_publicado text;
