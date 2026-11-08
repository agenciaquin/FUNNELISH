import { chat } from '@/lib/quinchat/claude';
import { createServerSupabaseClient } from '@/lib/supabase';
import { EVIDENCIA_CATALOGO_ID } from '@/lib/sin-evidencia';
import { buscarCandidatos, resolverVariante, nombreGenero, type Candidato } from './ia';
import { sinTildes, limpiarTalla, ultimaSync, sincronizarCatalogo } from './catalogo';

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
  `"prendas":[{"producto":"","color":"","talla":"","genero":"","cantidad":1}],"valor_total":null,"observaciones":"",` +
  `"reclama_en_oficina":false,"transportadora":"","abono_recibido":0}\n` +
  `ABONO: si el ASESOR o el cliente dejan claro que el abono YA se pagó o se recibió (ej. "ya recibí tu abono", ` +
  `"te envío el comprobante" seguido de confirmación), abono_recibido = el valor pagado en pesos si aparece en el chat; ` +
  `si se confirmó pero no dicen el valor, usa 5000 (el abono de recogida en oficina es de $5.000). Si no se confirmó, 0.\n` +
  `OFICINA: si acordaron que el cliente RECLAMA EN OFICINA de la transportadora, reclama_en_oficina = true y transportadora = ` +
  `la transportadora de esa oficina (ej. "INTERRAPIDISIMO").\n` +
  `REGLAS: usa el pedido como base y aplica lo que el CLIENTE o el ASESOR acordaron después en el chat (el último valor manda: ` +
  `si cambiaron un color, una talla o la dirección, usa lo nuevo). No inventes: si no aparece, "" o null. ` +
  `celular 10 dígitos. cedula solo si el cliente la escribió (nunca el celular). ` +
  `Si acordaron RECLAMAR EN OFICINA de la transportadora, direccion = "Oficina <transportadora>" y referencia = "Reclama en oficina".\n` +
  `SEPARA SIEMPRE la dirección: direccion = solo calle/carrera y número (ej. "Cra 50 #31-91"); barrio = el nombre del barrio ` +
  `sin la palabra "barrio" (ej. "Los 4 Vientos"); complemento = apto, torre, casa, conjunto, interior, manzana; ` +
  `referencia = indicaciones para llegar (ej. "entrando por Muebles Jamar, diagonal a Unicolombo"). Nunca dejes el barrio ni la referencia dentro de direccion.\n` +
  `prendas: UNA por cada prenda distinta del pedido (un pack de 2 con tallas o colores distintos = 2 prendas, cada una cantidad 1). ` +
  `producto = tipo de prenda + diseño tal como lo nombran (ej. "CAMISETA AMERICA", "BUZO AMERICA LINEA", "CUELLO ALTO MERCEDES"); ` +
  `NUNCA cambies camiseta por buzo ni al revés. color COMPLETO como lo dice el producto o el cliente (ej. «Blanco Marfil», «Azul Navy», «Negro»), no lo recortes. talla sola (S, M, L, XL, XXL, 2XL…). ` +
  `genero "Hombre" o "Dama" si aparece.\n` +
  `valor_total = total del pedido en pesos, solo número. observaciones: algo útil para el despacho (oficina, horario, quién recibe), corto.`;

