-- ============================================================
-- ConfirmaYa — Módulo Historial y Comparación
-- Ejecutar en: Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1. Archivos Funnelish (metadata de cada Excel subido)
CREATE TABLE IF NOT EXISTS archivos_funnelish (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  total_registros INTEGER DEFAULT 0,
  fecha_carga TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Clientes de Funnelish (filas de cada Excel)
CREATE TABLE IF NOT EXISTS clientes_funnelish (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  archivo_id UUID REFERENCES archivos_funnelish(id) ON DELETE CASCADE,
  telefono TEXT NOT NULL,
  nombre TEXT DEFAULT '',
  ciudad TEXT DEFAULT '',
  departamento TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  producto TEXT DEFAULT '',
  talla TEXT DEFAULT '',
  valor TEXT DEFAULT '',
  correo TEXT DEFAULT '',
  fecha_pedido TEXT DEFAULT '',
  fecha_carga TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Archivos Effi (metadata)
CREATE TABLE IF NOT EXISTS archivos_effi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  total_registros INTEGER DEFAULT 0,
  fecha_carga TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Teléfonos Effi (confirmados)
CREATE TABLE IF NOT EXISTS telefonos_effi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  archivo_id UUID REFERENCES archivos_effi(id) ON DELETE CASCADE,
  telefono TEXT NOT NULL,
  nombre TEXT DEFAULT '',
  fecha_carga TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Clientes por confirmar
CREATE TABLE IF NOT EXISTS clientes_por_confirmar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telefono TEXT UNIQUE NOT NULL,
  nombre TEXT DEFAULT '',
  ciudad TEXT DEFAULT '',
  departamento TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  producto TEXT DEFAULT '',
  talla TEXT DEFAULT '',
  valor TEXT DEFAULT '',
  correo TEXT DEFAULT '',
  fecha_pedido TEXT DEFAULT '',
  fecha_primer_registro TIMESTAMPTZ DEFAULT NOW(),
  estado TEXT DEFAULT 'pendiente',
  alerta_effi BOOLEAN DEFAULT FALSE,
  fecha_alerta_effi TIMESTAMPTZ,
  fecha_ultimo_mensaje TIMESTAMPTZ,
  mensajes_enviados INTEGER DEFAULT 0
);

-- 6. Configuración (mensaje WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

INSERT INTO config (clave, valor) VALUES
  ('mensaje_whatsapp', 'Hola {Nombre}, los Buzos se están agotando, aún tengo apartado el tuyo. Necesitamos tu confirmación para enviarlo.')
ON CONFLICT (clave) DO NOTHING;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cf_telefono ON clientes_funnelish(telefono);
CREATE INDEX IF NOT EXISTS idx_cf_fecha    ON clientes_funnelish(fecha_carga);
CREATE INDEX IF NOT EXISTS idx_te_telefono ON telefonos_effi(telefono);
CREATE INDEX IF NOT EXISTS idx_te_fecha    ON telefonos_effi(fecha_carga);
CREATE INDEX IF NOT EXISTS idx_cpc_estado  ON clientes_por_confirmar(estado);

-- Deshabilitar RLS (app interna sin login)
ALTER TABLE archivos_funnelish      DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_funnelish      DISABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_effi           DISABLE ROW LEVEL SECURITY;
ALTER TABLE telefonos_effi          DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_por_confirmar  DISABLE ROW LEVEL SECURITY;
ALTER TABLE config                  DISABLE ROW LEVEL SECURITY;

-- Permisos al rol anon (clave publishable)
GRANT ALL ON archivos_funnelish     TO anon;
GRANT ALL ON clientes_funnelish     TO anon;
GRANT ALL ON archivos_effi          TO anon;
GRANT ALL ON telefonos_effi         TO anon;
GRANT ALL ON clientes_por_confirmar TO anon;
GRANT ALL ON config                 TO anon;
