/**
 * GENERADOR DE COLLAGES (navegador, canvas) — Panel de Catálogos, 09-nov-2026.
 * Formato aprobado por el dueño (maquetas «rectangulares»):
 *  · Cada prenda: foto ORIGINAL cuadrada + franja oscura abajo con el letrero «// NOMBRE //»
 *    (borde del color de la prenda). El letrero nunca tapa el buzo.
 *  · Filas sin huecos: 2 → [2] · 3 → [3] · 4 → [2,2] · 5 → [2 grandes, 3] · 6 → [3,3] · 7 → [2,2,3] · 8 → [2,3,3] · 9 → [3,3,3].
 *    Las filas de 2 se agrandan para medir lo mismo que las de 3. Más de 9 → varias imágenes.
 *  · Fondo azul oscuro, bordes azul oscuro. Sin precios ni textos extra.
 * La foto no se altera: solo se quita el encabezado impreso de arriba y márgenes lisos vacíos.
 */

export interface PrendaCollage { nombre: string; color: string; foto: string }

const PAD = 16, GAP = 12, B = 524, FRANJA = 64;
const BG1 = '#090E1A', BG2 = '#141C2E', BORDE = '#1E3A5F';
const FUENTE = 'PoppinsBI';

const COLORES: Record<string, string> = {
  AMARILLO: '#F5C400', COCOA: '#C9A08E', MARFIL: '#F0EADE', VERDEOSCURO: '#39D64A', VERDE: '#39D64A', VERDECALI: '#39D64A',
  NEGRO: '#AAB2BE', ROJO: '#E53935', AZULNAVY: '#406EE6', AZULREY: '#2F6BFF', AZUL: '#2F6BFF', BLANCO: '#FFFFFF',
  GRIS: '#A0A0A0', BEIGE: '#DEC8A0', VINOTINTO: '#AA1E3C', ROSADO: '#FF78AA', ROSADOCLARO: '#FFAACD', MORADO: '#9A5ADC',
  LILA: '#BE96FF', NARANJA: '#FF8C00', CAFE: '#8B5A2B', MOSTAZA: '#D4A017',
};
export const colorDe = (c: string) =>
  COLORES[String(c ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '')] ?? '#C8C8C8';

/** Filas de cada imagen (sin casillas vacías). */
export function filasDe(n: number): number[] {
  if (n <= 3) return [n];
  if (n % 3 === 0) return Array(n / 3).fill(3);
  if (n % 3 === 2) return [2, ...Array((n - 2) / 3).fill(3)];
  return [2, 2, ...Array((n - 4) / 3).fill(3)];
}

/** Reparte más de 9 prendas en varias imágenes parejas. */
export function partir<T>(items: T[]): T[][] {
  if (items.length <= 9) return [items];
  const grupos = Math.ceil(items.length / 9), base = Math.floor(items.length / grupos), extra = items.length % grupos;
  const out: T[][] = []; let k = 0;
  for (let g = 0; g < grupos; g++) { const t = base + (g < extra ? 1 : 0); out.push(items.slice(k, k + t)); k += t; }
  return out;
}

let fuenteLista: Promise<void> | null = null;
function cargarFuente() {
  if (!fuenteLista) {
    fuenteLista = (async () => {
      try {
        const f = new FontFace(FUENTE, 'url(/fonts/Poppins-BoldItalic.ttf)', { weight: '700', style: 'italic' });
        await f.load(); (document as any).fonts.add(f);
      } catch { /* si falla, se usa la letra del sistema */ }
    })();
  }
  return fuenteLista;
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error(`No se pudo cargar la foto: ${url}`));
    img.src = `/api/collages/foto?u=${encodeURIComponent(url)}`;   // mismo dominio → el canvas no queda «contaminado»
  });
}

