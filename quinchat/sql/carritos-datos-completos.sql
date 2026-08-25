-- Carrito abandonado: guarda TODOS los datos que el cliente escribió (dirección,
-- barrio, ciudad, correo, fotos seleccionadas, etc.) y una nota privada del asesor.
-- Idempotente: se puede correr varias veces.
alter table carritos_abandonados add column if not exists datos jsonb;
alter table carritos_abandonados add column if not exists nota  text;
