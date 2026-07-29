import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage, sendVendedoresTemplate } from '@/lib/whatsapp';
import { entrarLinea } from '@/lib/whatsapp-contexto';
import { VENDEDORES, tipDelDia, mensajeFinDeSemana, nombreChat, CRONO_HEADER, CRONO_NOTA } from '@/lib/vendedores';

/** ¿El vendedor ya nos escribió alguna vez? (si no, hay que reenviarle la invitación) */
async function haRespondido(supabase: any, telefono: string): Promise<boolean> {
  const { data } = await supabase.from('messages')
    .select('id').eq('conversation_id', telefono).eq('role', 'user').limit(1).maybeSingle();
  return !!data;
}

export const dynamic = 'force-dynamic';

/**
 * Supervisión de vendedores por WhatsApp. Se ejecuta cada hora (cron-job.org).
 *
 *  - 8:00  → tip del día + "¿cuántas cerraste AYER?" (actualiza el total de ayer,
 *            porque venden de noche y a esa hora no se les escribe).
 *  - 10, 12, 14, 16, 18 → "¿cuántas llevas HOY?" (el último número manda).
 *  - 19:00 → resumen del día al supervisor.
 *  - Fuera de 8–19 hora Colombia: no molesta.
 */

// A quién le llega el resumen del día
const ADMINS = ['573167648391', '573187051499'];

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const bearer = req.headers.get('authorization') === `Bearer ${secret}`;
  const query  = req.nextUrl.searchParams.get('secret') === secret;
  return bearer || query;
}

