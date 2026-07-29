/**
 * Transcribe notas de voz de WhatsApp con Whisper (vía Groq — capa gratuita).
 * Devuelve el texto o null si no se pudo.
 *
 * Env: GROQ_API_KEY  (se saca gratis en console.groq.com/keys)
 */
export async function transcribirAudio(
  buffer: Buffer,
  mimeType: string,
): Promise<string | null> {
  const key = String(process.env.GROQ_API_KEY ?? '').trim();
  if (!key) return null;

  try {
    const ext = (mimeType.split('/')[1] ?? 'ogg').split(';')[0].replace('mpeg', 'mp3');
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from(buffer)], { type: mimeType || 'audio/ogg' }), `audio.${ext}`);
    form.append('model', 'whisper-large-v3');
    form.append('language', 'es');
    form.append('response_format', 'text');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      console.error('[Transcribir] error Groq:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const texto = (await res.text()).trim();
    return texto || null;
  } catch (e) {
    console.error('[Transcribir] fallo de red:', e);
    return null;
  }
}
