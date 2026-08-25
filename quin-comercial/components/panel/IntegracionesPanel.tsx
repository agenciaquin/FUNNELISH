'use client';

import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'coming_soon';
  color: string;
  url?: string;
}

const INTEGRACIONES: Integration[] = [
  {
    id: 'confirmaya',
    name: 'ConfirmaYa',
    description: 'Envía mensajes de confirmación de pedidos desde ConfirmaYa directamente por WhatsApp. Los CONFIRMO se detectan automáticamente.',
    icon: '✅',
    status: 'active',
    color: '#00A89D',
    url: 'https://funnelish-9o3g8ir5l-agencia-quin.vercel.app/',
  },
  {
    id: 'funnelish',
    name: 'Funnelish',
    description: 'Cada nuevo pedido en Funnelish envía automáticamente el mensaje de confirmación por WhatsApp vía bot.',
    icon: '🛒',
    status: 'active',
    color: '#6366f1',
    url: 'https://app.funnelish.com/automations',
  },
  {
    id: 'meta',
    name: 'Meta Ads',
    description: 'Conecta campañas de Meta Ads y notifica leads por WhatsApp en tiempo real.',
    icon: '📘',
    status: 'coming_soon',
    color: '#1877f2',
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Automatiza flujos entre QuinChat y cualquier otra herramienta via Make.',
    icon: '⚙️',
    status: 'coming_soon',
    color: '#7c3aed',
  },
  {
    id: 'dropi',
    name: 'Dropi',
    description: 'Importa pedidos de Dropi y gestiona confirmaciones por WhatsApp.',
    icon: '📦',
    status: 'coming_soon',
    color: '#059669',
  },
];

export default function IntegracionesPanel() {
  const [copied, setCopied] = useState(false);

  const webhookUrl = 'https://quinchat-agencia-quin.vercel.app/api/whatsapp/confirmar';

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0D0D0D] mb-1">Integraciones</h1>
        <p className="text-sm text-[#6B6B6B]">Conecta QuinChat con tus herramientas de negocio.</p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {INTEGRACIONES.map(integ => (
          <div
            key={integ.id}
            className={`relative rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
              integ.status === 'active'
                ? 'bg-white border-[#E8E8E8] hover:border-[#00A89D]/40'
                : 'bg-[#FAFAFA] border-[#F0F0F0] opacity-60'
            }`}
          >
            {/* Status badge */}
            <div className="absolute top-4 right-4">
              {integ.status === 'active' ? (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Activo
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-[#9A9A9A] bg-[#F5F5F5] border border-[#E8E8E8] rounded-full px-2 py-0.5">
                  Próximamente
                </span>
              )}
            </div>

            {/* Icon + name */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: `${integ.color}18`, border: `1px solid ${integ.color}30` }}
              >
                {integ.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0D0D0D]">{integ.name}</h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-[#6B6B6B] leading-relaxed">{integ.description}</p>

            {/* Action */}
            {integ.status === 'active' && integ.url && (
              <a
                href={integ.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-2 text-xs font-semibold text-[#00A89D] hover:text-[#00847A] transition-colors"
              >
                Abrir ConfirmaYa →
              </a>
            )}
          </div>
        ))}
      </div>

      {/* API Endpoint info */}
      <div className="mt-10 rounded-2xl border border-[#E8E8E8] bg-white p-6">
        <h2 className="text-sm font-bold text-[#0D0D0D] mb-1">Endpoint de integración</h2>
        <p className="text-xs text-[#6B6B6B] mb-4">
          Usa esta URL para enviar mensajes de confirmación desde cualquier herramienta externa.
          Requiere el header <code className="text-[#00A89D] bg-[#00A89D]/10 px-1 rounded">X-API-Key: klixmant-confirma-2026</code>.
        </p>

        <div className="flex items-center gap-3 bg-[#F5F5F5] border border-[#E8E8E8] rounded-xl px-4 py-3">
          <code className="flex-1 text-xs text-[#3A3A3A] break-all font-mono">{webhookUrl}</code>
          <button
            onClick={copyWebhook}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all"
            style={copied
              ? { color: '#4ade80', borderColor: '#4ade8040', background: '#4ade8010' }
              : { color: '#00A89D', borderColor: '#00A89D40', background: '#00A89D10' }
            }
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="mt-4 text-xs text-[#9A9A9A] space-y-1">
          <p><span className="text-[#6B6B6B] font-semibold">Método:</span> POST</p>
          <p><span className="text-[#6B6B6B] font-semibold">Body:</span>{' '}
            <code className="text-[#6B6B6B] font-mono">{'{ "telefono": "3001234567", "mensaje": "Hola..." }'}</code>
          </p>
          <p><span className="text-[#6B6B6B] font-semibold">Respuesta:</span>{' '}
            <code className="text-[#6B6B6B] font-mono">{'{ "success": true, "phone": "573001234567" }'}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
