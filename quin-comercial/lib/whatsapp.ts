import { phoneIdActual, tokenActual } from './whatsapp-contexto';
import { createServerSupabaseClient } from './supabase';

const WA_API_URL = 'https://graph.facebook.com/v19.0';

/**
 * Construye el campo del destinatario para el envío.
 * Meta cambió su API (Business-Scoped User IDs): los clientes que activaron
 * "nombre de usuario" de WhatsApp llegan SIN número, con un ID de negocio como
 * "CO.2843970012644478". A esos NO se les puede responder con `to` (que es solo
 * para números); hay que usar `recipient`. Regla: un número es solo dígitos
 * (con o sin +); cualquier cosa con letras o punto es un BSUID → `recipient`.
 * Ref: developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids
 */
function destino(to: string): Record<string, string> {
  const esTelefono = /^\+?\d{6,}$/.test(String(to ?? '').trim());
  return esTelefono ? { to } : { recipient: to };
}

// ── Número real del bot ───────────────────────────────────────────────────────
// Se le pregunta a Meta cuál es el número conectado, para que ningún enlace de
// la página pueda apuntar a un número equivocado escrito a mano.
// MULTI-TENANT: el caché se guarda POR phone_number_id, para que el número de un
// cliente nunca se devuelva por error a otro.
const numeroCache = new Map<string, { valor: string; hasta: number }>();

/** Número del bot. Solo se usa si Meta no contesta. */
const NUMERO_BOT_FIJO = '573172653897';

