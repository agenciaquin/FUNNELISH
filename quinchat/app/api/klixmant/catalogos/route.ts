import { NextResponse } from 'next/server';
import { haySesion } from '@/lib/live/admin-guard';
import { SERVIDOR_LOCAL } from '@/lib/freno-local';

/**
 * Vista previa de los catálogos de Klixmant (CONTRATO-API-CATALOGOS.md §4).
 * Solo lee la API del reporte; no guarda nada. La llave va en la cabecera y
 * nunca sale al navegador.
 */
const URL_REPORTE = process.env.REPORTE_API_URL || 'https://reporte-de-ventas-bwey.vercel.app';
const ORIGEN_FOTOS = 'https://pqcqeywhduryaoehleuh.supabase.co/storage/v1/object/public/klixmant-soft/';

// Sin llave en local: unos pocos catálogos de ejemplo para ver la pantalla. 973 es el del contrato.
const MUESTRA = {
  version: 1,
  generado: new Date().toISOString(),
  catalogos: [
    { id: 973, nombre: 'NEW YORK', categoria: 'EQUIPOS', reflectivo: false, colores: ['Negro', 'Beige', 'Rojo', 'Blanco marfil'], tipos: ['Buzo'], foto: null },
    { id: 23, nombre: 'CUELLO ALTO BARCELONA', categoria: 'EQUIPOS', reflectivo: false, colores: ['Azul', 'Granate'], tipos: ['Buzo'], foto: null },
    { id: 31, nombre: 'CUELLO ALTO BARCELONA', categoria: 'EQUIPOS', reflectivo: false, colores: ['Negro'], tipos: ['Buzo', 'Camiseta'], foto: null },
    { id: 501, nombre: 'DUCATI', categoria: 'MOTOS', reflectivo: true, colores: ['Rojo', 'Negro'], tipos: ['Chaqueta'], foto: null },
    { id: 502, nombre: 'YAMAHA RACING', categoria: 'MOTOS', reflectivo: false, colores: ['Azul'], tipos: ['Camiseta'], foto: null },
  ],
  categorias: ['EQUIPOS', 'MOTOS'],
};

export async function GET() {
  if (!(await haySesion())) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const llave = process.env.QUINCHAT_API_KEY;
  if (!llave) {
    if (SERVIDOR_LOCAL) return NextResponse.json({ ...MUESTRA, muestra: true });
    return NextResponse.json({ error: 'Falta la llave de la API de catálogos.' }, { status: 503 });
  }

  try {
    const r = await fetch(`${URL_REPORTE}/api/v1/catalogos`, {
      headers: { Authorization: `Bearer ${llave}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return NextResponse.json({ error: `El reporte respondió ${r.status}.` }, { status: 502 });
    const d = await r.json();
    if (!Array.isArray(d?.catalogos)) return NextResponse.json({ error: 'Respuesta del reporte sin catálogos.' }, { status: 502 });
    // §5.6: el bot vuelve a validar cada foto antes de usarla.
    d.catalogos = d.catalogos.map((c: any) => ({
      ...c,
      foto: typeof c.foto === 'string' && c.foto.startsWith(ORIGEN_FOTOS) ? c.foto : null,
    }));
    return NextResponse.json({ ...d, muestra: false });
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el reporte.' }, { status: 502 });
  }
}
