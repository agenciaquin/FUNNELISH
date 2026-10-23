import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { parseLabels, ETIQUETAS_FIJAS } from '@/lib/panel/types';
import { sendPlantillaRemarketing } from '@/lib/whatsapp';
import { listarPlantillas } from '@/lib/whatsapp-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // envíos masivos pueden tardar varios minutos

/**
 * GET  /api/remarketing  → etiquetas con cuántos chats tiene cada una.
 * POST /api/remarketing  → envía una plantilla aprobada a los chats de las
 *   etiquetas elegidas. Body: { etiquetas: string[], template: string,
 *   imageUrl?: string, lang?: string }.
 */
/** ¿La última actividad del chat es de hace AL MENOS `dias` días? (dias=0 → todos). */
function tieneAntiguedad(c: { last_message_time?: string | null; created_at?: string | null }, dias: number): boolean {
  if (dias <= 0) return true;
  const fecha = c.last_message_time || c.created_at;
  if (!fecha) return false; // sin fecha conocida → no arriesgamos
  const ms = Date.now() - new Date(fecha).getTime();
  return ms >= dias * 86400000;
}

/**
 * ¿La actividad del chat cae dentro del rango de fechas [desde, hasta]?
 * Las fechas vienen como YYYY-MM-DD (día calendario de Colombia, UTC-5).
 * Si no se pasa desde/hasta, ese lado no limita.
 */