export async function prellenarDesdeChat(conv: string) {
  const supabase = createServerSupabaseClient();
  const tel = tel10De(conv);

  // La copia del catálogo KlixmSoft no tiene cron: si tiene más de 24 h, se actualiza aquí
  // (el 08-nov-2026 llevaba 6 días vieja y no tenía CAMISETA AMERICA ni BUCARO LEOPARDO).
  try {
    const { ultimaOk } = await ultimaSync();
    if (!ultimaOk || Date.now() - new Date(ultimaOk).getTime() > 24 * 3600_000) await sincronizarCatalogo('cron');
  } catch { /* si falla, se sigue con la copia que hay */ }

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
    // Regla del dueño (08-nov-2026): si reclama en OFICINA de Interrapidísimo, la transportadora es
    // Interrapidísimo sin importar la ciudad.
    transportadora: '',
    tipo_pago: 'contraentrega',
    // Abono: el registrado en el pedido; si no, el que el asesor confirmó en el chat
    abono: (pedido?.abono_recibido ? Number(pedido?.abono) || 0 : 0) || (num(x.abono_recibido) ?? 0),
    observaciones: s(x.observaciones),
  };
  // Respaldo si la IA dejó todo junto: «Cra 50#31-91, Barrio Los 4 vientos entrando por …»
  Object.assign(datos, separarDireccion(datos));
  // El cliente a veces escribe la ciudad en «departamento» y al revés (Departamento: Cartagena,
  // Ciudad: Bolívar). Si lo de «departamento» no es un departamento y lo de «municipio» sí, se cruzan.
  if (!esDepartamento(datos.departamento) && esDepartamento(datos.municipio)) {
    [datos.departamento, datos.municipio] = [datos.municipio, datos.departamento];
  }
  // Oficina de Interrapidísimo (aunque venga mal escrito) → dirección estándar + transportadora Inter
  const oficinaInter = esOficinaInter([x.transportadora, x.direccion, x.referencia, x.observaciones, x.reclama_en_oficina ? 'oficina' : ''].join(' '))
    || (x.reclama_en_oficina && /inter/i.test(String(x.transportadora ?? '')));
  if (oficinaInter) Object.assign(datos, normalizarOficinaInter({ ...datos }, 'reclama oficina interrapidisimo'));
  // Prendas: las de la IA; si no trajo, una sola con lo del pedido.
  let prendasIA: any[] = Array.isArray(x.prendas) ? x.prendas.filter((p: any) => s(p?.producto) || s(p?.talla) || s(p?.color)) : [];
  if (!prendasIA.length) prendasIA = [{ producto: s(pedido?.producto), color: s(pedido?.producto).split(/\s+-\s+/)[1] ?? '', talla: s(pedido?.talla).split('-')[0], genero: /dama|mujer/i.test(String(pedido?.talla ?? '')) ? 'Dama' : '', cantidad: Number(pedido?.cantidad) || 1 }];
  const unidades = prendasIA.reduce((t, p) => t + Math.max(1, Math.min(50, Number(p?.cantidad) || 1)), 0) || 1;
  const precioUnidad = Math.round(total / unidades);

  const prendas = [];
  for (const p of prendasIA.slice(0, 6)) {
    const producto = s(p.producto) || s(pedido?.producto);
    const color = s(p.color);
    const talla = limpiarTalla(s(p.talla).split(/\s+-\s+/)[0]);
    const genero = s(p.genero);
    const cantidad = Math.max(1, Math.min(50, Number(p.cantidad) || 1));
    let candidatos: Candidato[] = [];
    // 1) Cruce EXACTO por el nombre del producto: catálogo de QuinChat (patrón) → su «Nombre en KlixmSoft».
    const enlazados = await candidatosPorCatalogoQuin(supabase, producto, color, genero);
    // 2) Si el catálogo de QuinChat no está enlazado, búsqueda aproximada en la copia de KlixmSoft.
    try { candidatos = producto ? await buscarCandidatos(`${producto} ${color}`, color, genero, 10) : []; } catch { /* sin candidatos */ }
    if (enlazados.length) {
      const ids = new Set(enlazados.map(c => c.id_item));
      candidatos = [...enlazados, ...candidatos.filter(c => !ids.has(c.id_item))];
    }
    // El TIPO de prenda manda: una camiseta nunca se propone como buzo.
    const tipoTxt = tipoDePrenda(producto);
    if (tipoTxt) {
      const mismos = candidatos.filter(c => tipoDePrenda(`${c.catalogo} ${c.tipo ?? ''}`) === tipoTxt);
      candidatos = [...mismos, ...candidatos.filter(c => !mismos.includes(c))];
    }
    // Nombre exacto del catálogo dentro del texto → ese primero (los enlazados ya van adelante)
    const pTxt = sinTildes(producto);
    if (!enlazados.length) candidatos.sort((a, b) => Number(pTxt.includes(sinTildes(b.catalogo))) - Number(pTxt.includes(sinTildes(a.catalogo))));
    const primero = candidatos[0] ?? null;
    const confiable = !!primero && (enlazados.length > 0 || !tipoTxt || tipoDePrenda(`${primero.catalogo} ${primero.tipo ?? ''}`) === tipoTxt);
    prendas.push({
      texto: producto, color, talla, genero, cantidad, precio: precioUnidad,
      id_item: confiable ? primero!.id_item : null,
      candidatos: candidatos.map(c => ({
        id_item: c.id_item, catalogo: c.catalogo, nombre: c.nombre, referencia: c.referencia, tipo: c.tipo,
        genero: nombreGenero(c.genero_id), foto: c.foto_card || c.foto_main || c.foto_thumb || null, colores: c.colores, tallas: c.tallas,
      })),
    });
  }

  const fotoChat = pedido?.foto_producto || (await fotoDelChat(supabase, conv));
  const vendedor = await vendedorDelChat(supabase, conv);
  return {
    vendedor: vendedor.nombre,
    datos,
    prendas,
    foto_chat: fotoChat ?? null,
    total,
    pedido_id: pedido?.id ?? null,
    existente: (existentes ?? [])[0] ?? null,
  };
}

