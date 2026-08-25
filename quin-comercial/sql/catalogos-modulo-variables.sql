-- ============================================================================
-- MÓDULO CATÁLOGOS CON VARIABLES  (aditivo — NO rompe el bot actual)
--   · Tablas nuevas: catalogo_variables (biblioteca) y catalogo_categorias.
--   · Columnas nuevas en catalogos_bot (categoría, columnas, fotos de portada,
--     eliminado_at para la papelera) y en catalogo_colores (variante jsonb con
--     toda la selección de la fila + url_original de la foto).
--   · El bot sigue leyendo EXACTAMENTE lo mismo que hoy: familia, patron,
--     anuncios, mensaje_bienvenida, llamado_accion, usar_entrenamiento, activo,
--     y de catalogo_colores: color, nombre_producto, url_imagen. Nada se toca.
-- Segura de correr varias veces (IF NOT EXISTS). No borra datos.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Biblioteca maestra de variables (Color, Talla, Género, Sabor, …)
create table if not exists catalogo_variables (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text,
  nombre       text not null,
  icono        text,
  con_color    boolean default false,   -- las opciones tienen color (muestrario)
  no_repite    boolean default false,   -- no se repite entre filas (ej. Color)
  opciones     jsonb   default '[]'::jsonb,  -- [{ nm, hex? }]
  orden        int     default 0,
  activo       boolean default true,    -- false = en la papelera
  eliminado_at timestamptz,
  created_at   timestamptz default now()
);
create index if not exists catalogo_variables_tenant_idx on catalogo_variables(tenant_id);

-- Categorías: plantillas de columnas para no armar cada producto desde cero.
create table if not exists catalogo_categorias (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    text,
  nombre       text not null,
  columnas     jsonb   default '[]'::jsonb,  -- [ variableId, ... ]
  activo       boolean default true,
  eliminado_at timestamptz,
  created_at   timestamptz default now()
);
create index if not exists catalogo_categorias_tenant_idx on catalogo_categorias(tenant_id);

-- Producto (catalogos_bot): categoría elegida, config de columnas y fotos de portada.
alter table catalogos_bot add column if not exists categoria_id  uuid;
alter table catalogos_bot add column if not exists columnas      jsonb default '[]'::jsonb;
alter table catalogos_bot add column if not exists fotos_portada jsonb default '[]'::jsonb;
alter table catalogos_bot add column if not exists eliminado_at  timestamptz;

-- Variante (catalogo_colores): la selección completa de la fila + copia limpia de la foto.
alter table catalogo_colores add column if not exists variante     jsonb default '{}'::jsonb;
alter table catalogo_colores add column if not exists url_original text;
