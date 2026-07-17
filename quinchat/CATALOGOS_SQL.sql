-- ════════════════════════════════════════════════════════════
-- CATÁLOGOS DEL BOT — ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- Tabla principal: familias de productos
CREATE TABLE IF NOT EXISTS catalogos_bot (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  familia     TEXT NOT NULL,          -- "NEW YORK", "COLOMBIA", etc.
  patron      TEXT NOT NULL,          -- texto que aparece en el nombre del producto Funnelish
  activo      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de variaciones de color por catálogo
CREATE TABLE IF NOT EXISTS catalogo_colores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  catalogo_id     UUID REFERENCES catalogos_bot(id) ON DELETE CASCADE,
  color           TEXT NOT NULL,           -- "Negro", "Beige", "Azul Navy"
  nombre_producto TEXT NOT NULL,           -- nombre EXACTO del archivo en /img (sin extensión)
  url_imagen      TEXT,                    -- URL pública de la foto
  activo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas del bot
CREATE INDEX IF NOT EXISTS idx_catalogos_activo   ON catalogos_bot(activo);
CREATE INDEX IF NOT EXISTS idx_colores_catalogo   ON catalogo_colores(catalogo_id);
CREATE INDEX IF NOT EXISTS idx_colores_activo     ON catalogo_colores(activo);
