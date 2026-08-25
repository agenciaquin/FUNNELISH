-- mt-17: barra de uso "cuánto lleva / cuánto le queda" por cada IA gratis.
-- Guarda el límite y lo restante que reporta cada proveedor + nuestro contador del día.
alter table ai_integraciones add column if not exists rl_limite         integer;
alter table ai_integraciones add column if not exists rl_restante       integer;
alter table ai_integraciones add column if not exists rl_unidad         text;      -- 'tokens' | 'solicitudes'
alter table ai_integraciones add column if not exists rl_reset_at       timestamptz;
alter table ai_integraciones add column if not exists rl_fuente         text;      -- 'meta' (lo reporta la IA) | 'contado' (lo contamos nosotros)
alter table ai_integraciones add column if not exists uso_hoy           integer not null default 0;
alter table ai_integraciones add column if not exists uso_dia           date;
alter table ai_integraciones add column if not exists rl_actualizado_at timestamptz;
