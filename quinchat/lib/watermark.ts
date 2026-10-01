import Jimp from 'jimp';
import path from 'path';
import { createHash } from 'crypto';
import { bufferDesdeJimp } from '@/lib/optimizar-imagen-servidor';
import { subirArchivo } from '@/lib/subir-archivo';

// Versión del estilo de la marca de agua. Al cambiar el diseño (tamaño, posición),
// sube este número: así el botón "Marcar fotos" re-aplica el nuevo estilo a TODAS.
export const ESTILO = 's2';

/** ¿La foto ya tiene la marca con el estilo ACTUAL? */
export function esEstiloActual(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.includes('/marcas/') && url.includes(`-${ESTILO}-`);
}

// Carga la fuente desde el repo (carpeta /fonts, incluida en el bundle). Si por
// algo falla, cae a la fuente interna de Jimp. Así funciona en Vercel, donde la
// fuente de node_modules a veces no se empaqueta (error ENOENT .fnt).
async function cargarFuente(tam: 16 | 32 | 64, fallback: string) {
  try {
    const p = path.join(process.cwd(), 'fonts', `open-sans-${tam}-black`, `open-sans-${tam}-black.fnt`);
    return await Jimp.loadFont(p);
  } catch {
    return await Jimp.loadFont(fallback);
  }
}

/**
 * Estampa el NOMBRE DEL PRODUCTO como marca de agua en la esquina superior
 * izquierda de la foto (etiqueta blanca, letra negra), y sube la versión
 * marcada a Supabase Storage. Así el bot y el cliente ven el mismo nombre.
 *
 * - No usa IA: es puro procesamiento de imagen (gratis, solo al guardar).
 * - Controla el largo: si el nombre es muy largo, baja el tamaño o recorta,
 *   para que la etiqueta NO tape la prenda.
 * - Devuelve la URL pública de la imagen marcada, o null si algo falla
 *   (en ese caso se usa la foto original sin marca).
 */
export async function estamparNombre(
  supabase: any,
  urlOriginal: string,
  nombre: string,
  key: string,
): Promise<string | null> {
  const { url } = await estamparNombreDetallado(supabase, urlOriginal, nombre, key);
  return url;
}

/**
 * Igual que estamparNombre pero devuelve también el motivo del error (para
 * diagnóstico en el panel). No lanza excepción.
 */
export async function estamparNombreDetallado(
  supabase: any,
  urlOriginal: string,
  nombre: string,
  key: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const texto = String(nombre ?? '').toUpperCase().trim().replace(/\s+/g, ' ');
    if (!texto || !urlOriginal) return { url: null, error: 'sin nombre o sin foto' };

    const img = await Jimp.read(urlOriginal);
    const W = img.getWidth();
    const H = img.getHeight();

    // La etiqueta no debe pasar del 62% del ancho (para no tapar la prenda).
    const maxBadgeW = Math.round(W * 0.62);
    const margin    = Math.max(10, Math.round(W * 0.03));

    // Letra pequeña UNIFORME para todas las etiquetas (sea el nombre corto o
    // largo), para que se vean parejas y estéticas.
    const font = await cargarFuente(32, Jimp.FONT_SANS_32_BLACK);

    let txt = texto;
    let anchoTxt = Jimp.measureText(font, txt);
    // Si es muy largo y no cabe, recortar con "…".
    while (anchoTxt + margin * 2 > maxBadgeW && txt.length > 4) {
      txt = txt.slice(0, -2);
      anchoTxt = Jimp.measureText(font, txt + '…');
    }
    if (txt !== texto) txt = txt + '…';
    anchoTxt = Jimp.measureText(font, txt);

    const altoTxt = Jimp.measureTextHeight(font, txt, anchoTxt + 10);
    const padX = Math.round(altoTxt * 0.55);
    const padY = Math.round(altoTxt * 0.30);
    const badgeW = anchoTxt + padX * 2;
    const badgeH = altoTxt + padY * 2;

    // Etiqueta blanca (fondo) + texto negro encima.
    const badge = new Jimp(badgeW, badgeH, 0xffffffff);
    badge.print(font, padX, padY, txt);
    img.composite(badge, margin, margin);

    const bucket = 'chat-media';
    const hash = Math.abs(hashStr(texto)).toString(36).slice(0, 6);
    // El nombre lleva también un hash de la FOTO DE ORIGEN: una foto nueva del mismo color
    // es una ruta nueva y la caché de 1 año (la marca de la LEY) nunca sirve la foto vieja.
    // Se mantiene `-${ESTILO}-` para que `esEstiloActual` siga reconociéndolo.
    const hashFoto = createHash('sha1').update(urlOriginal).digest('hex').slice(0, 10);
    const path = `catalogo/marcas/${sanit(key)}-${ESTILO}-${hash}-${hashFoto}.jpg`;
    // LEY DE PESO: Jimp compone la etiqueta y sharp codifica (foto-whatsapp, 250 kB),
    // en vez del JPEG de Jimp a calidad 100. Es automático: nunca rechaza.
    // OJO: el texto de la etiqueta es fino; la revisión a ojo (q85 frente a q90) sigue pendiente.
    const r = await subirArchivo({
      supabase, bucket, ruta: path, buffer: await bufferDesdeJimp(img), contentType: 'image/png',
      tipo: 'foto-whatsapp', origen: 'marca-agua', upsert: true,
    });
    if (!r.subido) { console.error('[Marca] upload error:', r.error); return { url: null, error: 'storage: ' + r.error }; }

    const supaUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    // Cache-busting por si se re-estampa con el mismo path
    return { url: `${supaUrl}/storage/v1/object/public/${bucket}/${path}?v=${hash}`, error: null };
  } catch (e: any) {
    console.error('[Marca] error:', e);
    return { url: null, error: e?.message ?? String(e) };
  }
}

function sanit(s: string): string {
  return String(s).replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'color';
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}
