'use client';

/**
 * Comprime una foto EN EL NAVEGADOR antes de subirla.
 *
 * - Redimensiona el lado más largo a `maxLado` px (sin recortar: conserva la forma).
 * - La re-codifica en JPG (liviano y compatible con TODO: web y encabezados de
 *   plantillas de WhatsApp, que NO soportan WebP y rechazan la entrega).
 * - Si el resultado NO pesa menos que el original, devuelve el original intacto.
 * - Video, GIF (animado) y SVG se devuelven SIN TOCAR.
 *
 * No depende de ningún servicio externo ni del optimizador de Vercel: la foto que
 * queda guardada ya es la liviana, así que se ve igual pero carga más rápido.
 *
 *
 * POR QUÉ IMPORTA QUE ESTO PROCESE TAMBIÉN LOS PNG
 * -----------------------------------------------
 * Antes se saltaba TODOS los PNG para no ponerle fondo negro a un logo con
 * transparencia. El efecto colateral era grave: en `EmbudosPanel`, un archivo de
 * más de 4 MB no cabe en las funciones de Vercel y se sube por enlace firmado,
 * directo del navegador a Storage, **sin pasar por ningún compresor del
 * servidor**. Un PNG de 5,5 MB salía de aquí intacto, superaba el umbral y
 * aterrizaba en el bucket a tamaño completo. De ahí que las imágenes de
 * `embudos/` pesaran 2.502 kB de media.
 *
 * La solución no es dejar de respetar la transparencia, sino mirarla:
 *
 *   · PNG sin canal alfa en uso  → a JPG, como cualquier otra foto. Son la
 *     mayoría: fotos guardadas como PNG por error. Es donde está el ahorro.
 *   · PNG con transparencia real → se redimensiona y se re-guarda como PNG.
 *     Pesa menos que el original y el logo conserva su fondo transparente.
 *
 * Este es el mismo criterio que aplica `lib/optimizar-imagen-servidor.ts` en el
 * servidor, para que una foto no acabe recodificada dos veces con reglas
 * distintas según por dónde entre.
 */
export async function comprimirImagen(
  file: File,
  opts: { maxLado?: number; calidad?: number } = {},
): Promise<File> {
  // Mismo perfil que `lib/optimizar-imagen-servidor.ts`.
  const maxLado = opts.maxLado ?? 1920;
  const calidad = opts.calidad ?? 0.85;

  // Solo mapas de bits comprimibles. Video, GIF (animado) y SVG se dejan igual.
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

    // Solo un PNG con transparencia REAL sale como PNG. Se comprueba sobre el
    // canvas ya redimensionado, que es mucho menos trabajo que sobre el original.
    // El resto va a JPG: compatible con web Y con los encabezados de plantillas
    // de WhatsApp (WebP hace que Meta acepte el envío pero NO entregue).
    const salePng = esPng && tieneTransparencia(ctx, w, h);
    const tipoSalida = salePng ? 'image/png' : 'image/jpeg';

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, tipoSalida, calidad),
    );

    // Si no logró bajar el peso, mejor dejar la original tal cual.
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'foto';
    const ext  = salePng ? 'png' : 'jpg';
    return new File([blob], `${base}.${ext}`, { type: tipoSalida });
  } catch {
    return file; // ante cualquier duda, la original intacta
  }
}

/**
 * ¿Hay algún píxel no opaco?
 *
 * Recorre el canal alfa entero, sin muestrear: un logo puede tener transparencia
 * solo en una esquina, y saltarse píxeles significaría convertirlo a JPG y
 * mancharlo de negro. Sobre el canvas ya redimensionado son unos pocos millones
 * de lecturas, cuestión de milisegundos.
 *
 * Si el navegador impide leer el canvas por cualquier motivo, se responde `true`
 * —"asume que tiene transparencia"— para re-guardarlo como PNG y no arriesgar.
 */
function tieneTransparencia(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}
