import { chat } from '@/lib/quinchat/claude';
import { createServerSupabaseClient } from '@/lib/supabase';
import { EVIDENCIA_CATALOGO_ID } from '@/lib/sin-evidencia';
import { buscarCandidatos, resolverVariante, nombreGenero, type Candidato } from './ia';
import { sinTildes, limpiarTalla } from './catalogo';

/**
 * «ENVIAR AL PANEL DE EFFI» desde un chat de cliente (07-nov-2026).
 *
 * 1) prellenarDesdeChat: junta lo que ya se sabe del pedido (clientes_funnelish) y lo que el
 *    cliente escribió en el chat (IA), y propone el producto del catálogo KLIXMANT.
 *    NO escribe nada.
 * 2) crearDesdeChat: con los datos FINALES que el asesor revisó y confirmó en la ventana,
 *    crea la preventa en el panel «Ventas Vendedores» (vv_ventas + vv_items) en estado
 *    'confirmada'. El ID de variante y el SKU se recalculan aquí desde el catálogo: nunca se
 *    confía en los que manda el navegador. No toca Effi, ni el pedido, ni el chat.
 */

function extraerJSON(t: string): any {
  const s = String(t ?? '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const i = s.indexOf('{'); const f = s.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(s.slice(i, f + 1)); } catch { return null; }
}
const s = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown) => { const x = Number(String(v ?? '').replace(/[^\d]/g, '')); return x > 0 ? x : null; };
export const tel10De = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);

/**
 * Vendedor en Effi según el chat de donde sale la venta (regla del dueño, 08-nov-2026):
 * Chat Funnel → FUNNELISTH LANDING · Chat WhatsApp (línea «ventas») → QUINO AGENCIA.
 * La clave va en vv_ventas.vendedor_tel y effi-remision.ts la traduce al tercero de Effi.
 */
export async function vendedorDelChat(supabase: any, conv: string): Promise<{ clave: string; nombre: string }> {
  const { data } = await supabase.from('conversations').select('linea').eq('id', conv).maybeSingle();
  return data?.linea === 'ventas'
    ? { clave: 'panel-whatsapp', nombre: 'QUINO AGENCIA' }
    : { clave: 'panel-funnel', nombre: 'FUNNELISTH LANDING' };
}

