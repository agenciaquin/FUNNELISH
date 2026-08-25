-- mt-23: pasos granulares del embudo + carritos abandonados.
--
-- 1) funnel_eventos.paso ahora admite más pasos (es texto libre, no hay que
--    cambiar la tabla). Los nuevos pasos son:
--      landing → página de venta
--      scroll_fin → bajó hasta el final de la página (vio el collage/todo)
--      pedido → abrió el formulario
--      talla → eligió talla/color
--      datos → escribió nombre y WhatsApp
--      boton → tocó el botón "Completar pedido"
--      compra → terminó el pedido (página de gracias)

-- 2) Carritos abandonados: cuando el cliente escribe su nombre y teléfono pero
--    NO completa la compra, queda aquí para recuperar la venta llamándolo.
create table if not exists carritos_abandonados (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid,
  slug         text not null,
  nombre       text,
  telefono     text not null,
  producto     text,
  talla        text,
  valor        numeric,
  recuperado   boolean not null default false,   -- ya lo llamé/recuperé
  recuperado_at timestamptz,
  notificado_at timestamptz,                      -- ya se avisó (al cliente/Lilibeth) para no repetir
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Un carrito por teléfono + embudo (se va actualizando mientras llena el form).
create unique index if not exists carritos_abandonados_uniq
  on carritos_abandonados (tenant_id, slug, telefono);

create index if not exists carritos_abandonados_tenant_idx
  on carritos_abandonados (tenant_id, recuperado, created_at desc);

grant all on carritos_abandonados to service_role;
