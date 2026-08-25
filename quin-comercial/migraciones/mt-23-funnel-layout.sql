-- mt-23: editor "todo es un bloque". La página del embudo se puede guardar como
-- una lista ordenada de bloques (layout). Si un embudo NO tiene layout, la página
-- pública se dibuja como siempre (respaldo) — así no se toca nada de lo que ya vende.
alter table funnels add column if not exists layout jsonb;
