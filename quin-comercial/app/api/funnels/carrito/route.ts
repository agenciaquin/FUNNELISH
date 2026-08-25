import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ── POST (PÚBLICO): el cliente escribió nombre + teléfono pero aún no compra.
//    Se guarda como "carrito abandonado" para poder recuperarlo llamándolo.
//    El tenant se deriva del embudo por su slug (nunca se confía en el cliente).
export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 200 }); }

  const slug = String(b?.slug ?? '').trim().toLowerCase();
  const telefono = String(b?.telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
  if (!slug || !/^3\d{9}$/.test(telefono)) return NextResponse.json({ ok: false }, { status: 200 });

  try {
    const admin = createServerSupabaseClient();
    const { data: f } = await admin.from('funnels').select('tenant_id').eq('slug', slug).maybeSingle();

    const txt = (v: any, n = 200) => (v != null && String(v).trim() ? String(v).trim().slice(0, n) : null);
    const fila: Record<string, any> = {
      tenant_id: f?.tenant_id ?? null,
      slug,
      telefono,
      nombre:   txt(b?.nombre, 120),
      producto: txt(b?.producto, 200),
      talla:    txt(b?.talla, 120),
      valor:    Number(b?.valor) > 0 ? Number(b.valor) : null,
      // Datos que el cliente alcanzó a llenar (parciales, se actualizan mientras escribe)
      apellidos:    txt(b?.apellidos, 120),
      correo:       txt(b?.correo, 160),
      direccion:    txt(b?.direccion, 200),
      barrio:       txt(b?.barrio, 120),
      ciudad:       txt(b?.municipio ?? b?.ciudad, 120),
      departamento: txt(b?.departamento, 120),
      // Blob completo: todos los campos que llenó + selección + fotos elegidas.
      datos: (b?.datos && typeof b.datos === 'object') ? b.datos : null,
      updated_at: new Date().toISOString(),
    };

    // Upsert por (tenant, slug, teléfono): se va actualizando mientras llena el form.
    let { error } = await admin.from('carritos_abandonados').upsert(fila, { onConflict: 'tenant_id,slug,telefono' });
    // Si la BD aún no tiene las columnas nuevas, se reintenta sin ellas (no romper).
    if (error && /column|apellidos|correo|direccion|barrio|ciudad|departamento|datos|nota/i.test(error.message ?? '')) {
      const { apellidos, correo, direccion, barrio, ciudad, departamento, datos, ...base } = fila;
      await admin.from('carritos_abandonados').upsert(base, { onConflict: 'tenant_id,slug,telefono' });
    }
  } catch { /* nunca romper la página del cliente */ }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ── GET (SESIÓN): lista los carritos abandonados del tenant que NO se recuperaron
//    y que NO terminaron comprando (se cruza contra los pedidos confirmados).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const verRecuperados = req.nextUrl.searchParams.get('recuperados') === '1';
  const admin = createServerSupabaseClient();

  const COLS_FULL = 'id, slug, nombre, telefono, producto, talla, valor, recuperado, created_at, apellidos, correo, direccion, barrio, ciudad, departamento, datos, nota';
  const COLS_BASE = 'id, slug, nombre, telefono, producto, talla, valor, recuperado, created_at';
  const consulta = (cols: string) => admin
    .from('carritos_abandonados')
    .select(cols)
    .eq('tenant_id', tid)
    .eq('recuperado', verRecuperados)
    .order('created_at', { ascending: false })
    .limit(500);

  let { data: carritos, error } = await consulta(COLS_FULL);
  // Si la BD aún no tiene las columnas nuevas, se cae a las básicas (sin romper).
  if (error && /column|apellidos|correo|direccion|barrio|ciudad|departamento|datos|nota/i.test(error.message ?? '')) {
    ({ data: carritos, error } = await consulta(COLS_BASE));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = carritos ?? [];

  // Excluir los que YA compraron (tienen pedido confirmado con ese teléfono).
  const tels = [...new Set(lista.map((c: any) => String(c.telefono)))];
  const compraron = new Set<string>();
  if (tels.length) {
    try {
      const { data: peds } = await admin.from('clientes_funnelish')
        .select('telefono').eq('tenant_id', tid).eq('confirmado', true).in('telefono', tels);
      for (const p of peds ?? []) compraron.add(String((p as any).telefono));
    } catch { /* si falla, se muestran todos */ }
  }

  const abiertos = verRecuperados ? lista : lista.filter((c: any) => !compraron.has(String(c.telefono)));
  return NextResponse.json({ carritos: abiertos, total: abiertos.length });
}

// ── PATCH (SESIÓN): dos usos según el body:
//    { id, nota }        → guarda/edita la nota privada del asesor.
//    { id, recuperado? } → marca el carrito como recuperado (ya lo llamé) o lo reabre.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }

  const admin = createServerSupabaseClient();

  // Acción en LOTE: { ids: [...], recuperado } → marca/reabre varios de una.
  const ids = Array.isArray(b?.ids) ? b.ids.map((x: any) => String(x)).filter(Boolean) : [];
  if (ids.length) {
    const recuperado = b?.recuperado !== false;
    const { error } = await admin.from('carritos_abandonados')
      .update({ recuperado, recuperado_at: recuperado ? new Date().toISOString() : null })
      .in('id', ids).eq('tenant_id', tid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, afectados: ids.length });
  }

  const id = String(b?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  // Guardar/editar nota privada.
  if ('nota' in (b ?? {})) {
    const nota = b?.nota != null && String(b.nota).trim() ? String(b.nota).trim().slice(0, 2000) : null;
    const { error } = await admin.from('carritos_abandonados')
      .update({ nota }).eq('id', id).eq('tenant_id', tid);
    if (error) {
      if (/column|nota/i.test(error.message ?? '')) {
        return NextResponse.json({ error: 'Falta correr la migración sql/carrito-datos-nota.sql en Supabase.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Marcar recuperado / reabrir.
  const recuperado = b?.recuperado !== false;
  const { error } = await admin.from('carritos_abandonados')
    .update({ recuperado, recuperado_at: recuperado ? new Date().toISOString() : null })
    .eq('id', id).eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE (SESIÓN): borra DE VERDAD carritos abandonados. ?id=x (uno) o
//    ?ids=a,b,c (varios). Es real (no papelera): descarta "ventas" que no cierran.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  const idsParam = req.nextUrl.searchParams.get('ids');
  const lista = idsParam
    ? idsParam.split(',').map(s => s.trim()).filter(Boolean)
    : (id ? [id] : []);
  if (!lista.length) return NextResponse.json({ error: 'falta id' }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('carritos_abandonados')
    .delete().in('id', lista).eq('tenant_id', tid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, borrados: lista.length });
}
