import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * Guarda el gasto de publicidad leído de un Excel de TikTok o Meta.
 * Si se vuelve a subir el mismo día y campaña, se reemplaza (no se duplica).
 */
export async function POST(req: NextRequest) {
  try {
    const { plataforma, filas } = await req.json();

    if (!plataforma || !Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No llegó ninguna fila para guardar.' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const ahora = new Date().toISOString();

    const registros = filas
      .filter((f: any) => f?.campana && String(f.campana).trim())
      .map((f: any) => ({
        plataforma:   String(plataforma),
        campana:      String(f.campana).trim(),
        campana_id:   String(f.campanaId ?? '').trim() || null,
        estado:       String(f.estado ?? '') || null,
        fecha:        String(f.fecha),
        gasto:        Number(f.gasto ?? 0),
        conversiones: Number(f.conversiones ?? 0),
        impresiones:  Number(f.impresiones ?? 0),
        clics:        Number(f.clics ?? 0),
        actualizado_at: ahora,
      }));

    if (registros.length === 0) {
      return NextResponse.json({ error: 'El archivo no tenía filas válidas.' }, { status: 400 });
    }

    // Borrar lo que ya existiera de esos días y plataforma, para no duplicar
    const fechas = [...new Set(registros.map(r => r.fecha))];
    for (const fecha of fechas) {
      await supabase.from('campanas_gasto')
        .delete().eq('plataforma', plataforma).eq('fecha', fecha);
    }

    let { error } = await supabase.from('campanas_gasto').insert(registros);

    // Si la base todavía no tiene las columnas nuevas, se guarda sin ellas
    // en vez de perder los datos, y se avisa qué falta.
    let faltanColumnas: string | null = null;
    if (error && /column .*(estado|campana_id).* does not exist/i.test(error.message)) {
      faltanColumnas = error.message;
      const basicos = registros.map(({ estado, campana_id, ...resto }) => resto);
      const reintento = await supabase.from('campanas_gasto').insert(basicos);
      error = reintento.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const total      = registros.reduce((s, r) => s + r.gasto, 0);
    const conEstado  = registros.filter(r => r.estado).length;
    const conId      = registros.filter(r => r.campana_id).length;

    return NextResponse.json({
      ok: true, guardadas: registros.length, fechas, total, conEstado, conId,
      aviso: faltanColumnas
        ? 'La base de datos aún no tiene las columnas de estado/identificador. Se guardó el gasto pero no el estado.'
        : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}
