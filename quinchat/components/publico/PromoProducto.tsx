'use client';

import { useState } from 'react';
import {
  Promo, SITE, pesos, coloresDe, tallasEnColor, controla, stockTotal,
  hexColor, fotoDeColor, coloresConFoto, agrupar, ICONO_GEN,
} from './PromosLista';

const WA_DEFECTO = '573167648391';

/**
 * Página de UN producto (deep link con tarjeta de WhatsApp).
 * Muestra la foto grande, colores, tallas disponibles y el botón
 * "COMPRAR POR WHATSAPP" que va al número del vendedor (si el link trae ?v=).
 */
export default function PromoProducto({
  promo, sellerWa, sellerNombre, sellerCodigo, ventaCodigo, ventaToken, canSell, initialColor,
}: {
  promo: Promo;
  sellerWa?: string | null;
  sellerNombre?: string | null;
  sellerCodigo?: string | null;
  ventaCodigo?: string | null;
  ventaToken?: string | null;
  canSell?: boolean;
  initialColor?: string | null;
}) {
  const colores = coloresDe(promo);
  const [color, setColor] = useState(initialColor && colores.includes(initialColor) ? initialColor : (colores[0] || ''));
  const [talla, setTalla] = useState('');
  const cambiarColor = (c: string) => { setColor(c); setTalla(''); };

  // Estado del botón "Marcar vendido" (solo visible con token de vendedor).
  const [vendiendo, setVendiendo] = useState(false);
  const [vendidoMsg, setVendidoMsg] = useState<string | null>(null);
  const [vendidoErr, setVendidoErr] = useState<string | null>(null);

  async function marcarVendido() {
    setVendidoErr(null); setVendidoMsg(null);
    if (colores.length > 0 && !color) { setVendidoErr('Elige el color que se vendió.'); return; }
    if (!talla) { setVendidoErr('Elige la talla que se vendió.'); return; }
    setVendiendo(true);
    try {
      const res = await fetch('/api/promociones/vender', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoId: promo.id, color, talla, codigo: ventaCodigo, token: ventaToken }),
      });
      const d = await res.json();
      if (!res.ok) { setVendidoErr(d.error || 'No se pudo descontar.'); return; }
      const quedanColor = d.restanteColor;
      setVendidoMsg(`✅ Descontada 1 unidad de ${color || 'este producto'} talla ${talla.replace('CABALLERO - ', '').replace('DAMA - ', '')}.` + (quedanColor != null ? ` Quedan ${quedanColor} en esa talla/color.` : ''));
    } catch { setVendidoErr('Error de conexión. Intenta de nuevo.'); }
    finally { setVendiendo(false); }
  }

  const waNumber = sellerWa || WA_DEFECTO;
  const conFoto = coloresConFoto(promo);
  const grupos = agrupar(tallasEnColor(promo, color));
  const total = stockTotal(promo);
  const desc = (promo.precio_antes && promo.precio_antes > promo.precio) ? Math.round((1 - promo.precio / promo.precio_antes) * 100) : 0;
  const ultimas = controla(promo) && total <= 3 && total > 0;
  const pocas = controla(promo) && total > 3 && total <= 7;
  const agotado = controla(promo) && total <= 0;

  // Link de esta misma página (para que, reenviado, muestre la tarjeta con foto).
  const urlProducto = `${SITE}/promos/${promo.id}${sellerCodigo ? `?v=${sellerCodigo}` : ''}${color ? `${sellerCodigo ? '&' : '?'}color=${encodeURIComponent(color)}` : ''}`;
  const catalogoUrl = `${SITE}/promos${sellerCodigo ? `?v=${sellerCodigo}` : ''}`;

  const waText = encodeURIComponent(
    `¡Hola! 😊 Quiero este producto:\n*${promo.nombre}*${promo.referencia ? `\nRef: ${promo.referencia}` : ''}`
    + `${color ? `\nColor: ${color}` : ''}${talla ? `\nTalla: ${talla.replace(' - ', ' ')}` : ''}`
    + `\nValor: ${pesos(promo.precio)}\n${urlProducto}`,
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="pp-wrap">
        <article className="pp-card">
          {agotado && (
            <div className="pp-body" style={{ textAlign: 'center' }}>
              <h1 className="pp-name">{promo.nombre}</h1>
              <p className="pp-urg rojo">AGOTADO por ahora 😔</p>
              <p style={{ color: '#9fb4b0', fontSize: 13 }}>Este producto no tiene unidades disponibles en este momento.</p>
              <a className="pp-vertodo" href={catalogoUrl}>← Ver todo el catálogo</a>
            </div>
          )}
          {!agotado && <>
          <div className="pp-imgwrap">
            {desc > 0 && <div className="pp-desc">-{desc}%</div>}
            {fotoDeColor(promo, color)
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={fotoDeColor(promo, color)} alt={promo.nombre} className="pp-img" />
              : <div className="pp-img pp-noimg">🛍️</div>}
            {conFoto.length > 1 && (
              <div className="pp-thumbs">
                {conFoto.map(c => (
                  <button key={c} onClick={() => cambiarColor(c)} title={c} className={`pp-thumb ${color === c ? 'on' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={promo.fotos![c]} alt={c} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pp-body">
            <h1 className="pp-name">{promo.nombre}</h1>

            <div className="pp-prices">
              <span className="pp-price">{pesos(promo.precio)}</span>
              {promo.precio_antes ? <span className="pp-price-old">{pesos(promo.precio_antes)}</span> : null}
            </div>

            {ultimas && <p className="pp-urg rojo">🔥 SOLO QUEDAN {total} {total === 1 ? 'UNIDAD' : 'UNIDADES'}</p>}
            {pocas && <p className="pp-urg amar">⚡ QUEDAN POCAS UNIDADES</p>}

            {!agotado && colores.length > 0 && (
              <>
                <div className="pp-hint">Selecciona el color para ver las tallas disponibles</div>
                <div className="pp-swrow">
                  {colores.map(c => (
                    <button key={c} title={c} onClick={() => cambiarColor(c)} className={`pp-sdot ${color === c ? 'on' : ''}`}>
                      <span style={{ background: hexColor(c) }} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {!agotado && grupos.length > 0 && (
              <div className="pp-tallas">
                <div className="pp-tallas-aviso">🔥 TALLAS DISPONIBLES 👇</div>
                {grupos.map(g => (
                  <div key={g.genero} className="pp-genwrap">
                    {g.genero !== 'TALLA' && <div className="pp-genlabel">{ICONO_GEN[g.genero] ?? '📏'} {g.genero}</div>}
                    <div className="pp-pills">
                      {g.items.map(it => (
                        <button key={it.full} onClick={() => setTalla(it.full === talla ? '' : it.full)} className={`pp-pill ${talla === it.full ? 'on' : ''}`}>
                          {it.size}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {agotado && <p className="pp-urg rojo" style={{ textAlign: 'center' }}>AGOTADO por ahora 😔</p>}

            <a className="pp-wa" href={`https://wa.me/${waNumber}?text=${waText}`} target="_blank" rel="noreferrer">
              COMPRAR POR WHATSAPP
            </a>
            {sellerNombre && <p className="pp-seller">Te atiende <b>{sellerNombre}</b> · pago contra entrega 🚚</p>}

            {canSell && (
              <div className="pp-vender">
                <div className="pp-vender-lbl">🔒 Cuando cierres la venta por WhatsApp:</div>
                <button className="pp-vendido" disabled={vendiendo} onClick={marcarVendido}>
                  {vendiendo ? 'Descontando…' : '✅ PRODUCTO VENDIDO (descontar 1)'}
                </button>
                <div className="pp-vender-hint">Elige el color y la talla que vendiste antes de tocar el botón.</div>
                {vendidoMsg && <p className="pp-vender-ok">{vendidoMsg}</p>}
                {vendidoErr && <p className="pp-vender-err">⚠️ {vendidoErr}</p>}
              </div>
            )}

            <a className="pp-vertodo" href={catalogoUrl}>← Ver todo el catálogo</a>
          </div>
          </>}
        </article>
      </div>
    </>
  );
}

const CSS = `
.pp-wrap{max-width:460px;margin:0 auto;padding:16px 14px 40px}
.pp-card{background:linear-gradient(160deg,#0f2a26 0%,#0b1b1a 60%,#081413 100%);border:1px solid rgba(34,211,197,.28);border-radius:20px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.45)}
.pp-imgwrap{position:relative;aspect-ratio:1/1;background:radial-gradient(120% 120% at 50% 0%,#12352f,#081413);display:flex;align-items:center;justify-content:center}
.pp-img{width:100%;height:100%;object-fit:cover;display:block}
.pp-noimg{font-size:64px}
.pp-desc{position:absolute;top:10px;right:10px;background:#22D3C5;color:#04211d;font-size:13px;font-weight:900;padding:4px 9px;border-radius:9px;z-index:3}
.pp-thumbs{position:absolute;left:8px;right:8px;bottom:8px;display:flex;gap:6px;flex-wrap:wrap;z-index:3}
.pp-thumb{width:52px;height:52px;border-radius:10px;overflow:hidden;padding:0;border:2px solid rgba(255,255,255,.55);background:#0b1b1a;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.5)}
.pp-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.pp-thumb.on{border-color:#22D3C5;box-shadow:0 0 12px rgba(34,211,197,.7)}
.pp-body{padding:16px 16px 18px;display:flex;flex-direction:column;gap:11px}
.pp-name{font-size:20px;font-weight:900;color:#fff;line-height:1.15;text-align:center;text-transform:uppercase}
.pp-prices{display:flex;align-items:baseline;gap:10px;justify-content:center}
.pp-price{font-size:30px;font-weight:900;color:#22D3C5;text-shadow:0 0 18px rgba(34,211,197,.35)}
.pp-price-old{font-size:16px;color:#7f938f;text-decoration:line-through}
.pp-hint{font-size:10px;color:#8aa39e;text-align:center;text-transform:uppercase;letter-spacing:.02em}
.pp-urg{font-size:13px;font-weight:900;margin:-2px 0;text-align:center}
.pp-urg.rojo{color:#ff5a5a}
.pp-urg.amar{color:#F4C24A}
.pp-swrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center}
.pp-sdot{width:30px;height:30px;padding:3px;border-radius:50%;border:2px solid rgba(255,255,255,.25);background:transparent;cursor:pointer;line-height:0}
.pp-sdot span{display:block;width:100%;height:100%;border-radius:50%}
.pp-sdot.on{border-color:#22D3C5;box-shadow:0 0 8px rgba(34,211,197,.6)}
.pp-tallas{display:flex;flex-direction:column;gap:8px}
.pp-tallas-aviso{font-size:12px;font-weight:800;color:#F4C24A;text-align:center;text-transform:uppercase}
.pp-genwrap{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:9px 10px}
.pp-genlabel{font-size:10px;font-weight:800;letter-spacing:.06em;color:#9fb4b0;margin-bottom:6px;text-transform:uppercase}
.pp-pills{display:flex;flex-wrap:wrap;gap:6px}
.pp-pill{min-width:40px;padding:8px 12px;border-radius:9px;border:1.5px solid rgba(255,255,255,.18);background:rgba(255,255,255,.03);color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:.15s}
.pp-pill.on{background:#22D3C5;color:#04211d;border-color:#22D3C5;box-shadow:0 0 12px rgba(34,211,197,.5)}
.pp-wa{margin-top:6px;display:block;width:100%;padding:15px 10px;border-radius:14px;background:#2ECC5B;color:#fff;font-size:16px;font-weight:900;text-align:center;text-decoration:none;text-transform:uppercase;box-shadow:0 10px 26px rgba(46,204,91,.4);animation:ppPulse 1.5s ease-in-out infinite}
@keyframes ppPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
.pp-seller{font-size:12px;color:#cfe3df;text-align:center;margin:-2px 0}
.pp-seller b{color:#2ECC5B}
.pp-vertodo{display:block;text-align:center;color:#9fb4b0;font-size:13px;text-decoration:none;margin-top:4px;padding:8px}
.pp-vertodo:hover{color:#22D3C5}
.pp-vender{margin-top:8px;background:rgba(232,181,74,.08);border:1px dashed rgba(244,194,74,.5);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:7px}
.pp-vender-lbl{font-size:11px;font-weight:800;color:#F4C24A;text-transform:uppercase;letter-spacing:.02em;text-align:center}
.pp-vendido{width:100%;padding:13px 10px;border:none;border-radius:12px;background:#E8B54A;color:#3a2a00;font-size:15px;font-weight:900;cursor:pointer;text-transform:uppercase}
.pp-vendido:hover{filter:brightness(1.05)}
.pp-vendido:disabled{opacity:.6;cursor:not-allowed}
.pp-vender-hint{font-size:11px;color:#cbb98a;text-align:center}
.pp-vender-ok{font-size:13px;font-weight:800;color:#22D3C5;text-align:center;margin:2px 0}
.pp-vender-err{font-size:13px;font-weight:700;color:#ff6b6b;text-align:center;margin:2px 0}
`;
