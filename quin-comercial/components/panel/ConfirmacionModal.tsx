'use client';

/**
 * Ventana flotante de confirmación reutilizable. Sirve para "¿salir sin guardar?"
 * y "¿seguro que deseas eliminar?" en cualquier módulo (plantillas, catálogos,
 * disparadores, FAQ, landing…). Evita perder trabajo o borrar algo por error.
 */
export default function ConfirmacionModal({
  abierto,
  titulo,
  mensaje,
  textoAceptar = 'Aceptar',
  textoCancelar = 'Cancelar',
  peligro = false,
  onAceptar,
  onCancelar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje?: string;
  textoAceptar?: string;
  textoCancelar?: string;
  peligro?: boolean;          // botón de aceptar en rojo (para eliminar)
  onAceptar: () => void;
  onCancelar: () => void;
}) {
  if (!abierto) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-[#E8E8E8] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-[15px] font-bold text-[#0D0D0D] mb-1.5">{titulo}</h3>
          {mensaje && <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{mensaje}</p>}
        </div>
        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded-xl border border-[#E8E8E8] text-[#3A3A3A] text-sm font-semibold hover:bg-[#F5F5F5] transition-colors"
          >
            {textoCancelar}
          </button>
          <button
            onClick={onAceptar}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors ${
              peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-[#00A89D] hover:bg-[#00847A]'
            }`}
          >
            {textoAceptar}
          </button>
        </div>
      </div>
    </div>
  );
}
