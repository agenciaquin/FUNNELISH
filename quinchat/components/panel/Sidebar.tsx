'use client';

import Image from 'next/image';
import { signOut } from 'next-auth/react';

export type PanelSection = 'chat' | 'entrenamiento' | 'plantillas' | 'disparadores' | 'contactos' | 'etiquetas' | 'catalogos' | 'integraciones' | 'ajustes' | 'manual';

const NAV_MAIN: { key: PanelSection; label: string; icon: string }[] = [
  { key: 'chat',          label: 'Chat',          icon: '💬' },
  { key: 'entrenamiento', label: 'Entrenamiento',  icon: '🎓' },
  { key: 'plantillas',    label: 'Plantillas',     icon: '📋' },
  { key: 'disparadores',  label: 'Disparadores',   icon: '⚡' },
  { key: 'contactos',     label: 'Contactos',      icon: '👥' },
  { key: 'etiquetas',     label: 'Etiquetas',      icon: '🏷️' },
  { key: 'catalogos',     label: 'Catálogos',      icon: '📦' },
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
    <aside className="w-[190px] flex flex-col shrink-0 text-white bg-gradient-to-b from-[#00B5A6] via-[#00A89D] to-[#00847A] shadow-xl shadow-[#00847A]/20">

      {/* Brand — logo Agencia Quin */}
      <div className="px-4 py-4 border-b border-white/15">
        <div className="bg-white/95 rounded-xl px-2 py-1.5 inline-flex shadow-sm">
          <Image
            src="/logo-agencia-quin.png"
            alt="Agencia Quin"
            width={120}
            height={48}
            className="object-contain"
            priority
          />
        </div>
        <p className="text-[10px] text-white/70 mt-1.5">Panel de administración</p>
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
              <span className={`text-base shrink-0 transition-transform duration-200 ${active ? '' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00A89D] shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 border-t border-white/15 pt-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/85 hover:text-white hover:bg-white/15 hover:translate-x-1 transition-all duration-200 ease-out"
        >
          <span className="text-base shrink-0">↩</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
