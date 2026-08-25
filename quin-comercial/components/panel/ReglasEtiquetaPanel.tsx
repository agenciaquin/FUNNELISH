'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/* Reglas de etiquetas automáticas: el dueño programa —hablando con Quino o a
 * mano— cuándo el bot debe marcar una conversación (ej: "cuando confirme el
 * pedido y dé sus datos → VENTA REALIZADA"). */

interface Regla {
  id: string;
  condicion: string;
  etiqueta: string;
  etiqueta_adicional?: string | null;
  activo: boolean;
  created_at?: string;
}
interface MsgQuino { role: 'user' | 'assistant'; content: string }

const ETIQUETAS_SUGERIDAS = [
  'VENTA REALIZADA', 'ABONO POR VERIFICAR', 'PENDIENTE POR CONFIRMACIÓN',
  'PEDIDO PROGRAMADO', 'PEDIDO CANCELADO', 'ANULADO EN EFFI',
];

export default function ReglasEtiquetaPanel() {
  const [reglas, setReglas]   = useState<Regla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  // alta manual
  const [nuevaCond, setNuevaCond] = useState('');
  const [nuevaEtq, setNuevaEtq]   = useState('VENTA REALIZADA');
  const [nuevaEtqAdic, setNuevaEtqAdic] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Quino
  const [chat, setChat]     = useState<MsgQuino[]>([]);
  const [entrada, setEntrada] = useState('');
  const [pensando, setPensando] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reglas-etiqueta');
      if (res.ok) setReglas(await res.json());
    } catch { /* red */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [chat, pensando]);

  async function toggle(r: Regla) {
    setReglas(prev => prev.map(x => x.id === r.id ? { ...x, activo: !x.activo } : x));
    try {
      await fetch(`/api/reglas-etiqueta/${r.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !r.activo }),
      });
    } catch { cargar(); }
  }

  async function guardarEdicion(r: Regla, condicion: string, etiqueta: string, adicional: string) {
    if (!condicion.trim() || !etiqueta.trim()) return;
    setEditId(null);
    try {
      await fetch(`/api/reglas-etiqueta/${r.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condicion: condicion.trim(),
          etiqueta: etiqueta.trim().toUpperCase(),
          etiqueta_adicional: adicional.trim().toUpperCase(),
        }),
      });
    } catch { /* red */ }
    cargar();
  }

  async function eliminar(id: string) {
    setBorrando(null);
    setReglas(prev => prev.filter(x => x.id !== id));
    try { await fetch(`/api/reglas-etiqueta/${id}`, { method: 'DELETE' }); } catch { cargar(); }
  }

  async function crearManual() {
    if (!nuevaCond.trim() || !nuevaEtq.trim()) return;
    setGuardando(true);
    try {
      await fetch('/api/reglas-etiqueta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condicion: nuevaCond.trim(),
          etiqueta: nuevaEtq.trim().toUpperCase(),
          etiqueta_adicional: nuevaEtqAdic.trim().toUpperCase(),
        }),
      });
      setNuevaCond('');
      setNuevaEtqAdic('');
      await cargar();
    } catch { /* red */ }
    setGuardando(false);
  }

  async function enviarAQuino() {
    const texto = entrada.trim();
    if (!texto || pensando) return;
    const historial = chat;
    setChat(prev => [...prev, { role: 'user', content: texto }]);
    setEntrada('');
    setPensando(true);
    try {
      const res = await fetch('/api/asistente-etiqueta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto, historial }),
      });
      const data = await res.json();
      setChat(prev => [...prev, { role: 'assistant', content: data.reply || 'Listo.' }]);
      if (Array.isArray(data.reglasCreadas) && data.reglasCreadas.length) await cargar();
    } catch {
      setChat(prev => [...prev, { role: 'assistant', content: 'No pude responder ahora. Intenta de nuevo.' }]);
    }
    setPensando(false);
  }

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 flex flex-col gap-5">
      {/* Encabezado */}
      <div>
        <h3 className="text-sm font-semibold text-[#0D0D0D] flex items-center gap-2">
          🤖 Reglas automáticas del bot
        </h3>
        <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
          Dile al bot <strong>en qué momento</strong> debe marcar cada conversación. Puedes escribirlo tú mismo
          o pedírselo a Quino con tus palabras (ej: <em>"cuando el cliente confirme y me dé la dirección, márcalo como Venta Realizada"</em>).
        </p>
      </div>

      {/* Lista de reglas */}
      <div className="flex flex-col gap-2">
        {loading && <div className="text-xs text-[#6B6B6B] py-4 text-center">Cargando reglas…</div>}
        {!loading && reglas.length === 0 && (
          <div className="text-xs text-[#6B6B6B] py-4 text-center bg-[#FAF9F6] rounded-xl">
            Aún no hay reglas. Crea una abajo o pídeselo a Quino.
          </div>
        )}
        {reglas.map(r => (
          <ReglaFila
            key={r.id}
            r={r}
            editando={editId === r.id}
            confirmandoBorrar={borrando === r.id}
            onEditar={() => setEditId(r.id)}
            onCancelarEdicion={() => setEditId(null)}
            onGuardar={(c, e, a) => guardarEdicion(r, c, e, a)}
            onToggle={() => toggle(r)}
            onPedirBorrar={() => setBorrando(r.id)}
            onCancelarBorrar={() => setBorrando(null)}
            onBorrar={() => eliminar(r.id)}
          />
        ))}
      </div>

      {/* Alta manual */}
      <div className="border-t border-[#F0F0F0] pt-4 flex flex-col gap-2">
        <label className="text-[11px] text-[#6B6B6B] font-medium uppercase tracking-wide">Agregar regla a mano</label>
        <input
          value={nuevaCond}
          onChange={e => setNuevaCond(e.target.value)}
          placeholder="Cuando… (ej: el cliente envíe el comprobante de pago)"
          className="w-full bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs text-[#0D0D0D] placeholder-[#6B6B6B]/50 focus:outline-none focus:border-[#00A89D]"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[10px] text-[#6B6B6B]">Etiqueta principal</span>
            <input
              value={nuevaEtq}
              onChange={e => setNuevaEtq(e.target.value)}
              list="etqs-sug"
              placeholder="ETIQUETA"
              className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs text-[#0D0D0D] uppercase placeholder-[#6B6B6B]/50 focus:outline-none focus:border-[#00A89D]"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <span className="text-[10px] text-[#6B6B6B]">Etiqueta adicional <span className="opacity-60">(opcional)</span></span>
            <input
              value={nuevaEtqAdic}
              onChange={e => setNuevaEtqAdic(e.target.value)}
              list="etqs-sug"
              placeholder="Se suma sin quitar la principal"
              className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs text-[#0D0D0D] uppercase placeholder-[#6B6B6B]/50 focus:outline-none focus:border-[#00A89D]"
            />
          </div>
          <datalist id="etqs-sug">
            {ETIQUETAS_SUGERIDAS.map(e => <option key={e} value={e} />)}
          </datalist>
          <button
            onClick={crearManual}
            disabled={guardando || !nuevaCond.trim() || !nuevaEtq.trim()}
            className="px-4 py-2 rounded-xl bg-[#00A89D] text-white text-xs font-bold hover:bg-[#007A72] disabled:opacity-40 transition-colors shrink-0 self-end"
          >
            {guardando ? '…' : 'Agregar'}
          </button>
        </div>
        <p className="text-[10px] text-[#6B6B6B]/70">
          La <strong>principal</strong> es el estado (reemplaza el anterior). La <strong>adicional</strong> es una marca extra que se suma (ej: CLIENTE VIP, MAYORISTA).
        </p>
      </div>

      {/* Quino */}
      <div className="border-t border-[#F0F0F0] pt-4 flex flex-col gap-2">
        <label className="text-[11px] text-[#6B6B6B] font-medium uppercase tracking-wide flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-[#00A89D] text-white text-[10px] flex items-center justify-center font-bold">Q</span>
          Pídeselo a Quino
        </label>
        <div ref={chatRef} className="max-h-56 overflow-y-auto flex flex-col gap-2 bg-[#FAF9F6] rounded-xl p-3">
          {chat.length === 0 && (
            <p className="text-xs text-[#6B6B6B]/70 text-center py-2">
              Escríbele como le hablarías a un asistente. Ej: <em>"marca Abono por Verificar cuando manden el comprobante"</em>.
            </p>
          )}
          {chat.map((m, i) => (
            <div key={i} className={`text-xs leading-relaxed max-w-[85%] px-3 py-2 rounded-2xl ${m.role === 'user' ? 'self-end bg-[#00A89D] text-white' : 'self-start bg-white border border-[#E8E8E8] text-[#0D0D0D]'}`}>
              {m.content}
            </div>
          ))}
          {pensando && <div className="self-start text-xs text-[#6B6B6B] px-3 py-2">Quino está pensando…</div>}
        </div>
        <div className="flex gap-2">
          <input
            value={entrada}
            onChange={e => setEntrada(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') enviarAQuino(); }}
            placeholder="Escríbele a Quino…"
            className="flex-1 bg-white border border-[#E8E8E8] rounded-xl px-3 py-2 text-xs text-[#0D0D0D] placeholder-[#6B6B6B]/50 focus:outline-none focus:border-[#00A89D]"
          />
          <button
            onClick={enviarAQuino}
            disabled={pensando || !entrada.trim()}
            className="px-4 py-2 rounded-xl bg-[#0D0D0D] text-white text-xs font-bold hover:bg-[#333] disabled:opacity-40 transition-colors shrink-0"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Fila de una regla ─────────────────────────────────────────────────────── */
function ReglaFila({
  r, editando, confirmandoBorrar,
  onEditar, onCancelarEdicion, onGuardar, onToggle, onPedirBorrar, onCancelarBorrar, onBorrar,
}: {
  r: Regla; editando: boolean; confirmandoBorrar: boolean;
  onEditar: () => void; onCancelarEdicion: () => void; onGuardar: (c: string, e: string, a: string) => void;
  onToggle: () => void; onPedirBorrar: () => void; onCancelarBorrar: () => void; onBorrar: () => void;
}) {
  const [c, setC] = useState(r.condicion);
  const [e, setE] = useState(r.etiqueta);
  const [a, setA] = useState(r.etiqueta_adicional ?? '');
  useEffect(() => { setC(r.condicion); setE(r.etiqueta); setA(r.etiqueta_adicional ?? ''); }, [r.condicion, r.etiqueta, r.etiqueta_adicional, editando]);

  if (editando) {
    return (
      <div className="border border-[#00A89D]/40 rounded-xl p-3 flex flex-col gap-2 bg-[#00A89D]/5">
        <textarea
          value={c} onChange={ev => setC(ev.target.value)} rows={2}
          className="bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-[#00A89D]"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={e} onChange={ev => setE(ev.target.value)} placeholder="ETIQUETA PRINCIPAL"
            className="flex-1 bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-xs uppercase focus:outline-none focus:border-[#00A89D]"
          />
          <input
            value={a} onChange={ev => setA(ev.target.value)} placeholder="ETIQUETA ADICIONAL (opcional)"
            className="flex-1 bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-xs uppercase focus:outline-none focus:border-[#00A89D]"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => onGuardar(c, e, a)} className="px-3 py-2 rounded-lg bg-[#00A89D] text-white text-xs font-bold">Guardar</button>
          <button onClick={onCancelarEdicion} className="px-3 py-2 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs">Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-[#E8E8E8] rounded-xl p-3 flex items-center gap-3 group ${!r.activo ? 'opacity-55' : ''}`}>
      {/* Toggle activo */}
      <button
        onClick={onToggle}
        title={r.activo ? 'Activa — clic para pausar' : 'Pausada — clic para activar'}
        className={`w-9 h-5 rounded-full shrink-0 relative transition-colors ${r.activo ? 'bg-[#00A89D]' : 'bg-[#D1D1D1]'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${r.activo ? 'left-4' : 'left-0.5'}`} />
      </button>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#0D0D0D] leading-snug">
          <span className="text-[#6B6B6B]">Si </span>{r.condicion}
        </p>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <span className="inline-block px-2 py-0.5 rounded-full bg-[#00A89D]/10 text-[#007A72] text-[10px] font-bold">
            → {r.etiqueta}
          </span>
          {r.etiqueta_adicional?.trim() && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#6D28D9] text-[10px] font-bold">
              + {r.etiqueta_adicional}
            </span>
          )}
        </div>
      </div>

      {/* Acciones */}
      {confirmandoBorrar ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-red-600 font-medium">¿Borrar?</span>
          <button onClick={onBorrar} className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg">Sí</button>
          <button onClick={onCancelarBorrar} className="px-2 py-1 border border-[#E8E8E8] text-[#6B6B6B] text-[10px] rounded-lg">No</button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEditar} title="Editar" className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F5F5F5] border border-[#E8E8E8] text-[#6B6B6B] hover:text-[#00A89D] text-sm">✏️</button>
          <button onClick={onPedirBorrar} title="Eliminar" className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F5F5F5] border border-[#E8E8E8] text-[#6B6B6B] hover:text-red-500 text-sm">🗑</button>
        </div>
      )}
    </div>
  );
}
