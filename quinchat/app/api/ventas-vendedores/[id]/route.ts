import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { ESTADOS_BLOQUEADOS } from '@/lib/ventas-vendedores/estados';
import { resolverVariante } from '@/lib/ventas-vendedores/ia';

export const dynamic = 'force-dynamic';

/** Detalle de una preventa: venta + prendas + historial + fotos del vendedor. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const { id } = await params;
  const supabase = createServerSupabaseClient();
  const [v, it, ev] = await Promise.all([
    Promise.resolve(supabase.from('vv_ventas').select('*').eq('id', id).maybeSingle()),
    Promise.resolve(supabase.from('vv_items').select('*').eq('venta_id', id).order('id')),
    Promise.resolve(supabase.from('vv_eventos').select('*').eq('venta_id', id).order('creado_at', { ascending: true })),
  ]);
  if (!v.data) return NextResponse.json({ error: 'no encontrada' }, { status: 404 });
  // Colores y tallas disponibles de cada producto (para editar sin inventar variantes)
  const idsItem = [...new Set((it.data ?? []).map((i: any) => i.id_item).filter(Boolean))];
  const opciones: Record<number, { color: string; talla: string }[]> = {};
  if (idsItem.length) {
    const { data: vars } = await supabase.from('vv_cat_variantes').select('id_item, color, talla').in('id_item', idsItem).eq('activo', true);
    for (const x of vars ?? []) (opciones[x.id_item] ??= []).push({ color: x.color, talla: x.talla });
  }
  return NextResponse.json({ venta: v.data, items: it.data ?? [], eventos: ev.data ?? [], opciones });
}

const CAMPOS = ['cliente_nombre', 'cliente_celular', 'cliente_identificacion', 'cliente_correo', 'departamento', 'municipio', 'direccion', 'barrio',
  'complemento', 'referencia_dir', 'transportadora', 'tipo_pago', 'total', 'abono', 'observaciones'] as const;

/** Corrección autorizada desde el panel (solo si aún no está en Effi). Deja motivo y usuario. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const session = await getServerSession(authOptions);
  const quien = session?.user?.name || session?.user?.email || 'panel';
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const motivo = String(b.motivo ?? '').trim().slice(0, 300);
  const supabase = createServerSupabaseClient();
  const { data: venta } = await supabase.from('vv_ventas').select('*').eq('id', id).maybeSingle();
  if (!venta) return NextResponse.json({ error: 'no encontrada' }, { status: 404 });
  if (ESTADOS_BLOQUEADOS.includes(venta.estado) || venta.effi_remision) {
    return NextResponse.json({ error: 'Esta venta ya está en Effi. Los cambios van por Novedades.' }, { status: 409 });
  }
  const ahora = new Date().toISOString();

  // PAPELERA (09-nov-2026, dueño): eliminar una venta antes de subirla (prueba, duplicada…) con MOTIVO obligatorio.
  // No se borra: queda en la papelera con motivo, fecha y quién; se puede restaurar.
  if (b.accion === 'papelera') {
    if (motivo.length < 3) return NextResponse.json({ error: 'Escribe el motivo por el que se elimina.' }, { status: 400 });
    await supabase.from('vv_ventas').update({
      estado: 'cancelada', estado_previo: venta.estado, papelera_at: ahora, papelera_motivo: motivo, papelera_por: quien, actualizado_at: ahora,
    }).eq('id', id);
    await supabase.from('vv_eventos').insert({ venta_id: id, tipo: 'papelera', quien, detalle: { motivo, antes: venta.estado } });
    return NextResponse.json({ ok: true });
  }
  if (b.accion === 'restaurar') {
    if (!venta.papelera_at) return NextResponse.json({ error: 'La venta no está en la papelera.' }, { status: 400 });
    const vuelve = venta.estado_previo && venta.estado_previo !== 'cancelada' ? venta.estado_previo : 'incompleta';
    const { error: errR } = await supabase.from('vv_ventas').update({ estado: vuelve, papelera_at: null, papelera_motivo: null, papelera_por: null, estado_previo: null, actualizado_at: ahora }).eq('id', id);
    if (errR) return NextResponse.json({ error: /duplicate|unique/i.test(errR.message) ? 'El vendedor ya tiene otra venta abierta; termínala antes de restaurar esta.' : errR.message }, { status: 409 });
    await supabase.from('vv_eventos').insert({ venta_id: id, tipo: 'restaurada', quien, detalle: { motivo_eliminacion: venta.papelera_motivo, vuelve } });
    return NextResponse.json({ ok: true });
  }

  // Acciones de estado
  const ACCIONES: Record<string, string> = { cancelar: 'cancelada', escalar: 'escalada', confirmar: 'confirmada', reabrir: 'confirmada' };
  if (b.accion && ACCIONES[b.accion]) {
    const nuevo = ACCIONES[b.accion];
    await supabase.from('vv_ventas').update({ estado: nuevo, motivo_revision: b.accion === 'escalar' ? motivo || 'Escalada desde el panel' : venta.motivo_revision, actualizado_at: ahora, ...(nuevo === 'confirmada' && !venta.confirmado_at ? { confirmado_at: ahora } : {}) }).eq('id', id);
    await supabase.from('vv_eventos').insert({ venta_id: id, tipo: `accion_${b.accion}`, quien, detalle: { motivo, antes: venta.estado, despues: nuevo } });
    return NextResponse.json({ ok: true });
  }

  // Campos de la venta
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
  const upd: any = {};
  for (const k of CAMPOS) {
    if (b.campos && k in b.campos) {
      let val: any = b.campos[k];
      if (k === 'total' || k === 'abono') val = Number(String(val ?? '').replace(/[^\d]/g, '')) || null;
      else val = String(val ?? '').trim() || null;
      if (k === 'cliente_celular' && val) val = String(val).replace(/\D/g, '').slice(-10);
      if (String(val ?? '') !== String(venta[k] ?? '')) { upd[k] = val; cambios[k] = { antes: venta[k], despues: val }; }
    }
  }
  if (Object.keys(upd).length) await supabase.from('vv_ventas').update({ ...upd, actualizado_at: ahora }).eq('id', id);

  // Prendas: talla/color/cantidad/precio. Talla o color → se recalcula la variante real.
  const problemas: string[] = [];
  for (const it of Array.isArray(b.items) ? b.items : []) {
    const { data: actual } = await supabase.from('vv_items').select('*').eq('id', it.id).eq('venta_id', id).maybeSingle();
    if (!actual) continue;
    const u: any = {};
    if (it.cantidad != null) u.cantidad = Math.max(1, Math.min(50, Number(it.cantidad) || 1));
    if (it.precio != null) u.precio = Number(String(it.precio).replace(/[^\d]/g, '')) || null;
    const talla = it.talla ?? actual.talla;
    const color = it.color ?? actual.color;
    if ((it.talla != null && it.talla !== actual.talla) || (it.color != null && it.color !== actual.color)) {
      if (!actual.id_item) { problemas.push('La prenda no tiene producto identificado'); continue; }
      const r = await resolverVariante(actual.id_item, color ?? '', talla ?? '');
      if (!r.variante) { problemas.push(`No existe ${actual.catalogo} en color ${color} talla ${talla}`); continue; }
      Object.assign(u, { talla: r.variante.talla, color: r.variante.color, id_variante: r.variante.id, sku: r.variante.sku, estado: 'ok' });
    }
    if (Object.keys(u).length) {
      await supabase.from('vv_items').update(u).eq('id', actual.id);
      cambios[`prenda_${actual.id}`] = { antes: { talla: actual.talla, color: actual.color, cantidad: actual.cantidad, precio: actual.precio, id_variante: actual.id_variante }, despues: u };
    }
  }
  if (Object.keys(cambios).length) {
    await supabase.from('vv_eventos').insert({ venta_id: id, tipo: 'edicion', quien, detalle: { motivo, cambios } });
  }
  return NextResponse.json({ ok: problemas.length === 0, problemas, cambios: Object.keys(cambios).length });
}
