import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ESTADOS = ['nueva', 'pendiente', 'en_gestion', 'solucionada'] as const;
const NOMBRE: Record<string, string> = { nueva: 'Nueva', pendiente: 'Pendiente', en_gestion: 'En gestión', solucionada: 'Solucionada' };

/** GET → novedad completa + historial.  PATCH {estado?, nota?, visto?} → cambia el estado de GESTIÓN del equipo (no toca Effi). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const { data: n } = await supabase.from('novedades_effi').select('*').eq('id', Number(id)).maybeSingle();
  if (!n) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  const { data: h } = await supabase.from('novedades_effi_historial').select('id, at, tipo, detalle, por').eq('novedad_id', n.id).order('at', { ascending: false }).limit(300);
  return NextResponse.json({ novedad: n, historial: h ?? [] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  const { data: n } = await supabase.from('novedades_effi').select('id, estado, visto_at').eq('id', Number(id)).maybeSingle();
  if (!n) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  const ahora = new Date().toISOString();
  const upd: Record<string, any> = {};
  const hist: { tipo: string; detalle: string }[] = [];

  // Al abrirla por primera vez: deja de ser «nueva» y pasa a «pendiente»
  if (b?.visto && !n.visto_at) {
    upd.visto_at = ahora;
    if (n.estado === 'nueva') { upd.estado = 'pendiente'; upd.estado_cambio_at = ahora; hist.push({ tipo: 'estado', detalle: 'Vista por el equipo: Nueva → Pendiente' }); }
  }
  if (b?.estado && (ESTADOS as readonly string[]).includes(b.estado) && b.estado !== (upd.estado ?? n.estado)) {
    const antes = upd.estado ?? n.estado;
    upd.estado = b.estado; upd.estado_cambio_at = ahora; upd.visto_at = upd.visto_at ?? n.visto_at ?? ahora;
    if (b.estado === 'solucionada') { upd.solucionada_at = ahora; upd.resultado = 'equipo'; } else { upd.solucionada_at = null; upd.resultado = null; }
    hist.push({ tipo: 'estado', detalle: `${NOMBRE[antes] ?? antes} → ${NOMBRE[b.estado]}` });
  }
  const nota = String(b?.nota ?? '').trim().slice(0, 2000);
  if (nota) hist.push({ tipo: 'nota', detalle: nota });
  if (!Object.keys(upd).length && !hist.length) return NextResponse.json({ ok: true });
  if (Object.keys(upd).length) {
    upd.actualizado_at = ahora;
    const { error } = await supabase.from('novedades_effi').update(upd).eq('id', n.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (hist.length) await supabase.from('novedades_effi_historial').insert(hist.map(h => ({ novedad_id: n.id, tipo: h.tipo, detalle: h.detalle, por: auth.quien })));
  return NextResponse.json({ ok: true });
}
