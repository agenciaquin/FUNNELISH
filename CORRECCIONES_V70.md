# CORRECCIONES V70 — Integración ConfirmaYa ↔ QuinChat (bot WA + Integraciones panel)
**Proyecto:** ConfirmaYa + QuinChat — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:**
- `FUNNELISH/app.js` (ConfirmaYa — bot WA + Realtime)
- `FUNNELISH/styles.css` (ConfirmaYa — badges wa-enviado / confirmado-bot)
- `quinchat/components/panel/Sidebar.tsx` (añadir Integraciones)
- `quinchat/components/panel/WhatsAppPanel.tsx` (añadir IntegracionesPanel)
- `quinchat/components/panel/IntegracionesPanel.tsx` (NUEVO)

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| app.js | `abrirWhatsApp` usa fetch a QuinChat en lugar de abrir WA manualmente | El bot envía el mensaje; CONFIRMO se detecta automáticamente |
| app.js | `suscribirConfirmacionesBot()` — Realtime Supabase escucha confirmaciones | Badge se actualiza en tiempo real cuando cliente responde CONFIRMO |
| styles.css | `.estado-wa-enviado` + `.estado-confirmado-bot` | Badges visuales para los nuevos estados |
| Sidebar.tsx | Añade `integraciones` a PanelSection + NAV_MAIN | Nueva sección en el panel |
| WhatsAppPanel.tsx | Import + render de `<IntegracionesPanel />` | Muestra el panel cuando se activa Integraciones |
| IntegracionesPanel.tsx | Nuevo panel con cards (ConfirmaYa activo, resto próximamente) + API info | Vista de integraciones conectadas |

---

## Pasos pendientes (hacer ANTES de testear)

### 1. SQL en Supabase QuinChat (bjbjqmbuzpyjvcugbusx)
Ejecuta esto en el SQL Editor de Supabase:

```sql
-- Tabla principal de pedidos ConfirmaYa en QuinChat
CREATE TABLE IF NOT EXISTS clientes_funnelish (
  id           BIGSERIAL PRIMARY KEY,
  telefono     TEXT NOT NULL,
  nombre       TEXT,
  producto     TEXT,
  talla        TEXT,
  valor        TEXT,
  ciudad       TEXT,
  departamento TEXT,
  direccion    TEXT,
  correo       TEXT,
  referencia   TEXT,
  wa_enviado     BOOLEAN DEFAULT FALSE,
  wa_enviado_at  TIMESTAMPTZ,
  confirmado     BOOLEAN DEFAULT FALSE,
  confirmado_at  TIMESTAMPTZ,
  estado         TEXT DEFAULT 'pendiente',
  fecha_pedido   DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_clientes_funnelish_telefono ON clientes_funnelish(telefono);
CREATE INDEX IF NOT EXISTS idx_clientes_funnelish_estado   ON clientes_funnelish(estado);

-- Permisos
GRANT ALL ON clientes_funnelish TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE clientes_funnelish_id_seq TO anon, authenticated, service_role;

-- Habilitar Realtime en la tabla (necesario para badges en tiempo real)
ALTER TABLE clientes_funnelish REPLICA IDENTITY FULL;
```

### 2. Variable de entorno en Vercel
En el dashboard de Vercel → proyecto quinchat → Settings → Environment Variables:

```
CONFIRMA_YA_API_KEY = klixmant-confirma-2026
```

(Aplica a Production + Preview + Development)

### 3. Desplegar a producción
En la terminal dentro de la carpeta `quinchat/`:
```bash
npx vercel --prod
```

---

## Instrucciones para Claude Code

Pega este mensaje en Claude Code (dentro de la carpeta `quinchat/`):

> Aplica estos cambios al proyecto QuinChat:
> 
> 1. En `components/panel/Sidebar.tsx`, en la línea del type PanelSection agrega `'integraciones'` y en NAV_MAIN agrega `{ key: 'integraciones', label: 'Integraciones', icon: '🔗' }` entre contactos y ajustes.
> 
> 2. En `components/panel/WhatsAppPanel.tsx`, agrega al final de los imports dinámicos: `const IntegracionesPanel = dynamic(() => import('./IntegracionesPanel'), { ssr: false });` y en el JSX agrega `{activeSection === 'integraciones' && <IntegracionesPanel />}` entre contactos y ajustes.
> 
> 3. Crea el archivo `components/panel/IntegracionesPanel.tsx` con el código completo que aparece en la sección de abajo.
> 
> Luego ejecuta `npx vercel --prod`.

---

## Código completo corregido

### `quinchat/components/panel/Sidebar.tsx`