export async function numeroDelBot(): Promise<string> {
  const respaldo =
    (process.env.WHATSAPP_NUMERO_BOT ?? '').replace(/\D/g, '') || NUMERO_BOT_FIJO;
  const ahora = Date.now();

  const phoneNumberId = phoneIdActual();
  const token = tokenActual();
  if (!phoneNumberId || !token) return respaldo;

  const enCache = numeroCache.get(phoneNumberId);
  if (enCache && enCache.hasta > ahora) return enCache.valor;

  try {
    const res = await fetch(
      `${WA_API_URL}/${phoneNumberId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) return respaldo;
    const data = await res.json();
    const num = String(data?.display_phone_number ?? '').replace(/\D/g, '');
    if (!num) return respaldo;
    numeroCache.set(phoneNumberId, { valor: num, hasta: ahora + 6 * 60 * 60 * 1000 }); // 6 horas
    return num;
  } catch {
    return respaldo;
  }
}

/**
 * Número del bot de un TENANT específico (por su empresa). Se usa en páginas
 * públicas (ej. la de "gracias" de un embudo) donde NO hay contexto de línea,
 * así el botón "Confirmar por WhatsApp" muestra el número de ESA tienda y nunca
 * el de otra empresa. Consulta a Meta el número real conectado del cliente.
 */
export async function numeroDelBotTenant(tenantId?: string | null): Promise<string> {
  const respaldo = (process.env.WHATSAPP_NUMERO_BOT ?? '').replace(/\D/g, '') || NUMERO_BOT_FIJO;
  if (!tenantId) return respaldo;
  try {
    const admin = createServerSupabaseClient();
    const { data } = await admin
      .from('tenants')
      .select('wa_access_token, wa_phone_number_id')
      .eq('id', tenantId).maybeSingle();
    const phoneId = String((data as any)?.wa_phone_number_id ?? '').trim();
    const token   = String((data as any)?.wa_access_token ?? '').trim();
    if (!phoneId || !token) return respaldo;

    const ahora = Date.now();
    const enCache = numeroCache.get(phoneId);
    if (enCache && enCache.hasta > ahora) return enCache.valor;

    const res = await fetch(
      `${WA_API_URL}/${phoneId}?fields=display_phone_number`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) return respaldo;
    const d = await res.json();
    const num = String(d?.display_phone_number ?? '').replace(/\D/g, '');
    if (!num) return respaldo;
    numeroCache.set(phoneId, { valor: num, hasta: ahora + 6 * 60 * 60 * 1000 });
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
  const token = tokenActual();
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
  const token = tokenActual();
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
  const token = tokenActual();
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
        ...destino(to),
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
  const token = tokenActual();
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
  const token = tokenActual();

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
        ...destino(to),
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
    const resp = await fetch(imageUrl);
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

// ── Send image by public URL (no media_id required) ──────────────────────────
export async function sendImageByUrl(to: string, imageUrl: string, caption?: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = tokenActual();
  if (!phoneNumberId || !token) return null;
  try {
    const imageObj: Record<string, string> = { link: imageUrl };
    if (caption) imageObj.caption = caption;
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...destino(to),
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

// ── Send audio by public URL (no media_id required) ──────────────────────────
export async function sendAudioByUrl(to: string, audioUrl: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = tokenActual();
  if (!phoneNumberId || !token) return null;
  try {
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...destino(to),
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
  const token = tokenActual();
  if (!phoneNumberId || !token) return null;
  try {
    const videoObj: Record<string, string> = { link: videoUrl };
    if (caption) videoObj.caption = caption;
    const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...destino(to), type: 'video', video: videoObj }),
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
  const token = tokenActual();

  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for template send');
    return null;
  }

  // Nombre ESTÁNDAR de la plantilla de confirmación: "confirmacion_pedido" (el que
  // crea el panel para cada cliente). Se prueban varios nombres por compatibilidad
  // con cuentas viejas (Klixmant usaba "confirmacion_pedido_klixmant"). El primero
  // que exista y salga bien, se usa. Así funciona para TODOS los clientes.
  const NOMBRES = ['confirmacion_pedido', 'confirmacion_pedido_klixmant'];

  const construir = (nombre: string) => ({
    messaging_product: 'whatsapp',
    ...destino(to),
    type: 'template',
    template: {
      name: nombre,
      language: { code: 'es' },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'image', image: { link: params.imageUrl } }],
        },
        {
          type: 'body',
          // ORDEN DE VARIABLES — debe coincidir EXACTO con el cuerpo de la plantilla
          // aprobada "confirmacion_pedido" (mismo orden que el proyecto original):
          //   Hola {{1}} … Nombre {{2}} · Teléfono {{3}} · Dirección {{4}} · Ciudad {{5}}
          //   Departamento {{6}} · Correo {{7}} · Talla {{8}} · Producto {{9}} · Valor {{10}}
          parameters: [
            { type: 'text', text: params.saludo },       // {{1}} saludo (nombre de pila)
            { type: 'text', text: params.nombre },        // {{2}} nombre completo
            { type: 'text', text: params.telefono },      // {{3}} teléfono
            { type: 'text', text: params.direccion },     // {{4}} dirección
            { type: 'text', text: params.ciudad },        // {{5}} ciudad
            { type: 'text', text: params.departamento },  // {{6}} departamento
            { type: 'text', text: params.correo },        // {{7}} correo
            { type: 'text', text: params.talla },         // {{8}} talla
            { type: 'text', text: params.producto },      // {{9}} producto
            { type: 'text', text: params.valor },         // {{10}} valor
          ],
        },
      ],
    },
  });

  for (const nombre of NOMBRES) {
    try {
      const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(construir(nombre)),
      });
      if (res.ok) {
        const data = await res.json();
        const wamid = (data.messages?.[0]?.id as string) ?? null;
        console.log(`[WhatsApp] Template "${nombre}" sent OK to ${to} | wamid: ${wamid}`);
        return wamid;
      }
      const err = await res.text();
      console.error(`[WhatsApp] template "${nombre}" failed:`, err);
      // Si es solo que la plantilla NO existe con ese nombre, se prueba el siguiente.
      // Cualquier otro error (ej. formato de variables) → no seguir probando.
      if (!/does not exist|132001|not found|no existe|template name/i.test(err)) return null;
    } catch (e) {
      console.error('[WhatsApp] Network error (sendTemplate):', e);
      return null;
    }
  }
  return null;
}

/**
 * Envía la plantilla de ESTADO del envío (guías Effi). Funciona fuera de la
 * ventana de 24h porque es plantilla aprobada. Debe existir en Meta con nombre
 * "estado_pedido" y 3 variables de body:
 *   {{1}} = nombre · {{2}} = frase del estado · {{3}} = número de guía
 */
export async function sendEstadoTemplate(
  to: string,
  params: { nombre: string; frase: string; guia: string },
): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = tokenActual();
  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for estado template');
    return null;
  }
  const NOMBRES = ['estado_pedido', 'estado_envio'];
  const construir = (nombre: string) => ({
    messaging_product: 'whatsapp',
    ...destino(to),
    type: 'template',
    template: {
      name: nombre,
      language: { code: 'es' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.nombre || 'Hola' }, // {{1}}
            { type: 'text', text: params.frase },             // {{2}}
            { type: 'text', text: params.guia || '—' },        // {{3}}
          ],
        },
      ],
    },
  });
  for (const nombre of NOMBRES) {
    try {
      const res = await fetch(`${WA_API_URL}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(construir(nombre)),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.messages?.[0]?.id as string) ?? null;
      }
      const err = await res.text();
      console.error(`[WhatsApp] estado template "${nombre}" failed:`, err);
      if (!/does not exist|132001|not found|no existe|template name/i.test(err)) return null;
    } catch (e) {
      console.error('[WhatsApp] Network error (sendEstadoTemplate):', e);
      return null;
    }
  }
  return null;
}

/**
 * Envía la plantilla de recordatorio de pedido pendiente (remarketing).
 * Funciona fuera de la ventana de 24h. Debe estar aprobada en Meta.
 * Plantilla: "recordatorio_pedido_klixmant" — 1 variable de body: {{1}} = nombre.
 */
export async function sendRecordatorioTemplate(to: string, nombre: string): Promise<string | null> {
  const phoneNumberId = phoneIdActual();
  const token = tokenActual();
  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for recordatorio template');
    return null;
  }
  const payload = {
    messaging_product: 'whatsapp',
    ...destino(to),
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
  const token = tokenActual();
  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for mantener_chat template');
    return null;
  }
  const payload = {
    messaging_product: 'whatsapp',
    ...destino(to),
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
  const token = tokenActual();
  if (!phoneNumberId || !token) {
    console.error('[WhatsApp] Missing credentials for vendedores template');
    return null;
  }
  const payload = {
    messaging_product: 'whatsapp',
    ...destino(to),
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
