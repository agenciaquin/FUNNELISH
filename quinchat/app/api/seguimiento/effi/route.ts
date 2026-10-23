import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ESTADOS_VALIDOS = ['entregada', 'en_camino', 'devuelta', 'novedad', 'anulada'];

/** Devuelve TODAS las guías de Effi guardadas (teléfono → estado + flete).
 *  Se pagina de a 1000 porque Supabase devuelve máximo 1000 filas por consulta;
 *  si hay más guías que eso, sin paginar el cruce dejaba ventas como "sin subir"
 *  aunque sí estuvieran en Effi. */
export async function GET() {
  const supabase = createServerSupabaseClient();
  const todas: any[] = [];
  const PAGE = 1000;
  for (let desde = 0; desde < 100000; desde += PAGE) {
    const { data, error } = await supabase
      .from('effi_guias').select('telefono, estado, flete, motivo')
      .range(desde, desde + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    todas.push(...data);
    if (data.length < PAGE) break;
  }
  return NextResponse.json({ guias: todas });
}

/**
 * Guarda/actualiza el cruce de Effi. Cada Excel que se sube ACTUALIZA el
 * anterior: los teléfonos que ya existían se actualizan, los nuevos se agregan,
 * y lo que ya estaba y no vino en este archivo se conserva.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const filas = Array.isArray(body?.guias) ? body.guias : [];
  if (!filas.length) return NextResponse.json({ error: 'No llegaron guías.' }, { status: 400 });

  // Solo telefono + estado: no dependemos de columnas extra (actualizado_at)
  // que podrían no existir en la tabla y hacer fallar el insert en silencio.
  // Prioridad: gana el estado más "avanzado" si el teléfono aparece repetido.
  const PRIORIDAD = ['sin-subir', 'novedad', 'en_camino', 'anulada', 'devuelta', 'entregada'];
  const limpias = filas
    .map((g: any) => ({
      telefono: String(g?.telefono ?? '').replace(/\D/g, '').slice(-10),
      estado:   ESTADOS_VALIDOS.includes(String(g?.estado)) ? String(g.estado) : 'en_camino',
      flete:    Number(g?.flete) || 0,
      motivo:   String(g?.motivo ?? '').trim().slice(0, 300),
    }))
    .filter((g: any) => g.telefono.length === 10);

  if (!limpias.length) return NextResponse.json({ error: 'No hay teléfonos válidos.' }, { status: 400 });

  const porTel = new Map<string, any>();
  for (const g of limpias) {
    const prev = porTel.get(g.telefono);
    if (!prev || PRIORIDAD.indexOf(g.estado) >= PRIORIDAD.indexOf(prev.estado)) {
      porTel.set(g.telefono, { ...g, flete: g.flete || prev?.flete || 0, motivo: g.motivo || prev?.motivo || '' });
    } else {
      if (g.flete && !prev.flete) prev.flete = g.flete;
      if (g.motivo && !prev.motivo) prev.motivo = g.motivo;
    }
  }
  const unicas = [...porTel.values()];
  const telefonos = unicas.map(g => g.telefono);

  const supabase = createServerSupabaseClient();

  // Reemplaza SOLO los teléfonos de este archivo (borra e inserta), y conserva
  // los que no vinieron. Así no depende de una restricción única y siempre guarda.
  const { error: delErr } = await supabase.from('effi_guias').delete().in('telefono', telefonos);
  if (delErr) return NextResponse.json({ error: `borrar: ${delErr.message}` }, { status: 500 });

  const { error: insErr } = await supabase.from('effi_guias').insert(unicas);
  if (insErr) return NextResponse.json({ error: `insertar: ${insErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, guardadas: unicas.length });
}
