-- ROLLBACK de 001_revocar_tablas_sin_uso.sql
--
-- Deja el proyecto exactamente como estaba. Usar solo si algo se rompe.
--
-- Si el problema es una sola tabla, NO hace falta ejecutar todo: basta con su
-- linea de GRANT. Es lo normal — devolver solo la tabla que fallo y dejar el
-- resto cerrado.

begin;

grant select, insert, update, delete on table
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
to anon, authenticated;

grant select on table public.funnels to anon, authenticated;

create policy "Permitir todo en plantillas" on public.plantillas
    for all to public using (true) with check (true);

commit;
