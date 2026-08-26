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

  // TODOS los datos que el cliente alcanzó a escribir (dirección, ciudad, etc.)
  // se guardan en la columna jsonb `datos`.
  const extra = (b?.datos && typeof b.datos === 'object') ? b.datos : null;
  const fila: any = {
    slug, telefono,
    nombre:   b?.nombre   ? String(b.nombre).slice(0, 120)   : null,
    producto: b?.producto ? String(b.producto).slice(0, 200) : null,
    talla:    b?.talla    ? String(b.talla).slice(0, 120)    : null,
    valor:    Number(b?.valor) > 0 ? Number(b.valor) : null,
    datos:    extra,
    updated_at: new Date().toISOString(),
  };

  try {
    const admin = createServerSupabaseClient();

    // Guardado SIN depender del índice único (slug,telefono): primero intenta
    // ACTUALIZAR la fila existente; si no existe ninguna, INSERTA. Así funciona
    // aunque el índice único no se haya creado (era la causa de la lista vacía).
    const guardar = async (f: any) => {
      const { data: upd, error: uErr } = await admin
        .from('carritos_abandonados')
        .update(f).eq('slug', slug).eq('telefono', telefono).select('id');
      if (uErr) return uErr;
      if (!upd || upd.length === 0) {
        const { error: iErr } = await admin.from('carritos_abandonados').insert(f);
        return iErr ?? null;
      }
      return null;
    };

    let err = await guardar(fila);
    // Si la columna `datos` aún no existe (falta la migración), guarda sin ella.
    if (err && /datos/i.test(err.message)) {
      const { datos, ...sinDatos } = fila;
      err = await guardar(sinDatos);
    }
    if (err) console.error('[carrito] no se guardó:', err.message);
  } catch (e) { console.error('[carrito] error inesperado:', e); }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// GET: lista carritos abandonados no recuperados que NO terminaron comprando.
export async function GET(req: NextRequest) {
  const verRecuperados = req.nextUrl.searchParams.get('recuperados') === '1';
  const admin = createServerSupabaseClient();

  const pedir = (cols: string) => admin
    .from('carritos_abandonados')
    .select(cols)
    .eq('recuperado', verRecuperados)
    .order('created_at', { ascending: false })
    .limit(500);

  let { data: carritos, error } = await pedir('id, slug, nombre, telefono, producto, talla, valor, datos, nota, recuperado, created_at');
  // Si faltan columnas nuevas (datos / nota), NO rompas: vuelve a pedir sin ellas
  // para que los carritos sigan mostrándose igual.
  if (error && /datos|nota/i.test(error.message)) {
    ({ data: carritos, error } = await pedir('id, slug, nombre, telefono, producto, talla, valor, recuperado, created_at'));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = carritos ?? [];
  const tels = [...new Set(lista.map((c: any) => String(c.telefono)))];
  // Para cada teléfono, la fecha del pedido REALIZADO más reciente (cualquier estado
  // menos cancelado/duplicado). Si el cliente hizo un pedido en o después de crear el
  // carrito, ese carrito ya NO está abandonado → se saca de la lista.
  const ultimoPedido = new Map<string, string>();
  if (tels.length && !verRecuperados) {
    try {
      const { data: peds } = await admin.from('clientes_funnelish')
        .select('telefono, created_at, estado')
        .in('telefono', tels)
        .not('estado', 'in', '("cancelado","duplicado")');
      for (const p of peds ?? []) {
        const t = String((p as any).telefono);
        const ca = String((p as any).created_at ?? '');
        const prev = ultimoPedido.get(t);
        if (!prev || ca > prev) ultimoPedido.set(t, ca);
      }
    } catch { /* si falla, se muestran todos */ }
  }

  const abiertos = verRecuperados ? lista : lista.filter((c: any) => {
    const ped = ultimoPedido.get(String(c.telefono));
    // hay un pedido de ese teléfono creado en o después del carrito → ya compró → fuera
    return !(ped && ped >= String(c.created_at));
  });

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

// PATCH: marca un carrito como recuperado/reabre, o guarda una nota del asesor.
//  - { id, recuperado }  → marca/reabre
//  - { id, nota }        → guarda/actualiza la nota privada
export async function PATCH(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }
  const id = String(b?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const patch: any = {};
  if ('nota' in b) {
    patch.nota = b.nota ? String(b.nota).slice(0, 2000) : null;
  } else {
    const recuperado = b?.recuperado !== false;
    patch.recuperado = recuperado;
    patch.recuperado_at = recuperado ? new Date().toISOString() : null;
  }

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('carritos_abandonados').update(patch).eq('id', id);
  if (error) {
    if (/nota/i.test(error.message)) {
      return NextResponse.json({ error: 'Falta correr la migración: agrega la columna nota a carritos_abandonados.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE: elimina definitivamente carritos. ?id=x (uno) o ?ids=a,b,c (varios).
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const idsParam = sp.get('ids');
  const uno = sp.get('id');
  const ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : uno ? [uno] : [];
  if (ids.length === 0) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('carritos_abandonados').delete().in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
