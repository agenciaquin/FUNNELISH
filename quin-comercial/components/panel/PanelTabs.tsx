'use client';

import { grupoDeSeccion, type PanelSection } from './Sidebar';

/**
 * Barra de pestañas arriba del contenido (estilo Funnelish). Muestra las pestañas
 * del grupo al que pertenece la sección activa. Si el grupo tiene una sola
 * pestaña, no se muestra nada.
 */
export default function PanelTabs({
  activeSection,
  onSectionChange,
}: {
  activeSection: PanelSection;
  onSectionChange: (s: PanelSection) => void;
}) {
  const grupo = grupoDeSeccion(activeSection);
  if (grupo.tabs.length <= 1) return null;

  return (
    <div className="shrink-0 flex items-center gap-1 px-4 py-2 border-b border-black/10 bg-white overflow-x-auto">
      <span className="text-xs font-semibold text-gray-400 mr-2 shrink-0">{grupo.label}</span>
      {grupo.tabs.map(t => {
        const active = t.key === activeSection;
        return (
          <button
            key={t.key}
            onClick={() => onSectionChange(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              active
                ? 'bg-[#00A89D] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
