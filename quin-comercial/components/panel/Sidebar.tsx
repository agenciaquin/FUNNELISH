'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import BotonAvisos from './BotonAvisos';
import ConfirmacionModal from './ConfirmacionModal';

/** Formatea un número de WhatsApp para mostrarlo lindo: +57 317 265 3897 */
function formatearNumero(n: string): string {
  const d = String(n).replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 12 && d.startsWith('57')) {
    const r = d.slice(2);
    return `+57 ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6)}`;
  }
  return '+' + d;
}

export type PanelSection = 'chat' | 'chat_ventas' | 'estadisticas' | 'embudos' | 'pedidos' | 'ventas' | 'vendedores' | 'seguimiento' | 'objeciones' | 'memoria' | 'faq' | 'entrenamiento' | 'plantillas' | 'disparadores' | 'contactos' | 'etiquetas' | 'catalogos' | 'integraciones' | 'ajustes' | 'manual' | 'wa_config' | 'empresas' | 'plantillas_embudo' | 'quino_aprendizaje' | 'recarga' | 'integrar_ia' | 'plantillas_conocimiento' | 'asistente_bot' | 'entrenar_bot' | 'dominio' | 'carritos' | 'guias_effi';

// Íconos SVG personalizados (embudo de ventas y WhatsApp)
const IconoEmbudo = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} width="18" height="18" aria-hidden>
    <path d="M3 4h18a1 1 0 0 1 .8 1.6L15 14v5a1 1 0 0 1-.55.9l-3 1.5A1 1 0 0 1 10 21.5V14L2.2 5.6A1 1 0 0 1 3 4z" />
  </svg>
);
const IconoWhatsApp = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" fill={color} width="18" height="18" aria-hidden>
    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.77.46 3.42 1.27 4.86L2 22l5.25-1.38A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.58 0-3.05-.46-4.29-1.25l-.3-.18-3.12.82.83-3.04-.2-.31A7.93 7.93 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm4.5-5.6c-.25-.12-1.47-.72-1.7-.8-.23-.09-.4-.13-.56.12-.17.25-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.38-1.73-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.42.06-.64.31-.22.25-.85.83-.85 2.02s.87 2.35 1 2.51c.12.17 1.7 2.6 4.13 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28z" />
  </svg>
);

// ── Estructura de menú: 6 grupos, cada uno con sus pestañas (estilo Funnelish) ──
export type Tab = { key: PanelSection; label: string };
export type Grupo = { key: string; label: string; icon?: string; svg?: 'embudo' | 'whatsapp'; color?: string; soloAdmin?: boolean; tabs: Tab[] };

export const GRUPOS: Grupo[] = [
  { key: 'empresas', label: 'Empresas', icon: '🏢', soloAdmin: true, tabs: [
    { key: 'empresas',          label: 'Empresas' },
    { key: 'quino_aprendizaje', label: 'Aprendizaje Quino' },
  ] },
  { key: 'chats', label: 'Chatbot', svg: 'whatsapp', color: '#25D366', tabs: [
    { key: 'chat', label: 'Chatbot' },
  ] },
  { key: 'embudos', label: 'Embudos', svg: 'embudo', color: '#ffffff', tabs: [
    { key: 'plantillas_embudo', label: 'Plantillas' },
    { key: 'embudos',           label: 'Embudos' },
    { key: 'carritos',          label: '🛒 Carritos abandonados' },
    { key: 'dominio',           label: '🌐 Mi dominio' },
    { key: 'pedidos',           label: 'Ventas' },
    { key: 'guias_effi',        label: '📦 Guías Effi' },
    { key: 'estadisticas',      label: 'Estadísticas' },
  ] },
  { key: 'bot', label: 'Bot', icon: '🤖', tabs: [
    { key: 'asistente_bot', label: '🪄 Arma tu bot con Quino' },
    { key: 'integrar_ia',   label: 'Integrar IA' },
    { key: 'entrenamiento', label: 'Entrenamiento' },
    { key: 'plantillas_conocimiento', label: 'Plantillas de conocimiento' },
    { key: 'memoria',       label: 'Memoria' },
    { key: 'faq',           label: 'Preguntas frecuentes' },
    { key: 'objeciones',    label: 'Objeciones' },
    { key: 'disparadores',  label: 'Disparadores' },
    { key: 'plantillas',    label: 'Plantillas WhatsApp' },
  ] },
  // Catálogos como MÓDULO propio (una sola pestaña = no despliega, va directo).
  { key: 'catalogos_grp', label: 'Catálogos', icon: '📦', tabs: [
    { key: 'catalogos', label: 'Catálogos' },
  ] },
  { key: 'marketing', label: 'Marketing', icon: '🎯', tabs: [
    { key: 'seguimiento', label: 'Meta Ads' },
  ] },
  { key: 'ajustes', label: 'Ajustes', icon: '⚙️', tabs: [
    { key: 'recarga',       label: 'Recarga' },
    { key: 'wa_config',     label: 'Conexión WhatsApp' },
    { key: 'integraciones', label: 'Integraciones' },
    { key: 'contactos',     label: 'Contactos' },
    { key: 'etiquetas',     label: 'Etiquetas' },
    { key: 'vendedores',    label: 'Vendedores' },
    { key: 'ventas',        label: 'Estado en Effi' },
    { key: 'ajustes',       label: 'Ajustes' },
    { key: 'manual',        label: 'Manual' },
  ] },
];

