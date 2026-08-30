-- FASE 1 — Cerrar las tablas de `quinchat` que tienen permisos para `anon`
-- pero que NINGUN cliente usa.
--
-- Proyecto: quinchat (bjbjqmbuzpyjvcugbusx)
-- Foto previa: sql/salidas/000_foto_previa_2026-08-29.md
-- Rollback: 002_rollback_revocar.sql
--
-- REVISADO EL 2026-08-29 contra los logs reales. Respecto a la primera version
-- de este script salen dos tablas, `clientes_funnelish` y `bot_config`: las lee
-- el navegador y revocarlas rompia el panel. Ver "LO QUE NO ENTRA" abajo.
--
-- POR QUE ES SEGURO
-- ----------------
-- En 24 h de logs, de ~15.000 peticiones a /rest/v1/, TODO el trafico anonimo
-- se concentra en cuatro rutas:
--
--   /rest/v1/conversations         GET    855   200
--   /rest/v1/messages              GET    430   200
--   /rest/v1/conversations         PATCH   43   204
--   /rest/v1/clientes_funnelish    GET      3   200
--
-- Ninguna de las tablas de este script recibe una sola peticion anonima. Todo
-- lo que las toca es `service_role` desde el servidor Node, y `service_role`
-- ignora tanto los GRANT como el RLS: no se entera del cambio.
--
-- SOBRE `authenticated`
-- --------------------
-- Se revoca tambien a `authenticated`. En 24 h no hay ni una peticion con ese
-- rol: las 1.324 del panel llevan un Authorization que Supabase rechaza como
-- "Not a JWT, invalid structure" y se resuelven como `anon`. El token que emite
-- NextAuth no es un JWT valido. Mientras eso siga asi, `authenticated` no lo
-- usa nadie; y si algun dia se arregla, conviene que no herede estos permisos.
--
-- LIMITE CONOCIDO
-- ---------------
-- La ventana de logs de Supabase es de 24 h. Un proceso semanal o quincenal que
-- usara la clave anonima contra alguna de estas tablas no habria aparecido.
-- Tras aplicar, vigilar los 401/403 un par de dias con 003_verificacion.sql.

begin;

revoke select, insert, update, delete on table
    public.campanas_gasto,
    public.catalogo_colores,
    public.catalogos_bot,
    public.configuracion,
    public.effi_guias,
    public.faq_bot,
    public.memoria_bot,
    public.objeciones_analisis,
    public.push_subscriptions,
    public.vendedor_preguntas,
    public.vendedor_reportes
from anon, authenticated;

-- `funnels` solo tenia SELECT. Sus 2.274 GET diarios son todos de service_role;
-- el navegador no la toca.
revoke select on table public.funnels from anon, authenticated;

-- `plantillas` tiene RLS activado, asi que el linter la da por protegida, pero
-- su unica policy es `ALL a public USING (true) WITH CHECK (true)`: no protege
-- nada y genera falsa confianza. Es inerte de todos modos, porque anon y
-- authenticated no tienen ningun grant sobre la tabla. Se borra por higiene.
drop policy if exists "Permitir todo en plantillas" on public.plantillas;

commit;


-- LO QUE NO ENTRA, Y POR QUE
--
-- `clientes_funnelish` — 3 GET anonimos con 200 en las ultimas 24 h, desde
--     components/panel/ChatArea.tsx, EstadisticasPanel.tsx y MunicipiosPanel.tsx.
--     Revocarla rompe el panel hoy mismo. Va en la fase 2.
--
-- `bot_config` — cero trafico en la ventana de 24 h, pero
--     components/panel/EntrenamientoPanel.tsx la lee desde el navegador. Es un
--     panel de uso esporadico: la ventana de logs no lo capturo. Ademas tiene
--     RLS activado y su policy `allow_all` es la unica via de acceso, asi que
--     borrarla la cerraria incluso restaurando los grants. Va en la fase 2.
--
-- `conversations` y `messages` — las dos que concentran el trafico anonimo
--     (1.328 peticiones). Fase 2, cuando esas llamadas se muevan al servidor.
--
--
-- NOTAS SOBRE LAS DECISIONES
--
-- 1. Se revocan los 4 privilegios DML y no `ALL`: deja REFERENCES, TRIGGER y
--    TRUNCATE, que es exactamente la forma que ya funciona en `confirma-ya` y
--    la misma con la que nacen las tablas nuevas creadas por `postgres`.
--
-- 2. No hace falta limpiar `pg_default_acl`: las tablas creadas por `postgres`
--    (editor SQL, migraciones) ya dan solo `Dxtm` a anon. El REVOKE no se
--    deshara solo con el tiempo.
