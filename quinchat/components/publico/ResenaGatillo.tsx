'use client';

import { useEffect, useState } from 'react';

/**
 * Aviso flotante "Nueva reseña agregada" (reseña gatillo). Aparece a los
 * `aparece` seg, dura `dura` seg y se borra. Al tocarlo hace scroll a la reseña.
 * Todo es editable desde el bloque de reseñas (props aviso*).
 */
export default function ResenaGatillo({
  nombre, foto, texto = 'Nueva reseña', color = '#1E3A8A', colorTexto = '#FFFFFF',
  posicion = 'sup-der', aparece = 6, dura = 20,
}: {
  nombre?: string; foto?: string; texto?: string; color?: string; colorTexto?: string;
  posicion?: string; aparece?: number; dura?: number;
}) {
  const [show, setShow] = useState(false);
  const [ido, setIdo] = useState(false);

  useEffect(() => {
    const aParecer = setTimeout(() => setShow(true), aparece * 1000);
    const ocultar = setTimeout(() => setIdo(true), (aparece + dura) * 1000);
    return () => { clearTimeout(aParecer); clearTimeout(ocultar); };
  }, [aparece, dura]);

  if (!show || ido) return null;

  const pos =
    posicion === 'sup-izq' ? 'top-3 left-2' :
    posicion === 'inf-izq' ? 'bottom-3 left-2' :
    posicion === 'inf-der' ? 'bottom-3 right-2' :
    'top-3 right-2'; // sup-der (por defecto)

  return (
    <button
      onClick={() => {
        document.getElementById('clientes-felices')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setIdo(true);
      }}
      className={`fixed ${pos} z-50 flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 shadow-xl animate-pulse max-w-[62%]`}
      style={{ background: color, color: colorTexto }}
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" className="w-6 h-6 rounded-full object-cover border border-white shrink-0" />
      ) : (
        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[11px] shrink-0">🆕</span>
      )}
      <span className="text-[10px] font-semibold leading-tight text-left truncate">
        {texto}{nombre ? ` · ${nombre.split(' ')[0]}` : ''} <span className="opacity-80">→</span>
      </span>
    </button>
  );
}