/** Devuelve el grupo al que pertenece una sección (para pintar la pestaña activa). */
export function grupoDeSeccion(s: PanelSection): Grupo {
  return GRUPOS.find(g => g.tabs.some(t => t.key === s)) ?? GRUPOS[1];
}

interface Props {
  userName: string;
  activeSection: PanelSection;
  onSectionChange: (s: PanelSection) => void;
  esSuperAdmin?: boolean;
}

const CLAVE_PLEGADO = 'quin_menu_plegado';

export default function Sidebar({ userName, activeSection, onSectionChange, esSuperAdmin }: Props) {
  const initial = userName.charAt(0).toUpperCase() || 'U';
  const grupoActivo = grupoDeSeccion(activeSection).key;
  const grupos = GRUPOS.filter(g => !g.soloAdmin || esSuperAdmin);
  const [abiertos, setAbiertos] = useState<string[]>([grupoActivo]);

  // Plegado 100% MANUAL con la hamburguesa. Se recuerda entre sesiones para que
  // el usuario navegue como le guste (ya no se recoge solo al entrar al chat).
  const [colapsado, setColapsado] = useState(false);
  useEffect(() => {
    try {
      const g = localStorage.getItem(CLAVE_PLEGADO);
      if (g === '1') setColapsado(true);
    } catch { /* sin storage */ }
  }, []);
  function alternarPlegado() {
    setColapsado(v => {
      const nuevo = !v;
      try { localStorage.setItem(CLAVE_PLEGADO, nuevo ? '1' : '0'); } catch { /* nada */ }
      return nuevo;
    });
  }

  // Menú del usuario (perfil) y confirmación de cierre de sesión.
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [confSalir, setConfSalir]     = useState(false);

  useEffect(() => {
    setAbiertos(prev => (prev.includes(grupoActivo) ? prev : [...prev, grupoActivo]));
  }, [grupoActivo]);

  const [numeroBot, setNumeroBot] = useState<string>('');
  useEffect(() => {
    let vivo = true;
    fetch('/api/tenant/whatsapp')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (vivo && d?.wa_numero) setNumeroBot(formatearNumero(d.wa_numero)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  return (
    <aside
      className={`${colapsado ? 'w-[64px]' : 'w-[190px]'} transition-[width] duration-200 ease-out h-full min-h-0 flex flex-col shrink-0 text-white bg-[#0B1B1A] shadow-xl shadow-black/30 overflow-hidden`}>

      {/* Estilo de la barra de scroll del menú, en el tono de la marca */}
      <style>{`
        .quin-nav-scroll::-webkit-scrollbar { width: 6px; }
        .quin-nav-scroll::-webkit-scrollbar-track { background: transparent; }
        .quin-nav-scroll::-webkit-scrollbar-thumb { background: #1E3A36; border-radius: 999px; }
        .quin-nav-scroll::-webkit-scrollbar-thumb:hover { background: #2A4E48; }
        .quin-nav-scroll { scrollbar-width: thin; scrollbar-color: #1E3A36 transparent; }
      `}</style>

      {/* Hamburguesa: plegar / desplegar el menú a mano (queda a tu gusto) */}
      <div className={`px-2 pt-2 flex ${colapsado ? 'justify-center' : 'justify-end'}`}>
        <button
          onClick={alternarPlegado}
          title={colapsado ? 'Desplegar menú' : 'Plegar menú'}
          aria-label="Plegar o desplegar el menú"
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <span className="flex flex-col gap-[3px] w-4">
            <span className="block h-[2px] w-full bg-white rounded-full" />
            <span className="block h-[2px] w-full bg-white rounded-full" />
            <span className="block h-[2px] w-full bg-white rounded-full" />
          </span>
        </button>
      </div>

      {/* Brand — logo más pequeño */}
      <div className="px-2 py-3 border-b border-white/10 flex flex-col items-center">
        <Image
          src="/logo-quin-app.png"
          alt="QuinChat — Agencia Quin"
          width={110}
          height={110}
          className={`object-contain drop-shadow-lg transition-all duration-200 ${colapsado ? 'w-8 h-8' : 'w-16 h-16'}`}
          priority
        />
        {!colapsado && <p className="text-[10px] text-white/60 mt-1.5">Panel de administración</p>}
      </div>

      {/* Cuenta / perfil de usuario — clic para abrir el menú (mi cuenta, salir) */}
      <div className="px-2 py-2.5 border-b border-white/10 relative">
        <button
          onClick={() => setMenuUsuario(v => !v)}
          className={`w-full flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-white/10 transition-colors ${colapsado ? 'justify-center' : ''}`}
          title="Mi perfil"
        >
          <div className="w-8 h-8 rounded-full bg-[#00A89D] flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initial}
          </div>
          <div className={`min-w-0 flex-1 text-left ${colapsado ? 'hidden' : ''}`}>
            <div className="text-xs font-semibold text-white truncate">{userName || 'Agencia Quin'}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0 animate-pulse" />
              <span className="text-[10px] text-white/70">Activo</span>
            </div>
            {numeroBot && (
              <div className="flex items-center gap-1 mt-1" title="Número del bot conectado">
                <span className="text-[10px] shrink-0">📱</span>
                <span className="text-[10px] text-white/90 font-medium truncate">{numeroBot}</span>
              </div>
            )}
          </div>
          {!colapsado && <span className="text-white/50 text-xs shrink-0">⌄</span>}
        </button>

        {menuUsuario && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuUsuario(false)} />
            <div className="absolute left-2 right-2 top-[calc(100%-2px)] z-40 bg-white rounded-xl shadow-2xl border border-black/10 overflow-hidden">
              <button
                onClick={() => { setMenuUsuario(false); onSectionChange('ajustes'); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-[#0D0D0D] hover:bg-[#F5F5F5] text-left"
              >
                <span>👤</span> Mi cuenta
              </button>
              <button
                onClick={() => { setMenuUsuario(false); setConfSalir(true); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-red-600 hover:bg-red-50 text-left border-t border-[#F0F0F0]"
              >
                <span>↩</span> Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>

      {/* Nav — grupos en acordeón. Activo = píldora en el teal de la marca. */}
      <nav className="quin-nav-scroll flex-1 px-2 py-3 flex flex-col gap-1 overflow-y-auto">
        {grupos.map(g => {
          const active = grupoActivo === g.key;
          const tieneSub = g.tabs.length > 1;
          const abierto = abiertos.includes(g.key);
          return (
            <div key={g.key} className="flex flex-col">
              <button
                onClick={() => {
                  onSectionChange(g.tabs[0].key);
                  if (tieneSub) {
                    setAbiertos(prev =>
                      prev.includes(g.key) ? prev.filter(x => x !== g.key) : [...prev, g.key]
                    );
                  }
                }}
                className={`group w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-200 ease-out ${colapsado ? 'justify-center gap-0' : 'gap-3'} ${
                  active
                    ? 'bg-[#00A89D] text-white font-semibold shadow-md shadow-black/20'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
                title={colapsado ? g.label : undefined}
              >
                <span className="text-base shrink-0 flex items-center">
                  {g.svg === 'embudo'   ? <IconoEmbudo color={active ? '#ffffff' : (g.color ?? '#ffffff')} />
                   : g.svg === 'whatsapp' ? <IconoWhatsApp color={g.color ?? '#25D366'} />
                   : g.icon}
                </span>
                <span className={`truncate flex-1 ${colapsado ? 'hidden' : ''}`}>{g.label}</span>
                {tieneSub && !colapsado && (
                  <span className={`text-xs shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180' : ''} ${active ? 'text-white/90' : 'text-white/60'}`}>⌄</span>
                )}
              </button>

              {/* Subopciones desplegables (acordeón) */}
              {tieneSub && abierto && !colapsado && (
                <div className="mt-1 mb-1 ml-4 pl-3 flex flex-col gap-0.5 border-l border-white/15">
                  {g.tabs.map(t => {
                    const subActive = t.key === activeSection;
                    return (
                      <button
                        key={t.key}
                        onClick={() => onSectionChange(t.key)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] transition-all duration-150 ${
                          subActive
                            ? 'bg-[#00A89D] text-white font-semibold'
                            : 'text-white/65 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Barra inferior compacta: solo avisos (campanita) y refrescar app */}
      <div className="px-2 pb-3 border-t border-white/10 pt-2">
        <div className={`flex items-center ${colapsado ? 'flex-col gap-1' : 'gap-1 justify-center'}`}>
          <BotonAvisos colapsado />
          <button
            onClick={() => window.location.reload()}
            title="Recargar la aplicación completa"
            className="w-9 h-9 shrink-0 rounded-xl text-white/85 hover:text-white hover:bg-white/10 flex items-center justify-center text-base transition-colors"
          >
            ⟳
          </button>
        </div>
      </div>

      <ConfirmacionModal
        abierto={confSalir}
        titulo="¿Estás seguro que deseas cerrar sesión?"
        mensaje="Tendrás que volver a iniciar sesión para entrar al panel."
        textoAceptar="Cerrar sesión"
        peligro
        onAceptar={() => { setConfSalir(false); signOut({ callbackUrl: '/login' }); }}
        onCancelar={() => setConfSalir(false)}
      />
    </aside>
  );
}
