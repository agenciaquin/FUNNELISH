import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { enviarPlantilla, listarPlantillas } from '@/lib/whatsapp-templates';
import { recortar } from '@/lib/recortar';
import { fotoDelCarrito } from '@/lib/foto-carrito';

export const dynamic = 'force-dynamic';

/** Plantillas de carrito, en orden de preferencia (la v2 lleva nombre y producto). */
const PLANTILLAS_CARRITO = ['carrito_abandonado_v2', 'carrito_abandonado'];

/**
 * ¿Se le puede enviar la plantilla de carrito a este teléfono?
 * NO si ya tiene chat en QuinChat (cualquier bandeja) o si ya hizo un pedido
 * (cualquier embudo/canal, menos cancelado o duplicado). En ese caso: "chat abierto".
 */
async function bloqueo(supabase: any, tel10: string): Promise<string | null> {
  const { data: conv } = await supabase.from('conversations').select('id').eq('id', `57${tel10}`).maybeSingle();
  if (conv) return 'chat abierto';
  const { data: ped } = await supabase.from('clientes_funnelish').select('id')
    .eq('telefono', tel10).not('estado', 'in', '("cancelado","duplicado")').limit(1);
  if (ped && ped.length) return 'ya compró';
  return null;
}

/** GET ?ids=a,b → estado de envío de cada carrito (para pintar el botón). */
export async function GET(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const ids = String(req.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 500);
  if (!ids.length) return NextResponse.json({ estados: {} });
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('carritos_abandonados')
    .select('id, plantilla_enviada_at, plantilla_error').in('id', ids);
  const estados: Record<string, { enviada_at: string | null; error: string | null }> = {};
  for (const c of data ?? []) estados[(c as any).id] = { enviada_at: (c as any).plantilla_enviada_at, error: (c as any).plantilla_error };
  return NextResponse.json({ estados });
}

