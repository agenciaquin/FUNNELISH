import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST (PÚBLICO): el cliente escribió nombre + teléfono pero aún no compra.
export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 200 }); }

  const slug = String(b?.slug ?? '').trim().toLowerCase();
  const telefono = String(b?.telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
  if (!slug || !/^3\d{9}$/.test(telefono)) return NextResponse.json({ ok: false }, { status: 200 });

  const fila = {
    slug, telefono,
    nombre:   b?.nombre   ? String(b.nombre).slice(0, 120)   : null,
    producto: b?.producto ? String(b.producto).slice(0, 200) : null,
    talla:    b?.talla    ? String(b.talla).slice(0, 120)    : null,
    valor:    Number(b?.valor) > 0 ? Number(b.valor) : null,
    updated_at: new Date().toISOString(),
  };

  try {
    const admin = createServerSupabaseClient();

    // Guardado SIN depender del índice único (slug,telefono): primero intenta
    // ACTUALIZAR la fila existente; si no existe ninguna, INSERTA. Así funciona
    // aunque el índice único no se haya creado (era la causa de la lista vacía).
    const { data: upd, error: uErr } = await admin
      .from('carritos_abandonados')
      .update(fila).eq('slug', slug).eq('telefono', telefono).select('id');

    if (uErr) {
      console.error('[carrito] update falló:', uErr.message);
    } else if (!upd || upd.length === 0) {
      const { error: iErr } = await admin.from('carritos_abandonados').insert(fila);
      if (iErr) console.error('[carrito] insert falló:', iErr.message);
    }
  } catch (e) { console.error('[carrito] error inesperado:', e); }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// GET: lista carritos abandonados no recuperados que NO terminaron comprando.
export async function GET(req: NextRequest) {
  const verRecuperados = req.nextUrl.searchParams.get('recuperados') === '1';
  const admin = createServerSupabaseClient();

  const { data: carritos, error } = await admin
    .from('carritos_abandonados')
    .select('id, slug, nombre, telefono, producto, talla, valor, recuperado, created_at')
    .eq('recuperado', verRecuperados)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = carritos ?? [];
  const tels = [...new Set(lista.map((c: any) => String(c.telefono)))];
  const compraron = new Set<string>();
  if (tels.length && !verRecuperados) {
    try {
      const { data: peds } = await admin.from('clientes_funnelish')
        .select('telefono').eq('confirmado', true).in('telefono', tels);
      for (const p of peds ?? []) compraron.add(String((p as any).telefono));
    } catch { /* si falla, se muestran todos */ }
  }

  const abiertos = verRecuperados ? lista : lista.filter((c: any) => !compraron.has(String(c.telefono)));

  // Diagnóstico: cuántos registros hay en TOTAL en la tabla (para distinguir
  // "tabla vacía" de "todos filtrados por ya compraron"). Si da error, es el grant.
  let totalTabla = 0;
  let permiso = true;
  try {
    const { count, error: cErr } = await admin
      .from('carritos_abandonados').select('*', { count: 'exact', head: true });
    if (cErr) permiso = false;
    totalTabla = count ?? 0;
  } catch { permiso = false; }

  return NextResponse.json({ carritos: abiertos, total: abiertos.length, totalTabla, permiso });
}

// PATCH: marca un carrito como recuperado o lo reabre.
export async function PATCH(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }
  const id = String(b?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  const recuperado = b?.recuperado !== false;

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('carritos_abandonados')
    .update({ recuperado, recuperado_at: recuperado ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
