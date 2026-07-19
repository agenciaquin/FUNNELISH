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
const EtiquetasPanel     = dynamic(() => import('./EtiquetasPanel'),     { ssr: false });
const IntegracionesPanel = dynamic(() => import('./IntegracionesPanel'), { ssr: false });
const ManualPanel        = dynamic(() => import('./ManualPanel'),        { ssr: false });
const CatalogosPanel     = dynamic(() => import('./CatalogosPanel'),     { ssr: false });

interface Props {
  userName: string;
}

export default function WhatsAppPanel({ userName }: Props) {
  const [activeSection, setActiveSection] = useState<PanelSection>('chat');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [loading, setLoading]             = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false); // menú lateral en móvil

  const supabase = createBrowserSupabaseClient();

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_time', { ascending: false });

    if (!error) setConversations(data ?? []);
    setLoading(false);
  }, []);

  // ── Load messages ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error) setMessages(data ?? []);
  }, []);

  // ── Realtime: conversations ───────────────────────────────────────────────
  useEffect(() => {
    loadConversations();

    const ch = supabase
      .channel('conversations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [loadConversations]);

  // ── Realtime: messages ────────────────────────────────────────────────────
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

  // ── Select conversation ───────────────────────────────────────────────────
  async function selectConversation(id: string) {
    setSelectedId(id);
    setMessages([]);
    await loadMessages(id);

    await supabase.from('conversations').update({ unread_count: 0 }).eq('id', id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c));
  }

  // ── Delete conversation ───────────────────────────────────────────────────
  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setMessages([]);
    }
  }

  const selectedConversation = conversations.find(c => c.id === selectedId) ?? null;

  return (
    <div className="flex h-screen bg-[#FAF9F6] overflow-hidden">

      {/* Sidebar — escritorio fijo; móvil cajón deslizante */}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:static md:z-auto md:translate-x-0 md:shrink-0 ${mobileSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          userName={userName}
          activeSection={activeSection}
          onSectionChange={(s) => { setActiveSection(s); setMobileSidebar(false); }}
        />
      </div>
      {/* Fondo oscuro al abrir el menú en móvil */}
      {mobileSidebar && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileSidebar(false)} />
      )}
      {/* Botón ☰ flotante en móvil para secciones que no son Chat */}
      {activeSection !== 'chat' && (
        <button
          onClick={() => setMobileSidebar(true)}
          className="md:hidden fixed top-2 left-2 z-30 w-9 h-9 rounded-lg bg-[#00A89D] text-white flex items-center justify-center shadow-lg"
          aria-label="Abrir menú"
        >☰</button>
      )}

      {/* ── Chat section ── */}
      {activeSection === 'chat' && (
        <>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={selectConversation}
            onDelete={deleteConversation}
            loading={loading}
            onMenuClick={() => setMobileSidebar(true)}
          />
          <ChatArea
            conversation={selectedConversation}
            messages={messages}
            onMessageSent={(msg) => setMessages(prev => [...prev, msg])}
            onConversationsUpdate={loadConversations}
            onBack={() => { setSelectedId(null); setMessages([]); }}
          />
        </>
      )}

      {/* ── Other sections ── */}
      {activeSection === 'entrenamiento' && <EntrenamientoPanel />}
      {activeSection === 'plantillas'    && <PlantillasPanel />}
      {activeSection === 'disparadores'  && <DisparadoresPanel />}
      {activeSection === 'contactos'     && <ContactosPanel />}
      {activeSection === 'etiquetas'     && <EtiquetasPanel />}
      {activeSection === 'catalogos'     && <CatalogosPanel />}
      {activeSection === 'integraciones' && <IntegracionesPanel />}
      {activeSection === 'ajustes'       && <AjustesPanel />}
      {activeSection === 'manual'        && <ManualPanel />}
    </div>
  );
}
