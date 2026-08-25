import { createServerSupabaseClient } from '@/lib/supabase';
import { desencriptar } from '@/lib/cripto';
import { proveedorDe } from '@/lib/ia-proveedores';

/**
 * Transcribe notas de voz de WhatsApp con Whisper.
 *
 * Usa la LLAVE DEL PROPIO CLIENTE (la que vinculó en "Integrar IA") si tiene una
 * que transcriba audio (ej. Groq — gratis con la misma llave del texto). Así el
 * dueño no depende de la agencia. Si no vinculó ninguna, cae a la llave global
 * de la agencia (GROQ_API_KEY) como respaldo.
 *
 * Devuelve el texto o null si no se pudo.
 */

/** Llama a un endpoint de transcripción compatible con OpenAI (Groq/OpenAI). */
async function transcribirCon(baseURL: string, apiKey: string, modelo: string, buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    const ext = (mimeType.split('/')[1] ?? 'ogg').split(';')[0].replace('mpeg', 'mp3');
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from(buffer)], { type: mimeType || 'audio/ogg' }), `audio.${ext}`);
    form.append('model', modelo);
    form.append('language', 'es');
    form.append('response_format', 'text');

    const url = `${baseURL.replace(/\/$/, '')}/audio/transcriptions`;
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!res.ok) {
      console.error('[Transcribir] error', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const texto = (await res.text()).trim();
    return texto || null;
  } catch (e) {
    console.error('[Transcribir] fallo de red:', e);
    return null;
  }
}

export async function transcribirAudio(
  buffer: Buffer,
  mimeType: string,
  tenantId?: string | null,
): Promise<string | null> {
  // 1) Intentar con las llaves de AUDIO que el cliente vinculó (en orden).
  if (tenantId) {
    try {
      const admin = createServerSupabaseClient();
      const { data } = await admin.from('ai_integraciones')
        .select('proveedor, api_key_cifrada')
        .eq('tenant_id', tenantId).eq('activo', true)
        .order('prioridad', { ascending: true });
      for (const ia of (data ?? [])) {
        const info = proveedorDe((ia as any).proveedor);
        if (!info?.soportaAudio) continue;
        const apiKey = desencriptar((ia as any).api_key_cifrada);
        if (!apiKey) continue;
        const modelo = info.modeloAudio || 'whisper-large-v3';
        const texto = await transcribirCon(info.baseURL, apiKey, modelo, buffer, mimeType);
        if (texto) return texto;
      }
    } catch (e) {
      console.error('[Transcribir] error buscando llave del cliente:', e);
    }
  }

  // 2) Respaldo: llave global de la agencia (Groq).
  const key = String(process.env.GROQ_API_KEY ?? '').trim();
  if (!key) return null;
  return transcribirCon('https://api.groq.com/openai/v1/', key, 'whisper-large-v3', buffer, mimeType);
}