/**
 * Cruce exacto: el nombre del producto del pedido/chat (ej. «CAMISETA AMERICA BLANCO XXL - HOMBRE»)
 * contiene el PATRÓN de un catálogo de QuinChat («CAMISETA AMERICA»); ese catálogo tiene su
 * «Nombre en KlixmSoft» / id de catálogo → productos de ese catálogo en la copia de KlixmSoft,
 * ordenados por color y género pedidos. Sin adivinar.
 */
async function candidatosPorCatalogoQuin(supabase: any, producto: string, color: string, genero: string): Promise<Candidato[]> {
  const txt = ` ${sinTildes(producto).toUpperCase().replace(/[^A-Z0-9Ñ ]/g, ' ').replace(/\s+/g, ' ')} `;
  if (txt.trim().length < 3) return [];
  const { data: cats } = await supabase.from('catalogos_bot')
    .select('patron, familia, nombre_klixmsoft, id_catalogo').eq('activo', true).is('eliminado_at', null)
    .or('nombre_klixmsoft.not.is.null,id_catalogo.not.is.null');
  const norm = (s: unknown) => sinTildes(s).toUpperCase().replace(/[^A-Z0-9Ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  const cat = (cats ?? [])
    .filter((c: any) => { const p = norm(c.patron || c.familia); return p.length >= 3 && txt.includes(` ${p} `); })
    .sort((a: any, b: any) => norm(b.patron || b.familia).length - norm(a.patron || a.familia).length)[0] as any;
  if (!cat) return [];
  let q = supabase.from('vv_cat_productos')
    .select('id_item, id_catalogo, catalogo, nombre, referencia, tipo, genero_id, foto_card, foto_main, foto_thumb, colores, tallas')
    .eq('activo', true);
  q = cat.id_catalogo ? q.eq('id_catalogo', cat.id_catalogo) : q.ilike('catalogo', String(cat.nombre_klixmsoft));
  const { data: prods } = await q.limit(40);
  const gen = /dama|mujer/i.test(genero) ? 2 : /nin/i.test(sinTildes(genero)) ? 4 : 1;
  const puntaje = (p: any) => puntajeColor(p.colores ?? [], color, producto) + (p.genero_id === gen ? 3 : 0);
  return [...(prods ?? [])].sort((a, b) => puntaje(b) - puntaje(a)).map((p: any) => ({ ...p, puntaje: 100 + puntaje(p) }));
}

/**
 * ¿Qué tanto coincide el color de un producto del catálogo con lo pedido?
 *  · 20 si el color del catálogo aparece TAL CUAL en el nombre del producto del chat
 *    («BLANCO MARFIL REAL MADRID» → Marfil, aunque la IA haya dicho solo «Blanco»).
 *  · 10 si coincide con el color que dio la IA.
 *  · 5 si es un tono equivalente (Blanco ≈ Marfil/Hueso/Crema) y no hay mejor.
 */
const TONOS: Record<string, string[]> = {
  blanco: ['marfil', 'hueso', 'crema', 'perla'], marfil: ['blanco', 'hueso', 'crema'],
  azul: ['azulnavy', 'azuloscuro', 'navy', 'azulrey'], navy: ['azulnavy', 'azuloscuro'],
  beige: ['cocoa', 'arena', 'camel'], cafe: ['cocoa', 'chocolate', 'marron'], gris: ['grisjaspe', 'gris'],
};
function puntajeColor(colores: string[], color: string, producto: string): number {
  const n = (t: unknown) => sinTildes(t).replace(/[^a-z0-9]/g, '');
  const cs = colores.map(n).filter(Boolean);
  const col = n(color);
  const txt = ` ${sinTildes(producto).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')} `;
  const txtJunto = n(producto);
  let p = 0;
  // Color del catálogo dentro del nombre del producto (palabra completa o compuesto tipo AzulNavy)
  if (cs.some(c => c.length >= 3 && (txt.includes(` ${c} `) || (c.length >= 6 && txtJunto.includes(c))))) p = Math.max(p, 20);
  if (col && cs.some(c => c === col || c.includes(col) || col.includes(c))) p = Math.max(p, 10);
  if (col && cs.some(c => (TONOS[col] ?? []).includes(c))) p = Math.max(p, 5);
  return p;
}

/**
 * Separa barrio, complemento y referencia cuando vienen dentro de la dirección (08-nov-2026).
 * Solo actúa si el barrio está vacío y la dirección trae la palabra «barrio» (o B/, Br., Urb., Sector).
 * Ej.: «Cra 50#31-91, Barrio Los 4 vientos entrando por muebles Jamar diagonal a unicolombo»
 *   → direccion «Cra 50#31-91» · barrio «Los 4 vientos» · referencia «entrando por muebles Jamar diagonal a unicolombo».
 */
const PALABRAS_REF = /\b(entrando|entrada|diagonal|frente|cerca|al lado|junto|detr[aá]s|despu[eé]s|antes de|por la|por el|a una cuadra|a media cuadra|esquina|donde|llegando|subiendo|bajando|enseguida|contiguo|via|v[ií]a)\b/i;
const PALABRAS_COMP = /^(casa|apto|apartamento|apt|torre|piso|interior|int|local|bloque|manzana|mz|conjunto|edificio|etapa|lote)\b/i;
export function separarDireccion<T extends { direccion: string; barrio: string; complemento: string; referencia_dir: string }>(d: T): T {
  const dir = String(d.direccion ?? '').trim();
  if (!dir || String(d.barrio ?? '').trim()) return d;
  const m = dir.match(/^(.*?)[\s,;.-]*\b(?:barrio|b\/|br\.|bº|urbanizaci[oó]n|urb\.?|sector)\s+(.+)$/i);
  if (!m || m[1].trim().length < 4) return d;
  const calle = m[1].replace(/[\s,;.-]+$/, '').trim();
  let resto = m[2].trim();
  // El barrio termina en una coma o donde empiezan las indicaciones / el complemento
  let barrio = resto, despues = '';
  const coma = resto.search(/[,;]/);
  const ref = resto.search(PALABRAS_REF);
  const comp = resto.search(/\b(casa|apto|apartamento|torre|piso|interior|local|bloque|manzana|mz|conjunto|edificio)\b/i);
  const cortes = [coma, ref, comp].filter(i => i > 0);
  if (cortes.length) { const i = Math.min(...cortes); barrio = resto.slice(0, i); despues = resto.slice(i); }
  barrio = barrio.replace(/[\s,;.-]+$/, '').trim();
  despues = despues.replace(/^[\s,;.-]+/, '').trim();
  if (!barrio) return d;
  let complemento = String(d.complemento ?? '').trim(), referencia = String(d.referencia_dir ?? '').trim();
  if (despues) {
    if (PALABRAS_COMP.test(despues)) {
      const r = despues.search(PALABRAS_REF);
      const c = (r > 0 ? despues.slice(0, r) : despues).replace(/[\s,;.-]+$/, '').trim();
      const resto2 = r > 0 ? despues.slice(r).trim() : '';
      complemento = [complemento, c].filter(Boolean).join(' ');
      if (resto2) referencia = [referencia, resto2].filter(Boolean).join(' · ');
    } else referencia = [referencia, despues].filter(Boolean).join(' · ');
  }
  return { ...d, direccion: calle, barrio, complemento, referencia_dir: referencia };
}

/** Los 32 departamentos de Colombia + Bogotá D.C. (con los nombres cortos que usa la gente). */
const DEPARTAMENTOS = ['amazonas', 'antioquia', 'arauca', 'atlantico', 'bolivar', 'boyaca', 'caldas', 'caqueta', 'casanare',
  'cauca', 'cesar', 'choco', 'cordoba', 'cundinamarca', 'guainia', 'guaviare', 'huila', 'la guajira', 'guajira', 'magdalena',
  'meta', 'narino', 'norte de santander', 'putumayo', 'quindio', 'risaralda', 'san andres', 'san andres y providencia',
  'archipielago de san andres', 'santander', 'sucre', 'tolima', 'valle del cauca', 'valle', 'vaupes', 'vichada',
  'bogota', 'bogota d.c.', 'bogota dc', 'distrito capital'];
function esDepartamento(t: string): boolean {
  const x = sinTildes(t).replace(/[^a-z. ]/g, ' ').replace(/\s+/g, ' ').trim();
  return !!x && DEPARTAMENTOS.includes(x);
}

/** Texto ÚNICO para las entregas en oficina de Interrapidísimo (regla del dueño, 08-nov-2026). */
export const DIR_OFICINA_INTER = 'RECLAMA EN LA OFICINA DE INTERRAPIDISIMO';

/**
 * ¿El texto dice que se reclama en una oficina de Interrapidísimo? Tolera errores de escritura
 * («Inter rapidisimob», «interapidisimo», «oficina de inter», «RECLAMA OFICINA DE INTERRAPIDISIMO»).
 */
export function esOficinaInter(t: string): boolean {
  const x = String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const oficina = /ofi[cs]?i?na|reclam|recog/.test(x);
  const inter = /inter\s*-?\s*r+a*p+i*d|interap+i*d|\binter\b|interrap/.test(x);
  return oficina && inter;
}

/** Si la dirección es «oficina de Interrapidísimo», la deja SIEMPRE con el mismo texto y sin referencia de calle. */
export function normalizarOficinaInter<T extends Record<string, any>>(d: T, extra = ''): T {
  if (!esOficinaInter([d.direccion, d.referencia_dir, d.complemento, d.observaciones, extra].filter(Boolean).join(' '))) return d;
  return { ...d, direccion: DIR_OFICINA_INTER, referencia_dir: '', complemento: '', barrio: '', transportadora: 'INTER RAPIDISIMO' };
}

/** Tipo de prenda de un texto (para no confundir camiseta con buzo). */
function tipoDePrenda(t: string): string {
  const x = sinTildes(t);
  if (/camiseta|camisa|t-?shirt/.test(x)) return 'camiseta';
  if (/\bpolo\b/.test(x)) return 'polo';
  if (/cuello alto/.test(x)) return 'cuello';
  if (/chaqueta/.test(x)) return 'chaqueta';
  if (/buzo|hoodie|saco/.test(x)) return 'buzo';
  return '';
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
  // Al guardar también se estandariza la oficina de Interrapidísimo (por si la escribieron a mano)
  const d = normalizarOficinaInter({ ...(e.datos ?? {}) });
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
