import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { enviarPlantilla, credencialesTenant } from '@/lib/whatsapp-templates';
import { tenantActual } from '@/lib/tenant';

/**
 * Envía una plantilla aprobada a un cliente y la registra en el chat.
 * Es la forma de escribirle cuando ya pasaron 24 horas de su último mensaje.
 */
export async function POST(req: NextRequest) {
  try {
    const tid = await tenantActual();
    if (!tid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { to, nombre, idioma = 'es', variables = [], imagenUrl, vistaPrevia } = await req.json();

    if (!to || !nombre) {
      return NextResponse.json({ error: 'Falta el destinatario o la plantilla.' }, { status: 400 });
    }

    const creds = await credencialesTenant(tid);
    const r = await enviarPlantilla(String(to), String(nombre), String(idioma), variables, imagenUrl, creds);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

    // Guardar en el chat para que quede el registro visible en el panel
    const supabase = createServerSupabaseClient();
    const ahora = new Date().toISOString();
    const texto = String(vistaPrevia ?? `📋 Plantilla enviada: ${nombre}`);

    if (imagenUrl) {
      await supabase.from('messages').insert({
        id: `tpl-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: to, content: imagenUrl,
        role: 'agent', type: 'image', created_at: ahora, tenant_id: tid,
      });
    }
    await supabase.from('messages').insert({
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: to, content: texto,
      role: 'agent', type: 'text', whatsapp_id: r.wamid ?? null, created_at: ahora, tenant_id: tid,
    });
    await supabase.from('conversations')
      .update({ last_message: texto.slice(0, 100), last_message_time: ahora })
      .eq('id', to).eq('tenant_id', tid);

    return NextResponse.json({ ok: true, wamid: r.wamid });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}
