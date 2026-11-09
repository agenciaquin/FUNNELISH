'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar, { type PanelSection } from './Sidebar';
import { confirmarSalida, haySinGuardar } from '@/lib/panel/cambios';
import ConversationList from './ConversationList';
import ChatArea from './ChatArea';
import ClienteInfo from './ClienteInfo';
import MonederoFlotante from './MonederoFlotante';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { Conversation, Message } from '@/lib/panel/types';

// Lazy-loaded section panels
import dynamic from 'next/dynamic';
const EntrenamientoPanel = dynamic(() => import('./EntrenamientoPanel'), { ssr: false });
const PlantillasPanel    = dynamic(() => import('./PlantillasSeccion'), { ssr: false });
const DisparadoresPanel  = dynamic(() => import('./DisparadoresPanel'),  { ssr: false });
const AjustesPanel       = dynamic(() => import('./AjustesPanel'),       { ssr: false });
const ContactosPanel     = dynamic(() => import('./ContactosPanel'),     { ssr: false });
const EtiquetasPanel     = dynamic(() => import('./EtiquetasPanel'),     { ssr: false });
const IntegracionesPanel = dynamic(() => import('./IntegracionesPanel'), { ssr: false });
const ManualPanel        = dynamic(() => import('./ManualPanel'),        { ssr: false });
const CatalogosPanel     = dynamic(() => import('./CatalogosPanel'),     { ssr: false });
const EstadisticasPanel  = dynamic(() => import('./EstadisticasSeccion'), { ssr: false });
const MemoriaPanel       = dynamic(() => import('./MemoriaPanel'),        { ssr: false });
const FaqPanel           = dynamic(() => import('./FaqPanel'),            { ssr: false });
const EmbudosPanel       = dynamic(() => import('./EmbudosModulo'),       { ssr: false }); // pestañas Mis Embudos / Mi Página
const PedidosPanel       = dynamic(() => import('./PedidosPanel'),        { ssr: false });
const SeguimientoPanel   = dynamic(() => import('./SeguimientoPanel'),    { ssr: false });
const RemarketingPanel   = dynamic(() => import('./RemarketingPanel'),     { ssr: false });
const PromocionesPanel   = dynamic(() => import('./PromocionesPanel'),     { ssr: false });
const VendedoresLinksPanel = dynamic(() => import('./VendedoresLinksPanel'), { ssr: false });
const ColeccionesPanel   = dynamic(() => import('./ColeccionesPanel'),       { ssr: false });
const LiveShoppingPanel  = dynamic(() => import('./PanelLiveShopping'),    { ssr: false });
const VentasPanel        = dynamic(() => import('./VentasPanel'),         { ssr: false });
const MetasPanel         = dynamic(() => import('./MetasPanel'),          { ssr: false });
const VendedoresPanel    = dynamic(() => import('./VendedoresPanel'),     { ssr: false });
const ObjecionesPanel    = dynamic(() => import('./ObjecionesPanel'),     { ssr: false });
const SupervisorPanel    = dynamic(() => import('./SupervisorPanel'),     { ssr: false });
const VentasVendedoresPanel = dynamic(() => import('./ventas-vendedores/VentasVendedoresPanel'), { ssr: false });
const MasterVendedoresPanel = dynamic(() => import('./master-vendedores/MasterVendedoresPanel'), { ssr: false });

interface Props {
  userName: string;
}

