'use client';

import { useEffect, useState } from 'react';

/**
 * Botón «← Volver a la página de inicio» para «Mi Página» (08-nov-2026).
 * Solo aparece si el cliente LLEGÓ desde Mi Página (pedido.klixmant.shop/web/<slug>) en esa misma pestaña.
 * Quien entra al embudo desde un anuncio o un enlace directo NO lo ve: el embudo queda igual que siempre.
 * No toca la lógica del embudo: vive en app/p/layout.tsx y solo lee/escribe sessionStorage.
 */
const CLAVE = 'qc-tienda';
const esPaginaWeb = (ruta: string) => /^\/(p\/)?web\//.test(ruta);

export default function VolverTienda() {
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    try {
      const ruta = window.location.pathname;
      if (esPaginaWeb(ruta)) {
        // Está en Mi Página: se recuerda para mostrar el botón en los embudos que abra (no en la vista previa del panel)
        if (!new URLSearchParams(window.location.search).has('borrador')) {
          sessionStorage.setItem(CLAVE, ruta.replace(/^\/p\/web\//, '/web/'));
        }
        return;
      }
      let guardado = sessionStorage.getItem(CLAVE);
      // Respaldo: llegó desde Mi Página pero el navegador no guardó la sesión
      if (!guardado && document.referrer) {
        const r = new URL(document.referrer);
        if (r.origin === window.location.origin && esPaginaWeb(r.pathname)) {
          guardado = r.pathname.replace(/^\/p\/web\//, '/web/');
          sessionStorage.setItem(CLAVE, guardado);
        }
      }
      if (guardado && esPaginaWeb(guardado)) setDestino(guardado);
    } catch { /* sin sessionStorage: no se muestra */ }
  }, []);

  if (!destino) return null;
  return (
    <div className="w-full bg-[#0D1F1C] text-white">
      <a href={destino} className="max-w-3xl mx-auto flex items-center gap-2 px-3 py-2 text-[13px] font-bold hover:opacity-90">
        <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-sm leading-none">←</span>
        Volver a la página de inicio
      </a>
    </div>
  );
}
