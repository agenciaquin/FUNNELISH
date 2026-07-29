import Jimp from 'jimp';

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
    const fileName = `${productos.map(sanit).sort().join('__')}__v2.jpg`;
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

    const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);

    const { error: upErr } = await supabase.storage.from(bucket)
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    if (upErr) { console.error('[Collage] upload error:', upErr.message); return null; }

    console.log(`[Collage] generado ${path}`);
    return publicUrl;
  } catch (e) {
    console.error('[Collage] error:', e);
    return null;
  }
}
