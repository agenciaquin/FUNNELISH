# CORRECCIONES V80 — Panel Ajustes (réplica SellerChat)

## Resumen
Agrega el panel **Ajustes** con tabs General/IA/Chat, sub-nav lateral, configuración de estado/tiempo de respuesta, y conexión de WhatsApp Business API (phone_number_id, waba_id, meta_app_id, access_token, webhook URL + verify token).

---

## 1. SQL — Ejecutar en Supabase SQL Editor

```sql
-- Tabla config singleton (una sola fila con id=1)
CREATE TABLE IF NOT EXISTS ajustes (
  id                  int PRIMARY KEY DEFAULT 1,
  nombre              text NOT NULL DEFAULT 'KLIXMANT',
  estado              text NOT NULL DEFAULT 'activo',
  tiempo_respuesta    int  NOT NULL DEFAULT 15,
  respuesta_texto_pct int  NOT NULL DEFAULT 80,
  phone_number_id     text NOT NULL DEFAULT '',
  waba_id             text NOT NULL DEFAULT '',
  meta_app_id         text NOT NULL DEFAULT '',
  access_token        text NOT NULL DEFAULT '',
  webhook_verify_token text NOT NULL DEFAULT '',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Insertar fila base si no existe
INSERT INTO ajustes (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Permisos para service_role
GRANT ALL ON TABLE ajustes TO service_role;
```

---

## 2. NUEVO — `quinchat/app/api/ajustes/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('ajustes')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}

export async function PUT(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('ajustes')
    .upsert({ id: 1, ...body, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

---

## 3. NUEVO — `quinchat/components/panel/AjustesPanel.tsx`

> El archivo completo ya fue creado en el workspace. Pégalo desde:
> `FUNNELISH/quinchat/components/panel/AjustesPanel.tsx`

---

## 4. MODIFICADO — `quinchat/components/panel/Sidebar.tsx`

**Cambio 1:** Agregar `'ajustes'` a `PanelSection`:

```typescript
// ANTES
export type PanelSection = 'chat' | 'entrenamiento' | 'plantillas' | 'disparadores';

// DESPUÉS
export type PanelSection = 'chat' | 'entrenamiento' | 'plantillas' | 'disparadores' | 'ajustes';
```

**Cambio 2:** Agregar item a `NAV_MAIN`:

```typescript
// Agregar al final del array:
{ key: 'ajustes', label: 'Ajustes', icon: '⚙️' },
```

---

## 5. MODIFICADO — `quinchat/components/panel/WhatsAppPanel.tsx`

**Cambio 1:** Importar AjustesPanel:

```typescript
// Agregar junto a los otros dynamic imports:
const AjustesPanel = dynamic(() => import('./AjustesPanel'), { ssr: false });
```

**Cambio 2:** Renderizar en el switch de secciones:

```typescript
// Agregar junto a los otros paneles:
{activeSection === 'ajustes' && <AjustesPanel />}
```

---

## Flujo de conexión WhatsApp

1. El usuario va a **Ajustes → Chat → WhatsApp**
2. Ingresa los 4 campos de la API de Meta
3. Copia la **URL del webhook** y el **Token de verificación**
4. Los pega en **Facebook Developer → WhatsApp → Configuración → Webhook**
5. Guarda → el panel muestra "✓ WhatsApp configurado"

> ⚠️ El `phone_number_id` y el `access_token` son obligatorios para que el bot envíe mensajes. Los demás campos son opcionales.
