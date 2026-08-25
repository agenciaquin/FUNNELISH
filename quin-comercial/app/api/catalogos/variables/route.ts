import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';

// ── Variables por defecto (se siembran la primera vez que el cliente entra) ──
const PAL: [string, string][] = [
  ['Blanco', '#FFFFFF'], ['Blanco marfil', '#F3EDE2'], ['Beige', '#D9C7A7'], ['Negro', '#111111'],
  ['Gris', '#9AA0A6'], ['Rojo', '#C8102E'], ['Amarillo', '#F5C518'], ['Azul', '#1B4FA0'], ['Azul oscuro', '#16233F'],
  ['Verde', '#1E9E5A'], ['Verde oscuro', '#14532D'], ['Marrón', '#6B4423'], ['Naranja', '#F26A21'],
  ['Rosa', '#F2A0BC'], ['Morado', '#6B3FA0'], ['Lila', '#B9A3E3'],
];
const ops = (a: string[]) => a.map(n => ({ nm: n }));
function defaultsVariables(tid: string) {
  const base = [
    { nombre: 'Color',        icono: '🎨', con_color: true,  no_repite: true,  opciones: PAL.map(p => ({ nm: p[0], hex: p[1] })) },
    { nombre: 'Talla',        icono: '📏', con_color: false, no_repite: false, opciones: ops(['S', 'M', 'L', 'XL', 'XXL', 'XXXL']) },
    { nombre: 'Género',       icono: '👥', con_color: false, no_repite: false, opciones: ops(['Hombre', 'Mujer', 'Unisex', 'Niño', 'Niña']) },
    { nombre: 'Sabor',        icono: '🍬', con_color: false, no_repite: false, opciones: ops(['Fresa', 'Vainilla', 'Chocolate', 'Maracuyá']) },
    { nombre: 'Material',     icono: '🧵', con_color: false, no_repite: false, opciones: ops(['Algodón', 'Poliéster', 'Cuero', 'Lino']) },
    { nombre: 'Presentación', icono: '🧴', con_color: false, no_repite: false, opciones: ops(['250 ml', '500 ml', '1 L']) },
    { nombre: 'Peso',         icono: '⚖️', con_color: false, no_repite: false, opciones: ops(['250 g', '500 g', '1 kg']) },
    { nombre: 'Capacidad',    icono: '💾', con_color: false, no_repite: false, opciones: ops(['64 GB', '128 GB', '256 GB', '512 GB']) },
    { nombre: 'Aroma',        icono: '🌸', con_color: false, no_repite: false, opciones: ops(['Floral', 'Cítrico', 'Amaderado', 'Dulce']) },
    { nombre: 'Modelo',       icono: '🏷️', con_color: false, no_repite: false, opciones: ops(['2025', '2026']) },
    { nombre: 'Empaque',      icono: '📦', con_color: false, no_repite: false, opciones: ops(['Bolsa', 'Frasco', 'Caja']) },
  ];
  return base.map((v, i) => ({ ...v, tenant_id: tid, orden: i, activo: true }));
}

/** GET /api/catalogos/variables — lista (o ?papelera=1). Siembra las 11 por defecto la 1ª vez. */
export async function GET(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const papelera = req.nextUrl.searchParams.get('papelera') === '1';
  const supabase = createServerSupabaseClient();

  // ¿Ya tiene variables (activas o en papelera)? Si nunca ha tenido, sembrar.
  if (!papelera) {
    const { count } = await supabase
      .from('catalogo_variables').select('id', { count: 'exact', head: true }).eq('tenant_id', tid);
    if ((count ?? 0) === 0) {
      await supabase.from('catalogo_variables').insert(defaultsVariables(tid));
    }
  }

  const { data, error } = await supabase
    .from('catalogo_variables').select('*')
    .eq('tenant_id', tid).eq('activo', !papelera)
    .order('orden', { ascending: true }).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/catalogos/variables — crear variable. */
export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const b = await req.json();
  const nombre = String(b?.nombre ?? '').trim();
  if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });

  const fila = {
    tenant_id: tid,
    nombre,
    icono: String(b?.icono ?? '✨').slice(0, 4) || '✨',
    con_color: b?.con_color === true,
    no_repite: b?.no_repite === true,
    opciones: Array.isArray(b?.opciones) ? b.opciones : [],
    orden: Number(b?.orden ?? 0) || 0,
    activo: true,
  };
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('catalogo_variables').insert(fila).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
