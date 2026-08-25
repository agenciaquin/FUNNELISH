import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { tenantActual } from '@/lib/tenant';
import { entrarLinea } from '@/lib/whatsapp-contexto';
import { sendEstadoTemplate } from '@/lib/whatsapp';
import { fraseEstado, ESTADOS_NOTIFICAR, type EstadoCanon } from '@/lib/guias-effi';

export const maxDuration = 300;

const primerNombre = (n: string) => String(n ?? '').trim().split(/\s+/)[0] || 'Hola';

/** Texto que se guarda en el chat del panel (refleja lo que recibió el cliente). */
function textoGuardado(nombre: string, frase: string, guia: string): string {
  return `Hola ${primerNombre(nombre)} 👋 ${frase}\n📦 Número de guía: ${guia}\nEscríbenos por aquí si tienes cualquier duda. ¡Gracias por tu compra! 🧡`;
}

export async function POST(req: NextRequest) {
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items: any[] = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: 'No hay avisos para enviar.' }, { status: 400 });

  const supabase = createServerSupabaseClient();

  // ── Credenciales de WhatsApp de ESTA tienda (multi-tenant) ───────────────────
  const { data: t } = await supabase.from('tenants')
    .select('wa_access_token, wa_phone_number_id').eq('id', tid).maybeSingle();
  const accessToken = String((t as any)?.wa_access_token ?? '').trim();
  const phoneId     = String((t as any)?.wa_phone_number_id ?? '').trim();
  if (!accessToken || !phoneId) {
    return NextResponse.json({ error: 'Tu tienda no tiene el WhatsApp conectado (falta token o número).' }, { status: 400 });
  }
  entrarLinea({ phoneId, tipo: 'funnel', accessToken, tenantId: tid });

  const res = { enviados: 0, fallidos: 0, omitidos: 0, detalle: [] as any[] };
  const ahora = () => new Date().toISOString();

  for (const it of items.slice(0, 800)) {
    const telefono = String(it?.telefono ?? '').replace(/\D/g, '').slice(-10);
    const guia     = String(it?.guia ?? '').replace(/\D/g, '');
    const estado   = String(it?.estado ?? '') as EstadoCanon;
    const nombre   = String(it?.nombre ?? '').trim();
    if (telefono.length !== 10 || !ESTADOS_NOTIFICAR.includes(estado)) { res.omitidos++; continue; }

    // Re-verificar contra la BD: si ya se avisó este mismo estado, no repetir.
    const { data: fila } = await supabase.from('guias_effi')
      .select('id, estado_notificado').eq('tenant_id', tid).eq('telefono', telefono).eq('guia', guia).maybeSingle();
    if (fila && (fila as any).estado_notificado === estado) { res.omitidos++; continue; }

    const waId  = `57${telefono}`;
    const frase = fraseEstado(estado);
    const wamid = await sendEstadoTemplate(waId, { nombre: primerNombre(nombre), frase, guia });

    if (!wamid) { res.fallidos++; res.detalle.push({ telefono, estado, ok: false }); continue; }

    res.enviados++;
    res.detalle.push({ telefono, estado, ok: true });

    // Marcar como notificado (para no repetir).
    if (fila?.id) {
      await supabase.from('guias_effi')
        .update({ estado_notificado: estado, notificado_at: ahora() }).eq('id', (fila as any).id);
    } else {
      await supabase.from('guias_effi').upsert({
        tenant_id: tid, telefono, guia, nombre, estado,
        estado_notificado: estado, notificado_at: ahora(), updated_at: ahora(),
      }, { onConflict: 'tenant_id,telefono,guia' });
    }

    // Guardar el mensaje en el chat del panel + refrescar la conversación.
    const texto = textoGuardado(nombre, frase, guia);
    await supabase.from('messages').insert({
      id: `guia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      conversation_id: waId, content: texto, role: 'assistant', type: 'text',
      whatsapp_id: wamid, created_at: ahora(),
    });
    await supabase.from('conversations')
      .update({ last_message: texto.slice(0, 100), last_message_time: ahora() })
      .eq('tenant_id', tid).eq('id', waId);

    await new Promise(r => setTimeout(r, 200)); // pausa para no saturar Meta
  }

  return NextResponse.json(res);
}
