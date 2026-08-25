'use client';

/**
 * Sonidos y confeti para el monedero de metas. Todo sintetizado con Web Audio
 * (no hay archivos que cargar). Los navegadores bloquean el audio hasta que el
 * usuario interactúa; por eso llamamos a `desbloquearAudio()` en el primer clic.
 */

let ctx: AudioContext | null = null;

function obtenerCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Se llama en el primer gesto del usuario para habilitar el sonido. */
export function desbloquearAudio() {
  const c = obtenerCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function nota(freq: number, inicio: number, dur: number, vol = 0.22, tipo: OscillatorType = 'triangle') {
  const c = obtenerCtx();
  if (!c) return;
  const t0 = c.currentTime + inicio;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** "Cha-ching" de caja registradora: dos campanitas ascendentes. */
export function chaChing() {
  const c = obtenerCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  // dos notas rápidas tipo campana (mi5 -> la5)
  nota(1318.5, 0.0, 0.18, 0.25, 'triangle');
  nota(1760.0, 0.09, 0.35, 0.22, 'triangle');
  // brillo agudo encima
  nota(2637.0, 0.09, 0.25, 0.08, 'sine');
}

/** Fanfarria corta al cruzar una meta. */
export function fanfarria() {
  const c = obtenerCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const notas = [523.25, 659.25, 783.99, 1046.5]; // do-mi-sol-do
  notas.forEach((f, i) => nota(f, i * 0.12, 0.4, 0.24, 'triangle'));
  nota(1567.98, 0.48, 0.6, 0.12, 'sine');
}

/** Lluvia de confeti sobre toda la pantalla (~1.6s). */
export function confeti() {
  if (typeof document === 'undefined') return;
  const colores = ['#00A89D', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#22C55E'];
  const cont = document.createElement('div');
  cont.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(cont);

  const N = 90;
  for (let i = 0; i < N; i++) {
    const p = document.createElement('div');
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const dur = 1.4 + Math.random() * 1.2;
    const delay = Math.random() * 0.3;
    const giro = (Math.random() * 720 - 360).toFixed(0);
    p.style.cssText = `position:absolute;top:-16px;left:${left}%;width:${size}px;height:${size * 0.6}px;`
      + `background:${colores[i % colores.length]};opacity:0.9;border-radius:2px;`
      + `animation:confetiCae ${dur}s ${delay}s ease-in forwards;--giro:${giro}deg`;
    cont.appendChild(p);
  }

  if (!document.getElementById('confeti-kf')) {
    const st = document.createElement('style');
    st.id = 'confeti-kf';
    st.textContent = '@keyframes confetiCae{to{transform:translateY(105vh) rotate(var(--giro));opacity:0}}';
    document.head.appendChild(st);
  }

  setTimeout(() => cont.remove(), 3200);
}
