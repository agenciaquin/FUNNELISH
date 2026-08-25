import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';
import {
  parsearReporteEffi, ESTADOS_NOTIFICAR, etiquetaEstado, fraseEstado,
  type EstadoCanon, type FilaEffi,
} from '@/lib/guias-effi';

export const maxDuration = 60;

// Orden de avance del envío (para quedarnos con el estado más adelantado si el
// mismo teléfono+guía aparece varias veces en el Excel).
const RANK: Record<EstadoCanon, number> = {
  anulado: 0, otro: 0, generada: 1, transito: 2, devuelto: 2,
  despachado: 3, reparto: 4, oficina: 5, entregado: 6,
};

export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // ── Leer el archivo ────────────────────────────────────────────────────────
  let buf: Buffer;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    buf = Buffer.from(await (file as File).arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo.' }, { status: 400 });
  }

  // ── Parsear ────────────────────────────────────────────────────────────────
  let filas: FilaEffi[];
  try {
    filas = parsearReporteEffi(buf);
  } catch (e: any) {
    console.error('[GuiasEffi] parse error:', e?.message);
    return NextResponse.json({ error: 'No se pudo leer el reporte. ¿Es el Excel de Effi?' }, { status: 400 });
  }
  if (!filas.length) return NextResponse.json({ error: 'El archivo no tiene filas con teléfono válido.' }, { status: 400 });

  // ── Quedarnos con UNA fila por (teléfono+guía): el estado más adelantado ─────
  const porClave = new Map<string, FilaEffi>();
  for (const f of filas) {
    if (!f.guia) continue;
    const clave = `${f.telefono}|${f.guia}`;
    const prev = porClave.get(clave);
    if (!prev || RANK[f.estado] >= RANK[prev.estado]) porClave.set(clave, f);
  }
  const unicas = [...porClave.values()];

  const supabase = createServerSupabaseClient();

  // ── ¿Qué teléfonos tienen chat en esta tienda? (solo a esos se les escribe) ──
  const waIds = [...new Set(unicas.map(f => `57${f.telefono}`))];
  const conChat = new Set<string>();
  for (let i = 0; i < waIds.length; i += 500) {
    const trozo = waIds.slice(i, i + 500);
    const { data } = await supabase.from('conversations').select('id').eq('tenant_id', tid).in('id', trozo);
    for (const c of (data ?? [])) conChat.add(String((c as any).id));
  }

  // ── Estado ya notificado antes (para no repetir) ─────────────────────────────
  const yaNotificado = new Map<string, string | null>(); // clave tel|guia → estado_notificado
  for (let i = 0; i < unicas.length; i += 500) {
    const trozo = unicas.slice(i, i + 500);
    const tels = [...new Set(trozo.map(f => f.telefono))];
    const { data } = await supabase.from('guias_effi')
      .select('telefono, guia, estado_notificado').eq('tenant_id', tid).in('telefono', tels);
    for (const r of (data ?? [])) yaNotificado.set(`${(r as any).telefono}|${(r as any).guia}`, (r as any).estado_notificado ?? null);
  }

  // ── Upsert del estado actual (sin tocar estado_notificado) ───────────────────
  const ahora = new Date().toISOString();
  const upserts = unicas.map(f => ({
    tenant_id: tid, telefono: f.telefono, guia: f.guia, nombre: f.nombre,
    estado_raw: f.estadoRaw, estado: f.estado, updated_at: ahora,
  }));
  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await supabase.from('guias_effi')
      .upsert(upserts.slice(i, i + 500), { onConflict: 'tenant_id,telefono,guia' });
    if (error) {
      if (/relation .*guias_effi.* does not exist|guias_effi/i.test(error.message ?? '') && /does not exist/i.test(error.message ?? '')) {
        return NextResponse.json({ error: 'Falta crear la tabla. Corre el SQL sql/guias-effi.sql en Supabase.' }, { status: 400 });
      }
      console.error('[GuiasEffi] upsert error:', error.message);
    }
  }

  // ── Armar la previsualización ────────────────────────────────────────────────
  const aEnviar: any[] = [];
  const res = { total: unicas.length, aEnviar: 0, sinCambio: 0, sinChat: 0, noNotificable: 0, anulados: 0 };

  for (const f of unicas) {
    const waId = `57${f.telefono}`;
    if (f.estado === 'anulado' || /anulad/i.test(f.remision)) { res.anulados++; continue; }
    if (!ESTADOS_NOTIFICAR.includes(f.estado)) { res.noNotificable++; continue; }
    if (!conChat.has(waId)) { res.sinChat++; continue; }
    const prev = yaNotificado.get(`${f.telefono}|${f.guia}`) ?? null;
    if (prev === f.estado) { res.sinCambio++; continue; }
    aEnviar.push({
      telefono: f.telefono, waId, nombre: f.nombre, guia: f.guia,
      estado: f.estado, etiqueta: etiquetaEstado(f.estado), frase: fraseEstado(f.estado),
    });
  }
  res.aEnviar = aEnviar.length;

  return NextResponse.json({ resumen: res, aEnviar });
}