export default function WhatsAppPanel({ userName }: Props) {
  const [activeSection, setActiveSection] = useState<PanelSection>('chat');
  const [embudoAEditar, setEmbudoAEditar] = useState<string | null>(null); // abrir un embudo desde Pedidos

  // Al refrescar, vuelve a la MISMA sección donde estabas (no al inicio).
  useEffect(() => {
    try {
      const guardada = localStorage.getItem('quin_panel_seccion') as PanelSection | null;
      if (guardada) setActiveSection(guardada);
    } catch { /* ignorar */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('quin_panel_seccion', activeSection); } catch { /* ignorar */ }
  }, [activeSection]);

  // Cambiar de sección pregunta si hay cambios sin guardar (ej. editando un embudo).
  const cambiarSeccion = useCallback((s: PanelSection) => {
    if (!confirmarSalida()) return false;
    setActiveSection(s);
    return true;
  }, []);

  // Refrescar / cerrar la pestaña con cambios sin guardar → el navegador avisa.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (haySinGuardar()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [loading, setLoading]             = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false); // menú lateral en móvil
  const [showInfo, setShowInfo]           = useState(false);  // ficha del cliente (columna derecha, desplegable)
  const [refrescando, setRefrescando]     = useState(false);
  // Cambiar este número fuerza a recrear las suscripciones en vivo
  const [conexion, setConexion]           = useState(0);
  // Cambia al redimensionar o hacer zoom: obliga a redibujar bien el panel
  const [medida, setMedida]               = useState(0);

  // Mientras el panel está montado, el body no scrollea (solo sus áreas internas).
  // Al salir, se restaura, para que las páginas de venta scrolleen normal.
  useEffect(() => {
    document.body.classList.add('panel-abierto');
    return () => document.body.classList.remove('panel-abierto');
  }, []);

  // Si cambia el tamaño de la ventana o el zoom del navegador, se vuelve a
  // dibujar el panel. Sin esto quedaba con las medidas viejas y se veía cortado.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const alCambiar = () => {
      clearTimeout(t);
      t = setTimeout(() => setMedida(n => n + 1), 150);
    };
    window.addEventListener('resize', alCambiar);
    // El zoom del navegador cambia la resolución efectiva de la pantalla
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener?.('change', alCambiar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', alCambiar);
      mq.removeEventListener?.('change', alCambiar);
    };
  }, []);

  const supabase = createBrowserSupabaseClient();
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // Espejos para leer el estado actual dentro del listener del botón "atrás"
  const sidebarRef = useRef(false);
  sidebarRef.current = mobileSidebar;

  // ── Botón "atrás" del celular ─────────────────────────────────────────────
  // En vez de cerrar la app, retrocede dentro de ella: cierra el menú, vuelve
  // al Chat desde otra sección, y del chat abierto vuelve a la lista.
  useEffect(() => {
    // Entrada centinela: sin esto el primer "atrás" saldría de la app
    try { window.history.pushState({ quinchat: true }, ''); } catch { /* ignorar */ }

    const alRetroceder = () => {
      let manejado = false;

      // 1) Menú lateral abierto → cerrarlo.
      if (sidebarRef.current) {
        setMobileSidebar(false);
        manejado = true;
      // 2) Chat abierto → cerrarlo y volver a la LISTA de la MISMA sección
      //    (si estás en Chat WhatsApp te quedas en Chat WhatsApp, no salta a Funnel).
      } else if (selectedIdRef.current) {
        setSelectedId(null);
        setMessages([]);
        manejado = true;
      }
      // 3) En una sección sin chat abierto → NO se cambia de sección: te quedas
      //    donde estás (antes saltaba a Chat Funnel). Aquí no se marca 'manejado',
      //    así el sistema decide si sales de la app normalmente.

      // Si retrocedimos dentro de la app, volvemos a armar la trampa.
      if (manejado) {
        try { window.history.pushState({ quinchat: true }, ''); } catch { /* ignorar */ }
      }
    };

    window.addEventListener('popstate', alRetroceder);
    return () => window.removeEventListener('popstate', alRetroceder);
  }, []);

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_time', { ascending: false });

    // Chats creados solo por una plantilla automática (carrito / descuento) quedan OCULTOS
    // hasta que el cliente responda; así la bandeja no se llena de mensajes enviados.
    // (Si justo está abierto, se mantiene.)
    if (!error) setConversations((data ?? []).filter((c: any) => !c.oculto || c.id === selectedIdRef.current));
    setLoading(false);
  }, []);

  // ── Load messages ─────────────────────────────────────────────────────────
  // `silencioso` evita parpadeos: solo reemplaza la lista si de verdad cambió.
  const loadMessages = useCallback(async (conversationId: string, silencioso = false) => {
    // Los ÚLTIMOS 800 (más nuevos primero) y se voltean. Antes se pedía en orden ascendente sin límite y
    // la base corta en 1.000 filas: en chats largos (vendedores con 1.300+ mensajes) se veían los más
    // VIEJOS y lo de hoy quedaba oculto (08-nov-2026).
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(800);

    if (error) return;
    const nuevos = [...(data ?? [])].reverse();

    if (!silencioso) { setMessages(nuevos); return; }

    setMessages(prev => {
      if (prev.length !== nuevos.length) return nuevos;
      // Misma cantidad: comprobar si cambió algún id o estado de entrega
      const igual = prev.every((m, i) => m.id === nuevos[i]?.id && m.status === nuevos[i]?.status);
      return igual ? prev : nuevos;
    });
  }, []);

  // ── Refresco manual / automático ──────────────────────────────────────────
  const refrescar = useCallback(async (mostrarSpinner = false) => {
    if (mostrarSpinner) setRefrescando(true);
    try {
      await loadConversations();
      const id = selectedIdRef.current;
      if (id) await loadMessages(id, true);
    } finally {
      if (mostrarSpinner) setTimeout(() => setRefrescando(false), 400);
    }
  }, [loadConversations, loadMessages]);

  // ── Realtime: conversations ───────────────────────────────────────────────
  // CARGA DE LA BASE (06-nov-2026): antes, CADA cambio en CUALQUIER chat hacía que cada
  // panel abierto volviera a pedir TODAS las conversaciones (6.400+). Con varias personas
  // conectadas en hora pico eso saturó la base y tumbó panel, bot y crons.
  // Ahora: el cambio que llega en vivo se aplica SOLO a ese chat (sin consultar la base),
  // y la recarga completa queda como respaldo, agrupada (máx. 1 cada 4 s).
  const recargaPend = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recargarPronto = useCallback(() => {
    if (recargaPend.current) return;
    recargaPend.current = setTimeout(() => { recargaPend.current = null; loadConversations(); }, 4000);
  }, [loadConversations]);
  useEffect(() => () => { if (recargaPend.current) clearTimeout(recargaPend.current); }, []);

  useEffect(() => {
    loadConversations();

    const ms = (s: any) => { const t = Date.parse(String(s ?? '').replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')); return isNaN(t) ? 0 : t; };
    const ch = supabase
      .channel(`conversations-changes-${conexion}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload: any) => {
        if (payload?.eventType === 'DELETE') {
          const idBorrado = payload?.old?.id;
          if (idBorrado) setConversations(prev => prev.filter(c => c.id !== idBorrado)); else recargarPronto();
          return;
        }
        const fila = payload?.new;
        if (!fila?.id) { recargarPronto(); return; }   // el aviso llegó sin datos → respaldo
        setConversations(prev => {
          const resto = prev.filter(c => c.id !== fila.id);
          const visible = !fila.oculto || fila.id === selectedIdRef.current;
          if (!visible) return resto;
          const anterior = prev.find(c => c.id === fila.id);
          const lista = [{ ...(anterior ?? {}), ...fila } as Conversation, ...resto];
          return lista.sort((a: any, b: any) => ms(b.last_message_time) - ms(a.last_message_time));
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [loadConversations, conexion, recargarPronto]);

  // ── Mantener el chat "en vivo" ────────────────────────────────────────────
  // 1) Al volver a la app (o recuperar internet) se refresca y se reconecta.
  //    Esto es lo que evitaba tener que cerrar y volver a abrir la aplicación.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      setConexion(c => c + 1); // recrear suscripciones: el socket muere en segundo plano
      refrescar();
    };
    const alReconectar = () => { setConexion(c => c + 1); refrescar(); };

    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    window.addEventListener('online', alReconectar);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      window.removeEventListener('online', alReconectar);
    };
  }, [refrescar]);

  // 2) Red de seguridad: consulta periódica mientras la app está a la vista,
  //    por si la conexión en vivo se cae sin avisar.
  //    Cada 6 s solo se revisan los mensajes del chat ABIERTO (consulta pequeña);
  //    la lista completa de conversaciones se repasa cada 60 s (antes cada 6 s).
  const ticks = useRef(0);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      ticks.current += 1;
      if (ticks.current % 10 === 0) { refrescar(); return; }
      const id = selectedIdRef.current;
      if (id) loadMessages(id, true);
    }, 6000);
    return () => clearInterval(t);
  }, [refrescar, loadMessages]);

  // ── Realtime: messages ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;

    const ch = supabase
      .channel(`messages-${selectedId}-${conexion}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
      )
      .on(
        // Estados de entrega/lectura (✓ ✓✓) llegan como UPDATE
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          const upd = payload.new as Message;
          setMessages(prev => prev.map(m => (m.id === upd.id ? { ...m, ...upd } : m)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [selectedId, conexion]);

  // ── Select conversation ───────────────────────────────────────────────────
  async function selectConversation(id: string) {
    setSelectedId(id);
    setMessages([]);
    await loadMessages(id);

    await supabase.from('conversations').update({ unread_count: 0 }).eq('id', id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c));
  }

  // ── Abrir un chat desde otra sección (Pedidos, Carritos, Ventas…) ─────────
  // Va a la bandeja correcta (Funnel o Ventas) y, si el chat es viejo y no está
  // en la lista cargada, lo trae para que se vea igual.
  async function abrirChatDesde(id: string) {
    let conv = conversations.find(c => c.id === id);
    if (!conv) {
      const { data } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
      if (data) {
        conv = data as Conversation;
        setConversations(prev => (prev.some(c => c.id === id) ? prev : [data as Conversation, ...prev]));
      }
    }
    setActiveSection(conv?.linea === 'ventas' ? 'chat_ventas' : 'chat');
    await selectConversation(id);
  }

  // ── Soporte (Lilibeth 3187051499): abre su chat en la LÍNEA del tab actual ──
  // En Funnel abre como funnel (responde por el número del funnel); en WhatsApp
  // abre como ventas. El bot queda apagado en su chat (es soporte, no cliente).
  async function abrirSoporte() {
    const LILIBETH = '573187051499';
    const esVentas = activeSection === 'chat_ventas';
    // Chats SEPARADOS por línea: ventas usa el número real; funnel usa un id
    // sintético (…@funnel) para que su historial no se mezcle con el de WhatsApp.
    const id = esVentas ? LILIBETH : `${LILIBETH}@funnel`;
    try {
      await supabase.from('conversations').upsert({
        id, contact_name: 'Soporte', linea: esVentas ? 'ventas' : 'funnel', bot_enabled: false,
      }, { onConflict: 'id' });
    } catch { /* ignorar */ }
    await loadConversations();
    await selectConversation(id);
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
  // Cada bandeja muestra solo sus chats: Ventas o Funnel (todo lo que no es ventas)
  const convsFunnel = conversations.filter(c => c.linea !== 'ventas');
  const convsVentas = conversations.filter(c => c.linea === 'ventas');

  return (
    // h-full sobre <html>/<body> al 100%: el navegador lo recalcula solo cuando
    // cambia el zoom o el tamaño de la ventana (con 100vh se quedaba desfasado).
    <div data-medida={medida} className="panel-app flex h-full min-h-0 bg-[#FAF9F6] overflow-hidden">

      {/* Monedero flotante de metas — visible en todas las secciones */}
      <MonederoFlotante onAbrir={() => cambiarSeccion('metas')} />

      {/* Sidebar — escritorio fijo; móvil cajón deslizante */}
      <div className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:static md:z-auto md:translate-x-0 md:shrink-0 md:h-full ${mobileSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          userName={userName}
          activeSection={activeSection}
          onSectionChange={(s) => { if (cambiarSeccion(s)) setMobileSidebar(false); }}
        />
      </div>
      {/* Fondo oscuro al abrir el menú en móvil */}
      {mobileSidebar && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileSidebar(false)} />
      )}
      {/* Botón ☰ flotante en móvil para secciones que no son Chat */}
      {activeSection !== 'chat' && activeSection !== 'chat_ventas' && (
        <button
          onClick={() => setMobileSidebar(true)}
          className="md:hidden fixed top-2 left-2 z-30 w-9 h-9 rounded-lg bg-[#00A89D] text-white flex items-center justify-center shadow-lg"
          aria-label="Abrir menú"
        >☰</button>
      )}

      {/* ── Chat Funnel / Chat Ventas ── */}
      {(activeSection === 'chat' || activeSection === 'chat_ventas') && (
        <>
          <ConversationList
            conversations={activeSection === 'chat_ventas' ? convsVentas : convsFunnel}
            selectedId={selectedId}
            onSelect={selectConversation}
            onDelete={deleteConversation}
            loading={loading}
            onMenuClick={() => setMobileSidebar(true)}
            onRefresh={() => refrescar(true)}
            refreshing={refrescando}
            onSoporte={abrirSoporte}
            otrasConversaciones={activeSection === 'chat_ventas' ? convsFunnel : convsVentas}
            otraBandeja={activeSection === 'chat_ventas' ? 'Chat Funnel' : 'Chat WhatsApp'}
            onAbrirOtro={id => { abrirChatDesde(id); }}
          />
          <ChatArea
            conversation={selectedConversation}
            messages={messages}
            onMessageSent={(msg) => setMessages(prev => [...prev, msg])}
            onConversationsUpdate={loadConversations}
            onBack={() => { setSelectedId(null); setMessages([]); }}
            infoVisible={showInfo}
            onToggleInfo={() => setShowInfo(v => !v)}
          />
          {selectedConversation && showInfo && (
            <ClienteInfo
              key={selectedConversation.id}
              conversation={selectedConversation}
              onClose={() => setShowInfo(false)}
            />
          )}
        </>
      )}

      {/* ── Other sections ── */}
      {activeSection === 'metas'         && <MetasPanel />}
      {activeSection === 'estadisticas'  && <EstadisticasPanel />}
      {activeSection === 'memoria'       && <MemoriaPanel />}
      {activeSection === 'faq'           && <FaqPanel />}
      {activeSection === 'embudos'       && <EmbudosPanel abrirSlug={embudoAEditar} onAbierto={() => setEmbudoAEditar(null)} />}
      {activeSection === 'pedidos'       && (
        <PedidosPanel
          onAbrirChat={id => { abrirChatDesde(id); }}
          onEditarEmbudo={slug => { setEmbudoAEditar(slug); setActiveSection('embudos'); }}
        />
      )}
      {activeSection === 'ventas'        && (
        <VentasPanel
          onAbrirChat={id => { setActiveSection('chat'); selectConversation(id); }}
        />
      )}
      {activeSection === 'vendedores'    && <VendedoresPanel />}
      {activeSection === 'master_vendedores' && (
        <MasterVendedoresPanel onAbrirChat={id => { abrirChatDesde(id); }} />
      )}
      {activeSection === 'ventas_vendedores' && (
        <VentasVendedoresPanel onAbrirChat={id => { abrirChatDesde(id); }} />
      )}
      {activeSection === 'objeciones'    && (
        <ObjecionesPanel
          onAbrirChat={id => { setActiveSection('chat'); selectConversation(id); }}
        />
      )}
      {activeSection === 'supervisor'    && (
        <SupervisorPanel onAbrirChat={id => { abrirChatDesde(id); }} />
      )}
      {activeSection === 'seguimiento'   && (
        <SeguimientoPanel
          onAbrirChat={id => { setActiveSection('chat'); selectConversation(id); }}
        />
      )}
      {activeSection === 'remarketing'   && <RemarketingPanel />}
      {activeSection === 'promociones'   && <PromocionesPanel />}
      {activeSection === 'vendedores_links' && <VendedoresLinksPanel />}
      {activeSection === 'colecciones'   && <ColeccionesPanel />}
      {activeSection === 'live_shopping' && <LiveShoppingPanel />}
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
