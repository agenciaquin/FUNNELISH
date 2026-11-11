import { NextRequest, NextResponse } from 'next/server';
import { unirDireccionBarrio } from '@/lib/direccion-barrio';
import { POST as procesarPedido } from '@/app/api/funnelish/webhook/route';
import { createServerSupabaseClient } from '@/lib/supabase';
import { enviarCompraMeta } from '@/lib/capi';
import { validarDescuento, marcarDescuentoUsado } from '@/lib/descuento-tienda';

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
    const direccionCompleta = unirDireccionBarrio(b.direccion, b.barrio);
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
        slug:         String(b.slug ?? '').trim(),   // embudo de origen (para atribución exacta)
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

    // ── DESCUENTO del cliente (código del botón «Ver la tienda», 11-nov-2026) ─────
    // Se vuelve a validar en el servidor: si sigue vigente se marca USADO por este pedido; el chat queda con la
    // etiqueta COMPRO EN DESCUENTO y una nota para el asesor. Si ya no vale (usado en otra compra / vencido), la
    // nota avisa que hay que cobrar el precio normal. Sin código, nada de esto corre.
    const codigoDesc = String(b.utms?.descuento ?? '').trim().toUpperCase();
    if (codigoDesc) {
      try {
        const supabase = createServerSupabaseClient();
        const d = await validarDescuento(supabase, codigoDesc);
        const ok = !!d && await marcarDescuentoUsado(supabase, codigoDesc, referencia);
        const conv = `57${tel}`;
        const { data: c } = await supabase.from('conversations').select('label, notas').eq('id', conv).maybeSingle();
        const dia = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
        const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
        const nota = ok
          ? `[${dia}] 🎁 Compró en la TIENDA con su descuento de ${pesos(d!.monto)} (código ${codigoDesc}). El valor del pedido (${pesos(Number(b.precio ?? 0))}) YA tiene el descuento.`
          : `[${dia}] ⚠️ Pidió en la tienda con el código de descuento ${codigoDesc}, pero ya estaba usado o vencido: cobrar el precio NORMAL (el pedido llegó con ${pesos(Number(b.precio ?? 0))}).`;
        if (c) {
          const labels = String(c.label ?? '').split('|').map((x: string) => x.trim()).filter(Boolean);
          const nuevas = ok && !labels.some((l: string) => l.toUpperCase() === 'COMPRO EN DESCUENTO') ? [...labels, 'COMPRO EN DESCUENTO'] : labels;
          await supabase.from('conversations').update({ label: nuevas.join(' | '), notas: [String(c.notas ?? '').trim(), nota].filter(Boolean).join('\n') }).eq('id', conv);
        }
        console.log(`[Pedidos] descuento ${codigoDesc} · ${ok ? 'aplicado' : 'NO válido'} · ${referencia}`);
      } catch (e) { console.warn('[Pedidos] descuento:', e); }
    }

    // ── Avisar la compra a Meta desde el servidor (Conversions API) ──────────
    // Así la venta aparece en la campaña aunque el píxel del navegador se pierda.
    try {
      const supabase = createServerSupabaseClient();
      const { data: f } = await supabase
        .from('funnels').select('pixel_meta, pixel_meta_token')
        .eq('slug', String(b.slug ?? '').trim()).maybeSingle();

      // Destinos: el píxel del embudo y, si la compra vino de un LIVE con su propio
      // píxel + token, también ese. Un mismo píxel se avisa UNA sola vez.
      const destinos = new Map<string, { token: string; url: string }>();
      if (f?.pixel_meta && f?.pixel_meta_token) {
        destinos.set(String(f.pixel_meta).trim(), {
          token: String(f.pixel_meta_token), url: `https://pedido.klixmant.shop/${String(b.slug ?? '').trim()}`,
        });
      }
      const liveSlug = String(b.live ?? '').trim();
      if (liveSlug && /^[a-z0-9-]{1,60}$/.test(liveSlug)) {
        const { data: lv } = await supabase.from('live_lives')
          .select('pixel_meta, pixel_meta_token').eq('slug', liveSlug).maybeSingle();
        if (lv?.pixel_meta && lv?.pixel_meta_token && !destinos.has(String(lv.pixel_meta).trim())) {
          destinos.set(String(lv.pixel_meta).trim(), { token: String(lv.pixel_meta_token), url: `https://pedido.klixmant.shop/${liveSlug}` });
        }
      }

      for (const [pixelId, d] of destinos) {
        await enviarCompraMeta({
          pixelId, token: d.token,
          valor: Number(b.precio ?? 0),
          telefono: tel, nombre: String(b.nombre ?? ''), apellidos: String(b.apellidos ?? ''),
          correo: String(b.correo ?? ''), ciudad: String(b.municipio ?? ''),
          departamento: String(b.departamento ?? ''), producto: String(b.variante ?? ''),
          eventId: referencia,   // mismo id que el píxel del navegador → sin duplicar
          fbc: b.fbc, fbp: b.fbp,
          urlOrigen: d.url,
        });
        console.log(`[Pedidos] CAPI Meta enviado · ${referencia} · píxel ${pixelId.slice(-4)}`);
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
