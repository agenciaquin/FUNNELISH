-- Plantillas de EMBUDO + diseño por bloques (layout). Single-tenant.
-- Ojo: la tabla `plantillas` (sin sufijo) es de las plantillas de WhatsApp; por eso
-- aquí se usa `plantillas_embudo`, para no chocar.

-- 1) Cada embudo puede guardar su propio diseño por bloques. Si es null, la
--    página usa el orden de siempre (retrocompatible).
alter table funnels add column if not exists layout jsonb;

-- 2) Plantillas de embudo reutilizables.
--    tipo 'diseno'   -> solo el diseño (bloques/orden/estilo) para reusar.
--    tipo 'completa' -> un embudo completo (con fotos/precio) para duplicar.
create table if not exists plantillas_embudo (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  categoria  text,
  tipo       text not null default 'diseno',
  layout     jsonb,
  datos      jsonb,
  thumb      text,
  creado_at  timestamptz not null default now()
);

create index if not exists plantillas_embudo_creado_idx on plantillas_embudo (creado_at desc);

-- Sin este grant, el servidor da "permission denied for table plantillas_embudo".
grant all on table plantillas_embudo to service_role;
