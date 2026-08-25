import { NextResponse } from 'next/server';
import { enviarPushATodos } from '@/lib/push';

/** Envía una notificación de prueba a todos los dispositivos registrados. */
export async function POST() {
  const enviadas = await enviarPushATodos({
    title: '🔔 QuinChat',
    body: 'Notificación de prueba — todo está funcionando.',
    url: '/',
    tag: 'quinchat-prueba',
  });
  return NextResponse.json({ ok: true, enviadas });
}
