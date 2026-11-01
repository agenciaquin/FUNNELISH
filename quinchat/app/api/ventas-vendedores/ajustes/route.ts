import { NextRequest, NextResponse } from 'next/server';
import { exigirSesion } from '@/lib/ventas-vendedores/auth';
import { ajustesVV, guardarAjustesVV } from '@/lib/ventas-vendedores/config';
import { VENDEDORES } from '@/lib/vendedores';

export const dynamic = 'force-dynamic';

/** Interruptor del módulo Ventas Vendedores. */
export async function GET() {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  return NextResponse.json({ ajustes: await ajustesVV(true), vendedores: VENDEDORES.map(v => ({ tel: v.telefono, nombre: v.nombre })) });
}

export async function PUT(req: NextRequest) {
  const auth = await exigirSesion();
  if (auth.error) return auth.error;
  const b = await req.json().catch(() => ({}));
  const parcial: any = {};
  if (typeof b.activo === 'boolean') parcial.activo = b.activo;
  if (typeof b.todos_vendedores === 'boolean') parcial.todos_vendedores = b.todos_vendedores;
  if (Array.isArray(b.numeros_prueba)) parcial.numeros_prueba = b.numeros_prueba.map(String);
  if (b.envio_effi === 'real' || b.envio_effi === 'simulacion') parcial.envio_effi = b.envio_effi;
  return NextResponse.json({ ajustes: await guardarAjustesVV(parcial) });
}
