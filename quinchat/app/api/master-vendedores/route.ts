import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { ajustesVV, guardarAjustesVV } from '@/lib/ventas-vendedores/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * MASTER VENDEDORES (08-nov-2026) — módulo nuevo e independiente.
 * Solo LEE lo que ya existe:
 *  · mv_vendedores            → vendedores de Effi (tercero, nombre, teléfonos).
 *  · vv_ventas / vv_items     → ventas que el bot recibió por WhatsApp desde los teléfonos del vendedor.
 *  · effi_remisiones_api      → ventas ya subidas a Effi con ese vendedor (copia de Effi, cada hora).
 *  · vv_eventos, effi_sync_log → actividad.
 * Escribe solo en mv_vendedores (nombre, teléfonos, meta, foto) y, con el interruptor de cada vendedor,
 * en ajustes_bot.ventas_vendedores.numeros_reales (recepción de ventas por WhatsApp; apagada por defecto).
 *
 *  GET                      → vendedores + contadores + resumen del día + actividad
 *  GET ?vendedor=<tercero>  → ventas del vendedor (por subir / pendientes / incidencias / en Effi)
 *  PUT  {tercero, nombre?, telefono_principal?, telefonos_extra?, meta_mes?, foto?}
 *  POST {tercero, accion:'recepcion', activar}
 */
const POR_SUBIR = ['confirmada', 'lista_effi'];
const PENDIENTES = ['recibida', 'incompleta', 'ambigua', 'esperando_confirmacion'];
const INCIDENCIAS = ['error_effi', 'escalada'];
const tel57 = (t: unknown) => { const d = String(t ?? '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `57${d}` : ''; };
const norm = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const inicioDiaCol = () => { const d = new Date(Date.now() - 5 * 3600_000); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() + 5 * 3600_000); };
const inicioMesCol = () => { const d = new Date(Date.now() - 5 * 3600_000); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() + 5 * 3600_000); };

async function cargarBase() {
  const supabase = createServerSupabaseClient();
  const { data: vend } = await supabase.from('mv_vendedores').select('*').eq('activo', true).order('orden');
  const vendedores = (vend ?? []) as any[];
  const telDe = new Map<string, number>();
  for (const v of vendedores) for (const t of [v.telefono_principal, ...(v.telefonos_extra ?? [])].map(tel57).filter(Boolean)) telDe.set(t, v.tercero);
  const nombreDe = new Map(vendedores.map(v => [norm(v.nombre_effi), v.tercero]));
  return { supabase, vendedores, telDe, nombreDe };
}

