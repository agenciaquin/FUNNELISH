'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { confirmarSalida } from '@/lib/panel/cambios';
import BotonAvisos from './BotonAvisos';

export type PanelSection = 'chat' | 'chat_ventas' | 'metas' | 'estadisticas' | 'embudos' | 'pedidos' | 'ventas' | 'vendedores' | 'seguimiento' | 'objeciones' | 'remarketing' | 'memoria' | 'faq' | 'entrenamiento' | 'plantillas' | 'disparadores' | 'contactos' | 'etiquetas' | 'catalogos' | 'integraciones' | 'ajustes' | 'manual';

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

// Botones principales del menú
type NavItem = { key: PanelSection; label: string; icon?: string; svg?: 'embudo' | 'whatsapp'; color?: string };
const NAV_MAIN: NavItem[] = [
  { key: 'chat',         label: 'Chat Funnel',   svg: 'embudo',   color: '#3B82F6' },
  { key: 'chat_ventas',  label: 'Chat WhatsApp', svg: 'whatsapp', color: '#25D366' },
  { key: 'metas',        label: 'Tus metas',    icon: '🏅' },
  { key: 'estadisticas', label: 'Estadísticas', icon: '📊' },
  { key: 'embudos',      label: 'Embudos',      icon: '🚀' },
  { key: 'pedidos',      label: 'Pedidos',      icon: '🛒' },
  { key: 'ventas',       label: 'Estado en Effi', icon: '🔵' },
  { key: 'vendedores',   label: 'Vendedores',   icon: '🏆' },
  { key: 'seguimiento',  label: 'META ADS',     icon: '🎯' },
  { key: 'objeciones',   label: 'Objeciones',   icon: '🔎' },
  { key: 'remarketing',  label: 'Remarketing',  icon: '📣' },
];

// Todo lo demás vive dentro de "Herramientas"
const NAV_HERRAMIENTAS: { key: PanelSection; label: string; icon: string }[] = [
  { key: 'memoria',       label: 'Memoria del bot', icon: '🧠' },
  { key: 'faq',           label: 'Preguntas frecuentes', icon: '💬' },
  { key: 'entrenamiento', label: 'Entrenamiento', icon: '🎓' },
  { key: 'plantillas',    label: 'Plantillas',    icon: '📋' },
  { key: 'disparadores',  label: 'Disparadores',  icon: '⚡' },
  { key: 'contactos',     label: 'Contactos',     icon: '👥' },
  { key: 'etiquetas',     label: 'Etiquetas',     icon: '🏷️' },
  { key: 'catalogos',     label: 'Catálogos',     icon: '📦' },
  { key: 'integraciones', label: 'Integraciones', icon: '🔗' },
  { key: 'ajustes',       label: 'Ajustes',       icon: '⚙️' },
  { key: 'manual',        label: 'Manual',        icon: '📖' },
];

interface Props {
  userName: string;
  activeSection: PanelSection;
  onSectionChange: (s: PanelSection) => void;
}

export default function Sidebar({ userName, activeSection, onSectionChange }: Props) {
  const initial = userName.charAt(0).toUpperCase() || 'U';

  const enHerramientas = NAV_HERRAMIENTAS.some(i => i.key === activeSection);
  // Si estás dentro de una herramienta, el submenú arranca abierto
  const [herramientasAbierto, setHerramientasAbierto] = useState(enHerramientas);

  return (
    <aside className="w-[190px] h-full min-h-0 flex flex-col shrink-0 text-white bg-gradient-to-b from-[#00B5A6] via-[#00A89D] to-[#00847A] shadow-xl shadow-[#00847A]/20">

      {/* Brand — logo QuinChat */}
      <div className="px-4 py-4 border-b border-white/15 flex flex-col items-center">
        <Image
          src="/logo-quin-app.png"
          alt="QuinChat — Agencia Quin"
          width={110}
          height={110}
          className="object-contain drop-shadow-lg"
          priority
        />
        <p className="text-[10px] text-white/70 mt-2">Panel de administración</p>
      </div>

      {/* Account */}
      <div className="px-3 py-3 border-b border-white/15 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white truncate">{userName || 'Agencia Quin'}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0 animate-pulse" />
            <span className="text-[10px] text-white/75">Activo</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-1 overflow-y-auto">
        {NAV_MAIN.map(item => {
          const active = activeSection === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSectionChange(item.key)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-200 ease-out ${
                active
                  ? 'bg-white text-[#00847A] font-semibold shadow-md shadow-black/10 scale-[1.03]'
                  : 'text-white/85 hover:text-white hover:bg-white/15 hover:translate-x-1'
              }`}
            >
              <span className={`text-base shrink-0 flex items-center transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`}>
                {item.svg === 'embudo'   ? <IconoEmbudo color={item.color ?? '#3B82F6'} />
                 : item.svg === 'whatsapp' ? <IconoWhatsApp color={item.color ?? '#25D366'} />
                 : item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00A89D] shrink-0" />
              )}
            </button>
          );
        })}

        {/* Herramientas — agrupa el resto de secciones */}
        <button
          onClick={() => setHerramientasAbierto(prev => !prev)}
          className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-200 ease-out ${
            enHerramientas && !herramientasAbierto
              ? 'bg-white text-[#00847A] font-semibold shadow-md shadow-black/10'
              : 'text-white/85 hover:text-white hover:bg-white/15'
          }`}
        >
          <span className="text-base shrink-0">🧰</span>
          <span className="truncate">Herramientas</span>
          <span className={`ml-auto text-[10px] opacity-70 transition-transform duration-200 ${herramientasAbierto ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>

        {herramientasAbierto && (
          <div className="pl-2 flex flex-col gap-0.5 border-l border-white/20 ml-3 mt-0.5 mb-1">
            {NAV_HERRAMIENTAS.map(item => {
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSectionChange(item.key)}
                  className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-left transition-all duration-200 ease-out ${
                    active
                      ? 'bg-white text-[#00847A] font-semibold shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/15 hover:translate-x-1'
                  }`}
                >
                  <span className="text-sm shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 border-t border-white/15 pt-3 flex flex-col gap-1">
        <BotonAvisos />
        {/* Refrescar toda la app: si algo se traba, la deja como recién abierta */}
        <button
          onClick={() => { if (confirmarSalida()) window.location.reload(); }}
          title="Recargar la aplicación completa"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/85 hover:text-white hover:bg-white/15 hover:translate-x-1 transition-all duration-200 ease-out"
        >
          <span className="text-base shrink-0">⟳</span>
          <span>Refrescar app</span>
        </button>
        <button
          onClick={() => { if (confirmarSalida()) signOut({ callbackUrl: '/login' }); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/85 hover:text-white hover:bg-white/15 hover:translate-x-1 transition-all duration-200 ease-out"
        >
          <span className="text-base shrink-0">↩</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
