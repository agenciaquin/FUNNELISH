# Guía de configuración — WhatsApp + Supabase

---

## PASO 1 — Crear cuenta Meta for Developers

1. Ve a **https://developers.facebook.com**
2. Inicia sesión con tu cuenta de Facebook
3. Haz clic en **"Mis apps"** → **"Crear app"**
4. Elige tipo: **"Business"** → Siguiente
5. Nombre de la app: **QUINCHAT** → Crea la app

---

## PASO 2 — Agregar WhatsApp a la app

1. Dentro de tu app, ve al panel de productos
2. Busca **WhatsApp** y haz clic en **"Configurar"**
3. Acepta los términos
4. Verás la sección **"Introducción a la API de WhatsApp"**

---

## PASO 3 — Anotar tus credenciales

En la sección **"Introducción a la API de WhatsApp"** verás:

| Campo | Dónde encontrarlo |
|-------|-------------------|
| **Phone Number ID** | Panel de WhatsApp → ID del número de teléfono |
| **WhatsApp Business Account ID** | Panel de WhatsApp → ID de cuenta |
| **Access Token** | Panel → "Token de acceso temporal" (dura 24h) o crea uno permanente con System User |

### Token permanente (recomendado)
1. Ve a **Business Settings** → **Users** → **System Users**
2. Crea un System User con rol "Admin"
3. Dale acceso al WhatsApp Business Account
4. Genera un token con permiso `whatsapp_business_messaging`

---

## PASO 4 — Crear cuenta Supabase

1. Ve a **https://supabase.com** y crea una cuenta (gratis)
2. Crea un nuevo proyecto: nombre **quinchat**, elige región más cercana
3. Espera ~2 minutos mientras arranca

---

## PASO 5 — Crear las tablas en Supabase

1. Dentro de tu proyecto Supabase → **SQL Editor** → **New Query**
2. Pega y ejecuta este SQL:

```sql
-- Tabla de conversaciones (una por número de WhatsApp)
create table if not exists conversations (
  id text primary key,
  contact_name text not null default '',
  last_message text not null default '',
  last_message_time timestamptz not null default now(),
  unread_count integer not null default 0,
  bot_enabled boolean not null default true,
  label text,
  created_at timestamptz not null default now()
);

-- Tabla de mensajes
create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  content text not null,
  role text not null check (role in ('user', 'assistant', 'agent')),
  type text not null default 'text',
  created_at timestamptz not null default now()
);

-- Índices para rendimiento
create index if not exists messages_conv_idx on messages(conversation_id);
create index if not exists messages_time_idx on messages(created_at desc);
create index if not exists conversations_time_idx on conversations(last_message_time desc);
```

---

## PASO 6 — Activar Realtime en Supabase

Para que el panel se actualice en tiempo real sin refrescar:

1. Supabase → **Database** → **Replication**
2. En la sección **"Source"**, activa las tablas:
   - ✅ `conversations`
   - ✅ `messages`

---

## PASO 7 — Obtener claves de Supabase

1. Supabase → **Settings** → **API**
2. Anota:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (secreta) → `SUPABASE_SERVICE_ROLE_KEY`

---

## PASO 8 — Agregar variables de entorno

### En .env.local (para desarrollo local)

Agrega estas líneas al archivo `.env.local` en la carpeta `quinchat`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAVh7dZ...
WHATSAPP_VERIFY_TOKEN=quinchat-verify-klixmant-2026
```

### En Vercel (para producción)

1. Ve a **vercel.com** → tu proyecto **quinchat-agencia-quin**
2. **Settings** → **Environment Variables**
3. Agrega las mismas 6 variables de arriba

---

## PASO 9 — Instalar paquete de Supabase

En la carpeta `quinchat`, ejecuta en PowerShell:

```powershell
npm install @supabase/supabase-js
```

---

## PASO 10 — Desplegar a Vercel

```powershell
cd quinchat
vercel --prod
```

---

## PASO 11 — Configurar el Webhook en Meta

1. Ve a tu app de Meta → **WhatsApp** → **Configuración** → **Webhooks**
2. Haz clic en **"Configurar webhooks"**
3. Ingresa:
   - **URL de devolución de llamada**: `https://quinchat-agencia-quin.vercel.app/api/whatsapp/webhook`
   - **Token de verificación**: `quinchat-verify-klixmant-2026`
4. Haz clic en **"Verificar y guardar"**
5. Suscríbete al campo: **messages** ✅

---

## PASO 12 — Prueba con número de prueba de Meta

1. Meta → WhatsApp → **Introducción a la API**
2. En "Enviar y recibir mensajes", usa el número de prueba
3. Agrega tu número personal como destinatario de prueba
4. Envía un mensaje de prueba
5. Verifica que aparezca en `https://quinchat-agencia-quin.vercel.app/panel`

---

## Flujo completo

```
Cliente envía WhatsApp
      ↓
Meta Cloud API
      ↓
POST /api/whatsapp/webhook
      ↓
Guarda en Supabase (conversations + messages)
      ↓
Claude genera respuesta
      ↓
Envía respuesta via Meta Cloud API
      ↓
Guarda respuesta en Supabase
      ↓
Panel QUINCHAT se actualiza en tiempo real (Supabase Realtime)
```
