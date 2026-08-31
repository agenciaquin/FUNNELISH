import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { optimizarImagen } from '@/lib/optimizar-imagen-servidor';

/**
 * RUTA DE DIAGNOSTICO — NO SE FUSIONA. Vive solo en la rama de prueba.
 *
 * Responde a la unica pregunta que las pruebas en local no pueden contestar:
 * si `sharp` carga y comprime **dentro del servidor de Vercel**, que es otro
 * sistema operativo y otro binario. Se genera la imagen en memoria y se
 * devuelven los tamanos. No escribe nada en Storage ni lee ninguna credencial.
 */
export const maxDuration = 60;

const crudo = (w: number, h: number, alfa: boolean) => {
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    px[i] = (x * 7 + y * 3) % 256;
    px[i + 1] = (x * 3 + y * 11) % 256;
    px[i + 2] = (x * 13 + y * 5) % 256;
    px[i + 3] = alfa ? Math.max(0, Math.min(255, Math.round(255 * (1 - Math.hypot(x - w / 2, y - h / 2) / (w / 2))))) : 255;
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } });
};

export async function GET() {
  const arranque = Date.now();
  try {
    const casos: any[] = [];

    // 1. PNG opaco grande: el caso que mas abunda en el bucket.
    const png = await crudo(2400, 2400, false).png().toBuffer();
    const r1 = await optimizarImagen(png, 'image/png');
    const m1 = await sharp(r1.buffer).metadata();
    casos.push({ caso: 'png opaco 2400x2400', entra: png.length, sale: r1.buffer.length,
      tipo: r1.contentType, lado: Math.max(m1.width!, m1.height!), optimizada: r1.optimizada });

    // 2. PNG con transparencia real: debe seguir siendo png y conservar el alfa.
    const alfa = await crudo(1600, 1600, true).png().toBuffer();
    const r2 = await optimizarImagen(alfa, 'image/png');
    const m2 = await sharp(r2.buffer).metadata();
    casos.push({ caso: 'png con alfa 1600x1600', entra: alfa.length, sale: r2.buffer.length,
      tipo: r2.contentType, alfa: m2.hasAlpha, factor: +(r2.buffer.length / alfa.length).toFixed(2) });

    // 3. JPEG grande: redimension a 1920 y recompresion.
    const jpg = await crudo(3000, 3000, false).jpeg({ quality: 100 }).toBuffer();
    const r3 = await optimizarImagen(jpg, 'image/jpeg');
    const m3 = await sharp(r3.buffer).metadata();
    casos.push({ caso: 'jpeg 3000x3000 q100', entra: jpg.length, sale: r3.buffer.length,
      tipo: r3.contentType, lado: Math.max(m3.width!, m3.height!) });

    // 4. WebP: se convierte siempre, Meta no lo entrega.
    const webp = await crudo(400, 400, false).webp({ quality: 80 }).toBuffer();
    const r4 = await optimizarImagen(webp, 'image/webp');
    casos.push({ caso: 'webp 400x400', entra: webp.length, sale: r4.buffer.length,
      tipo: r4.contentType, sigueWebp: r4.contentType === 'image/webp' });

    // 5. Archivo corrupto: no debe tumbar la subida.
    const basura = Buffer.alloc(400 * 1024, 0x7f);
    const r5 = await optimizarImagen(basura, 'image/jpeg');
    casos.push({ caso: 'archivo corrupto', devuelveOriginal: r5.buffer === basura, optimizada: r5.optimizada });

    return NextResponse.json({
      ok: true,
      sharp: sharp.versions,
      simd: (sharp as any).simd?.() ?? null,
      node: process.version,
      ms: Date.now() - arranque,
      casos,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message, stack: e?.stack, ms: Date.now() - arranque }, { status: 500 });
  }
}