export async function GET(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const { supabase, vendedores, telDe, nombreDe } = await cargarBase();
  const tels = [...telDe.keys()];
  const nombresEffi = vendedores.map(v => v.nombre_effi);
  const sp = req.nextUrl.searchParams;
  const ajustes = await ajustesVV(true);
  const reales = new Set(ajustes.numeros_reales);

  // ── Ventas de UN vendedor ──
  if (sp.get('vendedor')) {
    const v = vendedores.find(x => String(x.tercero) === sp.get('vendedor'));
    if (!v) return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
    const misTels = [v.telefono_principal, ...(v.telefonos_extra ?? [])].map(tel57).filter(Boolean);
    const desde = new Date(Date.now() - 45 * 86400_000).toISOString();
    const [{ data: ventas }, { data: rems }, { data: papelera }] = await Promise.all([
      supabase.from('vv_ventas').select('*').in('vendedor_tel', misTels.length ? misTels : ['-'])
        .neq('estado', 'cancelada').order('creado_at', { ascending: false }).limit(300),
      supabase.from('effi_remisiones_api').select('id_effi, id_transaccion, telefono, nombre, ciudad, departamento, direccion, estado, total, guia, fecha_trans, vendedor')
        .ilike('vendedor', v.nombre_effi).gte('fecha_trans', desde).order('fecha_trans', { ascending: false }).limit(300),
      supabase.from('vv_ventas').select('id, codigo, cliente_nombre, cliente_celular, municipio, total, creado_at, papelera_at, papelera_motivo, papelera_por, estado_previo, fotos_vendedor')
        .in('vendedor_tel', misTels.length ? misTels : ['-']).not('papelera_at', 'is', null).order('papelera_at', { ascending: false }).limit(100),
    ]);
    const ids = (ventas ?? []).map((x: any) => x.id);
    const { data: items } = ids.length ? await supabase.from('vv_items').select('*').in('venta_id', ids).order('id') : { data: [] as any[] };
    const porVenta = new Map<string, any[]>();
    for (const it of (items ?? []) as any[]) porVenta.set(it.venta_id, [...(porVenta.get(it.venta_id) ?? []), it]);
    const remDeVV = new Set((ventas ?? []).map((x: any) => String(x.effi_remision ?? '')).filter(Boolean));
    return NextResponse.json({
      vendedor: { ...v, recepcion: misTels.some(t => reales.has(t)) },
      ventas: (ventas ?? []).map((x: any) => ({ ...x, items: porVenta.get(x.id) ?? [] })),
      // Remisiones en Effi de este vendedor que NO vienen de una venta del bot (subidas a mano)
      remisiones: ((rems ?? []) as any[]).filter(r => !/anulad/i.test(String(r.estado ?? '')) && !remDeVV.has(String(r.id_effi))),
      papelera: papelera ?? [],
    });
  }

  // ── Lista de vendedores + resumen ──
  const mes = inicioMesCol().toISOString(), hoy = inicioDiaCol().getTime();
  const [{ data: ventas }, { data: rems }, { data: sync }] = await Promise.all([
    tels.length ? supabase.from('vv_ventas').select('id, vendedor_tel, estado, total, creado_at, effi_remision, cliente_nombre, codigo')
      .in('vendedor_tel', tels).neq('estado', 'cancelada').gte('creado_at', mes).limit(3000) : Promise.resolve({ data: [] as any[] }),
    supabase.from('effi_remisiones_api').select('id_effi, vendedor, total, estado, fecha_trans, nombre')
      .in('vendedor', nombresEffi).gte('fecha_trans', mes).limit(5000),
    supabase.from('effi_sync_log').select('inicio, fin, ok, remisiones').order('inicio', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ids = ((ventas ?? []) as any[]).map(v => v.id);
  const unidades = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data: it } = await supabase.from('vv_items').select('venta_id, cantidad').in('venta_id', ids.slice(i, i + 300));
    for (const x of (it ?? []) as any[]) unidades.set(x.venta_id, (unidades.get(x.venta_id) ?? 0) + (Number(x.cantidad) || 0));
  }
  const vivas = ((rems ?? []) as any[]).filter(r => !/anulad/i.test(String(r.estado ?? '')));
  const stats = new Map<number, any>();
  const st = (t: number) => { if (!stats.has(t)) stats.set(t, { por_subir: 0, pendientes: 0, incidencias: 0, en_effi_mes: 0, valor_mes: 0, valor_por_subir: 0, unidades_por_subir: 0, ventas_mes: 0 }); return stats.get(t); };
  const remDeVV = new Set<string>();
  for (const v of (ventas ?? []) as any[]) {
    const t = telDe.get(v.vendedor_tel); if (t == null) continue;
    const s = st(t);
    if (POR_SUBIR.includes(v.estado)) { s.por_subir++; s.valor_por_subir += Number(v.total) || 0; s.unidades_por_subir += unidades.get(v.id) ?? 0; }
    else if (PENDIENTES.includes(v.estado)) s.pendientes++;
    else if (INCIDENCIAS.includes(v.estado)) s.incidencias++;
    if (v.effi_remision) remDeVV.add(String(v.effi_remision));
  }
  for (const r of vivas) {
    const t = nombreDe.get(norm(r.vendedor)); if (t == null) continue;
    const s = st(t); s.en_effi_mes++; s.valor_mes += Number(r.total) || 0;
  }
  for (const v of vendedores) { const s = st(v.tercero); s.ventas_mes = s.en_effi_mes + s.por_subir + s.pendientes + s.incidencias; s.valor_mes += s.valor_por_subir; }

  // Resumen del día (todos los vendedores del módulo)
  const deHoy = (iso: string) => new Date(iso).getTime() >= hoy;
  const ventasHoy = ((ventas ?? []) as any[]).filter(v => deHoy(v.creado_at));
  const resumenDia = {
    enviadas_effi: vivas.filter(r => deHoy(r.fecha_trans)).length,
    por_subir: [...stats.values()].reduce((a, s) => a + s.por_subir, 0),
    unidades: ventasHoy.reduce((a, v) => a + (unidades.get(v.id) ?? 0), 0),
    pendientes: [...stats.values()].reduce((a, s) => a + s.pendientes + s.incidencias, 0),
  };

  // Actividad reciente: remisiones de estos vendedores + eventos del bot con sus ventas
  const { data: evs } = ids.length ? await supabase.from('vv_eventos').select('venta_id, tipo, creado_at, detalle')
    .in('venta_id', ids.slice(0, 300)).order('creado_at', { ascending: false }).limit(12) : { data: [] as any[] };
  const ventaPorId = new Map(((ventas ?? []) as any[]).map(v => [v.id, v]));
  const actividad = [
    ...vivas.slice().sort((a, b) => String(b.fecha_trans).localeCompare(String(a.fecha_trans))).slice(0, 8).map(r => ({
      tipo: 'effi', fecha: r.fecha_trans, titulo: `Venta en Effi #${r.id_effi}`, detalle: `${r.nombre ?? ''} · ${vendedores.find(v => v.tercero === nombreDe.get(norm(r.vendedor)))?.nombre ?? r.vendedor}`,
    })),
    ...((evs ?? []) as any[]).map(e => ({
      tipo: e.tipo, fecha: e.creado_at, titulo: ({ recibida: 'Venta recibida por WhatsApp', effi_enviada: 'Venta enviada a Effi', effi_error: 'Error al subir a Effi' } as any)[e.tipo] ?? e.tipo,
      detalle: `${ventaPorId.get(e.venta_id)?.cliente_nombre ?? ''} · ${ventaPorId.get(e.venta_id)?.codigo ?? ''}`,
    })),
  ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 10);

  return NextResponse.json({
    vendedores: vendedores.map(v => ({
      ...v, stats: st(v.tercero),
      recepcion: [v.telefono_principal, ...(v.telefonos_extra ?? [])].map(tel57).some(t => reales.has(t)),
    })),
    resumen_dia: resumenDia,
    actividad,
    sync: sync ?? null,
    modulo_activo: ajustes.activo,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => null);
  const tercero = Number(b?.tercero);
  if (!tercero) return NextResponse.json({ error: 'Falta el vendedor' }, { status: 400 });
  const cambio: Record<string, any> = { actualizado_at: new Date().toISOString() };
  if (typeof b.nombre === 'string' && b.nombre.trim()) cambio.nombre = b.nombre.trim().slice(0, 80);
  if (b.telefono_principal != null) {
    const t = tel57(b.telefono_principal);
    if (!t) return NextResponse.json({ error: 'El teléfono principal debe tener 10 dígitos.' }, { status: 400 });
    cambio.telefono_principal = t;
  }
  if (Array.isArray(b.telefonos_extra)) {
    const extra = [...new Set(b.telefonos_extra.map(tel57).filter(Boolean))];
    if (b.telefonos_extra.some((x: any) => String(x ?? '').trim() && !tel57(x))) return NextResponse.json({ error: 'Cada teléfono debe tener 10 dígitos.' }, { status: 400 });
    cambio.telefonos_extra = extra;
  }
  if ('meta_mes' in (b ?? {})) cambio.meta_mes = Number(b.meta_mes) > 0 ? Math.round(Number(b.meta_mes)) : null;
  if ('foto' in (b ?? {})) cambio.foto = b.foto || null;
  const supabase = createServerSupabaseClient();
  // Un teléfono no puede quedar en dos vendedores
  const nuevos = [cambio.telefono_principal, ...(cambio.telefonos_extra ?? [])].filter(Boolean);
  if (nuevos.length) {
    const { data: otros } = await supabase.from('mv_vendedores').select('tercero, nombre, telefono_principal, telefonos_extra').neq('tercero', tercero);
    for (const o of (otros ?? []) as any[]) {
      const suyos = [o.telefono_principal, ...(o.telefonos_extra ?? [])];
      const choque = nuevos.find(t => suyos.includes(t));
      if (choque) return NextResponse.json({ error: `El ${choque.slice(2)} ya es de ${o.nombre}.` }, { status: 409 });
    }
  }
  const { data, error } = await supabase.from('mv_vendedores').update(cambio).eq('tercero', tercero).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, vendedor: data });
}

export async function POST(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => null);
  if (b?.accion !== 'recepcion') return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  const supabase = createServerSupabaseClient();
  const { data: v } = await supabase.from('mv_vendedores').select('*').eq('tercero', Number(b.tercero)).maybeSingle();
  if (!v) return NextResponse.json({ error: 'Vendedor no encontrado' }, { status: 404 });
  const suyos = [v.telefono_principal, ...(v.telefonos_extra ?? [])].map(tel57).filter(Boolean);
  const a = await ajustesVV(true);
  const reales = new Set(a.numeros_reales);
  for (const t of suyos) b.activar ? reales.add(t) : reales.delete(t);
  const nuevo = await guardarAjustesVV({ numeros_reales: [...reales] });
  return NextResponse.json({ ok: true, recepcion: !!b.activar, numeros_reales: nuevo.numeros_reales });
}
