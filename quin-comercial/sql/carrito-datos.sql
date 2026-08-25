-- ============================================================================
-- CARRITOS ABANDONADOS: guardar también los DATOS que el cliente alcanzó a
-- llenar (dirección, ciudad, correo, etc.) para poder verlos al desplegar el
-- carrito en el panel y así recuperar la venta con toda la info a la mano.
--
-- Segura de correr varias veces (IF NOT EXISTS). No borra datos.
-- ============================================================================

ALTER TABLE carritos_abandonados ADD COLUMN IF NOT EXISTS apellidos    text;
ALTER TABLE carritos_abandonados ADD COLUMN IF NOT EXISTS correo       text;
ALTER TABLE carritos_abandonados ADD COLUMN IF NOT EXISTS direccion    text;
ALTER TABLE carritos_abandonados ADD COLUMN IF NOT EXISTS barrio       text;
ALTER TABLE carritos_abandonados ADD COLUMN IF NOT EXISTS ciudad       text;
ALTER TABLE carritos_abandonados ADD COLUMN IF NOT EXISTS departamento text;
