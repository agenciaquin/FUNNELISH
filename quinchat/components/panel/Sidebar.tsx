'use client';

import { signOut } from 'next-auth/react';

export type PanelSection = 'chat' | 'entrenamiento' | 'plantillas' | 'disparadores' | 'contactos' | 'integraciones' | 'ajustes' | 'manual';

const NAV_MAIN: { key: PanelSection; label: string; icon: string }[] = [
  { key: 'chat',          label: 'Chat',          icon: '💬' },
  { key: 'entrenamiento', label: 'Entrenamiento',  icon: '🎓' },
  { key: 'plantillas',    label: 'Plantillas',     icon: '📋' },
  { key: 'disparadores',  label: 'Disparadores',   icon: '⚡' },
  { key: 'contactos',     label: 'Contactos',      icon: '👥' },
  { key: 'integraciones', label: 'Integraciones',  icon: '🔗' },
  { key: 'ajustes',       label: 'Ajustes',        icon: '⚙️' },
  { key: 'manual',        label: 'Manual',         icon: '📖' },
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
