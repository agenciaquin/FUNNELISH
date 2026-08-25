-- mt-29: carritos abandonados. Cuando alguien empieza el checkout (escribe
-- nombre + teléfono) pero no termina de comprar, se guarda aquí para que el
-- dueño pueda recuperarlo (escribirle por WhatsApp). Un registro por
-- (empresa, embudo, teléfono): se va actualizando mientras llena el formulario.
create table if not exists carritos_abandonados (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid,
  slug          text,
  telefono      text not null,
  nombre        text,
  producto      text,
  talla         text,
  valor         numeric,
  recuperado    boolean not null default false,   -- ya lo contactó el dueño
  recuperado_at timestamptz,
  notificado_at timestamptz,                       -- ya se le avisó al dueño
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- Un carrito por empresa/embudo/teléfono (se actualiza, no se duplica).
create unique index if not exists carritos_uniq on carritos_abandonados (tenant_id, slug, telefono);
create index if not exists carritos_tenant_idx on carritos_abandonados (tenant_id, recuperado, created_at desc);
