-- ============================================================================
-- GUÍAS EFFI: guarda por cliente la guía y el estado del envío que subes en el
-- Excel de Effi, y recuerda cuál fue el ÚLTIMO estado avisado por WhatsApp para
-- no repetir el mismo aviso (solo avisa cuando el estado cambia).
--
-- Segura de correr varias veces (IF NOT EXISTS). No borra datos.
-- ============================================================================

create table if not exists guias_effi (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  telefono          text not null,             -- 10 dígitos
  guia              text,                       -- número de guía (solo dígitos)
  nombre            text,
  estado_raw        text,                       -- estado tal cual lo trae Effi
  estado            text,                       -- normalizado: despachado/reparto/oficina/…
  estado_notificado text,                       -- último estado que SÍ se le avisó al cliente
  notificado_at     timestamptz,
  updated_at        timestamptz default now(),
  created_at        timestamptz default now()
);

-- Un registro por (tenant, teléfono, guía). El upsert se apoya en este índice.
create unique index if not exists guias_effi_uq
  on guias_effi (tenant_id, telefono, guia);

create index if not exists guias_effi_tel_idx
  on guias_effi (tenant_id, telefono);
