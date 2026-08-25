-- ============================================================
-- RESET de vendedores: borra TODO el histórico para arrancar de cero.
-- El conteo (ventas + promedio de respuesta) empieza fresco con el
-- primer check-in del lunes a las 8:00 a.m.
-- Correr en Supabase -> SQL Editor -> Run
-- ============================================================

-- Reportes de ventas por día
delete from public.vendedor_reportes;

-- Preguntas/cronómetros (tiempos de respuesta)
delete from public.vendedor_preguntas;