/** Recorte de lo que NO es foto: encabezado impreso (franja blanca con el título / banda oscura) y márgenes lisos. */
function recorte(img: HTMLImageElement): { x: number; y: number; w: number; h: number } {
  const W = 300, H = Math.max(1, Math.round(img.height * W / img.width));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const L = (x: number, y: number) => { const i = (y * W + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
  // 1) encabezado: última fila del 22 % superior casi toda blanca pura o muy oscura
  let top = 0;
  for (let y = 0; y < Math.floor(H * 0.22); y++) {
    let blancos = 0, suma = 0;
    for (let x = 0; x < W; x++) { const v = L(x, y); suma += v; if (v > 240) blancos++; }
    if (blancos / W > 0.6 || suma / W < 55) top = y + 1;
  }
  // 2) márgenes lisos (claros u oscuros) en los 4 lados
  const lisa = (vals: number[]) => {
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
    return sd < 14 && (m > 210 || m < 60);
  };
  let y0 = top, y1 = H, x0 = 0, x1 = W;
  for (let it = 0; it < 4; it++) {
    while (y1 - y0 > 40 && lisa(Array.from({ length: x1 - x0 }, (_, k) => L(x0 + k, y0)))) y0++;
    while (y1 - y0 > 40 && lisa(Array.from({ length: x1 - x0 }, (_, k) => L(x0 + k, y1 - 1)))) y1--;
    while (x1 - x0 > 40 && lisa(Array.from({ length: y1 - y0 }, (_, k) => L(x0, y0 + k)))) x0++;
    while (x1 - x0 > 40 && lisa(Array.from({ length: y1 - y0 }, (_, k) => L(x1 - 1, y0 + k)))) x1--;
  }
  const f = img.width / W;
  return { x: x0 * f, y: y0 * f, w: (x1 - x0) * f, h: (y1 - y0) * f };
}

function redondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Dibuja la foto completa en el cuadro: si es casi cuadrada la llena; si no, la encaja sobre su mismo fondo desenfocado. */
function pintarFoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, lado: number) {
  const r = recorte(img); const ar = r.w / r.h;
  ctx.save(); redondeado(ctx, x, y, lado, lado + 1, 14); ctx.clip();
  if (Math.abs(ar - 1) <= 0.08) {
    const s = Math.min(r.w, r.h);
    ctx.drawImage(img, r.x + (r.w - s) / 2, r.y + (r.h - s) / 2, s, s, x, y, lado, lado);
  } else {
    const s = Math.min(r.w, r.h);
    ctx.filter = 'blur(40px) brightness(0.9)';
    ctx.drawImage(img, r.x + (r.w - s) / 2, r.y + (r.h - s) / 2, s, s, x - 40, y - 40, lado + 80, lado + 80);
    ctx.filter = 'none';
    const e = Math.min(lado / r.w, lado / r.h), w = r.w * e, h = r.h * e;
    ctx.drawImage(img, r.x, r.y, r.w, r.h, x + (lado - w) / 2, y + (lado - h) / 2, w, h);
  }
  ctx.restore();
}

function letrero(ctx: CanvasRenderingContext2D, texto: string, color: string, cx: number, yFranja: number, franja: number, sz: number) {
  ctx.font = `italic 700 ${sz}px ${FUENTE}, Poppins, Arial, sans-serif`;
  const t = texto.toUpperCase(), sl = ctx.measureText('//').width, sp = ctx.measureText('  ').width, tw = ctx.measureText(t).width;
  const ph = Math.round(sz * 1.95), pw = Math.round(tw + 2 * sl + 2 * sp + 30);
  const x0 = cx - pw / 2, y0 = yFranja + (franja - ph) / 2 - franja * 0.06;
  redondeado(ctx, x0, y0, pw, ph, ph / 2); ctx.fillStyle = '#08080A'; ctx.fill();
  ctx.lineWidth = Math.max(3, sz / 7); ctx.strokeStyle = color; ctx.stroke();
  ctx.textBaseline = 'middle'; const ym = y0 + ph / 2 + 1;
  ctx.fillStyle = color; ctx.fillText('//', x0 + 15, ym); ctx.fillText('//', x0 + 15 + sl + sp + tw + sp, ym);
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(t, x0 + 15 + sl + sp, ym);
}

/** Arma UNA imagen (hasta 9 prendas). Devuelve el canvas. */
export async function generarCollage(prendas: PrendaCollage[]): Promise<HTMLCanvasElement> {
  await cargarFuente();
  const n = prendas.length;
  if (!n) throw new Error('Escoge al menos una prenda');
  const imgs = await Promise.all(prendas.map(p => cargarImagen(p.foto)));
  const filas = filasDe(n);
  const hayTres = filas.some(c => c === 3);
  const anchoInt = n === 1 ? 1048 : hayTres ? 3 * B + 2 * GAP : Math.max(...filas) * B + (Math.max(...filas) - 1) * GAP;
  const ladoDe = (c: number) => (n === 1 ? 1048 : Math.floor((anchoInt - (c - 1) * GAP) / c));
  const franjaDe = (lado: number) => Math.round(FRANJA * lado / B);
  const W = anchoInt + 2 * PAD;
  const H = 2 * PAD + filas.reduce((a, c) => a + ladoDe(c) + franjaDe(ladoDe(c)), 0) + (filas.length - 1) * GAP;

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, BG1); gr.addColorStop(1, BG2);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);

  let y = PAD, k = 0;
  for (const c of filas) {
    const lado = ladoDe(c), fr = franjaDe(lado);
    const deFila = prendas.slice(k, k + c);
    // Misma letra en toda la fila: la mayor que quepa en el letrero más largo (mín. 13)
    let sz = Math.round(27 * lado / B);
    ctx.font = `italic 700 ${sz}px ${FUENTE}, Poppins, Arial, sans-serif`;
    const ancho = (t: string, s: number) => { ctx.font = `italic 700 ${s}px ${FUENTE}, Poppins, Arial, sans-serif`; return ctx.measureText(`//  ${t.toUpperCase()}  //`).width + 30; };
    while (sz > 13 && Math.max(...deFila.map(p => ancho(p.nombre, sz))) > lado - 24) sz--;
    let x = PAD + (anchoInt - (c * lado + (c - 1) * GAP)) / 2;
    for (let j = 0; j < c; j++, k++) {
      const p = prendas[k];
      redondeado(ctx, x, y, lado, lado + fr, 16); ctx.fillStyle = '#0A0E18'; ctx.fill();
      pintarFoto(ctx, imgs[k], x, y, lado);
      letrero(ctx, p.nombre, p.color.startsWith('#') ? p.color : colorDe(p.color), x + lado / 2, y + lado, fr, sz);
      redondeado(ctx, x, y, lado, lado + fr, 16); ctx.lineWidth = 3; ctx.strokeStyle = BORDE; ctx.stroke();
      x += lado + GAP;
    }
    y += lado + fr + GAP;
  }
  return cv;
}

export const aJpg = (cv: HTMLCanvasElement) =>
  new Promise<Blob>((ok, mal) => cv.toBlob(b => (b ? ok(b) : mal(new Error('No se pudo crear la imagen'))), 'image/jpeg', 0.9));
