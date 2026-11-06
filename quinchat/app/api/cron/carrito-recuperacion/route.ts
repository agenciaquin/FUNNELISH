import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { enviarPlantillaCarrito, bloqueoCarrito } from '@/lib/carrito-plantilla';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}`
      || req.nextUrl.searchParams.get('secret') === secret;
}

/**
 * CARRITOS ABANDONADOS — envío AUTOMÁTICO de la plantilla aprobada.
 * Se llama cada 1–2 minutos (cron-job.org). Interruptor: ajustes_bot «carritos_auto»
 * { activo, minutos (10), max_horas (24) }. Apagado → no hace nada.
 *
 * Para cada carrito sin plantilla y sin actividad hace ≥ `minutos` (updated_at: si el
 * cliente sigue escribiendo, el conteo se reinicia), y no más viejo que `max_horas`:
 *   · si ya compró (cualquier pedido de ese teléfono) → auto_estado 'compro' (cancelado para siempre)
 *   · si ya tiene chat en QuinChat                    → 'chat_abierto' (no se le escribe)
 *   · si no → envía la plantilla (misma función que el botón: re-verifica justo antes
 *     y reserva el carrito de forma atómica, así nunca sale dos veces)    → 'enviado' / 'error'
 * (Reemplaza la versión anterior, que fallaba siempre: usaba una columna que no existe.)
 */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();

  const { data: aj } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'carritos_auto').maybeSingle();
  const cfg = (aj?.valor ?? {}) as { activo?: boolean; minutos?: number; max_horas?: number; desde?: string };
  if (cfg.activo !== true) return NextResponse.json({ ok: true, apagado: true });
  const minutos = Math.max(5, Number(cfg.minutos) || 10);
  const maxHoras = Math.min(72, Math.max(1, Number(cfg.max_horas) || 24));

  const ahora = Date.now();
  const { data: carritos, error } = await supabase.from('carritos_abandonados')
    .select('id, telefono, nombre, producto, talla, datos, created_at, updated_at')
    .eq('recuperado', false)
    .is('plantilla_enviada_at', null)
    .is('auto_estado', null)
    .lte('updated_at', new Date(ahora - minutos * 60_000).toISOString())
    .gte('created_at', new Date(Math.max(ahora - maxHoras * 3600_000, Date.parse(cfg.desde ?? '') || 0)).toISOString())
    .order('updated_at', { ascending: true })
    .limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const marcar = (id: string, auto_estado: string, extra: Record<string, any> = {}) =>
    supabase.from('carritos_abandonados').update({ auto_estado, auto_revisado_at: new Date().toISOString(), ...extra }).eq('id', id);

  const resumen = { revisados: 0, enviados: 0, compraron: 0, chatAbierto: 0, errores: 0, duplicados: 0 };
  // UN envío por cliente: si tiene varios carritos, se usa el más completo y los demás
  // quedan como 'duplicado' (nunca reciben plantilla aparte).
  const completitud = (c: any) => {
    const d = (c.datos && typeof c.datos === 'object') ? c.datos : {};
    return Object.entries(d).filter(([k, v]) => k !== 'imagenes' && typeof v === 'string' && (v as string).trim()).length
      + (c.producto ? 1 : 0) + (c.talla ? 1 : 0) + (c.nombre ? 1 : 0);
  };
  const elegido = new Map<string, any>();
  for (const c of carritos ?? []) {
    const t = String((c as any).telefono);
    const prev = elegido.get(t);
    if (!prev || completitud(c) > completitud(prev)) elegido.set(t, c);
  }
  for (const c of carritos ?? []) {
    if (elegido.get(String((c as any).telefono)) !== c) {
      await supabase.from('carritos_abandonados').update({ auto_estado: 'duplicado', auto_revisado_at: new Date().toISOString() }).eq('id', (c as any).id);
      resumen.duplicados++;
    }
  }
  for (const c of elegido.values()) {
    resumen.revisados++;
    const id = String((c as any).id);
    const tel10 = String((c as any).telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
    if (!/^3\d{9}$/.test(tel10)) { await marcar(id, 'error', { plantilla_error: 'Teléfono no válido' }); resumen.errores++; continue; }

    const b = await bloqueoCarrito(supabase, tel10);
    if (b === 'ya compró') { await marcar(id, 'compro'); resumen.compraron++; continue; }
    if (b === 'ya enviada a este número') { await marcar(id, 'duplicado'); resumen.duplicados++; continue; }
    if (b) { await marcar(id, 'chat_abierto'); resumen.chatAbierto++; continue; }

    const r = await enviarPlantillaCarrito(supabase, id);
    if (r.ok) { await marcar(id, 'enviado'); resumen.enviados++; }
    else if (r.bloqueado) { await marcar(id, r.error === 'ya compró' ? 'compro' : r.error === 'ya enviada a este número' ? 'duplicado' : 'chat_abierto'); }
    else if (r.status === 409) { /* otro proceso ya lo envió: no se toca */ }
    else { await marcar(id, 'error'); resumen.errores++; }
  }

  return NextResponse.json({ ok: true, minutos, ...resumen });
}
