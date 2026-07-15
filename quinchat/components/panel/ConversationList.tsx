'use client';

import { useState } from 'react';
import type { Conversation, ConversationStatus } from '@/lib/panel/types';
import { STATUS_CONFIG } from '@/lib/panel/types';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - date.getTime()) / 3_600_000;

  if (diffH < 24) {
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
}

const FILTER_TABS: { key: 'todos' | ConversationStatus; label: string }[] = [
  { key: 'todos',      label: 'Todos'      },
  { key: 'nuevo',      label: 'Nuevo'      },
  { key: 'en_proceso', label: 'En proceso' },
  { key: 'resuelto',   label: 'Resuelto'   },
  { key: 'cerrado',    label: 'Cerrado'    },
];

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

export default function ConversationList({ conversations, selectedId, onSelect, loading }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ConversationStatus>('todos');

  const filtered = conversations.filter(c => {
    const matchSearch =
      c.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.includes(search);
    const matchStatus = statusFilter === 'todos' || (c.status ?? 'nuevo') === statusFilter;
    return matchSearch && matchStatus;
  });

  // Count per status for badges
  const counts = conversations.reduce((acc, c) => {
    const s = (c.status ?? 'nuevo') as ConversationStatus;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<ConversationStatus, number>);

  return (
    <div className="w-[290px] flex flex-col bg-[#0D0D0D] border-r border-[#1C1C1C] shrink-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1C1C1C]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-sm font-semibold">Conversaciones</h2>
          {!loading && (
            <span className="text-xs text-gray-600">{conversations.length}</span>
          )}
        </div>
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none">
            🔍
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar contacto..."
            className="w-full bg-[#1A1A1A] border border-[#252525] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-[#C9A84C]/40 transition-colors"
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-[#1C1C1C] overflow-x-auto scrollbar-none">
        {FILTER_TABS.map(tab => {
          const active = statusFilter === tab.key;
          const cfg = tab.key !== 'todos' ? STATUS_CONFIG[tab.key] : null;
          const count = tab.key !== 'todos' ? (counts[tab.key] ?? 0) : conversations.length;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all border ${
                active
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-gray-600 border-transparent hover:text-gray-400 hover:bg-white/[0.03]'
              }`}
              style={active && cfg ? { color: cfg.color, background: cfg.bg, borderColor: cfg.border } : undefined}
            >
              {cfg && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: cfg.color }}
                />
              )}
              {tab.label}
              {count > 0 && (
                <span className="text-[9px] opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-20 text-gray-600 text-xs">
            Cargando...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-700 gap-2">
            <span className="text-2xl">📭</span>
            <span className="text-xs">
              {conversations.length === 0 ? 'Sin conversaciones aún' : 'Sin resultados'}
            </span>
          </div>
        )}

        {filtered.map(conv => {
          const selected = selectedId === conv.id;
          const initial = conv.contact_name.charAt(0).toUpperCase() || '?';
          const status = (conv.status ?? 'nuevo') as ConversationStatus;
          const cfg = STATUS_CONFIG[status];

          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-3 py-3 border-b border-[#111] transition-all relative ${
                selected
                  ? 'bg-[#C9A84C]/10'
                  : 'hover:bg-white/[0.03]'
              }`}
            >
              {/* Gold left bar when selected */}
              {selected && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#C9A84C] rounded-r" />
              )}

              <div className="flex items-center gap-2.5">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  selected ? 'bg-[#C9A84C]/20 text-[#C9A84C]' : 'bg-[#1A1A1A] text-gray-400'
                }`}>
                  {initial}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-xs font-semibold truncate ${selected ? 'text-[#C9A84C]' : 'text-white'}`}>
                      {conv.contact_name}
                    </span>
                    <span className="text-[10px] text-gray-600 shrink-0 ml-1">
                      {formatTime(conv.last_message_time)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-gray-600 truncate leading-tight">
                      {conv.last_message || '—'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {conv.unread_count > 0 && (
                        <span className="bg-[#C9A84C] text-black text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                      {/* Status dot */}
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: cfg.color }}
                        title={cfg.label}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
