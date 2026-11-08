'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Botón «🗂️ Catálogos» del chat (08-nov-2026): buscar cualquier catálogo por nombre y enviarle
 * al cliente sus fotos (una por color) desde el mismo chat.
 * Solo LEE /api/catalogos y envía con /api/whatsapp/send-media-url (el mismo envío de imágenes del chat).
 */
interface Color { id: string; color: string; url_imagen: string | null; activo?: boolean; orden?: number }
interface Catalogo { id: string; familia: string; patron?: string; nombre_klixmsoft?: string | null; catalogo_colores?: Color[] }

const VERDE = '#00A89D';

export default function CatalogosChatModal({ conv, nombreCliente, onCerrar, onEnviada }: {
  conv: string; nombreCliente?: string; onCerrar: () => void;
  onEnviada: (m: { id: string; media_url: string; caption: string }) => void;
}) {
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<Catalogo | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [conTexto, setConTexto] = useState(true);
  const [enviando, setEnviando] = useState<{ hechas: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/catalogos', { cache: 'no-store' }).then(r => r.json()).then(d => setCatalogos(Array.isArray(d) ? d : [])).catch(() => setCatalogos([])).finally(() => setCargando(false));
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- se carga una sola vez al abrir

  const fotosDe = (c: Catalogo) => (c.catalogo_colores ?? [])
    .filter(x => x.activo !== false && x.url_imagen)
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));

  const sinT = (t: string) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = useMemo(() => {
    const p = sinT(q).split(/\s+/).filter(Boolean);
    return catalogos
      .filter(c => fotosDe(c).length > 0)
      .filter(c => !p.length || p.every(w => sinT(`${c.familia} ${c.patron ?? ''} ${c.nombre_klixmsoft ?? ''} ${fotosDe(c).map(x => x.color).join(' ')}`).includes(w)))
      .sort((a, b) => a.familia.localeCompare(b.familia));
  }, [catalogos, q]);

  const abrir = (c: Catalogo) => { setAbierto(c); setSel(new Set(fotosDe(c).map(x => x.id))); setResultado(null); };

  const enviar = async () => {
    if (!abierto) return;
    const fotos = fotosDe(abierto).filter(x => sel.has(x.id));
    if (!fotos.length) return;
    setEnviando({ hechas: 0, total: fotos.length }); setResultado(null);
    let ok = 0, fallo = 0;
    for (const f of fotos) {
      const caption = conTexto ? `${abierto.familia} · ${f.color}` : '';
      try {
        const r = await fetch('/api/whatsapp/send-media-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: conv, url: f.url_imagen, type: 'image', caption: caption || undefined }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) { ok++; onEnviada({ id: j.id ?? `agent-cat-${Date.now()}-${ok}`, media_url: j.media_url ?? f.url_imagen!, caption }); }
        else fallo++;
      } catch { fallo++; }
      setEnviando({ hechas: ok + fallo, total: fotos.length });
      await new Promise(res => setTimeout(res, 350)); // conserva el orden en WhatsApp
    }
    setEnviando(null);
    setResultado(fallo === 0
      ? `✅ ${ok} foto(s) de ${abierto.familia} enviadas.`
      : `⚠️ Se enviaron ${ok} y fallaron ${fallo}. Si pasaron más de 24 h desde el último mensaje del cliente, WhatsApp solo deja enviar plantillas (📋).`);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-3" onClick={onCerrar}>
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-[#F0F0F0]">
          {abierto && <button onClick={() => setAbierto(null)} className="w-9 h-9 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6]" title="Volver">←</button>}
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xl" style={{ background: VERDE }}>🗂️</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold leading-tight truncate">{abierto ? abierto.familia : 'Catálogos'}</h2>
            <p className="text-xs text-[#6B7280] truncate">{abierto ? `Elige las fotos y envíalas a ${nombreCliente || 'este cliente'}` : 'Busca un catálogo por nombre y envíaselo al cliente'}</p>
          </div>
          <button onClick={onCerrar} className="w-9 h-9 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6]" aria-label="Cerrar">✕</button>
        </header>

        {!abierto ? (
          <>
            <div className="px-5 py-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E5E7EB] focus-within:border-[#00A89D]">
                <span className="text-[#9CA3AF]">🔍</span>
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar catálogo (ej. Real Madrid, Yamaha, camiseta, negro…)" className="flex-1 text-sm outline-none" />
                {q && <button onClick={() => setQ('')} className="text-[#9CA3AF]">✕</button>}
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-1.5">{cargando ? 'Cargando…' : `${lista.length} catálogo(s)`}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {lista.map(c => {
                  const fotos = fotosDe(c);
                  return (
                    <button key={c.id} onClick={() => abrir(c)} className="text-left rounded-2xl border border-[#E5E7EB] p-2 hover:border-[#00A89D] hover:shadow-md transition bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fotos[0].url_imagen!} alt="" loading="lazy" className="w-full aspect-square object-contain rounded-xl bg-[#F5F5F5]" />
                      <p className="text-[13px] font-bold mt-1.5 leading-tight line-clamp-2">{c.familia}</p>
                      <p className="text-[11px] text-[#6B7280]">{fotos.length} {fotos.length === 1 ? 'color' : 'colores'}</p>
                    </button>
                  );
                })}
              </div>
              {!cargando && lista.length === 0 && <p className="text-sm text-[#6B7280] text-center py-10">No hay catálogos con ese nombre.</p>}
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-3 flex items-center gap-3 flex-wrap text-sm">
              <button onClick={() => setSel(s => s.size === fotosDe(abierto).length ? new Set() : new Set(fotosDe(abierto).map(x => x.id)))} className="font-semibold text-[#00847A]">
                {sel.size === fotosDe(abierto).length ? 'Quitar todas' : 'Elegir todas'}
              </button>
              <span className="text-[#6B7280]">{sel.size} de {fotosDe(abierto).length} elegidas</span>
              <label className="ml-auto flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={conTexto} onChange={e => setConTexto(e.target.checked)} className="accent-[#00A89D]" />
                Poner nombre y color debajo de cada foto
              </label>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {fotosDe(abierto).map(f => {
                  const on = sel.has(f.id);
                  return (
                    <button key={f.id} onClick={() => setSel(s => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n; })}
                      className={`relative text-left rounded-2xl border-2 p-1.5 transition ${on ? 'border-[#00A89D] bg-[#F0FBF9]' : 'border-[#E5E7EB] opacity-60'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url_imagen!} alt={f.color} loading="lazy" className="w-full aspect-square object-contain rounded-xl bg-[#F5F5F5]" />
                      <p className="text-xs font-bold mt-1 px-1">{f.color}</p>
                      <span className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${on ? 'text-white' : 'bg-white border border-[#D1D5DB]'}`} style={on ? { background: VERDE } : undefined}>{on ? '✓' : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <footer className="px-5 py-3 border-t border-[#F0F0F0] flex items-center gap-3 flex-wrap">
              <p className="flex-1 min-w-[200px] text-[13px]">
                {enviando ? `Enviando ${enviando.hechas} de ${enviando.total}…` : resultado}
              </p>
              <button onClick={() => setAbierto(null)} className="h-10 px-4 rounded-xl border border-[#D1D5DB] text-sm font-semibold">Otro catálogo</button>
              <button onClick={enviar} disabled={!!enviando || sel.size === 0}
                className="h-10 px-5 rounded-xl text-white text-sm font-bold disabled:opacity-50" style={{ background: VERDE }}>
                ➤ Enviar {sel.size} foto{sel.size === 1 ? '' : 's'} al cliente
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
