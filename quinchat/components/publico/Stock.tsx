import { STOCK_DEFAULT } from '@/lib/bloques';
import BarraStockAnimada from './BarraStockAnimada';

/**
 * Bloque "Stock / escasez": barra de disponibilidad + mensaje de urgencia.
 * Presentacional; se usa en la página y en la vista previa. Puede ir flotante.
 * Si tiene barra inicial y final, la barra baja sola muy lento (sin vaciarse).
 */
export default function Stock({ props, flotante }: { props?: Record<string, any>; flotante?: boolean }) {
  const p = props ?? {};
  const titulo = (p.titulo ?? STOCK_DEFAULT.titulo) as string;
  const pct = Math.max(3, Math.min(100, Number(p.porcentaje) || STOCK_DEFAULT.porcentaje));
  const mensaje = (p.mensaje ?? STOCK_DEFAULT.mensaje) as string;
  const alerta = (p.alerta ?? STOCK_DEFAULT.alerta) as string;
  const color = (p.color || STOCK_DEFAULT.color) as string;

  // Animación: solo si el admin activó "barra que baja sola" con inicial > final.
  const anim = p.animar === true && Number(p.barraInicial) > Number(p.barraFinal);
  const barraInicial = Number(p.barraInicial) || pct;
  const barraFinal = Number(p.barraFinal) || Math.max(1, Math.round(pct / 3));
  const cadaSeg = Number(p.cadaSeg) > 0 ? Number(p.cadaSeg) : 15;
  const paso = Number(p.paso) > 0 ? Number(p.paso) : 1;

  return (
    <div className={flotante ? '' : 'px-3 py-1.5'}>
      <div className={`rounded-2xl border border-[#E8E8E8] bg-white ${flotante ? 'p-3' : 'p-3'} text-center`}>
        <h3 className="font-extrabold text-sm tracking-wide" style={{ color: (p.tituloColor as string) || '#0D0D0D', fontFamily: (p.tituloFont as string) || undefined, fontSize: Number(p.tituloSize) || undefined }}>{titulo}</h3>
        {anim ? (
          <BarraStockAnimada inicial={barraInicial} final={barraFinal} color={color} cadaSeg={cadaSeg} paso={paso} />
        ) : (
          <div className="h-3 rounded-full bg-[#E8E8E8] overflow-hidden mt-2">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
          </div>
        )}
        {mensaje && <p className="text-[12px] text-[#6B6B6B] mt-2 leading-snug">{mensaje}</p>}
        {alerta && <p className="text-sm font-extrabold mt-1.5" style={{ color }}>⚠️ {alerta}</p>}
      </div>
    </div>
  );
}
