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
const ManualPanel        = dynamic(() => import('./ManualPanel'),        { ssr: false });

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
    <div className="flex h-screen bg-[#0A0A0A] text-white overflow-hidden">
      <Sidebar
        userName={userName}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      {/* ── Chat section ── */}
      {activeSection === 'chat' && (
        <>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={selectConversation}
            onDelete={deleteConversation}
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

      {/* ── Other sections ── */}
      {activeSection === 'entrenamiento' && <EntrenamientoPanel />}
      {activeSection === 'plantillas'    && <PlantillasPanel />}
      {activeSection === 'disparadores'  && <DisparadoresPanel />}
      {activeSection === 'contactos'      && <ContactosPanel />}
      {activeSection === 'integraciones' && <IntegracionesPanel />}
      {activeSection === 'ajustes'       && <AjustesPanel />}
      {activeSection === 'manual'        && <ManualPanel />}
    </div>
  );
}
