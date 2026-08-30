import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { AHORRO_MINIMO, config } from './config.js';

// ffmpeg-static exporta con `export =`, que bajo NodeNext no se deja importar
// por defecto de forma limpia. `createRequire` da directamente la ruta al binario.
const ffmpegPath = createRequire(import.meta.url)('ffmpeg-static') as string | null;

export type Clase = 'imagen' | 'video' | 'otro';

export interface Resultado {
  /** null cuando no se ha optimizado; el motivo lo explica. */
  buffer: Buffer | null;
  contentType: string;
  bytesOriginal: number;
  bytesFinal: number;
  motivo: string;
}

/**
 * Clasifica por el contenido real del archivo, no por su nombre.
 * En quinchat hay mp4 guardados en columnas llamadas `imagen_clientes`, así que
 * fiarse de la extensión o del nombre de la columna lleva a errores.
 */
export function clasificar(buffer: Buffer, contentTypeDeclarado?: string): Clase {
  if (buffer.length >= 12) {
    const c = buffer.subarray(0, 12);
    if (c[0] === 0xff && c[1] === 0xd8) return 'imagen'; // JPEG
    if (c.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'imagen'; // PNG
    if (c.subarray(0, 4).toString('ascii') === 'RIFF' && c.subarray(8, 12).toString('ascii') === 'WEBP') return 'imagen';
    if (c.subarray(0, 4).toString('ascii') === 'GIF8') return 'imagen';
    if (c.subarray(4, 8).toString('ascii') === 'ftyp') return 'video'; // MP4 / MOV
    if (c.subarray(0, 4).toString('hex') === '1a45dfa3') return 'video'; // WebM / Matroska
  }
  if (contentTypeDeclarado?.startsWith('image/')) return 'imagen';
  if (contentTypeDeclarado?.startsWith('video/')) return 'video';
  return 'otro';
}

function decidir(original: number, optimizado: Buffer, contentType: string): Resultado {
  const ahorro = (original - optimizado.length) / original;
  if (ahorro < AHORRO_MINIMO) {
    return {
      buffer: null,
      contentType,
      bytesOriginal: original,
      bytesFinal: original,
      motivo: `el ahorro sería del ${(ahorro * 100).toFixed(1)}%, por debajo del mínimo del ${AHORRO_MINIMO * 100}%`,
    };
  }
  return {
    buffer: optimizado,
    contentType,
    bytesOriginal: original,
    bytesFinal: optimizado.length,
    motivo: `ahorro del ${(ahorro * 100).toFixed(1)}%`,
  };
}

/**
 * Recomprime la imagen a JPEG con el ancho limitado.
 *
 * El archivo conserva su nombre original, extensión incluida: el navegador hace
 * caso al `Content-Type` antes que a la extensión, y eso es lo que permite
 * optimizar sin tocar las 131 rutas guardadas en la base de datos.
 *
 *
 * POR QUÉ JPEG Y NO WEBP
 * ----------------------
 * WebP comprime alrededor de un punto y medio mejor, pero **Meta acepta el envío
 * y luego no entrega el mensaje** (lección documentada en
 * `quinchat/lib/imagen-comprimir.ts` por quien la sufrió).
 *
 * Y este bucket no se puede separar por carpetas, porque `embudos/` mezcla las
 * dos cosas:
 *   · `embudos/chat/`        — media de conversaciones, la sube ChatArea y se
 *                              manda a WhatsApp con `send-media-url`
 *   · `embudos/remarketing/` — imágenes de campaña, también van por WhatsApp
 *   · `embudos/<slug>/`      — imágenes de landing, solo navegador
 *
 * Como `lib/whatsapp.ts` reenvía el `Content-Type` que le devuelve la URL sin
 * convertirlo, un WebP llegaría a Meta como WebP. Por eso aquí no se usa WebP
 * en ninguna carpeta.
 *
 * Los PNG con transparencia real se quedan en PNG y se comprimen SIN PÉRDIDA:
 * pasarlos a JPEG les pondría fondo negro, y cuantizar a paleta degrada la
 * imagen y llega a descartar el canal alfa.
 */
export async function optimizarImagen(buffer: Buffer): Promise<Resultado> {
  const original = buffer.length;
  const meta = await sharp(buffer).metadata();

  // Un WebP se convierte SIEMPRE, pese lo que pese y aunque el JPEG salga más
  // grande. Aquí no es cuestión de peso sino de que Meta acepta el WebP y luego
  // no entrega el mensaje. Había 6 en `embudos/remarketing/` de 95 a 167 kB —
  // por debajo del mínimo— y esas campañas se envían por WhatsApp.
  const esWebp = meta.format === 'webp';

  if (!esWebp && original < config.imagen.minimoBytes) {
    return {
      buffer: null,
      contentType: 'image/jpeg',
      bytesOriginal: original,
      bytesFinal: original,
      motivo: `ya pesa menos de ${config.imagen.minimoBytes} bytes`,
    };
  }

  const conTransparencia = meta.hasAlpha === true;

  const redimensionada = sharp(buffer, { animated: true })
    .rotate() // aplica la orientación EXIF antes de que sharp la descarte
    .resize({ width: config.imagen.anchoMax, withoutEnlargement: true });

  const optimizado = conTransparencia
    ? await redimensionada.png({ compressionLevel: 9 }).toBuffer()
    : await redimensionada.jpeg({ quality: config.imagen.calidad, mozjpeg: true }).toBuffer();

  const contentType = conTransparencia ? 'image/png' : 'image/jpeg';

  // Del WebP se sale siempre, saltándose el mínimo de ahorro: aunque el archivo
  // crezca, pasa de "no se entrega" a "se entrega".
  if (esWebp) {
    const ahorro = ((original - optimizado.length) / original) * 100;
    return {
      buffer: optimizado,
      contentType,
      bytesOriginal: original,
      bytesFinal: optimizado.length,
      motivo: `WebP convertido a ${contentType} para que WhatsApp lo entregue`
        + ` (${ahorro >= 0 ? 'ahorro' : 'aumento'} del ${Math.abs(ahorro).toFixed(1)}%)`,
    };
  }

  return decidir(original, optimizado, contentType);
}

/**
 * Recomprime a H.264 y vuelve a salir como mp4, así que la URL no cambia.
 *
 * `+faststart` mueve el índice al principio del archivo. Sin eso el navegador
 * necesita el archivo entero antes de empezar a reproducir, que es justo lo que
 * dispara el egress cuando el mismo vídeo se sirve cientos de veces al día.
 */
export async function optimizarVideo(buffer: Buffer): Promise<Resultado> {
  const original = buffer.length;

  if (original < config.video.minimoBytes) {
    return {
      buffer: null,
      contentType: 'video/mp4',
      bytesOriginal: original,
      bytesFinal: original,
      motivo: `ya pesa menos de ${config.video.minimoBytes} bytes`,
    };
  }

  const carpeta = await mkdtemp(join(tmpdir(), 'media-api-'));
  const entrada = join(carpeta, `${randomUUID()}.entrada`);
  const salida = join(carpeta, `${randomUUID()}.mp4`);

  try {
    await writeFile(entrada, buffer);

    const escala = `scale=min(${config.video.anchoMax}\\,iw):-2,fps=${config.video.fpsMax}`;

    await ejecutar([
      '-i', entrada,
      '-vf', escala,
      '-c:v', 'libx264',
      '-crf', String(config.video.crf),
      '-preset', 'slow',
      '-profile:v', 'main',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', `${config.video.audioKbps}k`,
      '-movflags', '+faststart',
      '-y', salida,
    ]);

    return decidir(original, await readFile(salida), 'video/mp4');
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

/** Primer fotograma como JPEG, para usarlo de poster y no cargar el vídeo entero. */
export async function extraerPoster(buffer: Buffer): Promise<Buffer> {
  const carpeta = await mkdtemp(join(tmpdir(), 'media-api-poster-'));
  const entrada = join(carpeta, `${randomUUID()}.entrada`);
  const salida = join(carpeta, `${randomUUID()}.jpg`);

  try {
    await writeFile(entrada, buffer);
    await ejecutar([
      '-i', entrada,
      '-frames:v', '1',
      '-vf', `scale=min(${config.imagen.anchoMax}\\,iw):-2`,
      '-y', salida,
    ]);
    return await readFile(salida);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

function ejecutar(args: string[]): Promise<void> {
  if (!ffmpegPath) {
    return Promise.reject(new Error('ffmpeg-static no encontró un binario para esta plataforma.'));
  }

  const binario = ffmpegPath;

  return new Promise((resolver, rechazar) => {
    const proceso = spawn(binario, args, { stdio: ['ignore', 'ignore', 'pipe'] as const });
    let stderr = '';
    proceso.stderr.on('data', (trozo: Buffer) => {
      stderr += trozo.toString();
    });
    proceso.on('error', rechazar);
    proceso.on('close', (codigo: number | null) => {
      if (codigo === 0) return resolver();
      // ffmpeg escupe muchísimo log y solo interesa el final, que es donde va el error.
      rechazar(new Error(`ffmpeg salió con código ${codigo}:\n${stderr.slice(-1500)}`));
    });
  });
}
