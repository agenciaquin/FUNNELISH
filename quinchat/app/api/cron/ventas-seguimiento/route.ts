import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';
import { conLinea, tipoDeLinea } from '@/lib/whatsapp-contexto';
import { esVendedor } from '@/lib/vendedores';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * SEGUIMIENTO DE VENTAS (sin IA, sin descuentos, siempre dentro de la ventana de 24 h).
 *
 * Hay DOS casos:
 *
 * A) Recibió el FORMULARIO DE DATOS y no respondió → UN recordatorio a las ~3 h.
 *
 * B) Recibió el CATÁLOGO / estaba eligiendo y se quedó callado (era el 59 % de los
 *    chats y antes NO se les escribía nunca) → máximo DOS toques:
 *      · Toque 1: a los ~45 min de silencio. Corto, con la elección fácil (número).
 *      · Toque 2: a las ~18 h (antes de que cierre la ventana de 24 h). Quita el
 *        riesgo: pagas al recibir, envío gratis.
 *
 * Nunca le escribe a: vendedores, chats con bot apagado, NO ENVIAR RECORDATORIO,
 * ventas cerradas / cancelados, quien dijo que no le interesa, o quien ya compró.
 * Si el cliente vuelve a escribir, el contador se reinicia (ventas.ts).
 * Se llama desde un cron externo (cada 15–30 min es lo ideal).
 */

const MIN = 60_000;
const H = 60 * MIN;

const TOQUE1_MIN_SILENCIO = 45 * MIN;   // toque 1: 45 min sin respuesta
const TOQUE2_MIN_SILENCIO = 18 * H;     // toque 2: 18 h sin respuesta…
const TOQUE2_MIN_TRAS_T1  = 3 * H;      // …y al menos 3 h después del toque 1
const FORM_MIN_SILENCIO   = 3 * H;      // formulario: 3 h
const VENTANA_SEGURA      = 23 * H;     // margen dentro de las 24 h de WhatsApp

// Formulario de datos (caso A)
const RECORDATORIOS_FORM = [
  (n: string) => `¡Hola${n ? ` ${n}` : ''}! 😊 Quedé pendiente de tus *datos de envío* para dejar tu pedido listo y despacharlo. ¿Seguimos? 🚚`,
  (n: string) => `¡Hola${n ? ` ${n}` : ''}! 👋 Solo me faltan tus *datos* para procesar tu pedido y enviártelo. Cuando quieras me los pasas y lo dejo listo 🙌`,
];

// Señal de que el bot pidió los DATOS de envío (o la confirmación con los datos).
const ES_FORMULARIO = /datos de env|datos para el env|nombre completo|celular:|direcci[oó]n:|direcci[oó]n con barrio|responde:? *confirmo|confirma (que )?estos datos/i;
// Señal de que el cliente NO está interesado → no se le vuelve a escribir.
const NO_INTERESADO = /no me interesa|no gracias|ya no (lo )?quiero|no lo quiero|no deseo|no quiero nada|ya compr|dejal[oa] as[ií]|no voy a comprar|no estoy interesad|no me escrib|no molest/i;
// Etiquetas donde no se interviene.
const SKIP_LABEL = /VENTA REALIZADA|CANCELAD|ANULAD|NO INTERES|NO ENVIAR RECORDATORIO|VENDEDOR|HUMANO|PEDIDO PROGRAMADO|ABONO POR VERIFICAR/;
// La lista numerada que manda el bot con el catálogo ("Respóndeme solo con el número").
const ES_LISTA_NUMERADA = /resp[oó]ndeme solo con el \*?n[uú]mero/i;

