import { NextRequest, NextResponse } from 'next/server';
import { sendTextMessage } from '@/lib/whatsapp';
import { porCadaTenant } from '@/lib/cron-tenant';

// Motor de remarketing de pedidos pendientes por confirmar.
// Se ejecuta por cron (ver vercel.json) cada hora. MULTI-TENANT.
//
// REGLA COMERCIAL (sin gastar en plantillas):
//  - Solo se recuerda DENTRO de la ventana gratis de 24h: es decir, si el
//    cliente escribió algo en las últimas 24h. Ahí se manda un mensaje normal
//    (gratis), NO una plantilla de pago.
//  - Si la ventana de 24h ya se cerró, NO se manda plantilla (no se gasta):
//    el pedido se pasa a revisión HUMANO para que un asesor decida.
//  - 1 solo recordatorio por pedido (marca remarketing_1_at).
//  - Solo entre 6:00 y 22:00 hora Colombia (UTC-5).
//  - No recuerda si el cliente ya confirmó, canceló o programó el pedido.

const HORAS = (h: number) => h * 3_600_000;
const SKIP_LABELS = ['PEDIDO CANCELADO', 'PEDIDO PROGRAMADO', 'VENTA REALIZADA', 'ANULADO EN EFFI'];

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // si no hay secret configurado, no bloquea (dev)
  const bearer = req.headers.get('authorization') === `Bearer ${secret}`;
  const query  = req.nextUrl.searchParams.get('secret') === secret;
  return bearer || query;
}

async function guardarMensajeBot(supabase: any, waPhone: string, texto: string, wamid: string | null) {
  const now = new Date().toISOString();
  await supabase.from('messages').insert({
    id: `remarketing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversation_id: waPhone, content: texto, role: 'assistant', type: 'text',
    whatsapp_id: wamid, created_at: now,
  });
  await supabase.from('conversations').update({ last_message: texto.slice(0, 100), last_message_time: now, unread_count: 0 }).eq('id', waPhone);
}

/** Último mensaje ENTRANTE (del cliente). Sirve para saber si la ventana de 24h sigue abierta. */
async function ultimoEntrante(supabase: any, waPhone: string): Promise<number> {
  const { data } = await supabase
    .from('messages')
    .select('created_at')
    .eq('conversation_id', waPhone)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at ? new Date(data.created_at).getTime() : 0;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  // Ventana horaria Colombia (UTC-5)
  const now     = new Date();
  const colHour = (now.getUTCHours() + 24 - 5) % 24;
  if (colHour < 6 || colHour >= 22) {
    return NextResponse.json({ status: 'fuera-de-horario', colHour });
  }

  const ahora = now.getTime();
  const hace3dias = new Date(ahora - HORAS(72)).toISOString();

  let enviados = 0, escalados = 0, saltados = 0, revisados = 0;

  const { tenants, errores } = await porCadaTenant(async (supabase) => {
    // Pedidos enviados, no confirmados, recientes (de este tenant)
    const { data: pend } = await supabase
      .from('clientes_funnelish')
      .select('id, telefono, nombre, producto, wa_enviado_at, remarketing_1_at')
      .eq('confirmado', false)
      .eq('wa_enviado', true)
      .gte('wa_enviado_at', hace3dias)
      .limit(60);

    revisados += pend?.length ?? 0;

    for (const p of pend ?? []) {
      const tel10   = String(p.telefono).replace(/^57/, '').slice(-10);
      const waPhone = `57${tel10}`;

      // Estado de la conversación (etiqueta)
      const { data: conv } = await supabase
        .from('conversations').select('label').eq('id', waPhone).maybeSingle();
      const label = (conv?.label ?? '').toUpperCase();
      if (SKIP_LABELS.some(l => label.includes(l)) || label.includes('HUMANO')) { saltados++; continue; }

      const enviadoAt = p.wa_enviado_at ? new Date(p.wa_enviado_at).getTime() : 0;
      const yaRecordado = !!p.remarketing_1_at;

      // ¿Sigue abierta la ventana gratis de 24h? (el cliente escribió hace <24h)
      const ultimoIn = await ultimoEntrante(supabase, waPhone);
      const ventanaAbierta = ultimoIn > 0 && ahora - ultimoIn < HORAS(24);

      // Recordatorio gratis: pedido enviado hace >=4h, aún sin recordar y ventana abierta
      if (!yaRecordado && enviadoAt && ahora - enviadoAt >= HORAS(4) && ventanaAbierta) {
        const nombre = String(p.nombre || '').split(' ')[0] || '';
        const saludo = nombre ? `¡Hola ${nombre}! 😊` : '¡Hola! 😊';
        const texto = `${saludo} ¿Me confirmas si todos los datos están correctos para despacharte tu pedido de *${p.producto}*? 🚚`;
        const wamid = await sendTextMessage(waPhone, texto);
        if (wamid) {
          await supabase.from('clientes_funnelish').update({ remarketing_1_at: now.toISOString() }).eq('id', p.id);
          await guardarMensajeBot(supabase, waPhone, texto, wamid);
          enviados++;
        }
        continue;
      }

      // Ventana cerrada y pedido viejo (>24h) sin confirmar → a revisión humana.
      // NO se manda plantilla de pago: solo se etiqueta para que un asesor lo tome.
      if (!ventanaAbierta && enviadoAt && ahora - enviadoAt >= HORAS(24)) {
        const labs: string[] = label ? String(label).split('|').map((s: string) => s.trim()).filter(Boolean) : [];
        if (!labs.map((l: string) => l.toUpperCase()).includes('HUMANO')) {
          await supabase.from('conversations')
            .update({ label: [...new Set([...labs, 'HUMANO'])].join(' | ') }).eq('id', waPhone);
          escalados++;
        }
        continue;
      }
    }
  });

  return NextResponse.json({ status: 'ok', revisados, enviados, escalados, saltados, tenants, errores });
}