```tsx
'use client';

import { signOut } from 'next-auth/react';

export type PanelSection = 'chat' | 'entrenamiento' | 'plantillas' | 'disparadores' | 'contactos' | 'integraciones' | 'ajustes';

const NAV_MAIN: { key: PanelSection; label: string; icon: string }[] = [
  { key: 'chat',          label: 'Chat',          icon: '💬' },
  { key: 'entrenamiento', label: 'Entrenamiento',  icon: '🎓' },
  { key: 'plantillas',    label: 'Plantillas',     icon: '📋' },
  { key: 'disparadores',  label: 'Disparadores',   icon: '⚡' },
  { key: 'contactos',     label: 'Contactos',      icon: '👥' },
  { key: 'integraciones', label: 'Integraciones',  icon: '🔗' },
  { key: 'ajustes',       label: 'Ajustes',        icon: '⚙️' },
];

interface Props {
  userName: string;
  activeSection: PanelSection;
  onSectionChange: (s: PanelSection) => void;
}

export default function Sidebar({ userName, activeSection, onSectionChange }: Props) {
  const initial = userName.charAt(0).toUpperCase() || 'U';

  return (
    <aside className="w-[190px] flex flex-col bg-[#080808] border-r border-[#1C1C1C] shrink-0">

      {/* Brand */}
      <div className="px-4 py-4 border-b border-[#1C1C1C]">
        <div className="leading-none mb-1">
          <span className="text-[#C9A84C] font-black text-sm tracking-widest">QUIN</span>
          <span className="text-white font-black text-sm tracking-widest">CHAT</span>
        </div>
        <p className="text-[10px] text-gray-600">Panel de administración</p>
      </div>

      {/* Account */}
      <div className="px-3 py-3 border-b border-[#1C1C1C] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center text-xs font-bold text-[#C9A84C] shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white truncate">{userName || 'KLIXMANT'}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="text-[10px] text-gray-600">Activo</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {NAV_MAIN.map(item => {
          const active = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSectionChange(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                active
                  ? 'bg-[#C9A84C]/12 text-[#C9A84C] border border-[#C9A84C]/20'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#C9A84C] shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 border-t border-[#1C1C1C] pt-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-all border border-transparent"
        >
          <span className="text-base shrink-0">↩</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
```

---

### `quinchat/components/panel/WhatsAppPanel.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar, { type PanelSection } from './Sidebar';
import ConversationList from './ConversationList';
import ChatArea from './ChatArea';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { Conversation, Message } from '@/lib/panel/types';

// Lazy-loaded section panels
import dynamic from 'next/dynamic';
const EntrenamientoPanel = dynamic(() => import('./EntrenamientoPanel'), { ssr: false });
const PlantillasPanel    = dynamic(() => import('./PlantillasPanel'),    { ssr: false });
const DisparadoresPanel  = dynamic(() => import('./DisparadoresPanel'),  { ssr: false });
const AjustesPanel       = dynamic(() => import('./AjustesPanel'),       { ssr: false });
const ContactosPanel     = dynamic(() => import('./ContactosPanel'),     { ssr: false });
const IntegracionesPanel = dynamic(() => import('./IntegracionesPanel'), { ssr: false });

interface Props {
  userName: string;
}

