import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { ajustesDescuento, fotoPlantilla } from '@/lib/descuento-entrega';
import { listarPlantillas, subirImagenEjemplo } from '@/lib/whatsapp-templates';
import { TIENDA_DESCUENTO, nuevoCodigo } from '@/lib/descuento-tienda';

export const dynamic = 'force-dynamic';

/** Estado del descuento por entrega: interruptor, plantilla y últimos envíos. */
export async function GET(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const supabase = createServerSupabaseClient();
  const cfg = await ajustesDescuento(supabase);
  let plantillaEstado = 'no existe';
  let pideFoto = false;
  let tienda: { nombre: string; estado: string; en_uso: boolean } = { nombre: `${cfg.plantilla}_tienda`, estado: 'no existe', en_uso: false };
  try {
    const { plantillas } = await listarPlantillas();
    const conTienda = await columnaCodigo(supabase);
    const tt = (plantillas ?? []).find(p => p.name === `${cfg.plantilla}_tienda`);
    if (tt) tienda = { nombre: tt.name, estado: tt.status, en_uso: tt.status === 'APPROVED' && conTienda };
    if (!conTienda && tt) tienda.estado = `${tt.status} · falta la columna «codigo» en la base`;
    const v2 = (tienda.en_uso ? tt : null) ?? (plantillas ?? []).find(p => p.name === `${cfg.plantilla}_v2` && p.status === 'APPROVED');
    const t = v2 ?? (plantillas ?? []).find(p => p.name === cfg.plantilla);
    if (t) { plantillaEstado = t.status; pideFoto = t.tieneImagen; cfg.plantilla = t.name; }
  } catch { plantillaEstado = 'desconocido'; }
  const foto = await fotoPlantilla(supabase, cfg.plantilla);  // de la plantilla en uso (v2 si ya está aprobada)
  const { data: ultimos } = await supabase.from('descuentos_entrega')
    .select('guia, telefono, nombre, estado, motivo, enviado_at, creado_at').order('creado_at', { ascending: false }).limit(50);
  const { count: enviados } = await supabase.from('descuentos_entrega').select('guia', { count: 'exact', head: true }).eq('estado', 'enviado');
  // Resumen por CLIENTE (un cliente puede tener varias guías) + lista completa si se pide
  const { data: todos } = await supabase.from('descuentos_entrega')
    .select('guia, telefono, nombre, estado, motivo, monto, enviado_at, creado_at, usado_at')
    .order('creado_at', { ascending: false }).limit(5000);
  const filas = todos ?? [];
  const resumen = {
    clientes: new Set(filas.filter(f => f.estado === 'enviado').map(f => f.telefono)).size,
    enviados: filas.filter(f => f.estado === 'enviado').length,
    omitidos: filas.filter(f => f.estado === 'omitido').length,
    errores: filas.filter(f => f.estado === 'error').length,
    usados: filas.filter(f => f.usado_at).length,
    hoy: filas.filter(f => f.estado === 'enviado' && f.enviado_at && new Date(Date.parse(f.enviado_at) - 5 * 3600_000).toISOString().slice(0, 10) === new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10)).length,
  };
  const lista = req.nextUrl.searchParams.get('lista') === '1' ? filas : undefined;
  return NextResponse.json({ ...cfg, plantillaEstado, pideFoto, foto, enviados: enviados ?? 0, ultimos: ultimos ?? [], resumen, lista, tienda, tienda_url: TIENDA_DESCUENTO });
}

/** { activo } — al encender se guarda `desde`: solo cuentan las entregas de ahí en adelante. */
export async function POST(req: NextRequest) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const supabase = createServerSupabaseClient();
  if (b?.accion === 'crear_tienda') return crearPlantillaTienda(supabase);
  const actual = await ajustesDescuento(supabase);
  const activo = b?.activo === true;
  const valor = { ...actual, activo, ...(activo && !actual.activo ? { desde: new Date().toISOString() } : {}) };
  await supabase.from('ajustes_bot').upsert({ clave: 'descuento_entrega', valor, actualizado_at: new Date().toISOString() }, { onConflict: 'clave' });
  return NextResponse.json({ ok: true, ...valor });
}

