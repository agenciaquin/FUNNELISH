import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { correrSupervisor, ETIQUETA_ERROR, ETIQUETA_PERFIL } from '@/lib/supervisor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function conSesion() { return !!(await getServerSession(authOptions)); }

/**
 * GET: tablero del supervisor (últimos N días).
 *  · nota promedio por día, top errores, perfiles y su conversión
 *  · últimas auditorías (con errores) · lecciones del supervisor
 */
export async function GET(req: NextRequest) {
  if (!(await conSesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const dias = Math.min(60, Math.max(1, Number(req.nextUrl.searchParams.get('dias') ?? 7)));
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const supabase = createServerSupabaseClient();

  const [{ data: auds }, { data: lecciones }] = await Promise.all([
    supabase.from('supervisor_auditorias')
      .select('conversation_id, resultado, puntaje, etapas, errores, aciertos, perfil, resumen, leccion_id, creado_at')
      .gte('creado_at', desde).order('creado_at', { ascending: false }).limit(1000),
    supabase.from('memoria_bot')
      .select('id, regla, categoria, estado, ejemplo, conversacion_id, creada_at, aprobada_at, riesgo, auto')
      .eq('origen', 'supervisor').neq('estado', 'descartada')
      .order('creada_at', { ascending: false }).limit(200),
  ]);

  const evaluadas = (auds ?? []).filter((a: any) => a.puntaje != null);

  // Nota promedio por día
  const porDia = new Map<string, { suma: number; n: number; vendidas: number }>();
  for (const a of evaluadas) {
    const d = new Date(new Date(a.creado_at).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
    const x = porDia.get(d) ?? { suma: 0, n: 0, vendidas: 0 };
    x.suma += a.puntaje; x.n++; if (a.resultado === 'vendida') x.vendidas++;
    porDia.set(d, x);
  }
  const tendencia = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, x]) => ({ dia, nota: Math.round(x.suma / x.n), chats: x.n, vendidas: x.vendidas }));

  // Errores más frecuentes (con un ejemplo cada uno)
  const errores = new Map<string, { n: number; ejemplo: string; chat: string }>();
  for (const a of evaluadas) for (const e of (a.errores ?? []) as any[]) {
    const x = errores.get(e.tipo) ?? { n: 0, ejemplo: e.descripcion, chat: a.conversation_id };
    x.n++;
    errores.set(e.tipo, x);
  }
  const topErrores = [...errores.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8)
    .map(([tipo, x]) => ({ tipo, etiqueta: ETIQUETA_ERROR[tipo] ?? tipo, n: x.n, ejemplo: x.ejemplo, chat: x.chat }));

  // Perfiles y su conversión (todas las auditorías, incluso las sin interacción)
  const perfiles = new Map<string, { n: number; vendidas: number; suma: number; evaluadas: number }>();
  for (const a of auds ?? []) {
    const p = a.perfil || 'otro';
    const x = perfiles.get(p) ?? { n: 0, vendidas: 0, suma: 0, evaluadas: 0 };
    x.n++; if (a.resultado === 'vendida') x.vendidas++;
    if (a.puntaje != null) { x.suma += a.puntaje; x.evaluadas++; }
    perfiles.set(p, x);
  }
  const listaPerfiles = [...perfiles.entries()].sort((a, b) => b[1].n - a[1].n).map(([perfil, x]) => ({
    perfil, etiqueta: ETIQUETA_PERFIL[perfil] ?? perfil, chats: x.n, vendidas: x.vendidas,
    conversion: x.n ? Math.round((x.vendidas / x.n) * 1000) / 10 : 0,
    nota: x.evaluadas ? Math.round(x.suma / x.evaluadas) : null,
  }));

  // Etapa más débil
  const etapas: Record<string, { suma: number; n: number }> = {};
  for (const a of evaluadas) for (const [k, v] of Object.entries(a.etapas ?? {})) {
    if (v == null) continue;
    etapas[k] = etapas[k] ?? { suma: 0, n: 0 };
    etapas[k].suma += Number(v); etapas[k].n++;
  }
  const notaEtapas = Object.fromEntries(Object.entries(etapas).map(([k, x]) => [k, Math.round(x.suma / x.n)]));

  const total = evaluadas.length;
  return NextResponse.json({
    dias,
    resumen: {
      auditadas: total,
      sinInteraccion: (auds ?? []).length - total,
      nota: total ? Math.round(evaluadas.reduce((s: number, a: any) => s + a.puntaje, 0) / total) : null,
      notaVendidas: (() => { const v = evaluadas.filter((a: any) => a.resultado === 'vendida'); return v.length ? Math.round(v.reduce((s: number, a: any) => s + a.puntaje, 0) / v.length) : null; })(),
      notaPerdidas: (() => { const v = evaluadas.filter((a: any) => a.resultado !== 'vendida'); return v.length ? Math.round(v.reduce((s: number, a: any) => s + a.puntaje, 0) / v.length) : null; })(),
      leccionesActivas: (lecciones ?? []).filter((l: any) => l.estado === 'aprobada').length,
      leccionesPorRevisar: (lecciones ?? []).filter((l: any) => l.estado === 'propuesta').length,
    },
    tendencia, topErrores, perfiles: listaPerfiles, notaEtapas,
    auditorias: evaluadas.slice(0, 40),
    lecciones: lecciones ?? [],
  });
}

/** POST: "Revisar ahora" — corre una tanda del supervisor. */
export async function POST() {
  if (!(await conSesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  try {
    const r = await correrSupervisor();
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 });
  }
}

/** PATCH: aprobar / desactivar una lección { id, accion: 'aprobar' | 'desactivar' }. */
export async function PATCH(req: NextRequest) {
  if (!(await conSesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id, accion } = await req.json().catch(() => ({}));
  if (!id || !['aprobar', 'desactivar'].includes(accion)) return NextResponse.json({ error: 'datos inválidos' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const cambios = accion === 'aprobar'
    ? { estado: 'aprobada', aprobada_at: new Date().toISOString() }
    : { estado: 'descartada' };   // descartada = el supervisor no la vuelve a proponer
  const { error } = await supabase.from('memoria_bot').update(cambios).eq('id', id).eq('origen', 'supervisor');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
