'use client';

import { useState, useEffect, useRef } from 'react';
import type { Conversation, ConversationStatus, Etiqueta } from '@/lib/panel/types';
import { STATUS_CONFIG, ETIQUETAS_FIJAS, ESTADOS_CONV, TAGS_CONV, parseLabels, conEstado, conTag } from '@/lib/panel/types';
import { createBrowserSupabaseClient } from '@/lib/supabase';

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - date.getTime()) / 3_600_000;

  if (diffH < 24) {
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
}

// Pestañas horizontales: filtran por etiqueta / no leídos.
const FILTER_TABS: { key: string; label: string; color: string; test: (c: Conversation) => boolean }[] = [
  { key: 'todos',     label: 'Todos',                    color: '#475569', test: () => true },
  { key: 'noleido',   label: 'No leído',                 color: '#38BDF8', test: c => (c.unread_count ?? 0) > 0 },
  { key: 'interbot',  label: '🤖 Interacción bot',       color: '#0EA5A0', test: c => !!(c as any).interaccion_bot },
  { key: 'pendconf',  label: 'Pendiente por confirmar',  color: '#8B5CF6', test: c => !!c.label && c.label.includes('PENDIENTE POR CONFIRMACIÓN') },
  { key: 'venta',     label: 'Venta realizada',          color: '#00847A', test: c => !!c.label && c.label.includes('VENTA REALIZADA') },
  { key: 'humano',    label: 'Humano',                   color: '#6B7280', test: c => !!c.label && c.label.toUpperCase().includes('HUMANO') },
  { key: 'abono',     label: 'Pendiente de abono',       color: '#EAB308', test: c => !!c.label && c.label.includes('PENDIENTE DE ABONO') },
  { key: 'procesado', label: 'Anulado en Effi',         color: '#DC2626', test: c => !!c.label && c.label.includes('ANULADO EN EFFI') },
  { key: 'vendedor',  label: '🏆 Vendedores',            color: '#F59E0B', test: c => !!c.label && c.label.toUpperCase().includes('VENDEDOR') },
  { key: 'ofisin',    label: '🏢 Oficina sin abono',     color: '#DC2626', test: c => !!c.label && c.label.toUpperCase().includes('OFICINA SIN ABONO') },
  { key: 'oficon',    label: '🏢 Oficina con abono',     color: '#15803D', test: c => !!c.label && c.label.toUpperCase().includes('OFICINA CON ABONO') },
  { key: 'noentreg',  label: '📵 No entregado',          color: '#B91C1C', test: c => !!(c as any).entrega_fallida },
];

/** ¿Es un chat del equipo de vendedores (no un cliente)? */
const esConvVendedor = (c: Conversation) => !!c.label && c.label.toUpperCase().includes('VENDEDOR');

// (ETIQUETAS_FIJAS ahora vive en lib/panel/types.ts para compartirla con el chat)

// Texto blanco o negro según qué tan claro sea el color de fondo (para que siempre se lea)
function textOn(bg: string): string {
  const c = bg.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 165 ? '#0D0D0D' : '#FFFFFF';
}

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
  onMenuClick?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onSoporte?: () => void;
}

