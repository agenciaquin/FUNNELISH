'use client';

/**
 * Comprime una foto EN EL NAVEGADOR antes de subirla.
 *
 * - Redimensiona el lado más largo a `maxLado` px (sin recortar: conserva la forma).
 * - La re-codifica en JPG (liviano y compatible con TODO: web y encabezados de
 *   plantillas de WhatsApp, que NO soportan WebP y rechazan la entrega).
 * - Si el resultado NO pesa menos que el original, devuelve el original intacto.
 * - Videos, GIF (animados), PNG con transparencia y SVG se devuelven SIN TOCAR.
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

  // Solo mapas de bits comprimibles. Video, GIF (animado) y SVG se dejan igual.
  // El PNG SÍ se procesa (antes se saltaba y quedaban fotos de 2+ MB que hacían
  // lenta la página): se redimensiona y se re-guarda como PNG para conservar la
  // transparencia de los logos.
  if (
    typeof window === 'undefined' ||
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml'
  ) {
    return file;
  }
  const esPng = file.type === 'image/png';

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

    // PNG → PNG (conserva transparencia). El resto → JPG (compatible con web y con
    // los encabezados de plantillas de WhatsApp; WebP hace que Meta no entregue).
    const tipoSalida = esPng ? 'image/png' : 'image/jpeg';
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, tipoSalida, calidad),
    );

    // Si no logró bajar el peso, mejor dejar la original tal cual.
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'foto';
    const ext  = esPng ? 'png' : 'jpg';
    return new File([blob], `${base}.${ext}`, { type: tipoSalida });
  } catch {
    return file; // ante cualquier duda, la original intacta
  }
}