function enRango(c: { last_message_time?: string | null; created_at?: string | null }, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true;
  const fecha = c.last_message_time || c.created_at;
  if (!fecha) return false;
  const t = new Date(fecha).getTime();
  if (desde) { const min = new Date(`${desde}T00:00:00-05:00`).getTime(); if (!isNaN(min) && t < min) return false; }
  if (hasta) { const max = new Date(`${hasta}T23:59:59.999-05:00`).getTime(); if (!isNaN(max) && t > max) return false; }
  return true;
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const dias = Math.max(0, parseInt(sp.get('dias') || '0', 10) || 0);
  const desde = String(sp.get('desde') || '').trim();
  const hasta = String(sp.get('hasta') || '').trim();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, label, last_message_time, created_at')
    .not('label', 'is', null)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const conteo = new Map<string, number>();
  for (const c of data ?? []) {
    if (!tieneAntiguedad(c, dias)) continue;
    if (!enRango(c, desde, hasta)) continue;
    for (const et of parseLabels(c.label)) {
      conteo.set(et.toUpperCase(), (conteo.get(et.toUpperCase()) ?? 0) + 1);
    }
  }
  // Etiquetas conocidas (con su color) + cualquier otra que exista en los datos.
  const etiquetas = ETIQUETAS_FIJAS.map(e => ({
    nombre: e.nombre, color: e.color, count: conteo.get(e.nombre.toUpperCase()) ?? 0,
  }));
  const conocidas = new Set(ETIQUETAS_FIJAS.map(e => e.nombre.toUpperCase()));
  for (const [nombreUp, count] of conteo) {
    if (!conocidas.has(nombreUp)) etiquetas.push({ nombre: nombreUp, color: '#6B7280', count });
  }
  etiquetas.sort((a, b) => b.count - a.count);
  return NextResponse.json({ etiquetas });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const etiquetas: string[] = Array.isArray(body.etiquetas) ? body.etiquetas : [];
  const template: string = String(body.template ?? '').trim();
  const imageUrl: string | undefined = body.imageUrl ? String(body.imageUrl) : undefined;
  const lang: string = String(body.lang ?? 'es');
  const dias: number = Math.max(0, parseInt(String(body.diasMin ?? 0), 10) || 0);
  const desde: string = String(body.desde ?? '').trim();
  const hasta: string = String(body.hasta ?? '').trim();

  if (!etiquetas.length) return NextResponse.json({ error: 'Elige al menos una etiqueta.' }, { status: 400 });
  if (!template) return NextResponse.json({ error: 'Falta el nombre de la plantilla aprobada.' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, contact_name, label, last_message_time, created_at')
    .not('label', 'is', null)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const objetivo = new Set(etiquetas.map(e => e.toUpperCase()));
  // Chats que tengan AL MENOS una etiqueta elegida y la antigüedad mínima pedida
  // (sin duplicar por teléfono).
  const vistos = new Set<string>();
  const destinatarios = (data ?? []).filter(c => {
    const tel = String(c.id ?? '').replace(/\D/g, '');
    if (tel.length < 10 || vistos.has(tel)) return false;
    if (!tieneAntiguedad(c, dias)) return false;
    if (!enRango(c, desde, hasta)) return false;
    const tiene = parseLabels(c.label).some(l => objetivo.has(l.toUpperCase()));
    if (tiene) { vistos.add(tel); return true; }
    return false;
  });

  // Identificador de esta campaña, para poder ver luego su reporte de entregas.
  const campanaId = `${template}-${Date.now()}`;

  // Texto (cuerpo) de la plantilla, para dejar el mismo mensaje visible en el
  // chat del panel (lo que el cliente recibe). Si no se puede leer, se usa un
  // texto genérico.
  let cuerpoTpl = '';
  try {
    const { plantillas } = await listarPlantillas();
    const tpl = (plantillas ?? []).find((p: any) => p.name === template);
    cuerpoTpl = String(tpl?.cuerpo ?? '');
    // Agregar pie (FOOTER) y botón de enlace (BUTTONS URL) si la plantilla los tiene,
    // para que en el panel se vea igual de completo que le llega al cliente.
    const comps: any[] = Array.isArray(tpl?.components) ? tpl!.components : [];
    const pie = comps.find(c => c.type === 'FOOTER')?.text;
    const btn = comps.find(c => c.type === 'BUTTONS')?.buttons?.find((b: any) => b.type === 'URL');
    if (pie) cuerpoTpl += `\n\n${pie}`;
    if (btn?.text) cuerpoTpl += `\n\n👉 ${btn.text}${btn.url ? `: ${btn.url}` : ''}`;
  } catch { /* sin cuerpo → se usa genérico */ }

  let enviados = 0, fallidos = 0;
  for (const c of destinatarios) {
    const tel = String(c.id ?? '').replace(/\D/g, '');
    const nombre = String(c.contact_name ?? '').trim().split(' ')[0] || 'hola';
    const wamid = await sendPlantillaRemarketing(tel, template, nombre, imageUrl, lang);
    if (wamid) enviados++; else fallidos++;

    // Registrar el envío para rastrear entregado/leído/respondió (lo actualiza el webhook).
    try {
      await supabase.from('remarketing_envios').insert({
        campana_id: campanaId,
        template,
        telefono: tel,
        wamid: wamid ?? null,
        estado: wamid ? 'enviado' : 'fallido',
        error: wamid ? null : 'No se pudo enviar (número sin WhatsApp o inválido).',
      });
    } catch { /* no bloquear el envío por un fallo de registro */ }

    // Dejar el mensaje enviado también en el chat del panel (imagen + texto),
    // para que se vea igual que le llegó al cliente.
    if (wamid) {
      const now = new Date();
      const texto = (cuerpoTpl
        ? cuerpoTpl.replace(/\{\{\s*1\s*\}\}/g, nombre).replace(/\{\{\s*\d+\s*\}\}/g, '').trim()
        : `📣 Te enviamos nuestra promoción, ${nombre}.`);
      try {
        if (imageUrl) {
          await supabase.from('messages').insert({
            id: `rmk-img-${campanaId}-${tel}`,
            conversation_id: c.id,
            content: imageUrl, role: 'assistant', type: 'image',
            whatsapp_id: null, created_at: now.toISOString(),
          });
        }
        await supabase.from('messages').insert({
          id: `rmk-txt-${campanaId}-${tel}`,
          conversation_id: c.id,
          content: texto, role: 'assistant', type: 'text',
          whatsapp_id: wamid, created_at: new Date(now.getTime() + 800).toISOString(),
        });
        // NO tocamos conversations.last_message_time a propósito: así la campaña
        // NO sube el chat al tope de la bandeja. El mensaje queda en el historial
        // y el chat solo sube cuando el cliente RESPONDE (lo hace el webhook).
      } catch { /* no bloquear el envío por un fallo de registro en el chat */ }
    }

    await new Promise(r => setTimeout(r, 120)); // pequeño respiro entre envíos
  }

  return NextResponse.json({ campanaId, total: destinatarios.length, enviados, fallidos });
}
