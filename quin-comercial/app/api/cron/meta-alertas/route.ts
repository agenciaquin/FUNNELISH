import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { gastoPorAnuncioMeta } from '@/lib/meta-ads';
import { sendTextMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Alerta diaria de META ADS al dueño: qué campañas APAGAR (gastan y no venden o
 * venden caro) y cuáles ESCALAR (venden barato). Se dispara 1 vez al día por cron.
 */

const ADMINS = ['573167648391', '573187051499', '573143534918'];

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get('secret') === secret;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const obj = Number(process.env.META_COSTO_OBJETIVO) || 45000; // costo objetivo por venta
  const hasta = new Date().toISOString().slice(0, 10);
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const meta = await gastoPorAnuncioMeta(desde, hasta);
  if (!meta.ok) return NextResponse.json({ status: 'sin-meta', error: meta.error });

  // Ventas por anuncio (últimos 30 días)
  const supabase = createServerSupabaseClient();
  const { data: convs } = await supabase
    .from('conversations')
    .select('anuncio_id, label, created_at')
    .not('anuncio_id', 'is', null)
    .gte('created_at', `${desde}T00:00:00`);
  const ventasPorAd = new Map<string, number>();
  for (const c of convs ?? []) {
    const id = String((c as any).anuncio_id ?? '').trim();
    if (!id) continue;
    if (String((c as any).label ?? '').toUpperCase().includes('VENTA REALIZADA')) {
      ventasPorAd.set(id, (ventasPorAd.get(id) ?? 0) + 1);
    }
  }

  const apagar: string[] = [];
  const escalar: string[] = [];
  for (const [id, ad] of meta.porAnuncio) {
    if (!ad.gasto || ad.gasto < 3000) continue; // ignorar sin gasto real
    const ventas = ventasPorAd.get(id) ?? 0;
    const costo = ventas > 0 ? ad.gasto / ventas : Infinity;
    const nombre = ad.nombre || id;
    if ((ventas === 0 && ad.gasto >= obj * 1.5) || costo > obj * 1.8) {
      apagar.push(`• ${nombre} — ${pesos(ad.gasto)} gastados, ${ventas} ventas${ventas ? ` (${pesos(costo)}/venta)` : ''}`);
    } else if (ventas > 0 && costo <= obj * 0.7) {
      escalar.push(`• ${nombre} — ${pesos(costo)}/venta (${ventas} ventas) 🔥`);
    }
  }

  if (!apagar.length && !escalar.length) {
    return NextResponse.json({ status: 'sin-alertas' });
  }

  const msg =
    `📊 *META ADS — Recomendaciones del día*\n` +
    `Costo objetivo por venta: ${pesos(obj)}\n` +
    (escalar.length ? `\n🟢 *Para ESCALAR* (venden barato):\n${escalar.slice(0, 8).join('\n')}\n` : '') +
    (apagar.length ? `\n🔴 *Para APAGAR o revisar* (gastan y no rinden):\n${apagar.slice(0, 8).join('\n')}\n` : '') +
    `\n_Revisa el panel META ADS para el detalle._`;

  for (const a of ADMINS) { try { await sendTextMessage(a, msg); } catch { /* ignorar */ } }
  return NextResponse.json({ status: 'ok', apagar: apagar.length, escalar: escalar.length });
}