export default function WhatsAppPanel({ userName }: Props) {
  const [activeSection, setActiveSection] = useState<PanelSection>('chat');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [loading, setLoading]             = useState(true);

  const supabase = createBrowserSupabaseClient();

  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_time', { ascending: false });

    if (!error) setConversations(data ?? []);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error) setMessages(data ?? []);
  }, []);

  useEffect(() => {
    loadConversations();

    const ch = supabase
      .channel('conversations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;

    const ch = supabase
      .channel(`messages-${selectedId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [selectedId]);

  async function selectConversation(id: string) {
    setSelectedId(id);
    setMessages([]);
    await loadMessages(id);

    await supabase.from('conversations').update({ unread_count: 0 }).eq('id', id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c));
  }

  const selectedConversation = conversations.find(c => c.id === selectedId) ?? null;

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-white overflow-hidden">
      <Sidebar
        userName={userName}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {activeSection === 'chat' && (
        <>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={selectConversation}
            loading={loading}
          />
          <ChatArea
            conversation={selectedConversation}
            messages={messages}
            onMessageSent={(msg) => setMessages(prev => [...prev, msg])}
            onConversationsUpdate={loadConversations}
          />
        </>
      )}

      {activeSection === 'entrenamiento' && <EntrenamientoPanel />}
      {activeSection === 'plantillas'    && <PlantillasPanel />}
      {activeSection === 'disparadores'  && <DisparadoresPanel />}
      {activeSection === 'contactos'      && <ContactosPanel />}
      {activeSection === 'integraciones' && <IntegracionesPanel />}
      {activeSection === 'ajustes'       && <AjustesPanel />}
    </div>
  );
}
```

---

### `quinchat/components/panel/IntegracionesPanel.tsx` (NUEVO)

```tsx
'use client';

import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'coming_soon';
  color: string;
  url?: string;
}

const INTEGRACIONES: Integration[] = [
  {
    id: 'confirmaya',
    name: 'ConfirmaYa',
    description: 'Envía mensajes de confirmación de pedidos desde ConfirmaYa directamente por WhatsApp. Los CONFIRMO se detectan automáticamente.',
    icon: '✅',
    status: 'active',
    color: '#C9A84C',
    url: 'https://agenciaquin43.github.io/confirmaya/',
  },
  {
    id: 'funnelish',
    name: 'Funnelish',
    description: 'Sincroniza pedidos de Funnelish automáticamente con el bot de WhatsApp.',
    icon: '🛒',
    status: 'coming_soon',
    color: '#6366f1',
  },
  {
    id: 'meta',
    name: 'Meta Ads',
    description: 'Conecta campañas de Meta Ads y notifica leads por WhatsApp en tiempo real.',
    icon: '📘',
    status: 'coming_soon',
    color: '#1877f2',
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Automatiza flujos entre QuinChat y cualquier otra herramienta via Make.',
    icon: '⚙️',
    status: 'coming_soon',
    color: '#7c3aed',
  },
  {
    id: 'dropi',
    name: 'Dropi',
    description: 'Importa pedidos de Dropi y gestiona confirmaciones por WhatsApp.',
    icon: '📦',
    status: 'coming_soon',
    color: '#059669',
  },
];

export default function IntegracionesPanel() {
  const [copied, setCopied] = useState(false);

  const webhookUrl = 'https://quinchat-agencia-quin.vercel.app/api/whatsapp/confirmar';

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Integraciones</h1>
        <p className="text-sm text-gray-500">Conecta QuinChat con tus herramientas de negocio.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {INTEGRACIONES.map(integ => (
          <div
            key={integ.id}
            className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
              integ.status === 'active'
                ? 'bg-[#111] border-[#2a2a2a] hover:border-[#C9A84C]/40'
                : 'bg-[#0d0d0d] border-[#1a1a1a] opacity-60'
            }`}
          >
            <div className="absolute top-4 right-4">
              {integ.status === 'active' ? (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Activo
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-gray-600 bg-gray-800/50 border border-gray-700/30 rounded-full px-2 py-0.5">
                  Próximamente
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: `${integ.color}18`, border: `1px solid ${integ.color}30` }}
              >
                {integ.icon}
              </div>
              <h3 className="text-sm font-bold text-white">{integ.name}</h3>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">{integ.description}</p>

            {integ.status === 'active' && integ.url && (
              <a
                href={integ.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-2 text-xs font-semibold text-[#C9A84C] hover:text-[#e0bc5a] transition-colors"
              >
                Abrir ConfirmaYa →
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-[#1C1C1C] bg-[#0d0d0d] p-6">
        <h2 className="text-sm font-bold text-white mb-1">Endpoint de integración</h2>
        <p className="text-xs text-gray-500 mb-4">
          Usa esta URL para enviar mensajes de confirmación desde cualquier herramienta externa.
          Requiere el header <code className="text-[#C9A84C] bg-[#C9A84C]/10 px-1 rounded">X-API-Key: klixmant-confirma-2026</code>.
        </p>

        <div className="flex items-center gap-3 bg-black/50 border border-[#222] rounded-xl px-4 py-3">
          <code className="flex-1 text-xs text-gray-300 break-all font-mono">{webhookUrl}</code>
          <button
            onClick={copyWebhook}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
            style={copied
              ? { color: '#4ade80', borderColor: '#4ade8040', background: '#4ade8010' }
              : { color: '#C9A84C', borderColor: '#C9A84C40', background: '#C9A84C10' }
            }
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-600 space-y-1">
          <p><span className="text-gray-400 font-semibold">Método:</span> POST</p>
          <p><span className="text-gray-400 font-semibold">Body:</span>{' '}
            <code className="text-gray-500 font-mono">{'{ "telefono": "3001234567", "mensaje": "Hola..." }'}</code>
          </p>
          <p><span className="text-gray-400 font-semibold">Respuesta:</span>{' '}
            <code className="text-gray-500 font-mono">{'{ "success": true, "phone": "573001234567" }'}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## Verificación

Después de aplicar y desplegar:
- [ ] `npx vercel --prod` termina sin errores
- [ ] QuinChat sidebar muestra "🔗 Integraciones"
- [ ] Panel Integraciones muestra ConfirmaYa como "Activo" y los demás como "Próximamente"
- [ ] El SQL de `clientes_funnelish` corre sin errores en Supabase
- [ ] La env var `CONFIRMA_YA_API_KEY` está configurada en Vercel
- [ ] ConfirmaYa: al hacer clic en el botón WA, muestra `⏳` mientras envía y `✅` al confirmar
- [ ] ConfirmaYa: el badge pasa a "WA Enviado" (azul) después de enviar
- [ ] ConfirmaYa: cuando el cliente responde CONFIRMO, el badge cambia a "✅ CONFIRMADO (bot)" automáticamente
