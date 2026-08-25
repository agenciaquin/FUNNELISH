import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { transcribirAudio } from '@/lib/transcribir';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Transcribe una nota de voz que el dueño graba al armar su bot, usando la misma
 * transcripción (Whisper) que las notas de voz de WhatsApp. Devuelve el texto.
 * Body: FormData con `file` (audio).
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'audio inválido' }, { status: 400 }); }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no llegó ningún audio' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El audio es muy largo (máx. 25 MB).' }, { status: 400 });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const texto = await transcribirAudio(buf, file.type || 'audio/webm', tid ?? null);
    if (!texto) return NextResponse.json({ error: 'No pude transcribir el audio. Revisa que tengas una IA con audio conectada, o escríbelo.' }, { status: 422 });
    return NextResponse.json({ texto });
  } catch {
    return NextResponse.json({ error: 'No pude procesar el audio. Intenta de nuevo o escríbelo.' }, { status: 500 });
  }
}
