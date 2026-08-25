import { phoneIdActual } from './whatsapp-contexto';

const WA_API_URL = 'https://graph.facebook.com/v19.0';

// ── Número real del bot ───────────────────────────────────────────────────────
// Se le pregunta a Meta cuál es el número conectado, para que ningún enlace de
// la página pueda apuntar a un número equivocado escrito a mano.
let numeroCache: { valor: string; hasta: number } | null = null;

/** Número del bot. Solo se usa si Meta no contesta. */
const NUMERO_BOT_FIJO = '573172653897';

export async function numeroDelBot(): Promise<string> {
  const respaldo =
    (process.env.WHATSAPP_NUMERO_BOT ?? '').replace(/\D/g, '') || NUMERO_BOT_FIJO;
  const ahora = Date.now();
  if (numeroCache && numeroCache.hasta > ahora) return numeroCache.valor;

  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return respaldo;

  try {
    const res = await fetch(
      `${WA_API_URL}/${phoneNumberId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) return respaldo;
    const data = await res.json();
    const num = String(data?.display_phone_number ?? '').replace(/\D/g, '');
    if (!num) return respaldo;
    numeroCache = { valor: num, hasta: ahora + 6 * 60 * 60 * 1000 }; // 6 horas
    return num;
  } catch {
    return respaldo;
  }
}

/**
 * Descarga un archivo que envió el cliente (foto, audio, video, documento).
 * Meta lo entrega en dos pasos: primero se pide la URL con el media_id,
 * y luego se descarga esa URL con el token de autorización.
 */
export async function descargarWhatsAppMedia(
  mediaId: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !mediaId) return null;

  try {
    const metaRes = await fetch(`${WA_API_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.error('[WhatsApp] no se pudo leer el media:', await metaRes.text());
      return null;
    }
    const meta = await metaRes.json();
    const url: string | undefined = meta?.url;
    if (!url) return null;

    const fileRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileRes.ok) {
      console.error('[WhatsApp] no se pudo descargar el archivo:', fileRes.status);
      return null;
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const mimeType = (meta?.mime_type as string) || fileRes.headers.get('content-type') || 'application/octet-stream';
    return { buffer, mimeType };
  } catch (e) {
    console.error('[WhatsApp] error descargando media:', e);
    return null;
  }
}

// ── Upload media to Meta and get media_id ─────────────────────────────────────
export async function uploadWhatsAppMedia(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([Uint8Array.from(buffer)], { type: mimeType }), filename);

  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) { console.error('[WhatsApp] uploadMedia failed:', await res.text()); return null; }
    const data = await res.json();
    return data.id as string;
  } catch (e) {
    console.error('[WhatsApp] uploadMedia network error:', e);
    return null;
  }
}

// ── Send a media message using a media_id ─────────────────────────────────────
// Returns: WhatsApp wamid string on success, null on failure
export async function sendMediaMessage(
  to: string,
  mediaId: string,
  type: 'image' | 'document' | 'audio' | 'video',
  options: { caption?: string; filename?: string } = {},
): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;

  const mediaObj: Record<string, string> = { id: mediaId };
  if (options.caption && (type === 'image' || type === 'document')) mediaObj.caption = options.caption;
  if (options.filename && type === 'document') mediaObj.filename = options.filename;

  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type,
        [type]: mediaObj,
      }),
    });
    if (!res.ok) { console.error('[WhatsApp] sendMedia failed:', await res.text()); return null; }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] sendMedia network error:', e);
    return null;
  }
}

/**
 * Sends a plain text message via WhatsApp Cloud API.
 * Returns: WhatsApp wamid string on success, null on failure.
 * Server-only — never call from browser code.
 */
/**
 * Marca el mensaje como leído y le muestra al cliente el "escribiendo…".
 * Se borra solo cuando respondes o a los 25 segundos, lo que pase primero.
 * Solo debe usarse cuando de verdad se le va a contestar.
 */
export async function mostrarEscribiendo(wamid: string): Promise<void> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token || !wamid) return;

  try {
    await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: wamid,
        typing_indicator: { type: 'text' },
      }),
    });
  } catch (e) {
    console.warn('[WhatsApp] no se pudo mostrar "escribiendo":', e);
  }
}

