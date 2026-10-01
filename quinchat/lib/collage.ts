import Jimp from 'jimp';
import { createHash } from 'crypto';

import { bufferDesdeJimp } from '@/lib/optimizar-imagen-servidor';
import { subirArchivo } from '@/lib/subir-archivo';

/**
 * Une varias fotos de producto en UNA sola imagen (lado a lado) y la sube a
 * Supabase Storage. Se usa para los PACK X2 (dos colores en una sola foto) tanto
 * en el webhook del funnel como en el bot de ventas de WhatsApp.
 *
 * Cachea por combinación: si ya existe el collage de ese combo, lo reutiliza.
 * Devuelve la URL pública, o null si algo falla (para caer al envío por separado).
 */
export async function generarCollagePack(
  supabase: any,
  productos: string[],
  imagenes: string[],
): Promise<string | null> {
  try {
    const bucket   = 'chat-media';
    const sanit    = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    // El nombre lleva también un hash de las FOTOS (no solo del producto): con la caché de
    // 1 año y `upsert`, una foto nueva del mismo producto debe ser una ruta nueva.
    const hashFotos = createHash('sha1').update(imagenes.join('|')).digest('hex').slice(0, 10);
    const fileName = `${productos.map(sanit).sort().join('__')}__${hashFotos}__v2.jpg`;
    const path     = `packs/${fileName}`;
    const supaUrl  = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const publicUrl = `${supaUrl}/storage/v1/object/public/${bucket}/${path}`;

    // Caché: ¿ya existe el collage de este combo?
    const { data: existentes } = await supabase.storage.from(bucket).list('packs', { search: fileName });
    if (existentes && existentes.some((f: any) => f.name === fileName)) return publicUrl;

    // Componer las imágenes lado a lado, todas a la misma altura
    const H    = 900;
    const imgs = await Promise.all(imagenes.map((u: string) => Jimp.read(u)));
    imgs.forEach((im: any) => im.resize(Jimp.AUTO, H));
    const totalW = imgs.reduce((s: number, im: any) => s + im.getWidth(), 0);

    const canvas = new Jimp(totalW, H, 0xffffffff);
    let left = 0;
    imgs.forEach((im: any) => { canvas.composite(im, left, 0); left += im.getWidth(); });

    // LEY DE PESO: Jimp solo COMPONE; sharp codifica (foto-whatsapp, 250 kB). Jimp a
    // calidad 100 daba ~1,6 MB por collage. Es automático: nunca rechaza; si no cabe
    // se guarda la mejor versión y queda la línea [ley-peso].
    const r = await subirArchivo({
      supabase, bucket, ruta: path, buffer: await bufferDesdeJimp(canvas), contentType: 'image/png',
      tipo: 'foto-whatsapp', origen: 'collage', upsert: true,
    });
    if (!r.subido) { console.error('[Collage] upload error:', r.error); return null; }

    console.log(`[Collage] generado ${path}`);
    return publicUrl;
  } catch (e) {
    console.error('[Collage] error:', e);
    return null;
  }
}
