import Link from 'next/link';
import { pesos } from '@/lib/funnels';
import { GATILLOS_DEFAULT, botonVariante } from '@/lib/bloques';

/**
 * Bloque "Gatillos mentales" (estilo urgencia): a la izquierda título + mensaje
 * de escasez con barra y el recuadro de instrucción; a la derecha sellos, precio
 * normal tachado, oferta con el precio y el botón. Todo editable por props.
 */
export default function Gatillos({
  props, precio, precioAntes, href, acento,
}: {
  props?: Record<string, any>;
  precio?: number;
  precioAntes?: number | null;
  href?: string;
  acento?: string;
}) {
  const p = props ?? {};
  const g = GATILLOS_DEFAULT;
  const titulo = (p.titulo ?? g.titulo) as string;
  const colorTitulo = (p.colorTitulo || g.colorTitulo) as string;
  const tituloSize = Number(p.tituloSize) || g.tituloSize;
  const mensaje = (p.mensaje ?? g.mensaje) as string;
  const colorMensaje = (p.colorMensaje || g.colorMensaje) as string;
  const pct = Math.max(3, Math.min(100, Number(p.porcentaje) || g.porcentaje));
  const colorBarra = (p.colorBarra || g.colorBarra) as string;
  const descripcion = (p.descripcion ?? g.descripcion) as string;
  const badges: string[] = Array.isArray(p.badges) ? p.badges : g.badges;
  const labelNormal = (p.labelNormal ?? g.labelNormal) as string;
  const labelOferta = (p.labelOferta ?? g.labelOferta) as string;
  const colorPrecio = (p.colorPrecio || g.colorPrecio) as string;
  const cta = (p.cta ?? g.cta) as string;
  const colorCta = (p.colorCta || g.colorCta) as string;
  const ctaSize = Number(p.ctaSize) || g.ctaSize;
  const ctaEscala = Number(p.ctaEscala) || g.ctaEscala || 1;
  const ctaVariante = (p.ctaVariante || g.ctaVariante) as string;
  const font = (p.font || undefined) as string | undefined;
  const mensajeSize = Number(p.mensajeSize) || g.mensajeSize;
  const descSize = Number(p.descSize) || g.descSize;
  const ofertaSize = Number(p.ofertaSize) || g.ofertaSize;
  const precioSize = Number(p.precioSize) || g.precioSize;
  const colorDesc = (p.colorDesc || g.colorDesc) as string;
  const colorOferta = (p.colorOferta || g.colorOferta) as string;

  const hoy = Number(precio) || 0;
  const normal = Number(precioAntes) || 0;

  const vBtn = botonVariante(ctaVariante, colorCta);
  const boton = (
    <span
      className={`boton-compra relative overflow-hidden flex items-center justify-center text-white font-extrabold px-4 ${vBtn.clase}`}
      style={{ ...vBtn.estilo, fontSize: Math.round(ctaSize * ctaEscala), paddingTop: Math.round(14 * ctaEscala), paddingBottom: Math.round(14 * ctaEscala) }}>
      {cta} <span className="ml-2 leading-none" style={{ fontSize: Math.round(ctaSize * ctaEscala * 1.15) }}>→</span>
    </span>
  );

  return (
    <div className="px-3 py-3" style={{ fontFamily: font }}>
      {/* Sellos arriba */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-3">
          {badges.map((b, i) => (
            <span key={i} className="text-[11px] font-semibold text-[#4B4B4B] bg-white border border-[#E8E8E8] rounded-full px-2.5 py-1">{b}</span>
          ))}
        </div>
      )}

      {/* Fila: caja de oferta/stock + precio (2 columnas, también en móvil) */}
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="p-2.5 text-center">
          <h3 className="font-extrabold leading-tight" style={{ color: colorTitulo, fontSize: tituloSize }}>{titulo}</h3>
          {mensaje && <p className="font-bold mt-1 leading-tight" style={{ color: colorMensaje, fontSize: mensajeSize }}>{mensaje}</p>}
          <div className="h-3 rounded-full border border-[#111] overflow-hidden mt-2 bg-white">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colorBarra }} />
          </div>
        </div>

        <div className="text-center">
          {normal > 0 && (
            <p className="font-bold text-sm text-[#0D0D0D] leading-tight">
              {labelNormal} <span className="line-through" style={{ color: colorPrecio }}>{pesos(normal)}</span>
            </p>
          )}
          <p className="font-extrabold leading-tight mt-0.5" style={{ fontSize: ofertaSize, color: colorOferta }}>{labelOferta}</p>
          <p className="font-extrabold leading-tight" style={{ fontSize: precioSize, color: colorPrecio }}>{pesos(hoy)}</p>
        </div>
      </div>

      {/* Botón grande a todo el ancho */}
      <div className="mt-3">
        {href ? <Link href={href} className="block">{boton}</Link> : boton}
      </div>

      {/* Instrucción (opcional) */}
      {descripcion && (
        <div className="rounded-xl border-2 border-[#1E3A8A] p-3 text-center mt-3">
          <p className="font-extrabold leading-snug" style={{ fontSize: descSize, color: colorDesc }}>{descripcion}</p>
        </div>
      )}
    </div>
  );
}
