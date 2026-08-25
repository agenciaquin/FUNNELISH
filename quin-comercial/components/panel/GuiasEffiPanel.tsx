'use client';

import { useRef, useState } from 'react';

interface ItemEnviar {
  telefono: string; waId: string; nombre: string; guia: string;
  estado: string; etiqueta: string; frase: string;
}
interface Resumen {
  total: number; aEnviar: number; sinCambio: number; sinChat: number; noNotificable: number; anulados: number;
}

const COLOR_ESTADO: Record<string, string> = {
  despachado: '#0EA5E9', reparto: '#8B5CF6', oficina: '#F59E0B',
};

export default function GuiasEffiPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cargando, setCargando]   = useState(false);
  const [enviando, setEnviando]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [resumen, setResumen]     = useState<Resumen | null>(null);
  const [items, setItems]         = useState<ItemEnviar[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [resultado, setResultado] = useState<{ enviados: number; fallidos: number; omitidos: number } | null>(null);

  async function subir(file: File) {
    setError(null); setResultado(null); setResumen(null); setItems([]);
    setCargando(true); setNombreArchivo(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/guias-effi/subir', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'No se pudo procesar el archivo.'); return; }
      setResumen(data.resumen);
      setItems(data.aEnviar ?? []);
    } catch {
      setError('No se pudo subir el archivo.');
    } finally {
      setCargando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function enviar() {
    if (!items.length) return;
    if (!confirm(`Se enviarán ${items.length} avisos de estado por WhatsApp. ¿Confirmas?`)) return;
    setEnviando(true); setError(null);
    try {
      const res  = await fetch('/api/guias-effi/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'No se pudieron enviar.'); return; }
      setResultado({ enviados: data.enviados ?? 0, fallidos: data.fallidos ?? 0, omitidos: data.omitidos ?? 0 });
      setItems([]); // ya se enviaron; se limpian de la vista
    } catch {
      setError('No se pudieron enviar los avisos.');
    } finally {
      setEnviando(false);
    }
  }

  const chip = (n: number, txt: string, color: string) => (
    <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ color, background: color + '18' }}>
      {n} {txt}
    </span>
  );

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        <header className="mb-4 pl-10 md:pl-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#0D0D0D]">📦 Guías Effi</h1>
          <p className="text-xs text-[#6B6B6B] mt-1 leading-snug">
            Sube el Excel de Effi. El sistema cruza por teléfono con tus chats y le avisa a cada cliente el estado
            de su envío (despachado, en reparto, en oficina) con su número de guía. Solo avisa cuando el estado cambia.
          </p>
        </header>

        {/* Zona de subida */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 mb-4">
          <input
            ref={fileRef} type="file" accept=".xls,.xlsx,.html,.htm"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); }}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={cargando || enviando}
              className="px-4 py-2.5 rounded-xl bg-[#00A89D] text-white text-sm font-semibold hover:bg-[#00847A] disabled:opacity-50"
            >
              {cargando ? 'Procesando…' : '⬆️ Subir Excel de Effi'}
            </button>
            {nombreArchivo && !cargando && <span className="text-xs text-[#6B6B6B] truncate">{nombreArchivo}</span>}
          </div>
          <p className="text-[11px] text-[#9A9A9A] mt-2 leading-snug">
            Acepta el reporte de remisiones de Effi (.xls). Los avisos van con tu plantilla aprobada de Meta
            <b> “estado_pedido”</b> (créala primero para que funcionen fuera de las 24 h).
          </p>
        </div>

        {error && (
          <div className="text-xs p-3 rounded-xl bg-red-50 text-red-600 border border-red-200 mb-4 leading-snug">{error}</div>
        )}

        {resultado && (
          <div className="text-sm p-3.5 rounded-xl bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] mb-4">
            ✅ Enviados: <b>{resultado.enviados}</b> · Fallidos: {resultado.fallidos} · Omitidos: {resultado.omitidos}
          </div>
        )}

        {/* Resumen del archivo */}
        {resumen && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] p-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              {chip(resumen.aEnviar, 'para enviar', '#00A89D')}
              {chip(resumen.sinCambio, 'sin cambio', '#6B7280')}
              {chip(resumen.sinChat, 'sin chat', '#9A9A9A')}
              {chip(resumen.noNotificable, 'otros estados', '#9A9A9A')}
              {chip(resumen.anulados, 'anulados', '#DC2626')}
            </div>
            <p className="text-[11px] text-[#9A9A9A] mt-2">
              Total de guías leídas: {resumen.total}. “Sin chat” = ese teléfono no está en ninguna conversación.
              “Sin cambio” = ya le avisaste ese mismo estado.
            </p>
          </div>
        )}

        {/* Previsualización + botón enviar */}
        {items.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E8E8]">
              <span className="text-sm font-semibold text-[#0D0D0D]">Se enviarán {items.length} avisos</span>
              <button
                onClick={enviar} disabled={enviando}
                className="px-4 py-2 rounded-xl bg-[#00A89D] text-white text-sm font-bold hover:bg-[#00847A] disabled:opacity-50"
              >
                {enviando ? 'Enviando…' : `📨 Enviar ${items.length} avisos`}
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#F5F5F5] text-[10px] uppercase tracking-wide text-[#9A9A9A]">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Cliente</th>
                    <th className="text-left px-4 py-2 font-semibold">Teléfono</th>
                    <th className="text-left px-4 py-2 font-semibold">Estado</th>
                    <th className="text-left px-4 py-2 font-semibold">Guía</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={`${it.telefono}-${it.guia}-${i}`} className="border-b border-[#F5F5F5]">
                      <td className="px-4 py-2 text-[#0D0D0D] truncate max-w-[180px]">{it.nombre || '—'}</td>
                      <td className="px-4 py-2 text-[#6B6B6B]">{it.telefono}</td>
                      <td className="px-4 py-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: COLOR_ESTADO[it.estado] ?? '#6B7280', background: (COLOR_ESTADO[it.estado] ?? '#6B7280') + '18' }}>
                          {it.etiqueta}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[#6B6B6B] font-mono text-xs">{it.guia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {resumen && items.length === 0 && !resultado && (
          <div className="text-sm text-[#6B6B6B] bg-white border border-[#E8E8E8] rounded-2xl p-5 text-center">
            No hay avisos nuevos para enviar en este archivo. 👍
          </div>
        )}
      </div>
    </div>
  );
}
