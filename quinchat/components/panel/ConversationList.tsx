'use client';

import { useState, useEffect, useRef } from 'react';
import type { Conversation, ConversationStatus } from '@/lib/panel/types';
import { STATUS_CONFIG } from '@/lib/panel/types';

interface Etiqueta { id: string; nombre: string; color: string; }

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - date.getTime()) / 3_600_000;

  if (diffH < 24) {
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
}

const STATUS_TABS: { key: 'todos' | ConversationStatus; label: string }[] = [
  { key: 'todos',      label: 'Todos'        },
  { key: 'nuevo',      label: 'No leído'     },
  { key: 'en_proceso', label: 'Confirmadas'  },
  { key: 'resuelto',   label: 'Pendientes'   },
  { key: 'cerrado',    label: 'Procesadas'   },
];

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

export default function ConversationList({ conversations, selectedId, onSelect, onDelete, loading }: Props) {
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<'todos' | ConversationStatus>('todos');
  const [labelFilter, setLabelFilter]     = useState<string | null>(null); // null=todos, ''=sin etiqueta, nombre=filtro
  const [soloNoLeidos, setSoloNoLeidos]   = useState(false);
  const [soloBotOff, setSoloBotOff]       = useState(false);
  const [labelDropOpen, setLabelDropOpen] = useState(false);
  const [etiquetas, setEtiquetas]         = useState<Etiqueta[]>([]);
  const [hoveredId, setHoveredId]         = useState<string | null>(null);
  const [confirmId, setConfirmId]         = useState<string | null>(null);
  const [deleting, setDeleting]           = useState<string | null>(null);

  const dropRef = useRef<HTMLDivElement>(null);

  // Load etiquetas
  useEffect(() => {
    fetch('/api/etiquetas').then(r => r.json()).then(setEtiquetas).catch(() => {});
  }, []);

  // Close label dropdown on outside click
  useEffect(() => {
    if (!labelDropOpen) return;
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setLabelDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [labelDropOpen]);

  // ── Active filter count (for badge) ──
  const activeFilters = [
    labelFilter !== null,
    soloNoLeidos,
    soloBotOff,
  ].filter(Boolean).length;

  // ── Filter logic ──
  const filtered = conversations.filter(c => {
    const matchSearch = c.contact_name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search);
    const matchStatus = statusFilter === 'todos' || (c.status ?? 'nuevo') === statusFilter;
    const matchLabel =
      labelFilter === null ? true :
      labelFilter === ''   ? !c.label :
      c.label === labelFilter;
    const matchUnread = !soloNoLeidos || (c.unread_count ?? 0) > 0;
    const matchBot    = !soloBotOff   || c.bot_enabled === false;
    return matchSearch && matchStatus && matchLabel && matchUnread && matchBot;
  });

  const counts = conversations.reduce((acc, c) => {
    const s = (c.status ?? 'nuevo') as ConversationStatus;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {} as Record<ConversationStatus, number>);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await onDelete(id);
    } finally {
      setDeleting(null);
      setConfirmId(null);
      setHoveredId(null);
    }
  }

  function clearAllFilters() {
    setLabelFilter(null);
    setSoloNoLeidos(false);
    setSoloBotOff(false);
    setStatusFilter('todos');
    setSearch('');
  }

  const activeLabelEtq = etiquetas.find(e => e.nombre === labelFilter);

  return (
    <div className="w-[290px] flex flex-col bg-[#FAF9F6] border-r border-[#E8E8E8] shrink-0">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-[#E8E8E8]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[#0D0D0D] text-sm font-semibold">Conversaciones</h2>
          <div className="flex items-center gap-1.5">
            {activeFilters > 0 && (
              <button
                onClick={clearAllFilters}
                title="Limpiar filtros"
                className="text-[10px] text-[#00A89D] font-semibold hover:underline"
              >
                Limpiar
              </button>
            )}
            {!loading && (
              <span className="text-xs text-[#6B6B6B] bg-[#F5F5F5] px-2 py-0.5 rounded-full font-medium">
                {filtered.length}{filtered.length !== conversations.length ? `/${conversations.length}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] text-xs pointer-events-none">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar contacto..."
            className="w-full bg-white border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2 text-xs text-[#0D0D0D] placeholder-[#6B6B6B]/60 focus:outline-none focus:border-[#00A89D] transition-colors"
          />
        </div>
      </div>

      {/* ── Quick filter pills ── */}
      <div className="px-3 py-2 border-b border-[#E8E8E8] flex items-center gap-1.5 flex-wrap">

        {/* Label filter dropdown */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setLabelDropOpen(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
              labelFilter !== null
                ? ''
                : 'text-[#6B6B6B] border-[#E8E8E8] bg-white hover:border-[#00A89D] hover:text-[#00A89D]'
            }`}
            style={
              labelFilter !== null && activeLabelEtq
                ? { color: activeLabelEtq.color, background: activeLabelEtq.color + '18', borderColor: activeLabelEtq.color + '50' }
                : labelFilter === ''
                ? { color: '#6B6B6B', background: '#F5F5F5', borderColor: '#E8E8E8' }
                : undefined
            }
          >
            🏷️{' '}
            {labelFilter === null
              ? 'Etiqueta'
              : labelFilter === ''
              ? 'Sin etiqueta'
              : (labelFilter.split(' ').slice(0, 2).join(' ') + (labelFilter.split(' ').length > 2 ? '…' : ''))
            }
            <span className="opacity-50">▾</span>
          </button>

          {labelDropOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-[#E8E8E8] rounded-xl shadow-lg z-30 overflow-hidden min-w-[210px]">
              {/* All */}
              <button
                onClick={() => { setLabelFilter(null); setLabelDropOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-[#F5F5F5] transition-all ${labelFilter === null ? 'bg-[#F5F5F5] text-[#0D0D0D]' : 'text-[#6B6B6B]'}`}
              >
                <span className="w-2 h-2 rounded-full bg-[#E8E8E8] shrink-0" />
                Todas las etiquetas
                {labelFilter === null && <span className="ml-auto text-[10px] opacity-50">✓</span>}
              </button>
              {/* Sin etiqueta */}
              <button
                onClick={() => { setLabelFilter(''); setLabelDropOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-[#F5F5F5] transition-all border-t border-[#F5F5F5] ${labelFilter === '' ? 'bg-[#F5F5F5] text-[#0D0D0D]' : 'text-[#6B6B6B]'}`}
              >
                <span className="w-2 h-2 rounded-full bg-[#D1D5DB] shrink-0" />
                Sin etiqueta
                {labelFilter === '' && <span className="ml-auto text-[10px] opacity-50">✓</span>}
              </button>
              {/* Etiquetas */}
              {etiquetas.map(etq => (
                <button
                  key={etq.id}
                  onClick={() => { setLabelFilter(etq.nombre); setLabelDropOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium hover:bg-[#F5F5F5] transition-all border-t border-[#F5F5F5] ${labelFilter === etq.nombre ? 'bg-[#F5F5F5]' : ''}`}
                  style={{ color: etq.color }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: etq.color }} />
                  {etq.nombre}
                  {labelFilter === etq.nombre && <span className="ml-auto text-[10px] opacity-50">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* No leídos toggle */}
        <button
          onClick={() => setSoloNoLeidos(prev => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
            soloNoLeidos
              ? 'bg-[#00A89D]/10 text-[#00A89D] border-[#00A89D]/40'
              : 'text-[#6B6B6B] border-[#E8E8E8] bg-white hover:border-[#00A89D] hover:text-[#00A89D]'
          }`}
        >
          🔵 No leídos
        </button>

        {/* Bot OFF toggle */}
        <button
          onClick={() => setSoloBotOff(prev => !prev)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
            soloBotOff
              ? 'bg-amber-50 text-amber-600 border-amber-300'
              : 'text-[#6B6B6B] border-[#E8E8E8] bg-white hover:border-amber-400 hover:text-amber-600'
          }`}
        >
          🤖 Bot OFF
        </button>
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex gap-1 px-3 py-2 border-b border-[#E8E8E8] overflow-x-auto scrollbar-none">
        {STATUS_TABS.map(tab => {
          const active = statusFilter === tab.key;
          const cfg = tab.key !== 'todos' ? STATUS_CONFIG[tab.key] : null;
          const count = tab.key !== 'todos' ? (counts[tab.key] ?? 0) : conversations.length;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all border ${
                active
                  ? 'bg-[#00A89D]/10 text-[#00A89D] border-[#00A89D]/25'
                  : 'text-[#6B6B6B] border-transparent hover:text-[#0D0D0D] hover:bg-[#F5F5F5]'
              }`}
              style={active && cfg ? { color: cfg.color, background: cfg.bg, borderColor: cfg.border } : undefined}
            >
              {cfg && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.color }} />}
              {tab.label}
              {count > 0 && <span className="text-[9px] opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-20 text-[#6B6B6B] text-xs">
            Cargando...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-[#6B6B6B] gap-2">
            <span className="text-2xl">📭</span>
            <span className="text-xs text-center px-4">
              {conversations.length === 0
                ? 'Sin conversaciones aún'
                : activeFilters > 0 || statusFilter !== 'todos' || search
                ? 'Sin resultados con este filtro'
                : 'Sin resultados'}
            </span>
            {(activeFilters > 0 || statusFilter !== 'todos') && (
              <button
                onClick={clearAllFilters}
                className="text-[10px] text-[#00A89D] font-semibold hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {filtered.map(conv => {
          const selected   = selectedId === conv.id;
          const isHovered  = hoveredId === conv.id;
          const isConfirm  = confirmId === conv.id;
          const isDeleting = deleting === conv.id;
          const initial    = conv.contact_name.charAt(0).toUpperCase() || '?';
          const status     = (conv.status ?? 'nuevo') as ConversationStatus;
          const cfg        = STATUS_CONFIG[status];
          const etq        = etiquetas.find(e => e.nombre === conv.label);

          return (
            <div
              key={conv.id}
              className={`relative border-b border-[#EFEFEF] transition-all ${
                selected ? 'bg-[#00A89D]/8' : isHovered ? 'bg-[#F5F5F5]' : 'bg-white'
              }`}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => { setHoveredId(null); if (!isConfirm) setConfirmId(null); }}
            >
              {/* Teal left bar when selected */}
              {selected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#00A89D] rounded-r z-10" />}

              {/* Confirmation overlay */}
              {isConfirm && (
                <div className="absolute inset-0 bg-white/95 z-20 flex items-center justify-center gap-2 px-3">
                  <span className="text-[11px] text-[#6B6B6B]">¿Eliminar chat?</span>
                  <button
                    onClick={() => handleDelete(conv.id)}
                    disabled={isDeleting}
                    className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-500 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-all disabled:opacity-50"
                  >
                    {isDeleting ? '...' : 'Sí, borrar'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="px-2.5 py-1 bg-[#F5F5F5] border border-[#E8E8E8] text-[#6B6B6B] text-[10px] rounded-lg hover:bg-[#EBEBEB] transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Main row */}
              <button
                onClick={() => { if (!isConfirm) onSelect(conv.id); }}
                className="w-full text-left px-3 py-3"
              >
                <div className="flex items-center gap-2.5">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    selected ? 'bg-[#00A89D] text-white' : 'bg-[#00A89D]/15 text-[#00A89D]'
                  }`}>
                    {initial}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: name + time */}
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs font-semibold truncate ${selected ? 'text-[#00A89D]' : 'text-[#0D0D0D]'}`}>
                        {conv.contact_name}
                      </span>
                      <span className="text-[10px] text-[#6B6B6B] shrink-0 ml-1">
                        {formatTime(conv.last_message_time)}
                      </span>
                    </div>

                    {/* Row 2: last message + badges */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] text-[#6B6B6B] truncate leading-tight">
                        {conv.last_message || '—'}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {!conv.bot_enabled && (
                          <span title="Bot pausado" className="text-[9px]">🤖</span>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="bg-[#00A89D] text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} title={cfg.label} />
                      </div>
                    </div>

                    {/* Row 3: label chip (only if has label) */}
                    {conv.label && (
                      <div className="mt-1">
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none"
                          style={
                            etq
                              ? { color: etq.color, background: etq.color + '18' }
                              : { color: '#6B6B6B', background: '#F5F5F5' }
                          }
                        >
                          {etq && <span className="w-1 h-1 rounded-full shrink-0" style={{ background: etq.color }} />}
                          {conv.label.length > 22 ? conv.label.slice(0, 22) + '…' : conv.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </button>

              {/* Delete button — visible on hover */}
              {isHovered && !isConfirm && (
                <button
                  onClick={e => { e.stopPropagation(); setConfirmId(conv.id); }}
                  title="Eliminar conversación"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center rounded-md bg-[#F5F5F5] border border-[#E8E8E8] text-[#6B6B6B] hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all text-xs"
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
