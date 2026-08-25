/**
 * Plantillas de WhatsApp (Meta Cloud API).
 *
 * Una plantilla aprobada es la ÚNICA forma de escribirle a un cliente cuando ya
 * pasaron 24 horas desde su último mensaje. Aquí se listan, se crean (quedan en
 * revisión de Meta) y se envían.
 */

import { createServerSupabaseClient } from '@/lib/supabase';

const WA_API = 'https://graph.facebook.com/v19.0';

/** Credenciales de WhatsApp de UNA empresa (o globales por env como respaldo). */
export interface WaCreds { token?: string; waba?: string; phone?: string; appId?: string; }

/** Usa las credenciales que le pasen; si faltan, cae a las globales por env. */
function credenciales(c?: WaCreds) {
  return {
    token:  c?.token || process.env.WHATSAPP_ACCESS_TOKEN,
    waba:   c?.waba  || process.env.WHATSAPP_WABA_ID,
    phone:  c?.phone || process.env.WHATSAPP_PHONE_NUMBER_ID,
    appId:  c?.appId || process.env.WHATSAPP_APP_ID,
  };
}

/**
 * Descubre el WABA ID (WhatsApp Business Account) a partir del token, para no
 * tener que pedírselo al cliente. El token trae, en sus permisos "granulares",
 * los IDs de las cuentas de WhatsApp a las que da acceso.
 */
async function descubrirWaba(token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${WA_API}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    const data = await res.json();
    const scopes = data?.data?.granular_scopes;
    if (Array.isArray(scopes)) {
      // Preferimos el scope de gestión (necesario para plantillas); si no, el de mensajería.
      for (const buscado of ['whatsapp_business_management', 'whatsapp_business_messaging']) {
        const s = scopes.find((x: any) => x?.scope === buscado && Array.isArray(x?.target_ids) && x.target_ids.length);
        if (s) return String(s.target_ids[0]);
      }
    }
    return null;
  } catch { return null; }
}

/** Carga las credenciales de WhatsApp guardadas por la empresa (tabla tenants).
 *  Si falta el WABA ID pero hay token, intenta descubrirlo solo y lo guarda. */
export async function credencialesTenant(tid: string): Promise<WaCreds> {
  try {
    const admin = createServerSupabaseClient();
    const { data } = await admin
      .from('tenants')
      .select('wa_access_token, wa_waba_id, wa_phone_number_id, wa_app_id')
      .eq('id', tid).maybeSingle();

    const token = (data as any)?.wa_access_token || undefined;
    let waba    = (data as any)?.wa_waba_id || undefined;

    // Auto-descubrir el WABA ID si no está configurado (una sola vez: se guarda).
    if (!waba && token) {
      const descubierto = await descubrirWaba(token);
      if (descubierto) {
        waba = descubierto;
        try { await admin.from('tenants').update({ wa_waba_id: descubierto }).eq('id', tid); } catch { /* no bloquear */ }
      }
    }

    return {
      token,
      waba,
      phone: (data as any)?.wa_phone_number_id || undefined,
      appId: (data as any)?.wa_app_id || undefined,
    };
  } catch { return {}; }
}

const ERR_SIN_CONFIG = 'Aún no has conectado tu WhatsApp Business, o falta el WABA ID. Ve a "Conexión de WhatsApp" y completa el WABA ID y el Access Token.';

export interface PlantillaWA {
  id: string;
  name: string;
  status: string;            // APPROVED | PENDING | REJECTED | PAUSED
  category: string;          // UTILITY | MARKETING | AUTHENTICATION
  language: string;
  components: any[];
  cuerpo: string;            // texto del body, para vista previa
  variables: number;         // cuántos {{n}} tiene el body
  tieneImagen: boolean;      // encabezado de tipo imagen
}

function resumir(t: any): PlantillaWA {
  const comps  = Array.isArray(t.components) ? t.components : [];
  const body   = comps.find((c: any) => c.type === 'BODY');
  const header = comps.find((c: any) => c.type === 'HEADER');
  const cuerpo = String(body?.text ?? '');
  const vars   = new Set((cuerpo.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []).map(s => s));
  return {
    id: t.id, name: t.name, status: t.status, category: t.category,
    language: t.language, components: comps,
    cuerpo,
    variables: vars.size,
    tieneImagen: header?.format === 'IMAGE',
  };
}

/** Lista todas las plantillas de la cuenta (aprobadas y en revisión). */
export async function listarPlantillas(creds?: WaCreds): Promise<{ ok: boolean; plantillas: PlantillaWA[]; error?: string }> {
  const { token, waba } = credenciales(creds);
  if (!token || !waba) {
    return { ok: false, plantillas: [], error: ERR_SIN_CONFIG };
  }
  try {
    const res = await fetch(
      `${WA_API}/${waba}/message_templates?limit=200&fields=id,name,status,category,language,components`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, plantillas: [], error: data?.error?.message ?? 'No se pudieron leer las plantillas.' };
    }
    return { ok: true, plantillas: (data.data ?? []).map(resumir) };
  } catch (e: any) {
    return { ok: false, plantillas: [], error: e?.message ?? 'Error de red.' };
  }
}

