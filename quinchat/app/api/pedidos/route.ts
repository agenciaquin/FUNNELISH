import { NextRequest, NextResponse } from 'next/server';
import { POST as procesarPedido } from '@/app/api/funnelish/webhook/route';
import { createServerSupabaseClient } from '@/lib/supabase';
import { enviarCompraMeta } from '@/lib/capi';

export const maxDuration = 60;

/**
 * Recibe un pedido de nuestras propias páginas de venta.
 *
 * En vez de duplicar toda la lógica (packs, colores, fotos, detección de
 * duplicados, envío de la plantilla de WhatsApp), arma el pedido con la misma
 * forma que ya entiende el flujo existente y se lo entrega. Así cualquier
 * mejora que se haga allá sirve también aquí.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();

    const requeridos = ['nombre', 'apellidos', 'whatsapp', 'direccion', 'barrio', 'municipio', 'departamento'];
    for (const campo of requeridos) {
      if (!String(b?.[campo] ?? '').trim()) {
        return NextResponse.json({ error: `Falta ${campo}` }, { status: 400 });
      }
    }

    const tel = String(b.whatsapp).replace(/\D/g, '').replace(/^57/, '');
    if (!/^3\d{9}$/.test(tel)) {
      return NextResponse.json(
        { error: 'El WhatsApp debe ser un celular de 10 dígitos que empiece por 3.' },
        { status: 400 }
      );
    }

    // El barrio va pegado a la dirección: así llega completa y el bot no
    // tiene que perseguirla después.
    const direccionCompleta = `${String(b.direccion).trim()}, ${String(b.barrio).trim()}`;
    // La referencia la genera la página, para que el pedido y los eventos de
    // los píxeles compartan el mismo identificador
    const referencia = String(b.referencia ?? '').trim() || `web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const carga = {
      id: referencia,
      event: 'purchase',
      first_name: String(b.nombre).trim(),
      last_name:  String(b.apellidos).trim(),
      phone: tel,
      address: direccionCompleta,
      city:  String(b.municipio).trim(),
      state: String(b.departamento).trim(),
      optin_email: String(b.correo ?? '').trim(),
      products: [{
        name: String(b.variante ?? '').trim(),
        variant_name: String(b.talla ?? '').trim(),
        amount: Number(b.precio ?? 0),
        image: String(b.imagen ?? '').trim() || undefined,
      }],
      // Foto del producto elegido en la página; respaldo para la plantilla de WhatsApp
      imagen: String(b.imagen ?? '').trim() || undefined,
      // "Arma tu pack": fotos de cada buzo, para armar el collage x2 en el servidor
      imagenes: Array.isArray(b.imagenes)
        ? b.imagenes.filter((u: any) => typeof u === 'string' && u.startsWith('http'))
        : undefined,
      meta: {
        utm_source:   b.utms?.utm_source   ?? '',
        utm_medium:   b.utms?.utm_medium   ?? '',
        utm_campaign: b.utms?.utm_campaign ?? '',
        utm_content:  b.utms?.utm_content  ?? '',
        utm_term:     b.utms?.utm_term     ?? '',
        referrer:     b.referrer ?? '',
      },
    };

    // Se reenvía al flujo que ya guarda el pedido y le escribe al cliente
    const interna = new NextRequest(new URL('/api/funnelish/webhook', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carga),
    });

    const resp = await procesarPedido(interna);
    const resultado = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error('[Pedidos] el pedido no se pudo procesar:', resultado);
      return NextResponse.json({ error: 'No pudimos registrar tu pedido.' }, { status: 500 });
    }

    console.log(`[Pedidos] pedido web ${referencia} · ${tel} · ${carga.products[0].name}`);

    // ── Avisar la compra a Meta desde el servidor (Conversions API) ──────────
    // Así la venta aparece en la campaña aunque el píxel del navegador se pierda.
    try {
      const supabase = createServerSupabaseClient();
      const { data: f } = await supabase
        .from('funnels').select('pixel_meta, pixel_meta_token')
        .eq('slug', String(b.slug ?? '').trim()).maybeSingle();
      if (f?.pixel_meta && f?.pixel_meta_token) {
        await enviarCompraMeta({
          pixelId: f.pixel_meta, token: f.pixel_meta_token,
          valor: Number(b.precio ?? 0),
          telefono: tel, nombre: String(b.nombre ?? ''), apellidos: String(b.apellidos ?? ''),
          correo: String(b.correo ?? ''), ciudad: String(b.municipio ?? ''),
          departamento: String(b.departamento ?? ''), producto: String(b.variante ?? ''),
          eventId: referencia,   // mismo id que el píxel del navegador → sin duplicar
          fbc: b.fbc, fbp: b.fbp,
          urlOrigen: `https://pedido.klixmant.shop/${String(b.slug ?? '').trim()}`,
        });
        console.log(`[Pedidos] CAPI Meta enviado · ${referencia}`);
      }
    } catch (e) {
      console.warn('[Pedidos] CAPI Meta no se pudo enviar:', e);
    }

    return NextResponse.json({ ok: true, referencia });
  } catch (e: any) {
    console.error('[Pedidos] error:', e?.message);
    return NextResponse.json({ error: 'No pudimos registrar tu pedido.' }, { status: 500 });
  }
}
