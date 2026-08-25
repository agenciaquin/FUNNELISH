import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Entrega la clave PÚBLICA de notificaciones (VAPID) al navegador en tiempo de
 * ejecución. Así no depende de que la variable NEXT_PUBLIC_* quede "horneada" en
 * el build: basta con tenerla en Vercel (con o sin el prefijo NEXT_PUBLIC_).
 */
export async function GET() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    process.env.VAPID_PUBLIC_KEY ||
    '';
  return NextResponse.json({ publicKey });
}
