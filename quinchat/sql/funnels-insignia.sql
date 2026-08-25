-- Insignia flotante "MÁS VENDIDO 🔥" por embudo (posición fija que define el admin).
-- Idempotente: se puede correr varias veces.
alter table funnels add column if not exists insignia jsonb;
