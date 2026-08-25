-- Fase 2: Plantillas de embudo
-- Marca qué embudos son plantillas (visibles para todos los clientes).
alter table funnels add column if not exists es_plantilla boolean default false;

-- Índice para listar plantillas rápido
create index if not exists idx_funnels_es_plantilla on funnels (es_plantilla) where es_plantilla = true;