function fechaColombia(offsetDias = 0): string {
  const t = Date.now() - 5 * 3_600_000 + offsetDias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Guarda el mensaje de QUINO en el chat del vendedor (para que se vea en el panel). */
async function guardarMsgVendedor(supabase: any, v: { telefono: string; nombre: string }, msg: string, wamid: string | null) {
  const iso = new Date().toISOString();
  try {
    await supabase.from('conversations').upsert({
      id: v.telefono, contact_name: v.nombre,
      last_message: msg.slice(0, 100), last_message_time: iso,
      bot_enabled: true, label: 'VENDEDOR', linea: 'ventas',
    }, { onConflict: 'id' });
    await supabase.from('messages').insert({
      id: `quino-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      conversation_id: v.telefono, content: msg, role: 'assistant', type: 'text',
      whatsapp_id: wamid, created_at: iso,
    });
  } catch { /* no bloquear el cron */ }
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  // Los vendedores escriben al número de ventas: se responde por ese mismo número.
  entrarLinea({
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID_VENTAS ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    tipo: 'ventas',
  });

  const supabase = createServerSupabaseClient();
  const colDate = new Date(Date.now() - 5 * 3_600_000); // hora Colombia
  const colHour = colDate.getUTCHours();
  const dow = colDate.getUTCDay();                       // 0=domingo, 6=sábado
  const esFinDeSemana = dow === 0 || dow === 6;
  const nowIso = new Date().toISOString();

  // Resumen del día al supervisor (se usa entre semana a las 7pm y el finde a las 2pm)
  const enviarResumen = async () => {
    const hoy = fechaColombia(0);
    const { data: reps } = await supabase
      .from('vendedor_reportes').select('nombre, telefono, ventas').eq('fecha', hoy);
    const filas = (reps ?? []).slice().sort((a: any, b: any) => (b.ventas ?? 0) - (a.ventas ?? 0));
    const total = filas.reduce((s: number, r: any) => s + (Number(r.ventas) || 0), 0);
    const reportaron = new Set(filas.map((r: any) => r.telefono));
    const sinReportar = VENDEDORES.filter(v => !reportaron.has(v.telefono));
    const medallas = ['🥇', '🥈', '🥉'];
    const lineas = filas.length
      ? filas.map((r: any, i: number) => `${medallas[i] ?? '•'} ${r.nombre}: *${r.ventas}*`).join('\n')
      : '_Nadie reportó ventas hoy._';
    const resumen =
      `📊 *CIERRE DEL DÍA — VENDEDORES*\n${hoy}\n\n${lineas}\n\n` +
      `🧮 *Total del equipo: ${total} ventas*\n` +
      (sinReportar.length
        ? `\n⚠️ Sin reportar hoy (${sinReportar.length}): ${sinReportar.map(v => v.nombre.split(' ')[0]).join(', ')}`
        : `\n✅ Todos reportaron.`);
    for (const admin of ADMINS) { try { await sendTextMessage(admin, resumen); } catch { /* ignorar */ } }
    return { total, reportaron: filas.length };
  };

  // ── Estado del equipo (solo lectura, no envía nada): ?estado=1 ──────────────
  // Muestra quién ya respondió (activo) y quién sigue pendiente.
  if (req.nextUrl.searchParams.get('estado') === '1') {
    const detalle: { nombre: string; telefono: string; activo: boolean }[] = [];
    for (const v of VENDEDORES) {
      detalle.push({ nombre: v.nombre, telefono: v.telefono, activo: await haRespondido(supabase, v.telefono) });
    }
    return NextResponse.json({
      status: 'ok',
      activos: detalle.filter(d => d.activo).map(d => d.nombre),
      pendientes: detalle.filter(d => !d.activo).map(d => d.nombre),
      detalle,
    });
  }

  // ── Diagnóstico de tablas (?diag=1): prueba insertar y devuelve el error ────
  // Sirve para saber si las tablas existen y por qué no se guardan los reportes.
  if (req.nextUrl.searchParams.get('diag') === '1') {
    const hoy = fechaColombia(0);
    const rIns = await supabase.from('vendedor_reportes')
      .insert({ telefono: 'diag-000', nombre: 'diag', fecha: hoy, ventas: 0, actualizado_at: nowIso });
    const pIns = await supabase.from('vendedor_preguntas')
      .insert({ telefono: 'diag-000', tipo: 'hoy', enviado_at: nowIso });
    // Limpiar las filas de prueba
    await supabase.from('vendedor_reportes').delete().eq('telefono', 'diag-000');
    await supabase.from('vendedor_preguntas').delete().eq('telefono', 'diag-000');
    const { count } = await supabase.from('vendedor_reportes')
      .select('*', { count: 'exact', head: true }).eq('fecha', hoy);
    return NextResponse.json({
      status: 'diag',
      vendedor_reportes: rIns.error ? `ERROR: ${rIns.error.message}` : 'OK (existe y acepta insert)',
      vendedor_preguntas: pIns.error ? `ERROR: ${pIns.error.message}` : 'OK (existe y acepta insert)',
      reportes_hoy: count ?? 0,
      fecha: hoy,
    });
  }

  // ── Invitación: SOLO se envía el LUNES a las 8:00 a.m. (o forzada con &force=1)
  // Antes se disparaba cada hora y llegaba "Enviada a 0" de spam. Ahora queda
  // pausada y la próxima sale automáticamente el lunes 8am.
  if (req.nextUrl.searchParams.get('invitar') === '1') {
    const forzar = req.nextUrl.searchParams.get('force') === '1';
    const esLunes8am = dow === 1 && colHour === 8;
    if (!forzar && !esLunes8am) {
      return NextResponse.json({ status: 'pausado', accion: 'invitar', motivo: 'la invitación solo se envía el lunes 8am (usa &force=1 para forzar)', dow, colHour });
    }
    const okNombres: string[] = [];
    const fallaron: string[] = [];
    const yaActivos: string[] = [];
    for (const v of VENDEDORES) {
      if (await haRespondido(supabase, v.telefono)) { yaActivos.push(v.nombre); continue; }
      const wamid = await sendVendedoresTemplate(v.telefono, v.nombre.split(' ')[0]);
      if (wamid) okNombres.push(v.nombre); else fallaron.push(v.nombre);
    }
    // Si no se invitó a nadie (todos activos), no molestar al admin con "Enviada a 0".
    if (okNombres.length === 0 && fallaron.length === 0) {
      return NextResponse.json({ status: 'ok', accion: 'invitar', invitados: 0, yaActivos: yaActivos.length, nota: 'todos activos, no se envió nada' });
    }
    // Confirmación al admin (3143534918) para saber que salió bien
    const resumen =
      `📣 *Invitación de QUINO enviada*\n` +
      `✅ Enviada a ${okNombres.length}: ${okNombres.join(', ') || '—'}\n` +
      (fallaron.length ? `❌ Falló a ${fallaron.length}: ${fallaron.join(', ')}\n` : '') +
      (yaActivos.length ? `🟢 Ya activos (no reenviado): ${yaActivos.join(', ')}` : '');
    try { await sendTextMessage('573143534918', resumen); } catch { /* no bloquear */ }

    return NextResponse.json({ status: 'ok', accion: 'invitar', invitados: okNombres.length, fallaron: fallaron.length, yaActivos: yaActivos.length });
  }

  // ── Envío MANUAL del cierre de fin de semana ahora mismo: ?cierre=1 ─────────
  if (req.nextUrl.searchParams.get('cierre') === '1') {
    let enviados = 0;
    for (const v of VENDEDORES) {
      const wamid = await sendTextMessage(v.telefono, mensajeFinDeSemana(v.nombre));
      if (wamid) enviados++;
    }
    return NextResponse.json({ status: 'ok', accion: 'cierre-manual', enviados });
  }

  // ── 8:00 — tip del día + pregunta de AYER (ya NO se reenvía presentación) ────
  if (colHour === 8) {
    const tip = tipDelDia();
    let enviados = 0;
    for (const v of VENDEDORES) {
      const nombre = nombreChat(v);
      const msg =
        `¡Buenos días, ${nombre}! ☀️✨\n\n` +
        `💡 *Tip de hoy:* ${tip}\n\n` +
        `${CRONO_HEADER}\n` +
        `Para arrancar el día: ¿con cuántas ventas cerraste *ayer*? Respóndeme solo el número 🙌\n\n` +
        `${CRONO_NOTA}`;
      const wamid = await sendTextMessage(v.telefono, msg);
      if (wamid) {
        enviados++;
        try {
          await supabase.from('vendedor_preguntas').insert({
            telefono: v.telefono, tipo: 'ayer', enviado_at: nowIso,
          });
        } catch { /* ignorar */ }
        // Guardar el mensaje para que SÍ se vea en el chat del vendedor en el panel
        await guardarMsgVendedor(supabase, v, msg, wamid);
      }
    }

    // Saludo de COMPAÑERA a Lilibeth (soporte): tono de equipo, NO de cliente.
    const LILIBETH = '573187051499';
    const saludosLili = [
      `¡Hola Lilibeth! ☀️ Arrancamos un nuevo día con toda 💪 Hoy vamos a confirmar muchas ventas. ¡Somos un equipazo! 🚀`,
      `¡Buenos días, compañera! 😊 Listas para otro día de éxitos. Vamos a cerrar muchas ventas juntas 🔥`,
      `¡Hola Lilibeth! 🙌 Nuevo día, nuevas oportunidades. Con toda la energía, que hoy la rompemos 💥`,
      `¡Buenos días, Lili! ✨ A darlo todo hoy. Cada chat es una venta que podemos cerrar 💪💰`,
    ];
    try {
      const saludo = saludosLili[Math.floor(Math.random() * saludosLili.length)];
      const wamid = await sendTextMessage(LILIBETH, saludo);
      await supabase.from('messages').insert({
        id: `lili-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversation_id: LILIBETH, content: saludo, role: 'assistant', type: 'text',
        whatsapp_id: wamid, created_at: nowIso,
      });
    } catch { /* no bloquear */ }

    return NextResponse.json({ status: 'ok', accion: 'tip+ayer', enviados });
  }

  // ── Cortes de HOY. Entre semana hasta las 6pm; fin de semana solo hasta 12m ─
  const horasCorte = esFinDeSemana ? [10, 12] : [10, 12, 14, 16, 18];
  if (horasCorte.includes(colHour)) {
    let enviados = 0;
    for (const v of VENDEDORES) {
      const nombre = nombreChat(v);
      const msg =
        `${CRONO_HEADER}\n` +
        `¡Hola, ${nombre}! 💪 Corte del día: ¿cuál es el *total* de ventas que llevas HOY? ` +
        `(el acumulado de todo el día, no solo las de las últimas 2 horas). ` +
        `Respóndeme solo el número total (ej: 5). Si aún no cierras ninguna, escribe 0 🚀\n\n` +
        `${CRONO_NOTA}`;
      const wamid = await sendTextMessage(v.telefono, msg);
      if (wamid) {
        enviados++;
        try {
          await supabase.from('vendedor_preguntas').insert({
            telefono: v.telefono, tipo: 'hoy', enviado_at: nowIso,
          });
        } catch { /* ignorar */ }
        await guardarMsgVendedor(supabase, v, msg, wamid);
      }
    }
    return NextResponse.json({ status: 'ok', accion: 'corte-hoy', enviados });
  }

  // ── FIN DE SEMANA a las 2pm: cierre motivador + resumen, y quietos al lunes ──
  if (esFinDeSemana && colHour === 14) {
    let enviados = 0;
    for (const v of VENDEDORES) {
      const wamid = await sendTextMessage(v.telefono, mensajeFinDeSemana(v.nombre));
      if (wamid) enviados++;
    }
    const r = await enviarResumen();
    return NextResponse.json({ status: 'ok', accion: 'cierre-finde', enviados, ...r });
  }

  // ── ENTRE SEMANA a las 7pm: resumen del día al supervisor ──────────────────
  if (!esFinDeSemana && colHour === 19) {
    const r = await enviarResumen();
    return NextResponse.json({ status: 'ok', accion: 'resumen', ...r });
  }

  return NextResponse.json({ status: 'fuera-de-horario', colHour, esFinDeSemana });
}