/**
 * Envía un mensaje de texto. Si se pasa `responderA` (el id de WhatsApp de otro
 * mensaje), llega citándolo, igual que al responder en la app.
 */
export async function sendTextMessage(to: string, text: string, responderA?: string | null): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
    return null;
  }

  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text },
        ...(responderA ? { context: { message_id: responderA } } : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[WhatsApp] sendText failed:', err);
      return null;
    }

    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] Network error (sendText):', e);
    return null;
  }
}

// Límite de WhatsApp para imágenes: 5 MB.
const WA_IMAGE_LIMIT = 5_242_880;

/**
 * Descarga una imagen, la comprime (con jimp, JS puro — no rompe el build) hasta
 * dejarla por debajo del límite de WhatsApp, la sube a Meta y devuelve el media_id.
 * Se usa solo cuando WhatsApp rechaza la imagen por tamaño (error 131053).
 */
async function comprimirYSubirImagen(imageUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(urlSegura(imageUrl));
    if (!resp.ok) return null;
    const original = Buffer.from(await resp.arrayBuffer());

    const mod: any = await import('jimp');
    const Jimp: any = mod.default ?? mod;
    const img: any = await Jimp.read(original);

    // Bajar a máximo 1600px de ancho (con eso se ve bien y pesa mucho menos)
    if (img.getWidth() > 1600) img.resize(1600, Jimp.AUTO);

    let calidad = 80;
    let out: Buffer = await img.quality(calidad).getBufferAsync(Jimp.MIME_JPEG);
    // Si sigue pesando, baja la calidad
    while (out.length > WA_IMAGE_LIMIT && calidad > 40) {
      calidad -= 15;
      out = await img.quality(calidad).getBufferAsync(Jimp.MIME_JPEG);
    }
    // Si aún pesa, reduce el tamaño en pasos
    while (out.length > WA_IMAGE_LIMIT && img.getWidth() > 600) {
      img.resize(Math.round(img.getWidth() * 0.8), Jimp.AUTO);
      out = await img.quality(calidad).getBufferAsync(Jimp.MIME_JPEG);
    }
    if (out.length > WA_IMAGE_LIMIT) return null;

    return await uploadWhatsAppMedia(out, 'image/jpeg', 'foto.jpg');
  } catch (e) {
    console.error('[WhatsApp] comprimirYSubirImagen error:', e);
    return null;
  }
}

/**
 * Normaliza una URL para que Meta pueda descargarla. Muchas fotos del catálogo
 * tienen espacios o tildes en el nombre del archivo; el navegador los codifica
 * solo, pero el descargador de Meta manda la URL "en crudo" y el servidor le
 * responde 400. Aquí re-codificamos cada tramo del path de forma consistente
 * (sin doble-codificar lo que ya venía bien).
 */
function urlSegura(u: string): string {
  try {
    const url = new URL(u);
    url.pathname = url.pathname.split('/').map(seg => {
      try { return encodeURIComponent(decodeURIComponent(seg)); }
      catch { return encodeURIComponent(seg); }
    }).join('/');
    return url.toString();
  } catch { return u; }
}

/**
 * Descarga la imagen desde su URL (lado servidor) y la SUBE a WhatsApp para
 * obtener un media_id. Es mucho más confiable que mandar el link: evita los
 * errores 131053/131103 ("Downloading media from weblink failed"), porque Meta
 * ya no tiene que descargar nada. Comprime solo si la foto pesa demasiado.
 */
async function subirImagenDesdeUrl(imageUrl: string): Promise<string | null> {
  // Hasta 2 intentos: cubre tropiezos transitorios de red al bajar/subir.
  for (let intento = 0; intento < 2; intento++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const resp = await fetch(imageUrl, { signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) {
        // 5xx = tropiezo temporal → reintentar; 4xx = archivo no existe → rendirse.
        if (resp.status >= 500 && intento === 0) { await new Promise(r => setTimeout(r, 700)); continue; }
        return null;
      }
      let ct = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0];
      if (!/^image\//i.test(ct)) ct = 'image/jpeg';
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > WA_IMAGE_LIMIT) return await comprimirYSubirImagen(imageUrl);
      const ext = (ct.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const id = await uploadWhatsAppMedia(buf, ct, `foto.${ext}`);
      if (id) return id;
      if (intento === 0) { await new Promise(r => setTimeout(r, 700)); continue; }
    } catch {
      if (intento === 0) { await new Promise(r => setTimeout(r, 700)); continue; }
    }
  }
  return null;
}