async function columnaCodigo(supabase: any): Promise<boolean> {
  try { const { error } = await supabase.from('descuentos_entrega').select('codigo').limit(1); return !error; } catch { return false; }
}

/**
 * Crea en Meta la versión «_tienda» de la plantilla del descuento (11-nov-2026, dueño): MISMO texto, misma foto y
 * misma categoría que la que se está usando, más un botón «Ver la tienda» con el código del cliente
 * (…/web/tienda?d={{1}}). Mientras Meta no la apruebe sigue saliendo la de siempre; al aprobarla se usa sola.
 */
async function crearPlantillaTienda(supabase: any) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN, waba = process.env.WHATSAPP_WABA_ID;
  if (!token || !waba) return NextResponse.json({ error: 'Falta configurar WhatsApp.' }, { status: 500 });
  if (!(await columnaCodigo(supabase))) return NextResponse.json({ error: 'Primero hay que agregar la columna «codigo» a descuentos_entrega (SQL).' }, { status: 400 });
  const cfg = await ajustesDescuento(supabase);
  const nombre = `${cfg.plantilla}_tienda`;
  const { plantillas } = await listarPlantillas();
  if ((plantillas ?? []).some(p => p.name === nombre)) return NextResponse.json({ error: `La plantilla «${nombre}» ya existe en Meta.` }, { status: 409 });
  const base = [`${cfg.plantilla}_v2`, cfg.plantilla].map(n => (plantillas ?? []).find(p => p.name === n && p.status === 'APPROVED')).find(Boolean);
  if (!base) return NextResponse.json({ error: 'No hay una plantilla de descuento aprobada para copiar.' }, { status: 400 });

  const comps: any[] = base.components ?? [];
  const body = comps.find((c: any) => c.type === 'BODY');
  const footer = comps.find((c: any) => c.type === 'FOOTER');
  const botonesPrevios = (comps.find((c: any) => c.type === 'BUTTONS')?.buttons ?? []).filter((x: any) => x.type === 'QUICK_REPLY').slice(0, 2);
  const components: any[] = [];
  if (base.tieneImagen) {
    const foto = await fotoPlantilla(supabase, base.name);
    if (!foto) return NextResponse.json({ error: `Falta la foto de «${base.name}».` }, { status: 400 });
    const r = await fetch(foto);
    if (!r.ok) return NextResponse.json({ error: 'No se pudo leer la foto de la plantilla.' }, { status: 502 });
    const mime = r.headers.get('content-type') || 'image/jpeg';
    const handle = await subirImagenEjemplo(Buffer.from(await r.arrayBuffer()), mime);
    if (!handle) return NextResponse.json({ error: 'Meta no recibió la foto del encabezado.' }, { status: 502 });
    components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [handle] } });
    // La foto de los envíos de la nueva plantilla = la misma
    await supabase.from('configuracion').upsert({ clave: `plantilla_img_${nombre}`, valor: foto }, { onConflict: 'clave' });
  }
  components.push({ type: 'BODY', text: body?.text ?? '', ...(body?.example ? { example: body.example } : {}) });
  if (footer?.text) components.push({ type: 'FOOTER', text: footer.text });
  components.push({ type: 'BUTTONS', buttons: [
    { type: 'URL', text: 'Ver la tienda', url: `${TIENDA_DESCUENTO}?d={{1}}`, example: [`${TIENDA_DESCUENTO}?d=${nuevoCodigo()}`] },
    ...botonesPrevios.map((x: any) => ({ type: 'QUICK_REPLY', text: x.text })),
  ] });

  const res = await fetch(`https://graph.facebook.com/v19.0/${waba}/message_templates`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, category: base.category || 'MARKETING', language: base.language || 'es', components }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: String(data?.error?.error_user_msg ?? data?.error?.message ?? 'Meta no aceptó la plantilla') }, { status: 502 });
  return NextResponse.json({ ok: true, nombre, status: data.status });
}
