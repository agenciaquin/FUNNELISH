-- mt-20: catálogo con llamado a la acción (CTA) + opción de usar el entrenamiento.
-- llamado_accion: mensaje corto que se envía DESPUÉS de las fotos ("me envías el
--   modelo y color que deseas adquirir").
-- usar_entrenamiento: si es TRUE, este catálogo NO usa su propio mensaje de
--   precios; el bot responde con la IA tomando precios y mensaje del entrenamiento.
alter table catalogos_bot add column if not exists llamado_accion     text;
alter table catalogos_bot add column if not exists usar_entrenamiento boolean default false;
