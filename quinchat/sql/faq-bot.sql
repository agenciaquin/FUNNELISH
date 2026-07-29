-- ════════════════════════════════════════════════════════════════════════
-- BASE DE PREGUNTAS FRECUENTES (FAQ) del bot de ventas.
-- El bot guarda automáticamente lo que preguntan los clientes + su respuesta.
-- Nada se usa hasta que el dueño lo APRUEBA (igual que la memoria).
-- Más adelante, las aprobadas se responderán directo (sin gastar IA).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists faq_bot (
  id              uuid primary key default gen_random_uuid(),
  pregunta        text not null,               -- pregunta tal como llegó
  pregunta_norm   text not null,               -- normalizada (para no duplicar)
  respuesta       text not null,               -- respuesta que dio el bot
  categoria       text default 'Otros',
  estado          text not null default 'propuesta', -- propuesta | aprobada | descartada
  veces           int  not null default 1,     -- cuántas veces la han preguntado
  ejemplo         text,                         -- fragmento/chat que la originó
  conversacion_id text,
  creada_at       timestamptz not null default now(),
  aprobada_at     timestamptz
);

create index if not exists faq_bot_estado_idx  on faq_bot (estado);
create index if not exists faq_bot_norm_idx     on faq_bot (pregunta_norm);
create index if not exists faq_bot_veces_idx    on faq_bot (veces desc);

comment on table faq_bot is
  'Preguntas frecuentes de clientes + respuesta. El dueño aprueba cuáles se guardan.';
