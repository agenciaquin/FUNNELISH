import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

/** Revisa qué embudos hay cargados y si la tabla responde. */
export async function GET() {
  try {
    const tid = await tenantActual();
    if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('funnels')
      .select('slug, activo, producto, precio, whatsapp')
      .eq('tenant_id', tid);

    if (error) {
      return NextResponse.json({
        ok: false,
        problema: 'La consulta a la tabla falló',
        detalle: error.message,
        pista: error.message.includes('does not exist')
          ? 'La tabla funnels no existe: falta correr el SQL.'
          : error.message.includes('permission')
          ? 'Faltan los permisos GRANT sobre la tabla.'
          : 'Revisa el mensaje de error.',
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      cuantos: data?.length ?? 0,
      embudos: data ?? [],
      pista: (data?.length ?? 0) === 0
        ? 'La tabla existe pero está vacía: el INSERT no guardó nada.'
        : 'Todo bien. Abre /p/ + el slug que aparece aquí.',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, problema: 'Error inesperado', detalle: e?.message }, { status: 500 });
  }
}
