-- ============================================================
-- ConfirmaYa — Limpiar historial completo
-- Ejecutar en: Supabase > SQL Editor > New query > Run
-- ADVERTENCIA: Elimina TODOS los registros de historial.
-- Haz esto solo para empezar desde cero (ej: 1 de julio 2026)
-- ============================================================

-- Limpia clientes_por_confirmar primero (sin referencias externas)
TRUNCATE TABLE clientes_por_confirmar;

-- Limpia archivos Funnelish y sus clientes (CASCADE elimina clientes_funnelish)
TRUNCATE TABLE archivos_funnelish CASCADE;

-- Limpia archivos Effi y sus teléfonos (CASCADE elimina telefonos_effi)
TRUNCATE TABLE archivos_effi CASCADE;

-- Verificar que todo quedó vacío
SELECT 'archivos_funnelish'    AS tabla, COUNT(*) AS registros FROM archivos_funnelish
UNION ALL
SELECT 'clientes_funnelish'    AS tabla, COUNT(*) AS registros FROM clientes_funnelish
UNION ALL
SELECT 'archivos_effi'         AS tabla, COUNT(*) AS registros FROM archivos_effi
UNION ALL
SELECT 'telefonos_effi'        AS tabla, COUNT(*) AS registros FROM telefonos_effi
UNION ALL
SELECT 'clientes_por_confirmar'AS tabla, COUNT(*) AS registros FROM clientes_por_confirmar;