export default function ConversationList({ conversations, selectedId, onSelect, onDelete, loading, onMenuClick, onRefresh, refreshing, onSoporte }: Props) {
  const [search, setSearch]               = useState('');
  // IDs de chats cuyos MENSAJES contienen la palabra buscada (búsqueda por contenido)
  const [idsMensaje, setIdsMensaje]       = useState<Set<string> | null>(null);
  const [tabKey, setTabKey]               = useState<string>('todos');
  const [labelFilter, setLabelFilter]     = useState<string | null>(null); // null=todos, ''=sin etiqueta, nombre=filtro
  const [soloNoLeidos, setSoloNoLeidos]   = useState(false);
  const [soloBotOff, setSoloBotOff]       = useState(false);
  const [labelDropOpen, setLabelDropOpen] = useState(false);
  const [hoveredId, setHoveredId]         = useState<string | null>(null);
  const [confirmId, setConfirmId]         = useState<string | null>(null);
  const [deleting, setDeleting]           = useState<string | null>(null);
  const [menuId, setMenuId]               = useState<string | null>(null);
  const [submenu, setSubmenu]             = useState<'estado' | 'tags' | null>(null);

  const supabase = createBrowserSupabaseClient();

  // Búsqueda por CONTENIDO: al escribir, busca la palabra dentro de los mensajes
  // y guarda los IDs de esos chats (ej. "abono" → todos los que hablaron de abono).
  useEffect(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2) { setIdsMensaje(null); return; }
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('messages').select('conversation_id')
          .ilike('content', `%${term}%`).limit(1000);
        if (!cancelado) setIdsMensaje(new Set((data ?? []).map((m: any) => String(m.conversation_id))));
      } catch { if (!cancelado) setIdsMensaje(null); }
    }, 300);
    return () => { cancelado = true; clearTimeout(t); };
  }, [search, supabase]);

  // Cerrar el menú del chat al hacer clic afuera
  useEffect(() => {
    if (!menuId) return;
    const cerrar = () => { setMenuId(null); setSubmenu(null); };
    document.addEventListener('click', cerrar);
    return () => document.removeEventListener('click', cerrar);
  }, [menuId]);

  // Las fijas del negocio + las que hayas creado en la sección Etiquetas
  const [etiquetasDB, setEtiquetasDB] = useState<Etiqueta[]>([]);

  useEffect(() => {
    fetch('/api/etiquetas')
      .then(r => r.json())
      .then(d => setEtiquetasDB(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const etiquetas: Etiqueta[] = [
    ...ETIQUETAS_FIJAS,
    ...etiquetasDB.filter(e => !ETIQUETAS_FIJAS.some(f => f.nombre === e.nombre)),
  ];

  /** Estados = los fijos + los que el usuario creó marcados como "estado". */
  const estadosDisponibles = [
    ...ESTADOS_CONV,
    ...etiquetasDB.filter(e => e.tipo === 'estado').map(e => e.nombre)
      .filter(n => !ESTADOS_CONV.includes(n.toUpperCase())),
  ];

  /** Las que se pueden sumar a un chat sin reemplazar su estado (adicionales). */
  const tagsDisponibles = [
    ...TAGS_CONV,
    ...etiquetasDB
      .filter(e => e.tipo !== 'estado')
      .map(e => e.nombre)
      .filter(n => !estadosDisponibles.some(s => s.toUpperCase() === n.toUpperCase()) && !TAGS_CONV.includes(n.toUpperCase())),
  ];

  const dropRef = useRef<HTMLDivElement>(null);

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

  const activeTab = FILTER_TABS.find(t => t.key === tabKey) ?? FILTER_TABS[0];

  // Los vendedores se OCULTAN del inbox de clientes. Solo aparecen al filtrar por
  // la pestaña "Vendedores" o al elegir la etiqueta VENDEDOR.
  const verVendedores = tabKey === 'vendedor' || labelFilter === 'VENDEDOR';

  // ── Filter logic ──
  const filtered = conversations.filter(c => {
    if (esConvVendedor(c) && !verVendedores) return false;
    const term = search.trim().toLowerCase();
    const matchSearch = !term
      || c.contact_name.toLowerCase().includes(term)
      || c.id.includes(term)
      || (c.last_message ?? '').toLowerCase().includes(term)
      || (idsMensaje?.has(c.id) ?? false);   // coincide con el CONTENIDO de sus mensajes
    const matchTab    = activeTab.test(c);
    const matchLabel =
      labelFilter === null ? true :
      labelFilter === ''   ? !c.label :
      (!!c.label && c.label.includes(labelFilter));
    const matchUnread = !soloNoLeidos || (c.unread_count ?? 0) > 0;
    const matchBot    = !soloBotOff   || c.bot_enabled === false;
    return matchSearch && matchTab && matchLabel && matchUnread && matchBot;
  }).sort((a, b) => {
    // Los fijados siempre arriba; el resto conserva el orden por fecha
    if (!!a.fijado === !!b.fijado) return 0;
    return a.fijado ? -1 : 1;
  });

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

  // ── Acciones rápidas sobre una conversación ────────────────────────────────
  async function actualizarConv(id: string, cambios: Record<string, unknown>) {
    await supabase.from('conversations').update(cambios).eq('id', id);
    setMenuId(null);
    onRefresh?.();
  }

  const colorDe = (nombre: string) =>
    etiquetas.find(e => e.nombre === nombre)?.color ?? '#6B7280';

  function clearAllFilters() {
    setLabelFilter(null);
    setSoloNoLeidos(false);
    setSoloBotOff(false);
    setTabKey('todos');
    setSearch('');
  }

  const activeLabelEtq = etiquetas.find(e => e.nombre === labelFilter);

  return (
    <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-[290px] flex-col min-h-0 h-full bg-[#FAF9F6] border-r border-[#E8E8E8] shrink-0`}>

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-[#E8E8E8]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="md:hidden w-8 h-8 -ml-1 rounded-lg bg-[#00A89D] text-white flex items-center justify-center shrink-0"
                aria-label="Abrir menú"
              >☰</button>
            )}
            <h2 className="text-[#0D0D0D] text-sm font-semibold">Conversaciones</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Actualizar ahora"
                aria-label="Actualizar"
                className="w-7 h-7 rounded-lg text-[#00A89D] hover:bg-[#00A89D]/10 flex items-center justify-center text-sm shrink-0 transition-colors"
              >
                <span className={refreshing ? 'inline-block animate-spin' : 'inline-block'}>⟳</span>
              </button>
            )}
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

      {/* ── Acceso directo a Soporte (Lilibeth) ── */}
      {onSoporte && (
        <div className="px-3 pt-2 pb-1">
          <button
            onClick={onSoporte}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#00A89D]/10 border border-[#00A89D]/30 text-[#00847A] hover:bg-[#00A89D]/20 transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-[#00A89D] text-white flex items-center justify-center text-sm shrink-0">🎧</span>
            <div className="min-w-0 text-left">
              <div className="text-xs font-bold leading-tight">Soporte</div>
              <div className="text-[10px] text-[#6B6B6B] leading-tight">Lilibeth · chat directo</div>
            </div>
          </button>
        </div>
      )}

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

      {/* ── Filtros horizontales por etiqueta ── */}
      <div className="flex gap-1 px-3 py-2 border-b border-[#E8E8E8] overflow-x-auto scrollbar-none">
        {FILTER_TABS.map(tab => {
          const active = tabKey === tab.key;
          const count  = tab.key === 'todos'
            ? conversations.filter(c => !esConvVendedor(c)).length   // el inbox normal no cuenta vendedores
            : conversations.filter(tab.test).length;
          return (
            <button
              key={tab.key}
              onClick={() => setTabKey(tab.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                active ? 'opacity-100 shadow-md scale-105' : 'opacity-60 hover:opacity-90'
              }`}
              style={{ background: tab.color, color: textOn(tab.color) }}
            >
              {tab.label}
              {count > 0 && <span className="text-[9px] font-bold" style={{ opacity: 0.8 }}>{count}</span>}
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
                : activeFilters > 0 || tabKey !== 'todos' || search
                ? 'Sin resultados con este filtro'
                : 'Sin resultados'}
            </span>
            {(activeFilters > 0 || tabKey !== 'todos') && (
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
          const labels     = (conv.label ?? '').split('|').map(s => s.trim()).filter(Boolean);

          return (
            <div
              key={conv.id}
              className={`relative border-b border-[#EFEFEF] transition-all ${
                selected ? 'bg-[#00A89D]/8' : isHovered ? 'bg-[#F5F5F5]' : 'bg-white'
              }`}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Teal left bar when selected */}
              {selected && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#00A89D] rounded-r z-10" />}

              {/* Flechita del menú (como en WhatsApp) */}
              {(isHovered || menuId === conv.id) && !isConfirm && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setMenuId(menuId === conv.id ? null : conv.id);
                    setSubmenu(null);
                  }}
                  className="absolute right-2 top-2 z-30 w-6 h-6 rounded-md bg-white/90 border border-[#E8E8E8] text-[#6B6B6B] flex items-center justify-center text-[10px] hover:bg-[#F0F0F0] shadow-sm"
                  aria-label="Opciones del chat"
                >▾</button>
              )}

              {/* Menú de opciones del chat */}
              {menuId === conv.id && (
                <div
                  onClick={e => e.stopPropagation()}
                  className="absolute right-2 top-8 z-40 bg-white border border-[#E8E8E8] rounded-xl shadow-xl overflow-hidden w-[215px] max-h-[330px] overflow-y-auto"
                >
                  {submenu === null && (
                    <>
                      <button
                        onClick={() => setSubmenu('estado')}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-[#0D0D0D] hover:bg-[#F5F5F5] text-left"
                      ><span>🏷️ Cambiar estado</span><span className="text-[#9A9A9A]">›</span></button>

                      <button
                        onClick={() => setSubmenu('tags')}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs text-[#0D0D0D] hover:bg-[#F5F5F5] text-left"
                      ><span>➕ Etiqueta adicional</span><span className="text-[#9A9A9A]">›</span></button>

                      <div className="border-t border-[#F0F0F0]" />

                      <button
                        onClick={() => actualizarConv(conv.id, { bot_enabled: !conv.bot_enabled })}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs hover:bg-[#F5F5F5] text-left"
                        style={{ color: conv.bot_enabled ? '#DC2626' : '#00847A' }}
                      >🤖 {conv.bot_enabled ? 'Apagar el bot' : 'Prender el bot'}</button>

                      <button
                        onClick={() => actualizarConv(conv.id, {
                          unread_count: (conv.unread_count ?? 0) > 0 ? 0 : 1,
                        })}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-[#0D0D0D] hover:bg-[#F5F5F5] text-left"
                      >{(conv.unread_count ?? 0) > 0 ? '👁️ Marcar como leído' : '🔵 Marcar como no leído'}</button>

                      <button
                        onClick={() => actualizarConv(conv.id, { fijado: !conv.fijado })}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-[#0D0D0D] hover:bg-[#F5F5F5] text-left"
                      >📌 {conv.fijado ? 'Quitar de arriba' : 'Fijar arriba'}</button>

                      <div className="border-t border-[#F0F0F0]" />

                      <button
                        onClick={() => { setMenuId(null); setConfirmId(conv.id); }}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs text-[#DC2626] hover:bg-[#FEE2E2] text-left"
                      >🗑 Eliminar chat</button>
                    </>
                  )}

                  {submenu === 'estado' && (
                    <>
                      <button
                        onClick={() => setSubmenu(null)}
                        className="w-full px-3.5 py-2 text-[10px] text-[#6B6B6B] hover:bg-[#F5F5F5] text-left border-b border-[#F0F0F0]"
                      >‹ Volver</button>
                      {estadosDisponibles.map(est => {
                        const activo = labels.some(l => l.toUpperCase() === est.toUpperCase());
                        return (
                          <button
                            key={est}
                            onClick={() => actualizarConv(conv.id, { label: conEstado(conv.label, activo ? null : est, estadosDisponibles) })}
                            className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-[11px] hover:bg-[#F5F5F5] text-left ${activo ? 'bg-[#F5F5F5] font-semibold' : ''}`}
                            style={{ color: colorDe(est) }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorDe(est) }} />
                            <span className="truncate">{est}</span>
                            {activo && <span className="ml-auto text-[10px]">✓</span>}
                          </button>
                        );
                      })}
                    </>
                  )}

                  {submenu === 'tags' && (
                    <>
                      <button
                        onClick={() => setSubmenu(null)}
                        className="w-full px-3.5 py-2 text-[10px] text-[#6B6B6B] hover:bg-[#F5F5F5] text-left border-b border-[#F0F0F0]"
                      >‹ Volver</button>
                      <p className="px-3.5 py-2 text-[10px] text-[#9A9A9A] leading-snug border-b border-[#F0F0F0]">
                        Se suman al estado sin reemplazarlo.
                      </p>
                      {tagsDisponibles.map(tag => {
                        const activo = labels.some(l => l.toUpperCase() === tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => {
                              const nuevoLabel = conTag(conv.label, tag);
                              const cambios: Record<string, unknown> = { label: nuevoLabel };
                              // Marcar HUMANO apaga el bot: responde una persona
                              if (!activo && tag === 'HUMANO') cambios.bot_enabled = false;
                              actualizarConv(conv.id, cambios);
                            }}
                            className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-[11px] hover:bg-[#F5F5F5] text-left ${activo ? 'bg-[#F5F5F5] font-semibold' : ''}`}
                            style={{ color: colorDe(tag) }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorDe(tag) }} />
                            <span className="truncate">{tag}</span>
                            <span className="ml-auto text-[10px]">{activo ? '✓' : '+'}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
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
                        {conv.fijado && <span className="mr-1 text-[10px]" title="Fijado">📌</span>}
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

                    {/* Row 3: chips de etiqueta (puede haber varias) */}
                    {(labels.length > 0 || (conv as any).entrega_fallida) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(conv as any).entrega_fallida && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none"
                            style={{ color: '#B91C1C', background: '#B91C1C18' }}
                            title="El último mensaje enviado no se pudo entregar"
                          >
                            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: '#B91C1C' }} />
                            📵 No entregado
                          </span>
                        )}
                        {labels.map(nombre => {
                          const e = etiquetas.find(x => x.nombre === nombre);
                          const color = e?.color ?? '#6B6B6B';
                          return (
                            <span
                              key={nombre}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold leading-none"
                              style={{ color, background: color + '18' }}
                            >
                              <span className="w-1 h-1 rounded-full shrink-0" style={{ background: color }} />
                              {nombre.length > 20 ? nombre.slice(0, 20) + '…' : nombre}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </button>

            </div>
          );
        })}
      </div>

      {/* Confirmación de borrado — centrada, no depende de dónde esté el mouse */}
      {confirmId && (() => {
        const conv = conversations.find(c => c.id === confirmId);
        const borrando = deleting === confirmId;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => { if (!borrando) setConfirmId(null); }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm font-bold text-[#0D0D0D] mb-1">¿Eliminar esta conversación?</p>
              <p className="text-xs text-[#6B6B6B] mb-4 leading-snug">
                Se borra <strong>{conv?.contact_name || 'este chat'}</strong> con todos sus mensajes
                del panel. No se puede deshacer.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmId(null)}
                  disabled={borrando}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-sm text-[#6B6B6B] hover:bg-[#F5F5F5] disabled:opacity-50"
                >Cancelar</button>
                <button
                  onClick={() => handleDelete(confirmId)}
                  disabled={borrando}
                  className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold hover:bg-[#b91c1c] disabled:opacity-50"
                >{borrando ? 'Borrando…' : 'Sí, eliminar'}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