function codigoNuevo(): string {
  const d = new Date(Date.now() - 5 * 3600_000).toISOString(); // hora Colombia
  return `PV-${d.slice(0, 10).replace(/-/g, '')}-${d.slice(11, 19).replace(/:/g, '')}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
}

/** Foto del producto más reciente que mandó el bot/asesor en el chat. */
async function fotoDelChat(supabase: any, conv: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('messages').select('content')
      .eq('conversation_id', conv).eq('type', 'image').in('role', ['assistant', 'agent'])
      .not('id', 'like', 'evid-%').not('content', 'ilike', `%${EVIDENCIA_CATALOGO_ID}%`)
      .order('created_at', { ascending: false }).limit(5);
    const f = (data ?? []).find((m: any) => typeof m.content === 'string' && m.content.startsWith('http'));
    return f?.content ?? null;
  } catch { return null; }
}

const SISTEMA =
  `Eres el asistente de despacho de una tienda colombiana de buzos y chaquetas (Klixmant). ` +
  `Te doy los DATOS DEL PEDIDO (pueden estar vacíos) y la CONVERSACIÓN con el cliente. ` +
  `Devuelve SOLO un JSON con los datos FINALES para despachar:\n` +
  `{"nombre":"","celular":"","cedula":"","correo":"","departamento":"","municipio":"","direccion":"","barrio":"","complemento":"","referencia":"",` +
  `"producto":"","color":"","talla":"","genero":"","cantidad":1,"valor_total":null,"observaciones":""}\n` +
  `REGLAS: usa el pedido como base y aplica lo que el CLIENTE agregó o corrigió en el chat (el último valor manda). ` +
  `No inventes: si no aparece, "" o null. celular 10 dígitos. cedula solo si el cliente la escribió (nunca el celular). ` +
  `barrio sin la palabra "barrio". complemento = apto, torre, casa, conjunto, interior. referencia = indicaciones para llegar. ` +
  `producto = nombre del producto (diseño, marca, tipo de prenda). talla tal cual (S, M, L, XL, 2XL…). ` +
  `valor_total en pesos, solo número. observaciones: algo útil para el despacho (horario, quién recibe), corto.`;

export async function prellenarDesdeChat(conv: string) {
  const supabase = createServerSupabaseClient();
  const tel = tel10De(conv);

  const [{ data: pedidos }, { data: msgs }, { data: existentes }] = await Promise.all([
    supabase.from('clientes_funnelish')
      .select('id, nombre, telefono, correo, direccion, ciudad, departamento, producto, talla, valor, cantidad, abono, abono_recibido, foto_producto, created_at')
      .in('telefono', [tel, `57${tel}`]).is('papelera_at', null)
      .order('created_at', { ascending: false }).limit(1),
    supabase.from('messages').select('content, role, created_at')
      .eq('conversation_id', conv).eq('type', 'text')
      .order('created_at', { ascending: false }).limit(40),
    supabase.from('vv_ventas').select('id, codigo, estado, effi_remision, creado_at')
      .eq('conversacion_id', conv).neq('estado', 'cancelada')
      .order('creado_at', { ascending: false }).limit(1),
  ]);
  const pedido: any = (pedidos ?? [])[0] ?? null;

  const charla = (msgs ?? []).reverse()
    .filter((m: any) => typeof m.content === 'string' && m.content.trim() && !m.content.startsWith('http'))
    .map((m: any) => `${m.role === 'user' ? 'CLIENTE' : m.role === 'agent' ? 'ASESOR' : 'BOT'}: ${m.content.trim().slice(0, 500)}`)
    .join('\n').slice(-6000);
  const datosPedido = pedido
    ? `Nombre: ${pedido.nombre ?? ''}\nCelular: ${pedido.telefono ?? ''}\nCorreo: ${pedido.correo ?? ''}\nDirección: ${pedido.direccion ?? ''}\n` +
      `Ciudad: ${pedido.ciudad ?? ''}\nDepartamento: ${pedido.departamento ?? ''}\nProducto: ${pedido.producto ?? ''}\nTalla: ${pedido.talla ?? ''}\n` +
      `Cantidad: ${pedido.cantidad ?? 1}\nValor: ${pedido.valor ?? ''}`
    : '(sin pedido registrado)';

  let ia: any = null;
  try {
    const r = await chat({ tenantId: 'klixmant', systemPrompt: SISTEMA, maxTokens: 600,
      messages: [{ role: 'user', content: `DATOS DEL PEDIDO:\n${datosPedido}\n\nCONVERSACIÓN:\n${charla || '(vacía)'}` }] });
    ia = extraerJSON(r.message);
  } catch (e: any) { console.error('[desde-chat] IA:', e?.message); }
  const x = ia ?? {};

  const valorPedido = num(pedido?.valor);
  const cantidad = Math.max(1, Math.min(50, Number(x.cantidad) || Number(pedido?.cantidad) || 1));
  const total = num(x.valor_total) ?? valorPedido ?? 130000;
  const datos = {
    cliente_nombre: s(x.nombre) || s(pedido?.nombre),
    cliente_celular: tel10De(x.celular) || tel10De(pedido?.telefono) || tel,
    cliente_identificacion: s(x.cedula).replace(/[^\dA-Za-z-]/g, ''),
    cliente_correo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(x.correo)) ? s(x.correo).toLowerCase() : s(pedido?.correo),
    departamento: s(x.departamento) || s(pedido?.departamento),
    municipio: s(x.municipio) || s(pedido?.ciudad),
    direccion: s(x.direccion) || s(pedido?.direccion),
    barrio: s(x.barrio), complemento: s(x.complemento), referencia_dir: s(x.referencia),
    transportadora: '',
    tipo_pago: 'contraentrega',
    abono: pedido?.abono_recibido ? Number(pedido?.abono) || 0 : 0,
    observaciones: s(x.observaciones),
  };
  const producto = s(x.producto) || s(pedido?.producto);
  const color = s(x.color);
  const talla = limpiarTalla(s(x.talla) || s(pedido?.talla).split('-')[0]);
  const genero = s(x.genero) || (/dama|mujer/i.test(String(pedido?.talla ?? '')) ? 'Dama' : '');

  // Producto del catálogo: candidatos por texto; el primero queda propuesto.
  let candidatos: Candidato[] = [];
  try { candidatos = producto ? await buscarCandidatos(`${producto} ${color}`, color, genero, 8) : []; } catch { /* sin candidatos */ }
  const elegido = candidatos[0] ?? null;
  let variante: any = null;
  if (elegido) {
    const r = await resolverVariante(elegido.id_item, color, talla);
    variante = r.variante;
  }

  const fotoChat = pedido?.foto_producto || (await fotoDelChat(supabase, conv));
  const vendedor = await vendedorDelChat(supabase, conv);
  return {
    vendedor: vendedor.nombre,
    datos,
    prenda: {
      texto: producto, color: variante?.color ?? color, talla: variante?.talla ?? talla, cantidad,
      precio: Math.round(total / cantidad), foto_chat: fotoChat ?? null,
      id_item: elegido?.id_item ?? null,
    },
    candidatos: candidatos.map(c => ({
      id_item: c.id_item, catalogo: c.catalogo, nombre: c.nombre, referencia: c.referencia, tipo: c.tipo,
      genero: nombreGenero(c.genero_id), foto: c.foto_card || c.foto_main || c.foto_thumb || null, colores: c.colores, tallas: c.tallas,
    })),
    pedido_id: pedido?.id ?? null,
    existente: (existentes ?? [])[0] ?? null,
  };
}

/**
 * Producto del catálogo con TODAS las variantes del mismo diseño (catálogo): en la copia de
 * KlixmSoft cada color/género es un producto aparte, así que al cambiar de color se pasa al
 * producto hermano. Cada variante trae su id_item, género, referencia y foto.
 */
export async function productoConVariantes(idItem: number) {
  const supabase = createServerSupabaseClient();
  const campos = 'id_item, id_catalogo, catalogo, nombre, referencia, tipo, genero_id, foto_card, foto_main, foto_thumb, activo';
  const { data: p } = await supabase.from('vv_cat_productos').select(campos).eq('id_item', idItem).maybeSingle();
  if (!p) return null;
  const { data: hermanos } = await supabase.from('vv_cat_productos').select(campos)
    .eq('id_catalogo', p.id_catalogo).eq('activo', true).limit(40);
  const items = (hermanos ?? []).length ? hermanos! : [p];
  const porItem = new Map(items.map((x: any) => [x.id_item, x]));
  const { data: vars } = await supabase.from('vv_cat_variantes').select('id, id_item, color, talla, sku')
    .in('id_item', [...porItem.keys()]).eq('activo', true).order('id');
  const fotoDe = (x: any) => x?.foto_card || x?.foto_main || x?.foto_thumb || null;
  return {
    id_item: p.id_item, id_catalogo: p.id_catalogo, catalogo: p.catalogo, nombre: p.nombre, referencia: p.referencia, tipo: p.tipo,
    genero: nombreGenero(p.genero_id), foto: fotoDe(p),
    variantes: (vars ?? []).map((v: any) => {
      const it: any = porItem.get(v.id_item);
      return { ...v, genero: nombreGenero(it?.genero_id), referencia: it?.referencia ?? null, nombre: it?.nombre ?? null, foto: fotoDe(it) };
    }),
  };
}

/** Buscador del catálogo por texto (catálogo, nombre, referencia, color). */
export async function buscarEnCatalogo(q: string, max = 24) {
  const supabase = createServerSupabaseClient();
  const palabras = sinTildes(q).replace(/[^a-z0-9ñ ]/g, ' ').split(' ').filter(w => w.length >= 2).slice(0, 6);
  if (!palabras.length) return [];
  let consulta = supabase.from('vv_cat_productos')
    .select('id_item, catalogo, nombre, referencia, tipo, genero_id, foto_card, foto_main, foto_thumb, colores, tallas')
    .eq('activo', true).eq('personalizado', false);
  for (const w of palabras) consulta = consulta.ilike('busqueda', `%${w}%`);
  const { data } = await consulta.order('catalogo').limit(max);
  return (data ?? []).map((c: any) => ({
    id_item: c.id_item, catalogo: c.catalogo, nombre: c.nombre, referencia: c.referencia, tipo: c.tipo,
    genero: nombreGenero(c.genero_id), foto: c.foto_card || c.foto_main || c.foto_thumb || null, colores: c.colores, tallas: c.tallas,
  }));
}

export interface EntradaPanel {
  conv: string;
  /** true = crear aunque el chat ya tenga una preventa viva (otra compra distinta). */
  forzar?: boolean;
  datos: Record<string, any>;
  prendas: { id_item: number; color: string; talla: string; cantidad: number; precio: number; foto?: string | null; notas?: string }[];
}

/** Crea la preventa en el panel con los datos FINALES confirmados por el asesor. */
export async function crearDesdeChat(e: EntradaPanel, quien: string): Promise<{ ok: boolean; mensaje: string; codigo?: string; id?: string; errores?: string[] }> {
  const supabase = createServerSupabaseClient();
  const errores: string[] = [];
  const d = e.datos ?? {};
  const conv = String(e.conv ?? '').replace(/\D/g, '');
  if (!/^57\d{10}$/.test(conv)) return { ok: false, mensaje: 'Chat inválido' };

  const cel = tel10De(d.cliente_celular);
  if (!s(d.cliente_nombre)) errores.push('Falta el nombre');
  if (!/^3\d{9}$/.test(cel)) errores.push('Celular inválido (10 dígitos, empieza por 3)');
  if (!s(d.departamento)) errores.push('Falta el departamento');
  if (!s(d.municipio)) errores.push('Falta el municipio');
  if (!s(d.direccion)) errores.push('Falta la dirección');
  if (!Array.isArray(e.prendas) || !e.prendas.length) errores.push('Falta el producto');

  // Cada prenda se resuelve OTRA VEZ contra el catálogo (id de variante y SKU reales).
  const filas: any[] = [];
  for (const [i, p] of (e.prendas ?? []).entries()) {
    const prod = Number(p.id_item) ? await productoConVariantes(Number(p.id_item)) : null;
    if (!prod) { errores.push(`Prenda ${i + 1}: elige el producto del catálogo`); continue; }
    const r = await resolverVariante(prod.id_item, s(p.color), s(p.talla));
    if (!r.variante) { errores.push(`Prenda ${i + 1}: no existe ${prod.catalogo} en color «${p.color || '—'}» talla «${p.talla || '—'}»`); continue; }
    const precio = num(p.precio);
    if (!precio) errores.push(`Prenda ${i + 1}: falta el precio`);
    const fotoPropia = s(p.foto) && s(p.foto) !== s(prod.foto) ? s(p.foto) : null;
    filas.push({
      id_item: prod.id_item, id_variante: r.variante.id, id_catalogo: prod.id_catalogo, catalogo: prod.catalogo,
      nombre: prod.nombre, referencia: prod.referencia, tipo: prod.tipo, genero: prod.genero || null,
      color: r.variante.color, talla: r.variante.talla, sku: r.variante.sku,
      cantidad: Math.max(1, Math.min(50, Number(p.cantidad) || 1)), precio,
      foto_oficial: prod.foto, foto_vendedor: fotoPropia, confianza: 1, estado: 'ok',
      descripcion: s(p.notas) || null,
    });
  }
  if (errores.length) return { ok: false, mensaje: 'Revisa los datos marcados.', errores };

  // Evita duplicar: si este chat ya tiene una preventa viva, no se crea otra.
  const { data: viva } = await supabase.from('vv_ventas').select('codigo, estado')
    .eq('conversacion_id', conv).not('estado', 'in', '(cancelada)').gte('creado_at', new Date(Date.now() - 3 * 86400_000).toISOString())
    .limit(1).maybeSingle();
  if (viva && !e.forzar) {
    return { ok: false, mensaje: `Este chat ya tiene la preventa ${viva.codigo} (${viva.estado}) en el panel. Edítala allá o cancélala antes de crear otra.` };
  }

  const total = filas.reduce((t, f) => t + (Number(f.precio) || 0) * f.cantidad, 0);
  const ahora = new Date().toISOString();
  const codigo = codigoNuevo();
  const fotos = filas.map(f => f.foto_vendedor).filter(Boolean);
  const vend = await vendedorDelChat(supabase, conv);
  const { data: venta, error } = await supabase.from('vv_ventas').insert({
    codigo, vendedor_tel: vend.clave, vendedor_nombre: vend.nombre, estado: 'confirmada',
    cliente_nombre: s(d.cliente_nombre), cliente_celular: cel,
    cliente_identificacion: s(d.cliente_identificacion).replace(/[^\dA-Za-z-]/g, '') || null,
    cliente_correo: s(d.cliente_correo) || null,
    departamento: s(d.departamento), municipio: s(d.municipio), direccion: s(d.direccion),
    barrio: s(d.barrio) || null, complemento: s(d.complemento) || null, referencia_dir: s(d.referencia_dir) || null,
    transportadora: s(d.transportadora) || null,
    tipo_pago: ['contado', 'anticipado'].includes(s(d.tipo_pago)) ? s(d.tipo_pago) : 'contraentrega',
    total, abono: Math.min(total, num(d.abono) ?? 0), observaciones: s(d.observaciones) || null,
    faltantes: [], fotos_vendedor: fotos, conversacion_id: conv, es_prueba: false,
    confirmado_at: ahora, creado_at: ahora, actualizado_at: ahora,
  }).select('id, codigo').single();
  if (error || !venta) return { ok: false, mensaje: `No se pudo guardar: ${error?.message ?? 'error'}` };

  const { error: eItems } = await supabase.from('vv_items').insert(filas.map(f => ({ ...f, venta_id: venta.id })));
  if (eItems) {
    // Sin prendas la preventa no sirve: se cancela para que no quede a medias.
    await supabase.from('vv_ventas').update({ estado: 'cancelada', motivo_revision: `Error guardando prendas: ${eItems.message}` }).eq('id', venta.id);
    return { ok: false, mensaje: `No se pudieron guardar las prendas: ${eItems.message}` };
  }
  await supabase.from('vv_eventos').insert({ venta_id: venta.id, tipo: 'desde_chat', quien, detalle: { conv, vendedor: vend.nombre, prendas: filas.map(f => ({ id_variante: f.id_variante, sku: f.sku })) } });
  return { ok: true, mensaje: `Preventa ${venta.codigo} creada en el panel de Effi.`, codigo: venta.codigo, id: venta.id };
}
