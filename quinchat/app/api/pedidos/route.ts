import { NextRequest, NextResponse } from 'next/server';
import { procesarPedidoFunnelish as procesarPedido } from '@/app/api/funnelish/webhook/route';
import { createServerSupabaseClient } from '@/lib/supabase';
import { enviarCompraMeta } from '@/lib/capi';
import { permitido } from '@/lib/rate-limit';
import { imagenPropia } from '@/lib/imagen-propia';

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

    // ── Límite de pedidos ────────────────────────────────────────────────────
    // Esta ruta es pública y cada pedido manda una plantilla de WhatsApp desde el
    // número de la marca y una compra a Meta. Sin límite, cualquiera la usaba
    // para escribirle a cualquier celular. Por hora:
    //  · 5 por teléfono: un comprador real hace 1, y con reintentos, doble clic
    //    o un segundo producto no pasa de 2-3.
    //  · 20 por IP: los operadores móviles ponen a muchos clientes detrás de la
    //    misma IP, así que se deja holgado; frena a quien los manda en bucle.
    // El conteo va en la base (tabla `rate_limits`, lib/rate-limit.ts), no en
    // memoria: vale para todas las instancias de Vercel. Si la tabla no existe o
    // falla, deja pasar (no tumba las ventas por un error del límite).
    const ip = (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim();
    if (ip && !(await permitido(`pedido-ip:${ip}`, 20, 3600))) {
      return NextResponse.json(
        { error: 'Recibimos muchos pedidos desde tu conexión. Espera un rato e inténtalo de nuevo, o escríbenos por WhatsApp.' },
        { status: 429 }
      );
    }
    if (!(await permitido(`pedido-tel:${tel}`, 5, 3600))) {
      return NextResponse.json(
        { error: 'Ya recibimos varios pedidos con este WhatsApp en la última hora. Si quieres cambiar algo, escríbenos por WhatsApp y te ayudamos.' },
        { status: 429 }
      );
    }

    // Fotos: solo se aceptan las de sitios propios (ver lib/imagen-propia.ts).
    const hostPeticion = req.headers.get('host') ?? '';
    const imagen = imagenPropia(b.imagen, hostPeticion);

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
        image: imagen,
      }],
      // Foto del producto elegido en la página; respaldo para la plantilla de WhatsApp
      imagen,
      // "Arma tu pack": fotos de cada buzo, para armar el collage x2 en el servidor
      imagenes: Array.isArray(b.imagenes)
        ? b.imagenes.map((u: unknown) => imagenPropia(u, hostPeticion)).filter(Boolean)
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

    // ── Avisar la compra a Meta desde el servidor (Conversions API) ──────────
    // Así la venta aparece en la campaña aunque el píxel del navegador se pierda.
    // Un pedido duplicado no es otra venta: no se avisa (desordena las campañas).
    const duplicado = resultado?.status === 'duplicado' || resultado?.duplicado === true;
    if (!duplicado) try {
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