/** Averigua el App ID a partir del token (evita tener que configurarlo a mano). */
async function obtenerAppId(token: string, creds?: WaCreds): Promise<string | null> {
  const { appId } = credenciales(creds);
  if (appId) return appId;
  try {
    const res = await fetch(`${WA_API}/debug_token?input_token=${token}&access_token=${token}`);
    const data = await res.json();
    return data?.data?.app_id ? String(data.data.app_id) : null;
  } catch { return null; }
}

/**
 * Sube la imagen de ejemplo del encabezado y devuelve su "handle".
 * Meta lo exige al crear una plantilla con encabezado de imagen.
 */
export async function subirImagenEjemplo(buffer: Buffer, mimeType: string, creds?: WaCreds): Promise<string | null> {
  const { token } = credenciales(creds);
  if (!token) return null;
  const appId = await obtenerAppId(token, creds);
  if (!appId) {
    console.error('[Plantillas] no se pudo determinar el App ID');
    return null;
  }
  try {
    // 1. Abrir la sesión de subida
    const inicio = await fetch(
      `${WA_API}/${appId}/uploads?file_length=${buffer.length}&file_type=${encodeURIComponent(mimeType)}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
    );
    const sesion = await inicio.json();
    if (!inicio.ok || !sesion?.id) {
      console.error('[Plantillas] error abriendo la subida:', sesion?.error?.message);
      return null;
    }

    // 2. Enviar el archivo
    const subida = await fetch(`${WA_API}/${sesion.id}`, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${token}`,
        file_offset: '0',
        'Content-Type': mimeType,
      },
      body: new Uint8Array(buffer),
    });
    const resultado = await subida.json();
    if (!subida.ok || !resultado?.h) {
      console.error('[Plantillas] error subiendo la imagen:', resultado?.error?.message);
      return null;
    }
    return resultado.h as string;
  } catch (e) {
    console.error('[Plantillas] error en la subida:', e);
    return null;
  }
}

export interface NuevaPlantilla {
  nombre: string;               // solo minúsculas, números y guion bajo
  categoria: 'UTILITY' | 'MARKETING';
  idioma: string;               // 'es'
  cuerpo: string;               // texto con {{1}}, {{2}}…
  ejemplos: string[];           // un valor de ejemplo por variable
  pie?: string;                 // footer opcional
  headerHandle?: string | null; // si lleva imagen de encabezado
  botones?: string[];           // botones de respuesta rápida (opcional)
}

/** Crea la plantilla en Meta. Queda en revisión hasta que la aprueben. */
export async function crearPlantilla(p: NuevaPlantilla, creds?: WaCreds): Promise<{ ok: boolean; id?: string; status?: string; error?: string }> {
  const { token, waba } = credenciales(creds);
  if (!token || !waba) return { ok: false, error: ERR_SIN_CONFIG };

  const components: any[] = [];

  if (p.headerHandle) {
    components.push({
      type: 'HEADER',
      format: 'IMAGE',
      example: { header_handle: [p.headerHandle] },
    });
  }

  const body: any = { type: 'BODY', text: p.cuerpo };
  if (p.ejemplos.length > 0) body.example = { body_text: [p.ejemplos] };
  components.push(body);

  if (p.pie?.trim()) components.push({ type: 'FOOTER', text: p.pie.trim() });

  if (p.botones && p.botones.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: p.botones.slice(0, 3).map(t => ({ type: 'QUICK_REPLY', text: t })),
    });
  }

  try {
    const res = await fetch(`${WA_API}/${waba}/message_templates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: p.nombre,
        category: p.categoria,
        language: p.idioma,
        components,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.error_user_msg ?? data?.error?.message ?? 'No se pudo crear.' };
    return { ok: true, id: data.id, status: data.status };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error de red.' };
  }
}

/** Elimina una plantilla de la cuenta. */
export async function borrarPlantilla(nombre: string, creds?: WaCreds): Promise<{ ok: boolean; error?: string }> {
  const { token, waba } = credenciales(creds);
  if (!token || !waba) return { ok: false, error: ERR_SIN_CONFIG };
  try {
    const res = await fetch(`${WA_API}/${waba}/message_templates?name=${encodeURIComponent(nombre)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error?.message ?? 'No se pudo borrar.' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error de red.' };
  }
}

/**
 * Envía una plantilla aprobada a un cliente. Funciona pasadas las 24 horas.
 * `imagenUrl` solo se usa si la plantilla tiene encabezado de imagen.
 */
export async function enviarPlantilla(
  to: string,
  nombre: string,
  idioma: string,
  variables: string[],
  imagenUrl?: string | null,
  creds?: WaCreds,
): Promise<{ ok: boolean; wamid?: string; error?: string }> {
  const { token, phone } = credenciales(creds);
  if (!token || !phone) return { ok: false, error: ERR_SIN_CONFIG };

  const components: any[] = [];
  if (imagenUrl) {
    components.push({ type: 'header', parameters: [{ type: 'image', image: { link: imagenUrl } }] });
  }
  if (variables.length > 0) {
    components.push({
      type: 'body',
      parameters: variables.map(v => ({ type: 'text', text: v || '—' })),
    });
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: nombre, language: { code: idioma } },
  };
  if (components.length > 0) payload.template.components = components;

  try {
    const res = await fetch(`${WA_API}/${phone}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error?.error_user_msg ?? data?.error?.message ?? 'No se pudo enviar.' };
    }
    return { ok: true, wamid: data.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Error de red.' };
  }
}
