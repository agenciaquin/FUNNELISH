import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';

export const dynamic = 'force-dynamic';

/**
 * Trae la foto ORIGINAL de una prenda (almacenamiento de Supabase) por el mismo dominio del panel,
 * para dibujarla en el collage sin problemas de CORS. Solo hosts de Supabase Storage (no es un proxy abierto).
 */
export async function GET(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const u = String(req.nextUrl.searchParams.get('u') ?? '');
  let url: URL;
  try { url = new URL(u); } catch { return NextResponse.json({ error: 'URL inválida' }, { status: 400 }); }
  if (url.protocol !== 'https:' || !/\.supabase\.co$/.test(url.hostname) || !url.pathname.startsWith('/storage/v1/object/public/')) {
    return NextResponse.json({ error: 'Origen no permitido' }, { status: 400 });
  }
  const r = await fetch(url.toString());
  if (!r.ok) return NextResponse.json({ error: `No se pudo traer la foto (${r.status})` }, { status: 502 });
  return new NextResponse(r.body, {
    headers: { 'Content-Type': r.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
  });
}
