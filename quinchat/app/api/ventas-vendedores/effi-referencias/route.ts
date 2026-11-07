import { NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { effiGet, effiConfigurado } from '@/lib/effi-api';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * FASE 0 (subir ventas a Effi) — SOLO LECTURA.
 * Consulta en Effi los números internos que necesita la remisión (sucursal, bodega,
 * centro de costos, vendedores, ubicaciones de venta, impuestos, formas y medios de
 * pago, cajas, cuentas) y verifica el artículo / ciudad / cliente de la venta de prueba.
 * Solo hace GET: no crea, no modifica ni anula nada en Effi.
 * Guarda el resultado en ajustes_bot clave 'effi_referencias' para revisarlo.
 */
const CONSULTAS: { clave: string; ruta: string; params?: Record<string, string> }[] = [
  { clave: 'sucursal', ruta: 'sucursal' },
  { clave: 'bodega', ruta: 'bodega' },
  { clave: 'centro_costos', ruta: 'centro_costos' },
  { clave: 'empleado', ruta: 'empleado' },
  { clave: 'ubicacion_venta', ruta: 'ubicacion_venta' },
  { clave: 'impuesto', ruta: 'impuesto' },
  { clave: 'forma_pago', ruta: 'forma_pago' },
  { clave: 'medio_pago', ruta: 'medio_pago' },
  { clave: 'caja', ruta: 'caja' },
  { clave: 'cuenta_bancaria', ruta: 'cuenta' },
  // Venta de prueba PV-20261107-152032-G1
  { clave: 'articulo_prueba', ruta: 'articulo', params: { referencia: 'HNLMARFILLES' } },
  { clave: 'ciudad_prueba', ruta: 'ciudad', params: { nombre: 'Bucaramanga' } },
  { clave: 'cliente_prueba', ruta: 'cliente', params: { celular: '3143534918' } },
];

export async function GET() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  if (!effiConfigurado()) return NextResponse.json({ error: 'Falta EFFI_API_TOKEN en Vercel' }, { status: 503 });

  const resultado: Record<string, any> = { consultado_at: new Date().toISOString(), quien: auth.quien };
  for (const c of CONSULTAS) {
    try {
      const j = await effiGet(c.ruta, { ...(c.params ?? {}), pagina: 1, por_pagina: 100 });
      resultado[c.clave] = { total: j?.paginacion?.total ?? (j?.data?.length ?? 0), data: j?.data ?? [] };
    } catch (e: any) {
      resultado[c.clave] = { error: e?.message ?? String(e) };
    }
  }

  const supabase = createServerSupabaseClient();
  await supabase.from('ajustes_bot').upsert(
    { clave: 'effi_referencias', valor: resultado, actualizado_at: new Date().toISOString() },
    { onConflict: 'clave' },
  );

  const resumen = Object.fromEntries(Object.entries(resultado).map(([k, v]: [string, any]) =>
    [k, v?.error ? `ERROR: ${v.error}` : (v?.data ? `${v.data.length} registros` : v)]));
  return NextResponse.json({ ok: true, mensaje: 'Consulta hecha (solo lectura). Avísale a Claude.', resumen });
}