// ── Send image by public URL ─────────────────────────────────────────────────
export async function sendImageByUrl(to: string, imageUrl: string, caption?: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;
  imageUrl = urlSegura(imageUrl);

  // 1) PREFERIR subir el archivo (confiable). Si la foto existe, esto siempre
  //    llega, sin que Meta dependa del enlace de Supabase.
  try {
    const mediaId = await subirImagenDesdeUrl(imageUrl);
    if (mediaId) {
      const w = await sendMediaMessage(to, mediaId, 'image', { caption });
      if (w) return w;
    }
  } catch { /* si algo falla en la subida, se intenta por link abajo */ }

  // 2) Fallback: por link (por si la descarga en servidor falló pero el link sí sirve).
  try {
    const imageObj: Record<string, string> = { link: imageUrl };
    if (caption) imageObj.caption = caption;
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'image',
        image: imageObj,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return (data.messages?.[0]?.id as string) ?? null;
    }

    // Falló el envío. Si fue por TAMAÑO de imagen (>5MB, error 131053), se
    // comprime la foto y se reintenta subiéndola como media.
    const errTxt = await res.text();
    console.error('[WhatsApp] sendImageByUrl failed:', errTxt);
    if (/131053|must be at most|too\s*(big|large)|file\s*size/i.test(errTxt)) {
      console.warn('[WhatsApp] imagen muy pesada, comprimiendo y reintentando…');
      const mediaId = await comprimirYSubirImagen(imageUrl);
      if (mediaId) return await sendMediaMessage(to, mediaId, 'image', { caption });
    }
    return null;
  } catch (e) {
    console.error('[WhatsApp] sendImageByUrl network error:', e);
    return null;
  }
}

/**
 * Reenvía una imagen SUBIÉNDOLA como archivo (no por link). Se usa cuando el envío
 * por link falló porque Meta no pudo descargar la URL (error 131103 "Downloading
 * media from weblink failed"). Al subir el archivo nosotros, Meta ya no depende del
 * enlace. Devuelve el nuevo whatsapp_id, o null si la imagen de origen está rota.
 */
export async function reenviarImagenComoMedia(to: string, imageUrl: string, caption?: string): Promise<string | null> {
  const mediaId = await comprimirYSubirImagen(imageUrl);
  if (!mediaId) return null;
  return await sendMediaMessage(to, mediaId, 'image', { caption });
}

// ── Send audio by public URL (no media_id required) ──────────────────────────
export async function sendAudioByUrl(to: string, audioUrl: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;
  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'audio',
        audio: { link: audioUrl },
      }),
    });
    if (!res.ok) { console.error('[WhatsApp] sendAudioByUrl failed:', await res.text()); return null; }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] sendAudioByUrl network error:', e);
    return null;
  }
}

// ── Send video by public URL (no media_id) — para videos grandes vía Supabase ─
export async function sendVideoByUrl(to: string, videoUrl: string, caption?: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) return null;
  try {
    const videoObj: Record<string, string> = { link: videoUrl };
    if (caption) videoObj.caption = caption;
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'video', video: videoObj }),
    });
    if (!res.ok) { console.error('[WhatsApp] sendVideoByUrl failed:', await res.text()); return null; }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] sendVideoByUrl network error:', e);
    return null;
  }
}

// ── Template message ──────────────────────────────────────────────────────────

export interface ConfirmacionParams {
  saludo: string;   // {{1}} — nombre en el saludo "Hola {{1}} 😊"
  nombre: string;   // {{2}}
  telefono: string; // {{3}}
  direccion: string;// {{4}}
  ciudad: string;   // {{5}}
  departamento: string; // {{6}}
  correo: string;   // {{7}}
  talla: string;    // {{8}}
  producto: string; // {{9}}
  valor: string;    // {{10}}
  imageUrl: string;
}

