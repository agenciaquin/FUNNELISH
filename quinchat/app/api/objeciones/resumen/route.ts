import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { CATEGORIAS_OBJ } from '@/lib/objeciones';

export const dynamic = 'force-dynamic';

/**
 * Resumen del tablero de chats perdidos.
 *   ?dias=7   → últimos N días (por defecto 7)
 * Devuelve el conteo por categoría y ejemplos recientes de cada una.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dias = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get('dias') ?? 7)));
  const desde = new Date(Date.now() - 5 * 3_600_000 - (dias - 1) * 86_400_000)
    .toISOString().slice(0, 10);

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('objeciones_analisis')
    .select('conversation_id, categoria, detalle, cita, fecha, created_at')
    .gte('fecha', desde)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = data ?? [];
  const total = filas.length;

  // Conteo + ejemplos por categoría
  const porCat = new Map<string, { categoria: string; total: number; ejemplos: any[] }>();
  for (const cat of CATEGORIAS_OBJ) porCat.set(cat, { categoria: cat, total: 0, ejemplos: [] });
  for (const f of filas) {
    const cat = String((f as any).categoria ?? 'Otro');
    const g = porCat.get(cat) ?? { categoria: cat, total: 0, ejemplos: [] };
    g.total++;
    if (g.ejemplos.length < 4) {
      g.ejemplos.push({
        conversation_id: (f as any).conversation_id,
        detalle: (f as any).detalle,
        cita: (f as any).cita,
        fecha: (f as any).fecha,
      });
    }
    porCat.set(cat, g);
  }

  const categorias = [...porCat.values()]
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    desde,
    dias,
    total,
    categorias,
  });
}
