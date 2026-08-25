import { NextRequest, NextResponse } from 'next/server';
import { procesarPedidoFunnelish } from '@/app/api/funnelish/webhook/route';
import { createServerSupabaseClient } from '@/lib/supabase';
import { enviarCompraMeta } from '@/lib/capi';
import type { BaseLinea } from '@/lib/whatsapp-contexto';

export const maxDuration = 60;

/**
 * Recibe un pedido de nuestras propias páginas de venta (EMBUDO INTERNO).
 *
 * En vez de duplicar toda la lógica (packs, colores, fotos, detección de
 * duplicados, envío de la plantilla de WhatsApp), arma el pedido con la misma
 * forma que ya entiende el flujo existente y se lo entrega. Así cualquier
 * mejora que se haga allá sirve también aquí.
 *
 * MULTI-TENANT: el embudo (slug) pertenece a una empresa. De ahí se saca el
 * tenant y SUS credenciales de WhatsApp, para que el pedido se guarde con su
 * tenant_id y la confirmación salga por el número del cliente correcto.
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

    // ── ¿De qué empresa es este embudo? ──────────────────────────────────────
    // El slug es único global; el embudo lleva su tenant_id. Con eso cargamos
    // las credenciales de WhatsApp del cliente para responderle con SU número.
    const slug = String(b.slug ?? '').trim();
    const supabase = createServerSupabaseClient();
    const { data: f } = await supabase
      .from('funnels').select('tenant_id, pixel_meta, pixel_meta_token, modo_confirmacion, variantes')
      .eq('slug', slug).maybeSingle();

    // ── Stock: no dejar comprar algo agotado (stock 0 + "no dejar vender").
    // Si no hay stock definido, no bloquea nada (se vende todo).
    let variantesFunnel: any[] = [];
    try {
      const raw = (f as any)?.variantes;
      variantesFunnel = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
    } catch { variantesFunnel = []; }
    const nombrePedido = String(b?.variante ?? '').trim().toLowerCase();
    const vSel = variantesFunnel.find((v: any) => String(v?.nombre ?? '').trim().toLowerCase() === nombrePedido);

    // 1) Si el embudo está VINCULADO al catálogo, manda el stock REAL del catálogo.
    const catColorId = String(b?.catColorId ?? '').trim();
    let catRow: { id: any; stock: number | null; stock_politica: string | null } | null = null;
    if (catColorId) {
      const { data: cr } = await supabase
        .from('catalogo_colores').select('id, stock, stock_politica').eq('id', catColorId).maybeSingle();
      catRow = (cr as any) ?? null;
      if (catRow && typeof catRow.stock === 'number' && catRow.stock <= 0 && (catRow.stock_politica ?? 'bloquear') === 'bloquear') {
        return NextResponse.json({ error: 'Esa opción está agotada. Por favor elige otra disponible.' }, { status: 409 });
      }
    }
    // 2) Si no hay vínculo, se usa el stock propio del embudo (por variante).
    if (!catColorId && vSel && typeof vSel.stock === 'number' && vSel.stock <= 0 && (vSel.politicaStock ?? 'bloquear') === 'bloquear') {
      return NextResponse.json({ error: 'Esa opción está agotada. Por favor elige otra disponible.' }, { status: 409 });
    }

    let base: BaseLinea | undefined;
    if (f?.tenant_id) {
      const { data: t } = await supabase
        .from('tenants')
        .select('wa_access_token, wa_phone_number_id, wa_phone_number_id_ventas')
        .eq('id', f.tenant_id).maybeSingle();
      base = {
        tenantId: String(f.tenant_id),
        accessToken: t?.wa_access_token ?? undefined,
        phoneId: t?.wa_phone_number_id ?? undefined,
        phoneIdVentas: t?.wa_phone_number_id_ventas ?? undefined,
      };
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
      // Embudo del que entró el pedido (para el contador de ventas por embudo).
      slug,
      // Modo de confirmación del embudo: 'solo' apaga el bot tras enviar; 'agente'/null lo deja atendiendo.
      modo_confirmacion: (f as any)?.modo_confirmacion ?? null,
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

    // Se reenvía al flujo que ya guarda el pedido y le escribe al cliente,
    // pasándole el tenant (para aislar los datos y usar su WhatsApp).
    const interna = new NextRequest(new URL('/api/funnelish/webhook', req.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carga),
    });

    const resp = await procesarPedidoFunnelish(interna, base);
    const resultado = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error('[Pedidos] el pedido no se pudo procesar:', resultado);
      return NextResponse.json({ error: 'No pudimos registrar tu pedido.' }, { status: 500 });
    }

    console.log(`[Pedidos] pedido web ${referencia} · ${tel} · ${carga.products[0].name}`);

    // ── Stock: descontar 1 unidad de lo vendido (mejor esfuerzo). Nunca frena el pedido.
    try {
      if (catRow && typeof catRow.stock === 'number' && catRow.stock > 0) {
        // Vinculado al catálogo → descuenta el stock REAL del producto (fuente única).
        await supabase.from('catalogo_colores').update({ stock: Math.max(0, Math.round(catRow.stock) - 1) }).eq('id', catRow.id);
      } else if (!catColorId && vSel && typeof vSel.stock === 'number' && vSel.stock > 0) {
        // Sin vínculo → descuenta el stock propio del embudo (snapshot).
        const nuevas = variantesFunnel.map((v: any) =>
          (String(v?.nombre ?? '').trim().toLowerCase() === nombrePedido)
            ? { ...v, stock: Math.max(0, Math.round(v.stock) - 1) }
            : v
        );
        await supabase.from('funnels').update({ variantes: nuevas }).eq('slug', slug);
      }
    } catch (e) {
      console.warn('[Pedidos] no se pudo descontar stock:', e);
    }

    // ── Avisar la compra a Meta desde el servidor (Conversions API) ──────────
    // Así la venta aparece en la campaña aunque el píxel del navegador se pierda.
    try {
      if (f?.pixel_meta && f?.pixel_meta_token) {
        await enviarCompraMeta({
          pixelId: f.pixel_meta, token: f.pixel_meta_token,
          valor: Number(b.precio ?? 0),
          telefono: tel, nombre: String(b.nombre ?? ''), apellidos: String(b.apellidos ?? ''),
          correo: String(b.correo ?? ''), ciudad: String(b.municipio ?? ''),
          departamento: String(b.departamento ?? ''), producto: String(b.variante ?? ''),
          eventId: referencia,   // mismo id que el píxel del navegador → sin duplicar
          fbc: b.fbc, fbp: b.fbp,
          urlOrigen: `https://pedido.klixmant.shop/${slug}`,
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
