'use client';

/**
 * Ventana flotante de confirmación reutilizable (no usa el confirm() del navegador).
 * `peligro` pinta el botón principal en rojo para acciones destructivas.
 */
export default function ModalConfirm({
  abierto, titulo, mensaje,
  textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar',
  peligro = false, onConfirmar, onCancelar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  peligro?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onCancelar}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-[#0D0D0D]">{titulo}</h3>
        {mensaje && <p className="text-sm text-[#6B6B6B] mt-2 leading-snug">{mensaje}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancelar}
            className="px-4 py-2 rounded-lg border border-[#E8E8E8] text-sm font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]"
          >{textoCancelar}</button>
          <button
            onClick={onConfirmar}
            className={`px-4 py-2 rounded-lg text-white text-sm font-semibold ${
              peligro ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#00A89D] hover:bg-[#00847A]'
            }`}
          >{textoConfirmar}</button>
        </div>
      </div>
    </div>
  );
}
