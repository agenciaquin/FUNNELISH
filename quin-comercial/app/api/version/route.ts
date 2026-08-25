import { NextResponse } from 'next/server';
import { VERSION, VERSION_FECHA, VERSION_CAMBIOS } from '@/lib/version';

export const dynamic = 'force-dynamic';

// Endpoint público para confirmar qué versión del bot está EN VIVO.
// Abre  https://TU-DOMINIO/api/version  en el navegador después de desplegar:
// si el número coincide con el último que te pasé, los cambios ya están activos.
export async function GET() {
  return NextResponse.json({
    version: VERSION,
    fecha: VERSION_FECHA,
    cambios: VERSION_CAMBIOS,
    desplegado: true,
  });
}
