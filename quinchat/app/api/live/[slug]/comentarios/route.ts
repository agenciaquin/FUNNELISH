import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase';
import { revisarComentario, limpiarNombre } from '@/lib/live/moderacion';

export const dynamic = 'force-dynamic';

/**
 * Chat del live (público, sin login).
 *  GET  → comentarios visibles del live (solo nombre, texto y segundo: nada personal).
 *         ?desde=<id> devuelve solo los más nuevos (para el refresco cada pocos segundos).
 *  POST → publica un comentario: moderación + límite por visitante e IP.
 */

async function liveId(slug: string): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('live_lives').select('id, estado').eq('slug', slug).maybeSingle();
  if (!data || data.estado === 'archivado') return null;
  return String(data.id);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = await liveId(slug);
  if (!id) return NextResponse.json({ comentarios: [] });
  const desde = Number(req.nextUrl.searchParams.get('desde')) || 0;
  const supabase = createServerSupabaseClient();
  let q = supabase.from('live_comentarios')
    .select('id, nombre, texto, segundo, creado_en')
    .eq('live_id', id).eq('estado', 'visible');
  if (desde > 0) q = q.gt('id', desde);
  const { data } = await q.order('id', { ascending: false }).limit(400);
  return NextResponse.json({ comentarios: (data ?? []).reverse() });
}

const MOTIVOS: Record<string, string> = {
  enlace: 'Por seguridad no se permiten enlaces en los comentarios.',
  correo: 'Por tu privacidad no publiques correos. Escríbenos por WhatsApp.',
  telefono: 'Por tu privacidad no publiques números de celular. Escríbenos por WhatsApp.',
  lenguaje: 'Tu comentario no se pudo publicar. Mantengamos el chat respetuoso 🙏',
  spam: 'Tu comentario parece spam.',
  vacio: 'Escribe un comentario.',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = await liveId(slug);
  if (!id) return NextResponse.json({ error: 'Live no disponible' }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const sesion = String(b?.sesion_id ?? '').replace(/[^\w-]/g, '').slice(0, 64);
  if (sesion.length < 8) return NextResponse.json({ error: 'sesión inválida' }, { status: 400 });

  const rev = revisarComentario(b?.texto);
  if (!rev.ok) return NextResponse.json({ error: MOTIVOS[rev.motivo ?? 'vacio'] ?? 'No se pudo publicar.', bloqueado: true }, { status: 422 });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';
  const ipHash = createHash('sha256').update(`quinlive:${ip}`).digest('hex').slice(0, 32);
  const supabase = createServerSupabaseClient();

  // Límites: 1 comentario cada 10 s por visitante; 15 por hora por visitante; 30 por hora por IP.
  const hace = (s: number) => new Date(Date.now() - s * 1000).toISOString();
  const [{ count: c10 }, { count: cHora }, { count: cIp }] = await Promise.all([
    supabase.from('live_comentarios').select('id', { count: 'exact', head: true }).eq('sesion_id', sesion).gte('creado_en', hace(10)),
    supabase.from('live_comentarios').select('id', { count: 'exact', head: true }).eq('sesion_id', sesion).gte('creado_en', hace(3600)),
    supabase.from('live_comentarios').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('creado_en', hace(3600)),
  ]);
  if ((c10 ?? 0) >= 1) return NextResponse.json({ error: 'Espera unos segundos antes de comentar otra vez.' }, { status: 429 });
  if ((cHora ?? 0) >= 15 || (cIp ?? 0) >= 30) return NextResponse.json({ error: 'Llegaste al límite de comentarios por ahora.' }, { status: 429 });

  const segundo = Math.max(0, Math.min(86400, Number(b?.segundo) || 0));
  const { data, error } = await supabase.from('live_comentarios').insert({
    live_id: id, sesion_id: sesion, ip_hash: ipHash,
    nombre: limpiarNombre(b?.nombre), texto: rev.texto, segundo,
  }).select('id, nombre, texto, segundo, creado_en').single();
  if (error) return NextResponse.json({ error: 'No se pudo publicar.' }, { status: 500 });
  return NextResponse.json({ ok: true, comentario: data });
}