/** POST { id } → envía la plantilla de carrito abandonado a ese cliente (una sola vez). */
export async function POST(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'Falta el carrito.' }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data: c } = await supabase.from('carritos_abandonados')
    .select('id, slug, nombre, telefono, producto, talla, datos, recuperado, plantilla_enviada_at').eq('id', id).maybeSingle();
  if (!c) return NextResponse.json({ error: 'No encontré el carrito.' }, { status: 404 });
  if ((c as any).plantilla_enviada_at) return NextResponse.json({ error: 'A este carrito ya se le envió la plantilla.' }, { status: 409 });
  if ((c as any).recuperado) return NextResponse.json({ error: 'Este carrito ya está marcado como recuperado.' }, { status: 409 });

  const tel10 = String((c as any).telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
  if (!/^3\d{9}$/.test(tel10)) return NextResponse.json({ error: 'El teléfono del carrito no es válido.' }, { status: 400 });

  // 1) Verificación en tiempo real: ¿tiene chat o ya compró?
  const b1 = await bloqueo(supabase, tel10);
  if (b1) return NextResponse.json({ error: b1, bloqueado: true }, { status: 409 });

  // 2) Plantilla aprobada a usar
  const { plantillas } = await listarPlantillas();
  const tpl = PLANTILLAS_CARRITO.map(n => (plantillas ?? []).find(p => p.name === n && p.status === 'APPROVED')).find(Boolean);
  if (!tpl) return NextResponse.json({ error: 'No hay una plantilla de carrito aprobada (carrito_abandonado).' }, { status: 400 });

  // 3) "Reservar" el carrito de forma atómica: si otro clic/proceso ya lo tomó, no se duplica.
  const ahora = new Date().toISOString();
  const { data: tomado } = await supabase.from('carritos_abandonados')
    .update({ plantilla_enviada_at: ahora, plantilla_nombre: tpl.name, plantilla_error: null })
    .eq('id', id).is('plantilla_enviada_at', null).select('id');
  if (!tomado?.length) return NextResponse.json({ error: 'A este carrito ya se le envió la plantilla.' }, { status: 409 });

  // 4) Última verificación justo antes de enviar (por si compró o escribió en este instante)
  const b2 = await bloqueo(supabase, tel10);
  if (b2) {
    await supabase.from('carritos_abandonados').update({ plantilla_enviada_at: null, plantilla_error: null }).eq('id', id);
    return NextResponse.json({ error: b2, bloqueado: true }, { status: 409 });
  }

  // 5) Variables según la plantilla: {{1}} primer nombre, {{2}} producto (+ talla)
  // Meta rechaza variables con saltos de línea, tabulaciones o más de 4 espacios seguidos.
  const limpio = (t: unknown) => String(t ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const nombre = limpio((c as any).nombre).split(' ')[0] || 'hola';
  const producto = limpio([limpio((c as any).producto), limpio((c as any).talla)].filter(Boolean).join(', ')).slice(0, 120) || 'tu pedido';
  const variables = [nombre, producto].slice(0, tpl.variables);
  // Foto REAL del producto, sacada del catálogo de colores como al confirmar una compra.
  // (La que guarda el formulario en el carrito es la MINIATURA del embudo, no el buzo.)
  let imagen: string | null = null;
  if (tpl.tieneImagen) {
    try { imagen = await fotoDelCarrito(supabase, String((c as any).producto ?? ''), String((c as any).talla ?? '')); }
    catch (e) { console.error('[Carrito] foto del catálogo:', e); }
  }
  if (tpl.tieneImagen && !imagen) {
    await supabase.from('carritos_abandonados').update({ plantilla_enviada_at: null, plantilla_error: 'No encontré la foto de este producto en el catálogo de colores.' }).eq('id', id);
    return NextResponse.json({ error: 'No encontré la foto de este producto en el catálogo de colores; no se envió para no mandar una foto equivocada.' }, { status: 400 });
  }

  const r = await enviarPlantilla(`57${tel10}`, tpl.name, tpl.language || 'es', variables, imagen);
  if (!r.ok) {
    await supabase.from('carritos_abandonados').update({ plantilla_enviada_at: null, plantilla_error: r.error ?? 'Error de envío' }).eq('id', id);
    return NextResponse.json({ error: r.error ?? 'No se pudo enviar.' }, { status: 502 });
  }
  await supabase.from('carritos_abandonados').update({ plantilla_wamid: r.wamid ?? null }).eq('id', id);

  // 6) Dejar el chat creado con el mensaje enviado, para que el asesor/bot tenga el contexto
  let texto = tpl.cuerpo || `📋 Plantilla enviada: ${tpl.name}`;
  variables.forEach((v, i) => { texto = texto.replace(new RegExp(`\\{\\{\\s*${i + 1}\\s*\\}\\}`, 'g'), v); });
  texto += `\n\n🛒 (Carrito abandonado: ${producto})`;
  try {
    await supabase.from('conversations').upsert({
      id: `57${tel10}`, contact_name: String((c as any).nombre ?? '').trim() || tel10,
      last_message: recortar(texto, 100), last_message_time: ahora, unread_count: 0, linea: 'funnel',
    }, { onConflict: 'id', ignoreDuplicates: true });
    // La foto del encabezado SÍ le llega al cliente; también se guarda en el chat
    // para que en el panel se vea igual que en su WhatsApp.
    if (imagen) {
      await supabase.from('messages').insert({
        id: `tpl-carrito-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: `57${tel10}`, content: imagen, role: 'agent', type: 'image',
        created_at: new Date(Date.parse(ahora) - 1).toISOString(),
      });
    }
    await supabase.from('messages').insert({
      id: `tpl-carrito-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: `57${tel10}`, content: texto, role: 'agent', type: 'text',
      whatsapp_id: r.wamid ?? null, created_at: ahora,
    });
  } catch (e) { console.error('[Carrito] no se pudo registrar en el chat:', e); }

  return NextResponse.json({ ok: true, plantilla: tpl.name, wamid: r.wamid });
}
