import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Registra un número en WhatsApp Cloud API (el paso que deja el número en
 * "Conectado"). Meta no ofrece este paso por su interfaz: hay que llamarlo.
 *
 * Uso:  /api/whatsapp/registrar?phoneId=1226140407251017&pin=123456
 * El PIN es el de "Verificación en dos pasos" que acabas de crear.
 */
export async function GET(req: NextRequest) {
  const phoneId = req.nextUrl.searchParams.get('phoneId');
  const pin     = req.nextUrl.searchParams.get('pin');

  if (!phoneId || !pin) {
    return NextResponse.json(
      { error: 'Faltan datos. Usa: /api/whatsapp/registrar?phoneId=XXXX&pin=123456' },
      { status: 400 },
    );
  }
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'El PIN debe ser de 6 dígitos.' }, { status: 400 });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: 'Falta WHATSAPP_ACCESS_TOKEN.' }, { status: 500 });

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    });
    const texto = await res.text();

    return NextResponse.json({
      estadoHttp: res.status,
      respuestaDeMeta: texto,
      resultado: res.ok
        ? '✅ Número registrado. En WhatsApp Manager debe pasar a "Conectado" en unos minutos.'
        : '❌ Meta rechazó el registro. Mira "respuestaDeMeta" para el motivo.',
    });
  } catch (e: any) {
    return NextResponse.json({ resultado: `❌ Error de red: ${e?.message}` }, { status: 500 });
  }
}
