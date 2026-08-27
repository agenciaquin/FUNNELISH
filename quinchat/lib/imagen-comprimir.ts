'use client';

/**
 * Comprime una foto EN EL NAVEGADOR antes de subirla.
 *
 * - Redimensiona el lado más largo a `maxLado` px (sin recortar: conserva la forma).
 * - La re-codifica en WebP (mucho más liviano que JPG/PNG, y conserva transparencia).
 * - Si el resultado NO pesa menos que el original, devuelve el original intacto.
 * - Videos, GIF (animados) y SVG se devuelven SIN TOCAR.
 *
 * No depende de ningún servicio externo ni del optimizador de Vercel: la foto que
 * queda guardada ya es la liviana, así que se ve igual pero carga más rápido.
 */
export async function comprimirImagen(
  file: File,
  opts: { maxLado?: number; calidad?: number } = {},
): Promise<File> {
  const maxLado = opts.maxLado ?? 1600;   // suficiente para pantalla de celular a todo lo ancho
  const calidad = opts.calidad ?? 0.82;   // 0–1; 0.82 se ve idéntico y pesa mucho menos

  // Solo mapas de bits comprimibles. Lo demás (video, gif animado, svg) se deja igual.
  if (
    typeof window === 'undefined' ||
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml'
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;

    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, 'image/webp', calidad),
    );

    // Si no logró bajar el peso, mejor dejar la original tal cual.
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${base}.webp`, { type: 'image/webp' });
  } catch {
    return file; // ante cualquier duda, la original intacta
  }
}
