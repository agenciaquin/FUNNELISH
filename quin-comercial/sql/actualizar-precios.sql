-- ============================================================
-- ACTUALIZAR PRECIOS DEL BOT: 1u $134.900 -> $129.900 | pack x2 $229.900 -> $219.900
-- Correr en Supabase -> SQL Editor -> New query -> Run
-- Es seguro/idempotente: solo cambia lo que aún tenga el precio viejo.
-- ============================================================

-- 1) CATÁLOGO (tabla funnels): precio de 1 unidad que ve el bot de ventas
update public.funnels
set precio = 129900
where precio = 134900;

-- 2) PACKS dentro de variantes (JSON): reemplaza el pack x2 viejo por el nuevo
--    y, si el pack de 1u estaba en el JSON, también lo baja.
update public.funnels
set variantes = replace(variantes::text, '229900', '219900')::jsonb
where variantes::text like '%229900%';

update public.funnels
set variantes = replace(variantes::text, '134900', '129900')::jsonb
where variantes::text like '%134900%';

-- 3) MEMORIA APROBADA del bot (tabla memoria_bot): corrige cualquier regla/ejemplo
--    que mencione el precio viejo, en todas sus formas ($134.900, 134.900, 134900).
update public.memoria_bot
set regla = replace(replace(replace(regla, '134.900', '129.900'), '134900', '129900'), '229.900', '219.900')
where regla ~ '134[.]?900|229[.]?900';

update public.memoria_bot
set ejemplo = replace(replace(replace(ejemplo, '134.900', '129.900'), '134900', '129900'), '229.900', '219.900')
where ejemplo ~ '134[.]?900|229[.]?900';

-- 4) Verificación: no debería quedar ningún 134900 ni 229900
select 'funnels precio 134900'  as donde, count(*) as quedan from public.funnels where precio = 134900
union all
select 'funnels variantes viejas', count(*) from public.funnels where variantes::text ~ '134900|229900'
union all
select 'memoria precio viejo',     count(*) from public.memoria_bot where coalesce(regla,'')||coalesce(ejemplo,'') ~ '134[.]?900|229[.]?900';
