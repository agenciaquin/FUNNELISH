-- mt-18: biblioteca de "Plantillas de Conocimiento" (cerebros reutilizables por producto).
-- Es GLOBAL (de la agencia): una plantilla se aplica al bot de cualquier cliente.
-- El acceso va por /api/plantillas con service_role, por eso no necesita RLS por tenant.
create table if not exists plantillas_conocimiento (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  contenido   text not null,
  campos      jsonb not null default '[]'::jsonb,
  origen      text not null default 'usuario',  -- 'sistema' (semilla) | 'usuario' (creada en el panel)
  creado_at   timestamptz not null default now()
);
