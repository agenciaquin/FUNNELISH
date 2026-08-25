import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { parseLabels, ETIQUETAS_FIJAS } from '@/lib/panel/types';
import { sendPlantillaRemarketing } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/remarketing  → etiquetas con cuántos chats tiene cada una.
 * POST /api/remarketing  → envía una plantilla aprobada a los chats de las
 *   etiquetas elegidas. Body: { etiquetas: string[], template: string,
 *   imageUrl?: string, lang?: string }.
 */
export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, label')
    .not('label', 'is', null)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const conteo = new Map<string, number>();
  for (const c of data ?? []) {
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

  if (!etiquetas.length) return NextResponse.json({ error: 'Elige al menos una etiqueta.' }, { status: 400 });
  if (!template) return NextResponse.json({ error: 'Falta el nombre de la plantilla aprobada.' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, contact_name, label')
    .not('label', 'is', null)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const objetivo = new Set(etiquetas.map(e => e.toUpperCase()));
  // Chats que tengan AL MENOS una de las etiquetas elegidas (sin duplicar por teléfono).
  const vistos = new Set<string>();
  const destinatarios = (data ?? []).filter(c => {
    const tel = String(c.id ?? '').replace(/\D/g, '');
    if (tel.length < 10 || vistos.has(tel)) return false;
    const tiene = parseLabels(c.label).some(l => objetivo.has(l.toUpperCase()));
    if (tiene) { vistos.add(tel); return true; }
    return false;
  });

  let enviados = 0, fallidos = 0;
  for (const c of destinatarios) {
    const tel = String(c.id ?? '').replace(/\D/g, '');
    const nombre = String(c.contact_name ?? '').trim().split(' ')[0] || 'hola';
    const wamid = await sendPlantillaRemarketing(tel, template, nombre, imageUrl, lang);
    if (wamid) enviados++; else fallidos++;
    await new Promise(r => setTimeout(r, 250)); // pequeño respiro entre envíos
  }

  return NextResponse.json({ total: destinatarios.length, enviados, fallidos });
}
