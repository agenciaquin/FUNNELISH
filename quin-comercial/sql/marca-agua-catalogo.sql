-- Guarda la foto ORIGINAL (sin marca) de cada color, para poder re-estampar
-- el nombre si más adelante lo cambias (si no, quedaría el nombre viejo pegado).
alter table catalogo_colores
  add column if not exists url_original text;

comment on column catalogo_colores.url_original is
  'Foto original sin marca de agua. url_imagen guarda la versión con el nombre estampado.';