/** "*BUZO MOTO KTM REFLECTIVO* 🔥" → "BUZO MOTO KTM REFLECTIVO" (último modelo mostrado). */
function productoDelChat(textosBot: string[]): string {
  for (const t of textosBot) {
    const m = t.match(/\*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 .&'-]{2,45})\*\s*(🔥|🏍)/);
    if (m) return m[1].trim();
  }
  return '';
}

/** "BUZO MOTO KTM REFLECTIVO" → "buzo KTM" (más natural en un mensaje corto). */
function nombreCorto(p: string): string {
  const marca = p.replace(/^BUZO\s+MOTO\s+/i, '').replace(/\s+REFLECTIVO$/i, '').trim();
  if (!marca) return 'buzo';
  return /^BUZO/i.test(p) ? `buzo ${marca}` : marca.charAt(0) + marca.slice(1).toLowerCase();
}

/** Primer nombre usable ("Manuel Ramirez" → "Manuel"); vacío si es un correo, "…", etc. */
function primerNombre(contacto: string): string {
  const t = String(contacto ?? '').trim().split(/\s+/)[0] ?? '';
  if (!/^[\p{L}]{2,15}$/u.test(t)) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function toque1(nombre: string, producto: string, hayLista: boolean, preguntoTalla: boolean): string {
  const prod = producto ? ` del *${nombreCorto(producto)}*` : '';
  if (preguntoTalla) {
    return `${nombre ? `${nombre}, ¿` : '¿'}qué talla usas normalmente? 😊 Así te confirmo que esté disponible y te lo dejo listo 🙌`;
  }
  const variantes = hayLista
    ? [
        `${nombre ? `${nombre}, ¿` : '¿'}te gustó alguno${prod}? 😍 Respóndeme solo con el *número* del color y te digo las tallas disponibles 👌`,
        `¿Cuál color te gustó más${prod}? 😊 Con que me mandes el *número* te lo aparto 🙌`,
      ]
    : [
        `${nombre ? `${nombre}, ¿` : '¿'}te gustó algún color${prod}? 😊 Dime cuál y te ayudo con la talla 👌`,
        `¿Pudiste ver los colores${prod}? 😍 Dime el que más te gustó y te lo dejo listo 🙌`,
      ];
  return variantes[Math.floor(Math.random() * variantes.length)];
}

function toque2(nombre: string, producto: string): string {
  const prod = producto ? `tu *${nombreCorto(producto)}*` : 'tu pedido';
  const variantes = [
    `¡Hola${nombre ? ` ${nombre}` : ''}! 👋 Te recuerdo que con nosotros *pagas solo cuando te llegue* 📦 y el envío es *gratis* 🚚 ¿Te dejo listo ${prod}? Solo dime color y talla 😊`,
    `¡Hola${nombre ? ` ${nombre}` : ''}! 😊 Sigo pendiente por si quieres ${prod}. No pagas nada por adelantado: *pagas al recibir* y el envío es gratis 🚚 ¿Qué color y talla te separo?`,
  ];
  return variantes[Math.floor(Math.random() * variantes.length)];
}

export async function GET(_req: NextRequest) {
  const numeroVentas = process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS;
  if (!numeroVentas) return NextResponse.json({ ok: true, nota: 'No hay número de ventas configurado.' });

  const ahora = Date.now();
  // Solo en horario Colombia razonable (8:00–21:00): nada de mensajes de madrugada.
  const colHour = new Date(ahora - 5 * H).getUTCHours();
  if (colHour < 8 || colHour >= 21) return NextResponse.json({ ok: true, nota: 'fuera-de-horario', colHour });

  const supabase = createServerSupabaseClient();
  const desde = new Date(ahora - VENTANA_SEGURA).toISOString();
  const hasta = new Date(ahora - 40 * MIN).toISOString();

  // Chats de VENTAS con actividad en las últimas 23 h y al menos 40 min quietos,
  // bot prendido y sin el seguimiento terminado.
  const { data: convs } = await supabase
    .from('conversations')
    .select('id, contact_name, label, seguimiento_n, seguimiento_at')
    .eq('linea', 'ventas')
    .neq('bot_enabled', false)
    .is('seguimiento_enviado', null)
    .gte('last_message_time', desde)
    .lte('last_message_time', hasta)
    .order('last_message_time', { ascending: true })
    .limit(250);

  if (!convs?.length) return NextResponse.json({ ok: true, enviados: 0 });

  const resumen = { form: 0, toque1: 0, toque2: 0, saltados: 0, esperando: 0 };

  let enviadosTanda = 0;
  const enviar = async (id: string, texto: string, cambios: Record<string, unknown>) => {
    enviadosTanda++;
    const wamid = await sendTextMessage(id, texto);
    await supabase.from('messages').insert({
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversation_id: id, content: texto, role: 'assistant', type: 'text',
      whatsapp_id: wamid, created_at: new Date().toISOString(),
    });
    await supabase.from('conversations')
      .update({ ...cambios, last_message: texto.slice(0, 100), last_message_time: new Date().toISOString(), unread_count: 0 })
      .eq('id', id);
  };

  await conLinea({ phoneId: numeroVentas, tipo: tipoDeLinea(numeroVentas) }, async () => {
    for (const c of convs) {
      // Tope por corrida (evita pasarse del tiempo máximo de la función).
      if (enviadosTanda >= 35) break;
      const id = String(c.id);
      // Ya recibió el toque 1 y aún no toca el 2: se salta sin consultar mensajes.
      const n0 = Number((c as any).seguimiento_n ?? 0);
      const t1 = (c as any).seguimiento_at ? new Date((c as any).seguimiento_at).getTime() : 0;
      if (n0 === 1 && t1 && ahora - t1 < TOQUE2_MIN_SILENCIO - 2 * H) { resumen.esperando++; continue; }
      const label = String((c as any).label ?? '').toUpperCase();
      const terminar = () => supabase.from('conversations').update({ seguimiento_enviado: true }).eq('id', id);

      // Vendedores del equipo y etiquetas donde no se interviene.
      if (esVendedor(id) || SKIP_LABEL.test(label)) { await terminar(); resumen.saltados++; continue; }

      // Últimos mensajes del chat (quién habló de último, qué se mostró).
      const { data: msgs } = await supabase.from('messages')
        .select('role, content, type, created_at').eq('conversation_id', id)
        .order('created_at', { ascending: false }).limit(15);
      const lista = msgs ?? [];
      const ultimo = lista[0];

      // El último debe ser NUESTRO (el cliente se quedó callado). Si el último es
      // del cliente, el bot/humano está por responder: no se interviene.
      if (!ultimo || ultimo.role === 'user') { await terminar(); resumen.saltados++; continue; }

      // Desinterés explícito → nunca más.
      if (lista.some(m => m.role === 'user' && NO_INTERESADO.test(String(m.content ?? '')))) { await terminar(); resumen.saltados++; continue; }

      // Ventana de 24 h: se cuenta desde el último mensaje ENTRANTE.
      const ultCli = lista.find(m => m.role === 'user');
      if (!ultCli) { await terminar(); resumen.saltados++; continue; }
      const silencio = ahora - new Date(ultCli.created_at).getTime();
      if (silencio > VENTANA_SEGURA) { await terminar(); resumen.saltados++; continue; }

      // Ya compró → no recordar.
      const tel = id.replace(/^57/, '').slice(-10);
      const { data: pedido } = await supabase.from('clientes_funnelish')
        .select('id').eq('telefono', tel).eq('confirmado', true).limit(1).maybeSingle();
      if (pedido) { await terminar(); resumen.saltados++; continue; }

      const nombre = primerNombre(String((c as any).contact_name ?? ''));
      const textosBot = lista.filter(m => m.role !== 'user' && m.type === 'text').map(m => String(m.content ?? ''));

      // ── Caso A: el bot ya pidió los DATOS → UN recordatorio a las 3 h ────────
      if (textosBot.some(t => ES_FORMULARIO.test(t))) {
        if (silencio < FORM_MIN_SILENCIO) { resumen.esperando++; continue; }
        const texto = RECORDATORIOS_FORM[Math.floor(Math.random() * RECORDATORIOS_FORM.length)](nombre);
        await enviar(id, texto, { seguimiento_enviado: true });
        resumen.form++;
        continue;
      }

      // ── Caso B: vio el catálogo / estaba eligiendo y se quedó callado ───────
      const n = Number((c as any).seguimiento_n ?? 0);
      const producto = productoDelChat(textosBot);
      const hayLista = textosBot.some(t => ES_LISTA_NUMERADA.test(t));

      if (n <= 0) {
        if (silencio < TOQUE1_MIN_SILENCIO) { resumen.esperando++; continue; }
        // Si ya pasó mucho (ej. el cron no corrió de noche), se salta directo al toque 2.
        if (silencio >= TOQUE2_MIN_SILENCIO) {
          await enviar(id, toque2(nombre, producto), { seguimiento_n: 2, seguimiento_at: new Date().toISOString(), seguimiento_enviado: true });
          resumen.toque2++;
          continue;
        }
        // ¿Lo último que preguntamos fue la talla? (y no la lista de colores)
        const ultimoTextoBot = textosBot[0] ?? '';
        const preguntoTalla = /talla/i.test(ultimoTextoBot) && !ES_LISTA_NUMERADA.test(ultimoTextoBot) && /\?/.test(ultimoTextoBot);
        await enviar(id, toque1(nombre, producto, hayLista, preguntoTalla), { seguimiento_n: 1, seguimiento_at: new Date().toISOString() });
        resumen.toque1++;
        continue;
      }

      if (n === 1) {
        const t1 = (c as any).seguimiento_at ? new Date((c as any).seguimiento_at).getTime() : 0;
        if (silencio < TOQUE2_MIN_SILENCIO || ahora - t1 < TOQUE2_MIN_TRAS_T1) { resumen.esperando++; continue; }
        await enviar(id, toque2(nombre, producto), { seguimiento_n: 2, seguimiento_at: new Date().toISOString(), seguimiento_enviado: true });
        resumen.toque2++;
        continue;
      }

      // Ya recibió los 2 toques.
      await terminar(); resumen.saltados++;
    }
  });

  return NextResponse.json({ ok: true, ...resumen });
}
