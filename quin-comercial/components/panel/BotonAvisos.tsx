'use client';

import { useEffect, useState } from 'react';

type Estado = 'cargando' | 'no-soportado' | 'bloqueado' | 'apagado' | 'encendido';

/** Convierte la clave VAPID (base64url) al formato que exige el navegador. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const out     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Botón para activar/desactivar las notificaciones push en este dispositivo.
 * Hay que activarlo una vez en cada equipo (PC, celular).
 */
export default function BotonAvisos({ colapsado = false }: { colapsado?: boolean }) {
  const [estado, setEstado]   = useState<Estado>('cargando');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setEstado('no-soportado');
        return;
      }
      if (Notification.permission === 'denied') {
        setEstado('bloqueado');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setEstado(sub ? 'encendido' : 'apagado');
      } catch {
        setEstado('apagado');
      }
    })();
  }, []);

  async function activar() {
    setOcupado(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado');
        return;
      }

      // La clave se pide al servidor en tiempo de ejecución (así funciona con
      // NEXT_PUBLIC_VAPID_PUBLIC_KEY o con VAPID_PUBLIC_KEY, sin depender del build).
      let clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
      if (!clave) {
        try {
          const rk = await fetch('/api/push/clave', { cache: 'no-store' });
          const dk = await rk.json();
          clave = String(dk?.publicKey ?? '').trim();
        } catch { /* sin conexión */ }
      }
      if (!clave) {
        alert('Aún no está configurada la clave de notificaciones (VAPID) en Vercel. Agrégala en Vercel (Environment Variables), en el entorno Production, y vuelve a desplegar.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;

      // Si ya existía una suscripción (por ejemplo de una clave anterior), hay que
      // eliminarla: el navegador rechaza suscribir de nuevo con otra clave.
      const previa = await reg.pushManager.getSubscription();
      if (previa) {
        try { await previa.unsubscribe(); } catch { /* seguir igual */ }
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(clave) as BufferSource,
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const detalle = await res.text().catch(() => '');
        throw new Error(`El servidor respondió ${res.status}. ${detalle.slice(0, 200)}`);
      }

      setEstado('encendido');
    } catch (e: any) {
      console.error('[Push] error activando:', e);
      alert(`No se pudieron activar los avisos.\n\nMotivo: ${e?.name ?? 'Error'} — ${e?.message ?? e}`);
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEstado('apagado');
    } catch (e) {
      console.error('[Push] error desactivando:', e);
    } finally {
      setOcupado(false);
    }
  }

  if (estado === 'cargando' || estado === 'no-soportado') return null;

  if (estado === 'bloqueado') {
    if (colapsado) return <div className="py-2 text-center text-base" title="Avisos bloqueados">🔕</div>;
    return (
      <div className="px-3 py-2 rounded-xl bg-white/10 text-[10px] leading-snug text-white/70">
        🔕 Avisos bloqueados. Actívalos en los permisos del navegador para este sitio.
      </div>
    );
  }

  const encendido = estado === 'encendido';

  return (
    <button
      onClick={encendido ? desactivar : activar}
      disabled={ocupado}
      className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-200 ease-out disabled:opacity-50 ${colapsado ? 'justify-center gap-0' : 'gap-3'} ${
        encendido
          ? 'bg-white/20 text-white hover:bg-white/25'
          : `text-white/85 hover:text-white hover:bg-white/15 ${colapsado ? '' : 'hover:translate-x-1'}`
      }`}
      title={encendido ? 'Avisos activados en este dispositivo' : 'Recibir aviso cuando escriba un cliente'}
    >
      <span className="text-base shrink-0">{encendido ? '🔔' : '🔕'}</span>
      <span className={`truncate ${colapsado ? 'hidden' : ''}`}>{ocupado ? 'Un momento…' : encendido ? 'Avisos activos' : 'Activar avisos'}</span>
    </button>
  );
}
