'use client';

import { useState, useEffect, useRef } from 'react';
import { aplicarValores, estimarTokens, semaforoTokens, type CampoPlantilla } from '@/lib/plantillas-conocimiento';

interface Plantilla { id: string; nombre: string; contenido: string; campos: CampoPlantilla[]; }
type Fase = 'cargando' | 'chat' | 'compilando' | 'revisar' | 'actualizar';
interface Msg { de: 'quino' | 'cliente'; texto: string; }

export default function AsistenteBotPanel() {
  const [fase, setFase] = useState<Fase>('cargando');
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
  const [preguntar, setPreguntar] = useState<CampoPlantilla[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [entrada, setEntrada] = useState('');
  const [entrenamiento, setEntrenamiento] = useState('');
  const [actual, setActual] = useState('');        // entrenamiento ya guardado (modo actualizar)
  const [pulido, setPulido] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; text: string } | null>(null);

  const finRef = useRef<HTMLDivElement>(null);

  // ── Adjuntos (archivos/fotos) y audio ──
  const [adjTexto, setAdjTexto] = useState('');                                   // texto extraído de documentos
  const [adjImgs, setAdjImgs]   = useState<{ mimeType: string; base64: string }[]>([]);
  const [adjChips, setAdjChips] = useState<{ nombre: string; tipo: 'texto' | 'imagen' }[]>([]);
  const [subiendoArch, setSubiendoArch] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const refArchivo = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Lee un archivo (PDF/Word/Excel/foto/txt) y lo deja listo para que la IA lo lea.
  async function procesarArchivo(file: File) {
    if (!file || subiendoArch) return;
    setSubiendoArch(true); setAviso(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/asistente-bot/leer-archivo', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) { setAviso({ ok: false, text: d.error ?? 'No pude leer el archivo.' }); return; }
      if (d.tipo === 'imagen') {
        setAdjImgs(a => [...a, { mimeType: d.mimeType, base64: d.base64 }]);
        setAdjChips(c => [...c, { nombre: d.nombre ?? 'imagen', tipo: 'imagen' }]);
      } else {
        setAdjTexto(t => (t ? t + '\n\n' : '') + `[Archivo: ${d.nombre}]\n${d.texto ?? ''}`);
        setAdjChips(c => [...c, { nombre: d.nombre ?? 'archivo', tipo: 'texto' }]);
      }
    } catch { setAviso({ ok: false, text: 'No pude leer el archivo. Intenta de nuevo.' }); }
    finally { setSubiendoArch(false); }
  }

  function quitarAdjuntos() { setAdjTexto(''); setAdjImgs([]); setAdjChips([]); }

  // Pegar (Ctrl+V) una imagen o archivo desde el portapapeles.
  function onPaste(e: any) {
    const items = e?.clipboardData?.items; if (!items) return;
    for (const it of Array.from(items) as any[]) {
      if (it.kind === 'file') { const f = it.getAsFile(); if (f) { e.preventDefault(); procesarArchivo(f); } }
    }
  }

  // Grabar una nota de voz y transcribirla al cuadro de texto.
  async function toggleGrabar() {
    if (grabando) { try { mediaRef.current?.stop(); } catch { /* */ } return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = ev => { if (ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setGrabando(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (!blob.size) return;
        setSubiendoArch(true);
        try {
          const fd = new FormData(); fd.append('file', blob, 'nota.webm');
          const r = await fetch('/api/asistente-bot/transcribir', { method: 'POST', body: fd });
          const d = await r.json();
          if (r.ok && d.texto) setEntrada(prev => (prev ? prev + ' ' : '') + d.texto);
          else setAviso({ ok: false, text: d.error ?? 'No pude transcribir el audio.' });
        } catch { setAviso({ ok: false, text: 'No pude transcribir el audio.' }); }
        finally { setSubiendoArch(false); }
      };
      mediaRef.current = mr; mr.start(); setGrabando(true);
    } catch { setAviso({ ok: false, text: 'No pude acceder al micrófono. Revisa los permisos del navegador.' }); }
  }

  useEffect(() => {
    (async () => {
      let p: Plantilla | undefined;
      try {
        const r = await fetch('/api/plantillas-conocimiento');
        const d = await r.json();
        p = (d.plantillas ?? [])[0];
      } catch { /* */ }
      if (p) {
        setPlantilla(p);
        const campos = p.campos ?? [];
        const marcados = campos.filter(c => c.esencial);
        const preg = marcados.length ? marcados : campos;
        setPreguntar(preg);
        const clavesPreg = new Set(preg.map(c => c.clave));
        const init: Record<string, string> = {};
        for (const c of campos) if (!clavesPreg.has(c.clave)) init[c.clave] = c.ejemplo ?? '';
        setValores(init);
      }
      // ¿Ya tiene entrenamiento? → modo ACTUALIZAR. Si no → modo ARMAR.
      let yaTiene = '';
      try {
        const r = await fetch('/api/entrenamiento/guardar');
        const d = await r.json();
        yaTiene = String(d?.value ?? '');
      } catch { /* */ }

      if (yaTiene.trim()) {
        setActual(yaTiene);
        setMsgs([{ de: 'quino', texto: '¡Hola! 👋 Soy Quino. Tu bot ya está armado y funcionando. Si necesitas *actualizar algún dato*, dime cuál y su nuevo valor (ej: "cambia los precios a 1 en 100" o "el Nequi a 300...”). Si solo me dices qué dato, yo te pregunto el nuevo valor. 🙌' }]);
        setFase('actualizar');
      } else if (p) {
        arrancarArmado(p);
      } else {
        setMsgs([{ de: 'quino', texto: 'Aún no hay una plantilla base. Crea una en “Plantillas de conocimiento” y vuelve 🙌' }]);
        setFase('chat');
      }
    })();
  }, []);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, fase, pensando]);

  function arrancarArmado(p: Plantilla) {
    const campos = p.campos ?? [];
    const marcados = campos.filter(c => c.esencial);
    const preg = marcados.length ? marcados : campos;
    setPreguntar(preg);
    const clavesPreg = new Set(preg.map(c => c.clave));
    const init: Record<string, string> = {};
    for (const c of campos) if (!clavesPreg.has(c.clave)) init[c.clave] = c.ejemplo ?? '';
    setValores(init);
    setIdx(0);
    setMsgs([
      { de: 'quino', texto: '¡Listo, armemos tu bot desde cero! 🙌 Te haré unas preguntas cortas. Puedes *saltar* la que no sepas, o *terminar* cuando quieras (lo que falte lo dejo con un valor recomendado).' },
      { de: 'quino', texto: preg[0]?.pregunta ?? `¿Cuál es tu ${preg[0]?.etiqueta?.toLowerCase() ?? 'dato'}?` },
    ]);
    setGuardado(false); setAviso(null); setEntrenamiento('');
    setFase('chat');
  }

  // Primer dato aún sin llenar (para el placeholder y el botón "Saltar").
  const siguientePendiente = (vals: Record<string, string>) =>
    preguntar.find(c => !String(vals[c.clave] ?? '').trim());
  const pendiente = fase === 'chat' ? siguientePendiente(valores) : undefined;
  const llenos = preguntar.filter(c => String(valores[c.clave] ?? '').trim()).length;
  const preview = fase === 'actualizar' ? actual : (plantilla ? aplicarValores(plantilla.contenido, { ...valores }) : '');
  const tok = estimarTokens(fase === 'revisar' ? entrenamiento : preview);
  const sem = semaforoTokens(tok);

  // Completa los campos vacíos con su ejemplo (para saltar / terminar temprano).
  function valoresConDefaults(vals: Record<string, string>) {
    const out = { ...vals };
    for (const c of (plantilla?.campos ?? [])) if (!String(out[c.clave] ?? '').trim()) out[c.clave] = c.ejemplo ?? '';
    return out;
  }

  // ── MODO ARMAR (conversacional con IA) ──
  // Cada mensaje del dueño va a la IA (Quino): ella aclara dudas y captura los
  // datos que va dando, hasta completar. Ya no es un cuestionario fijo.
  async function enviarEntrevista(texto: string) {
    const t = texto.trim();
    const hayAdj = !!adjTexto || adjImgs.length > 0;
    if ((!t && !hayAdj) || pensando || fase !== 'chat') return;
    const etiqueta = t || (adjChips.length ? `📎 ${adjChips.map(c => c.nombre).join(', ')}` : '📎 adjunto');
    const nuevosMsgs: Msg[] = [...msgs, { de: 'cliente', texto: etiqueta }];
    setMsgs(nuevosMsgs); setEntrada(''); setPensando(true);
    const cuerpo = {
      campos: preguntar, valores, mensajes: nuevosMsgs.slice(-10),
      adjunto: adjTexto || undefined,
      imagenes: adjImgs.length ? adjImgs : undefined,
    };
    quitarAdjuntos();  // ya van en este envío
    try {
      const r = await fetch('/api/asistente-bot/entrevista', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json();
      const cap = (d.captura && typeof d.captura === 'object') ? d.captura : {};
      const merged = { ...valores, ...cap };
      setValores(merged);
      if (d.mensaje) setMsgs(m => [...m, { de: 'quino', texto: d.mensaje }]);
      const faltan = preguntar.filter(c => !String(merged[c.clave] ?? '').trim());
      if (d.listo || faltan.length === 0) {
        setMsgs(m => [...m, { de: 'quino', texto: '¡Listo! Ya tengo todo. Armo tu bot… ✨' }]);
        compilar(merged);
      }
    } catch {
      setMsgs(m => [...m, { de: 'quino', texto: 'Uy, no pude procesarlo. ¿Me lo repites? 🙏' }]);
    } finally { setPensando(false); }
  }

  // "Saltar": deja el dato pendiente con su valor recomendado y sigue con el próximo.
  function saltar() {
    if (fase !== 'chat' || pensando) return;
    const p = siguientePendiente(valores);
    if (!p) { terminarAhora(); return; }
    const merged = { ...valores, [p.clave]: p.ejemplo ?? '' };
    setValores(merged);
    const sig = siguientePendiente(merged);
    const out: Msg[] = [...msgs, { de: 'cliente', texto: '(usar lo recomendado)' }];
    if (sig) out.push({ de: 'quino', texto: sig.pregunta ?? `¿Cuál es tu ${sig.etiqueta.toLowerCase()}?` });
    setMsgs(out);
    if (!sig) compilar(merged);
  }

  // Terminar ya: arma con lo que haya; lo que falte queda con su valor recomendado.
  function terminarAhora() {
    if (fase !== 'chat' || pensando) return;
    setMsgs(m => [...m, { de: 'cliente', texto: '(terminar aquí)' }, { de: 'quino', texto: '¡Perfecto! Con lo que me diste armo tu bot y lo demás lo dejo recomendado ✨' }]);
    setEntrada('');
    compilar(valores);
  }

  async function compilar(vals: Record<string, string>) {
    if (!plantilla) return;
    setFase('compilando');
    const finales = valoresConDefaults(vals);
    try {
      const r = await fetch('/api/asistente-bot/compilar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: plantilla.contenido, valores: finales, pulir: true }),
      });
      const d = await r.json();
      setEntrenamiento(d.entrenamiento ?? aplicarValores(plantilla.contenido, finales));
      setPulido(!!d.pulidoPorIA);
    } catch {
      setEntrenamiento(aplicarValores(plantilla.contenido, finales));
      setPulido(false);
    }
    setMsgs(m => [...m, { de: 'quino', texto: '¡Tu bot quedó listo! 🎉 Revísalo abajo y cuando estés conforme dale a "Guardar y activar".' }]);
    setFase('revisar');
  }

  // ── MODO ACTUALIZAR ──
  async function enviarActualizacion(texto: string) {
    const t = texto.trim();
    const hayAdj = !!adjTexto || adjImgs.length > 0;
    if ((!t && !hayAdj) || pensando) return;
    const etiqueta = t || (adjChips.length ? `📎 ${adjChips.map(c => c.nombre).join(', ')}` : '📎 adjunto');
    const nuevosMsgs: Msg[] = [...msgs, { de: 'cliente', texto: etiqueta }];
    setMsgs(nuevosMsgs);
    setEntrada('');
    setPensando(true);
    const adjuntoEnvio = adjTexto || undefined;
    const imgsEnvio = adjImgs.length ? adjImgs : undefined;
    quitarAdjuntos();
    try {
      const r = await fetch('/api/asistente-bot/actualizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, mensajes: nuevosMsgs.slice(-6), adjunto: adjuntoEnvio, imagenes: imgsEnvio }),
      });
      const d = await r.json();
      if (d.tipo === 'aplicar' && d.entrenamiento) {
        // Guardar el entrenamiento actualizado.
        let ok = false;
        try {
          const g = await fetch('/api/entrenamiento/guardar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: d.entrenamiento }) });
          const gd = await g.json(); ok = g.ok && gd.ok;
        } catch { /* */ }
        if (ok) {
          setActual(d.entrenamiento);
          // Quino confirma EXACTAMENTE qué cambió (mensaje variado, no robótico).
          const conf = String(d.confirmacion ?? '').trim()
            || '¡Listo! ✅ Actualicé ese dato en tu bot. ¿Quieres cambiar algo más?';
          setMsgs(m => [...m, { de: 'quino', texto: conf }]);
        } else {
          setMsgs(m => [...m, { de: 'quino', texto: 'Preparé el cambio pero no pude guardarlo. Intenta de nuevo en un momento, por favor 🙏' }]);
        }
      } else {
        setMsgs(m => [...m, { de: 'quino', texto: d.pregunta ?? '¿Qué dato quieres actualizar y cuál es su nuevo valor?' }]);
      }
    } catch {
      setMsgs(m => [...m, { de: 'quino', texto: 'Ahora mismo no pude procesarlo. ¿Me repites qué quieres cambiar? 🙏' }]);
    } finally { setPensando(false); }
  }

  // ── Guardar (modo armar → revisar) ──
  async function guardarYActivar() {
    if (guardando) return;
    setGuardando(true); setAviso(null);
    let ok = false, errText = 'no se pudo guardar';
    try {
      const r = await fetch('/api/entrenamiento/guardar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: entrenamiento }) });
      const d = await r.json(); ok = r.ok && d.ok; errText = d.error ?? errText;
    } catch { errText = 'error de conexión'; }
    setGuardando(false);
    if (!ok) { setAviso({ ok: false, text: 'No se pudo guardar: ' + errText }); return; }
    setGuardado(true); setActual(entrenamiento);
    setAviso({ ok: true, text: '✅ ¡Guardado y activado! Ya es el cerebro de tu bot. Puedes verlo en Entrenamiento o probarlo en su simulador.' });
    setMsgs(m => [...m, { de: 'quino', texto: '¡Guardado! ✅ Tu bot ya quedó entrenado y activo. Lo puedes probar en la pestaña Entrenamiento 🚀' }]);
  }

  const inputCls = 'w-full bg-white border border-[#E8E8E8] rounded-xl px-3 py-2.5 text-sm text-[#0D0D0D] placeholder:text-[#B5B5B5] focus:outline-none focus:border-[#00A89D]';
  const enModoChat = fase === 'chat' && preguntar.length > 0;
  const enModoActualizar = fase === 'actualizar';

  return (
    <div className="flex-1 flex min-w-0 overflow-hidden bg-[#FAF9F6]">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-3 border-b border-[#E8E8E8] bg-white shrink-0 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[#0D0D0D] font-bold text-base flex items-center gap-2">🪄 Arma tu bot con Quino</h1>
            <p className="text-[11px] text-[#9A9A9A]">{enModoActualizar ? 'Tu bot ya está armado. Dime qué dato quieres actualizar.' : 'Conversa con Quino y él arma el cerebro de tu bot.'}</p>
          </div>
          {fase === 'chat' && preguntar.length > 0 && (
            <span className="text-[11px] text-[#6B6B6B] bg-[#F0F0F0] px-2 py-1 rounded-full shrink-0">{llenos} de {preguntar.length} datos ✓</span>
          )}
          {enModoActualizar && plantilla && (
            <button onClick={() => arrancarArmado(plantilla)} className="text-[11px] text-[#6B6B6B] border border-[#E8E8E8] px-2.5 py-1 rounded-full hover:bg-[#F5F5F5] shrink-0">Armar de nuevo desde cero</button>
          )}
        </div>

        <div className="px-6 pt-3 shrink-0">
          <div className="text-[11px] text-[#7C3AED] bg-[#8B5CF6]/[0.08] border border-[#8B5CF6]/20 rounded-lg px-3 py-2 leading-relaxed">
            <b>Habla con Quino y él arma tu bot.</b> Te entrevista (qué vendes, precios, envíos, pagos…) y con tus respuestas <b>arma todo el entrenamiento</b>. Si tienes una <b>duda</b>, pregúntale y te la aclara; y si tu bot <b>ya está armado</b>, dile qué dato cambiar y lo actualiza al momento. Todo en un solo lugar 🙌
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {aviso && <div className={`text-sm rounded-lg px-3 py-2 border ${aviso.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>{aviso.text}</div>}

          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.de === 'cliente' ? 'justify-end' : 'justify-start'} gap-2`}>
              {m.de === 'quino' && <span className="text-lg shrink-0">🤖</span>}
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-snug ${m.de === 'cliente' ? 'bg-[#00A89D] text-white rounded-br-sm' : 'bg-white text-[#0D0D0D] border border-[#E8E8E8] rounded-tl-sm shadow-sm'}`}>{m.texto}</div>
            </div>
          ))}

          {(fase === 'compilando' || pensando) && (
            <div className="flex justify-start gap-2">
              <span className="text-lg">🤖</span>
              <div className="bg-white border border-[#E8E8E8] px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm"><span className="text-[#9A9A9A] text-sm animate-pulse">{fase === 'compilando' ? 'Armando tu bot… ✨' : 'Pensando… ✨'}</span></div>
            </div>
          )}

          {fase === 'revisar' && (
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#6B6B6B] font-semibold">Entrenamiento de tu bot{pulido ? ' (Quino pulió la redacción)' : ''}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: sem.color, backgroundColor: sem.color + '18' }}>~{tok.toLocaleString('es-CO')} tokens · {sem.texto}</span>
              </div>
              <textarea value={entrenamiento} onChange={e => { setEntrenamiento(e.target.value); setGuardado(false); }} rows={14} className={inputCls + ' font-mono text-xs resize-y leading-relaxed'} />
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={() => plantilla && arrancarArmado(plantilla)} className="px-3 py-2 rounded-lg border border-[#E8E8E8] text-xs hover:bg-[#F5F5F5]">↻ Empezar de nuevo</button>
                <button onClick={guardarYActivar} disabled={guardando || guardado} className={`px-6 py-2.5 rounded-lg text-sm font-bold ml-auto transition-all ${guardado ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-[#00A89D] text-white hover:bg-[#00847A]'} disabled:opacity-60`}>{guardando ? 'Guardando…' : guardado ? 'Guardado ✓' : 'Guardar y activar ✓'}</button>
              </div>
            </div>
          )}

          <div ref={finRef} />
        </div>

        {/* Input modo ARMAR (conversacional, con adjuntos y audio) */}
        {enModoChat && (
          <div className="p-3 border-t border-[#E8E8E8] bg-white shrink-0">
            {/* Chips de archivos adjuntos, listos para enviar */}
            {adjChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {adjChips.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-[#EAF7F5] text-[#00847A] border border-[#00A89D]/25 px-2 py-1 rounded-full max-w-[180px]">
                    <span className="shrink-0">{c.tipo === 'imagen' ? '🖼️' : '📄'}</span>
                    <span className="truncate">{c.nombre}</span>
                  </span>
                ))}
                <button onClick={quitarAdjuntos} className="text-[11px] text-[#DC2626] hover:underline px-1">quitar</button>
              </div>
            )}

            <input
              ref={refArchivo} type="file" className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md"
              onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }}
            />

            <div className="flex gap-2 items-end">
              <button
                onClick={() => refArchivo.current?.click()} disabled={subiendoArch || pensando}
                title="Adjuntar archivo (PDF, Word, Excel, foto, texto…)"
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#E8E8E8] hover:bg-[#F5F5F5] shrink-0 disabled:opacity-50 text-lg"
              >📎</button>
              <button
                onClick={toggleGrabar} disabled={subiendoArch || pensando}
                title={grabando ? 'Detener y transcribir' : 'Grabar nota de voz'}
                className={`w-10 h-10 flex items-center justify-center rounded-xl border shrink-0 disabled:opacity-50 text-lg ${grabando ? 'border-red-400 bg-red-50 text-red-600 animate-pulse' : 'border-[#E8E8E8] hover:bg-[#F5F5F5]'}`}
              >{grabando ? '⏹️' : '🎤'}</button>
              <textarea
                autoFocus value={entrada} onChange={e => setEntrada(e.target.value)} rows={2}
                onPaste={onPaste}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarEntrevista(entrada); } }}
                placeholder={grabando ? 'Grabando… 🎙️' : (pendiente?.ejemplo ? `Responde, pega o adjunta… (ej: ${pendiente.ejemplo})` : 'Responde, pega, adjunta o pregúntale a Quino…')}
                disabled={pensando}
                className={inputCls + ' resize-none'}
              />
              <button onClick={() => enviarEntrevista(entrada)} disabled={pensando || subiendoArch} className="px-5 h-10 rounded-xl text-sm font-bold bg-[#00A89D] text-white hover:bg-[#00847A] shrink-0 disabled:opacity-50">Enviar</button>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <button onClick={saltar} disabled={pensando} className="text-[12px] text-[#6B6B6B] hover:text-[#0D0D0D] border border-[#E8E8E8] rounded-full px-3 py-1 disabled:opacity-50">Saltar ⏭️</button>
              <button onClick={terminarAhora} disabled={pensando} className="text-[12px] text-[#00847A] hover:text-[#00A89D] font-medium disabled:opacity-50">Terminar aquí y armar mi bot ✓</button>
              {subiendoArch && <span className="text-[11px] text-[#9A9A9A] ml-auto">Procesando… ⏳</span>}
            </div>
          </div>
        )}

        {/* Input modo ACTUALIZAR (con adjuntos y audio) */}
        {enModoActualizar && (
          <div className="p-3 border-t border-[#E8E8E8] bg-white shrink-0">
            {adjChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {adjChips.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-[#EAF7F5] text-[#00847A] border border-[#00A89D]/25 px-2 py-1 rounded-full max-w-[180px]">
                    <span className="shrink-0">{c.tipo === 'imagen' ? '🖼️' : '📄'}</span>
                    <span className="truncate">{c.nombre}</span>
                  </span>
                ))}
                <button onClick={quitarAdjuntos} className="text-[11px] text-[#DC2626] hover:underline px-1">quitar</button>
              </div>
            )}
            <input
              ref={refArchivo} type="file" className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md"
              onChange={e => { const f = e.target.files?.[0]; if (f) procesarArchivo(f); e.target.value = ''; }}
            />
            <div className="flex gap-2 items-center">
              <button onClick={() => refArchivo.current?.click()} disabled={subiendoArch || pensando} title="Adjuntar archivo (PDF, Word, Excel, foto…)" className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#E8E8E8] hover:bg-[#F5F5F5] shrink-0 disabled:opacity-50 text-lg">📎</button>
              <button onClick={toggleGrabar} disabled={subiendoArch || pensando} title={grabando ? 'Detener y transcribir' : 'Grabar nota de voz'} className={`w-10 h-10 flex items-center justify-center rounded-xl border shrink-0 disabled:opacity-50 text-lg ${grabando ? 'border-red-400 bg-red-50 text-red-600 animate-pulse' : 'border-[#E8E8E8] hover:bg-[#F5F5F5]'}`}>{grabando ? '⏹️' : '🎤'}</button>
              <input autoFocus value={entrada} onChange={e => setEntrada(e.target.value)} onPaste={onPaste} onKeyDown={e => { if (e.key === 'Enter') enviarActualizacion(entrada); }} placeholder={grabando ? 'Grabando… 🎙️' : 'Cambia un dato, pega o adjunta un archivo…'} className={inputCls} disabled={pensando} />
              <button onClick={() => enviarActualizacion(entrada)} disabled={pensando || subiendoArch} className="px-5 h-10 rounded-xl text-sm font-bold bg-[#00A89D] text-white hover:bg-[#00847A] shrink-0 disabled:opacity-50">Enviar</button>
            </div>
            {subiendoArch && <p className="text-[11px] text-[#9A9A9A] mt-1">Procesando… ⏳</p>}
          </div>
        )}
      </div>

      {/* Vista previa */}
      {(fase === 'chat' || fase === 'compilando' || fase === 'actualizar') && (
        <div className="w-[320px] shrink-0 flex flex-col bg-white border-l border-[#E8E8E8]">
          <div className="px-4 py-3 border-b border-[#E8E8E8] flex items-center justify-between shrink-0">
            <span className="text-[#0D0D0D] text-sm font-semibold">{enModoActualizar ? 'Tu bot actual' : 'Así va tu bot'}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ color: sem.color, backgroundColor: sem.color + '18' }}>~{tok.toLocaleString('es-CO')} · {sem.texto}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4"><pre className="text-[10px] text-[#3A3A3A] whitespace-pre-wrap leading-relaxed font-mono">{preview}</pre></div>
        </div>
      )}
    </div>
  );
}
