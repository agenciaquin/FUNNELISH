-- ════════════════════════════════════════════════════════════════════════
-- MULTI-TENANT · FASE 5 (sub-bloque 6) — Clave compuesta en conversations
-- Ejecutar en confirma-ya → SQL Editor → Run.
--
-- Motivo: hoy conversations.id (el teléfono) es PK GLOBAL. Dos empresas con el
-- mismo teléfono de cliente colisionarían. La PK pasa a (tenant_id, id) y el FK
-- de messages pasa a ser compuesto. Las tablas están vacías → es seguro.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Quitar el FK viejo de messages para poder recrearlo compuesto
alter table public.messages drop constraint if exists messages_conversation_id_fkey;

-- 2. tenant_id obligatorio (es parte de la clave / del FK)
alter table public.conversations alter column tenant_id set not null;
alter table public.messages      alter column tenant_id set not null;

-- 3. PK compuesta en conversations: (tenant_id, id)
alter table public.conversations drop constraint if exists conversations_pkey;
alter table public.conversations add  constraint conversations_pkey primary key (tenant_id, id);

-- 4. FK compuesto en messages → conversations(tenant_id, id)
alter table public.messages
  add constraint messages_conversation_id_fkey
  foreign key (tenant_id, conversation_id)
  references public.conversations(tenant_id, id) on delete cascade;

-- 5. Índice para el lado que referencia (ayuda al borrado en cascada)
create index if not exists messages_tenant_conv_idx
  on public.messages (tenant_id, conversation_id);