/**
 * Sends the approved Meta template "confirmacion_pedido_klixmant".
 * Works for business-initiated messages (no 24h window required).
 * The template must be approved in Meta WhatsApp Manager before using this.
 *
 * Template variables (in order):
 *   {{1}} nombre  {{2}} telefono  {{3}} direccion  {{4}} ciudad
 *   {{5}} departamento  {{6}} correo  {{7}} talla
 *   {{8}} producto  {{9}} valor
 */
/** Returns the WhatsApp message ID (wamid) on success, null on failure */
export async function sendConfirmacionTemplate(
  to: string,
  params: ConfirmacionParams,
): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for template send');
    return null;
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'confirmacion_pedido_klixmant',
      language: { code: 'es' },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: params.imageUrl },
            },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.saludo },      // {{1}} saludo
            { type: 'text', text: params.nombre },       // {{2}}
            { type: 'text', text: params.telefono },     // {{3}}
            { type: 'text', text: params.direccion },    // {{4}}
            { type: 'text', text: params.ciudad },       // {{5}}
            { type: 'text', text: params.departamento }, // {{6}}
            { type: 'text', text: params.correo },       // {{7}}
            { type: 'text', text: params.talla },        // {{8}}
            { type: 'text', text: params.producto },     // {{9}}
            { type: 'text', text: params.valor },        // {{10}}
          ],
        },
      ],
    },
  };

  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[WhatsApp] sendTemplate failed:', err);
      return null;
    }
    const data = await res.json();
    const wamid = (data.messages?.[0]?.id as string) ?? null;
    console.log('[WhatsApp] Template sent OK to', to, '| wamid:', wamid);
    return wamid;
  } catch (e) {
    console.error('[WhatsApp] Network error (sendTemplate):', e);
    return null;
  }
}

/**
 * Envía la plantilla de recordatorio de pedido pendiente (remarketing).
 * Funciona fuera de la ventana de 24h. Debe estar aprobada en Meta.
 * Plantilla: "recordatorio_pedido_klixmant" — 1 variable de body: {{1}} = nombre.
 */
export async function sendRecordatorioTemplate(to: string, nombre: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for recordatorio template');
    return null;
  }
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'recordatorio_pedido_klixmant',
      language: { code: 'es' },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: nombre || 'hola' }], // {{1}} nombre
        },
      ],
    },
  };
  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[WhatsApp] recordatorio template failed:', await res.text());
      return null;
    }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] Network error (recordatorio):', e);
    return null;
  }
}

/**
 * Plantilla "mantener_chat_activo" — sin variables.
 * Se envía a los números de registro de ventas para pedirles que respondan y así
 * la ventana de 24h no se cierre (si se cierra, dejan de llegar los registros).
 * La plantilla debe estar APROBADA en Meta con ese nombre e idioma 'es'.
 */
export async function sendMantenerChatTemplate(to: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for mantener_chat template');
    return null;
  }
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'recordatorio_lilibeth',
      language: { code: 'es' },
    },
  };
  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[WhatsApp] mantener_chat template failed:', await res.text());
      return null;
    }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] Network error (mantener_chat):', e);
    return null;
  }
}

/**
 * Plantilla "vendedores" — 1 variable {{1}} = nombre. Es la invitación de QUINO
 * para que el vendedor responda "hola" y se le abra el chat de supervisión.
 * Debe estar APROBADA en Meta con ese nombre e idioma 'es'.
 */
export async function sendVendedoresTemplate(to: string, nombre: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for vendedores template');
    return null;
  }
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'vendedores',
      language: { code: 'es' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: nombre || 'equipo' }] },
      ],
    },
  };
  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[WhatsApp] vendedores template failed:', await res.text());
      return null;
    }
    const data = await res.json();
    return (data.messages?.[0]?.id as string) ?? null;
  } catch (e) {
    console.error('[WhatsApp] Network error (vendedores):', e);
    return null;
  }
}
