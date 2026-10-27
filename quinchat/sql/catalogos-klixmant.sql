-- ════════════════════════════════════════════════════════════
-- CATÁLOGOS DE KLIXMANT EN EL BOT — copia local del contrato
-- CONTRATO-API-CATALOGOS.md §5 (27-oct-2026).
--
-- El bot NO crea catálogos: estas tablas son una copia de lo que entrega
-- el reporte en /api/v1/catalogos y /api/v1/catalogos/variantes. Se llenan
-- una vez al día y con el botón «Actualizar catálogos». En la conversación
-- el bot lee solo estas tablas, nunca al reporte.
--
-- Solo las lee y escribe el servidor del bot (clave de servicio). El
-- navegador y los usuarios anónimos no tienen ningún permiso.
--
-- Antes de pegarlo: lo revisa el guardián. Lo pega el dueño en el SQL Editor
-- del Supabase del bot. Es aditivo: no cambia ni borra nada que exista.
-- ════════════════════════════════════════════════════════════

-- Un catálogo de Klixmant. id = id_catalogo de Klixmant (la llave de todo).
create table if not exists klixmant_catalogos (
  id          integer primary key check (id > 0),
  nombre      text not null check (char_length(nombre) between 1 and 80),
  categoria   text not null check (char_length(categoria) between 1 and 80),
  reflectivo  boolean not null default false,
  colores     text[] not null default '{}',
  tipos       text[] not null default '{}',
  foto        text check (foto is null or foto like 'https://pqcqeywhduryaoehleuh.supabase.co/storage/v1/object/public/klixmant-soft/%'),
  -- false cuando deja de salir en la lista: el bot no lo ofrece, pero la fila
  -- y los pedidos viejos se conservan (nunca se borra).
  activo      boolean not null default true,
  generado    timestamptz not null,               -- el «generado» de la API
  actualizado timestamptz not null default now()  -- cuándo lo escribió el bot
);

-- Una variante (prenda + color + talla). id = el que va en «Observación concepto» de Effi.
-- La llave es (id_catalogo, id): si un mismo producto sale en dos catálogos, cada
-- copia queda en su fila y ninguna pisa a la otra.
create table if not exists klixmant_variantes (
  id          integer not null check (id > 0),
  id_catalogo integer not null references klixmant_catalogos(id),  -- sin cascade a propósito
  referencia  text check (referencia is null or char_length(referencia) <= 80),
  tipo        text check (tipo is null or char_length(tipo) <= 80),
  color       text not null check (char_length(color) between 1 and 80),  -- «Sin color» no se ofrece
  -- null si Klixmant no la trae: la fila se guarda (no tumba la copia del día) y no se ofrece.
  talla       text check (talla is null or char_length(talla) between 1 and 80),
  sku         text check (sku is null or char_length(sku) <= 80),
  foto        text check (foto is null or foto like 'https://pqcqeywhduryaoehleuh.supabase.co/storage/v1/object/public/klixmant-soft/%'),
  activo      boolean not null default true,
  actualizado timestamptz not null default now(),
  primary key (id_catalogo, id)
);

-- La llave ya sirve para buscar por catálogo; este índice es para buscar por el id de Effi.
create index if not exists idx_klixmant_variantes_id on klixmant_variantes(id);
create index if not exists idx_klixmant_catalogos_activo   on klixmant_catalogos(activo);

-- Lo del bot (precio, anuncios, palabras clave, fotos con marca de agua) se cuelga
-- del número. Puede quedar vacío mientras se vincula a mano; nunca por nombre.
-- Solo admite números que estén en la copia: hay que llenarla antes de vincular.
alter table catalogos_bot
  add column if not exists id_catalogo integer unique check (id_catalogo > 0)
    references klixmant_catalogos(id);  -- sin cascade a propósito

-- Permisos: solo el servidor (service_role, que se salta la RLS).
alter table klixmant_catalogos enable row level security;
alter table klixmant_variantes enable row level security;
revoke all on klixmant_catalogos from anon, authenticated;
revoke all on klixmant_variantes from anon, authenticated;

-- ── COMPROBACIÓN (correr después de pegar; todo debe dar lo indicado) ──
-- 1) RLS activa en las dos (t, t):
--    select relname, relrowsecurity from pg_class
--     where relname in ('klixmant_catalogos','klixmant_variantes');
-- 2) Ningún permiso para anon ni authenticated (0 filas):
--    select table_name, grantee, privilege_type from information_schema.role_table_grants
--     where table_name in ('klixmant_catalogos','klixmant_variantes')
--       and grantee in ('anon','authenticated');
-- 3) Ninguna política (0 filas):
--    select * from pg_policies where tablename in ('klixmant_catalogos','klixmant_variantes');
-- 4) La columna nueva existe y está vacía (n = 0):
--    select count(id_catalogo) as n from catalogos_bot;

-- ── REVERSA (solo si hay que deshacerlo) ──
-- OJO: borrar la columna pierde los vínculos hechos a mano. Antes, guardar esto:
--    select id, id_catalogo from catalogos_bot where id_catalogo is not null;
-- alter table catalogos_bot drop column if exists id_catalogo;
-- drop table if exists klixmant_variantes;
-- drop table if exists klixmant_catalogos;
