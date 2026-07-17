'use client';

import Image from 'next/image';
import { signOut } from 'next-auth/react';

export type PanelSection = 'chat' | 'entrenamiento' | 'plantillas' | 'disparadores' | 'contactos' | 'etiquetas' | 'integraciones' | 'ajustes' | 'manual';

const NAV_MAIN: { key: PanelSection; label: string; icon: string }[] = [
  { key: 'chat',          label: 'Chat',          icon: '💬' },
  { key: 'entrenamiento', label: 'Entrenamiento',  icon: '🎓' },
  { key: 'plantillas',    label: 'Plantillas',     icon: '📋' },
  { key: 'disparadores',  label: 'Disparadores',   icon: '⚡' },
  { key: 'contactos',     label: 'Contactos',      icon: '👥' },
  { key: 'etiquetas',     label: 'Etiquetas',      icon: '🏷️' },
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
    <aside className="w-[190px] flex flex-col bg-white border-r border-[#E8E8E8] shrink-0">

      {/* Brand — logo Agencia Quin */}
      <div className="px-4 py-4 border-b border-[#E8E8E8]">
        <Image
          src="/logo-agencia-quin.png"
          alt="Agencia Quin"
          width={120}
          height={48}
          className="object-contain"
          priority
        />
        <p className="text-[10px] text-[#6B6B6B] mt-1">Panel de administración</p>
      </div>

      {/* Account */}
      <div className="px-3 py-3 border-b border-[#E8E8E8] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#00A89D]/15 border border-[#00A89D]/30 flex items-center justify-center text-xs font-bold text-[#00A89D] shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[#0D0D0D] truncate">{userName || 'Agencia Quin'}</div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="text-[10px] text-[#6B6B6B]">Activo</span>
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
                  ? 'bg-[#00A89D]/10 text-[#00A89D] border border-[#00A89D]/20'
                  : 'text-[#6B6B6B] hover:text-[#0D0D0D] hover:bg-[#F5F5F5] border border-transparent'
              }`}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00A89D] shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 border-t border-[#E8E8E8] pt-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#6B6B6B] hover:text-red-500 hover:bg-red-50 transition-all border border-transparent"
        >
          <span className="text-base shrink-0">↩</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
