/**
 * Prueba el motor de compresión sin tocar Supabase.
 *
 *   npx tsx src/prueba-local.ts
 *
 * Genera una imagen y un vídeo sintéticos con el mismo peso aproximado que los
 * de `embudos/`, los pasa por el optimizador y enseña el ahorro real. Sirve para
 * validar que sharp y ffmpeg funcionan en esta máquina antes de tocar nada.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { clasificar, optimizarImagen, optimizarVideo } from './optimizar.js';

const ffmpegPath = createRequire(import.meta.url)('ffmpeg-static') as string | null;
const mb = (b: number) => (b / 1024 / 1024).toFixed(2);

async function main() {
  console.log(`ffmpeg: ${ffmpegPath ?? 'NO ENCONTRADO'}`);
  console.log(`sharp:  ${sharp.versions.vips ? `libvips ${sharp.versions.vips}` : 'NO DISPONIBLE'}\n`);

  // --- Imagen: PNG de 1600x1600 con ruido, para que no comprima de forma irreal ---
  const pixeles = Buffer.alloc(1600 * 1600 * 3);
  for (let i = 0; i < pixeles.length; i++) pixeles[i] = (Math.sin(i / 97) * 127 + 128) | 0;
  const png = await sharp(pixeles, { raw: { width: 1600, height: 1600, channels: 3 } }).png().toBuffer();

  console.log(`Imagen  clasificada como: ${clasificar(png)}`);
  const rImagen = await optimizarImagen(png);
  console.log(`  ${mb(rImagen.bytesOriginal)} MB -> ${mb(rImagen.bytesFinal)} MB  (${rImagen.motivo})\n`);

  // --- Vídeo: 6 s a 1080p generados por ffmpeg ---
  if (!ffmpegPath) return;
  const carpeta = await mkdtemp(join(tmpdir(), 'prueba-'));
  const ruta = join(carpeta, `${randomUUID()}.mp4`);
  try {
    spawnSync(ffmpegPath, [
      '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30:duration=6',
      '-c:v', 'libx264', '-crf', '18', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-y', ruta,
    ]);
    const video = await readFile(ruta);
    console.log(`Vídeo   clasificado como: ${clasificar(video)}`);
    const rVideo = await optimizarVideo(video);
    console.log(`  ${mb(rVideo.bytesOriginal)} MB -> ${mb(rVideo.bytesFinal)} MB  (${rVideo.motivo})`);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
