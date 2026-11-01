import { chat } from '@/lib/quinchat/claude';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sinTildes, limpiarTalla, GENEROS } from './catalogo';

/**
 * IA del módulo Ventas Vendedores:
 *  · interpretarVenta: arma la venta estructurada con TODO lo que el vendedor escribió.
 *  · reconocerPrenda: busca el producto en la copia local del catálogo (texto + foto)
 *    y resuelve la variante real (color + talla). Nunca inventa ids ni referencias.
 */

function extraerJSON(t: string): any {
  const s = String(t ?? '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const i = s.indexOf('{'); const f = s.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(s.slice(i, f + 1)); } catch { return null; }
}

export interface PrendaTexto { descripcion: string; color: string; talla: string; genero: string; cantidad: number; precio: number | null }
export interface VentaTexto {
  cliente_nombre: string; cliente_celular: string; cliente_identificacion: string; cliente_correo: string;
  departamento: string; municipio: string; direccion: string; barrio: string;
  complemento: string; referencia_dir: string; tipo_pago: string;
  total: number | null; abono: number | null; observaciones: string;
  prendas: PrendaTexto[];
}

const SISTEMA_INTERPRETAR =
  `Eres el asistente que organiza ventas de una tienda colombiana de buzos y chaquetas (Klixmant). ` +
  `Un VENDEDOR te manda por WhatsApp los datos de una venta, desordenados y en varios mensajes, a veces con correcciones. ` +
  `Devuelve SOLO un JSON con esta forma:\n` +
  `{"cliente_nombre":"","cliente_celular":"","cliente_identificacion":"","cliente_correo":"","departamento":"","municipio":"","direccion":"","barrio":"",` +
  `"complemento":"","referencia_dir":"","tipo_pago":"","total":null,"abono":null,"observaciones":"",` +
  `"prendas":[{"descripcion":"","color":"","talla":"","genero":"","cantidad":1,"precio":null}]}\n` +
  `REGLAS:\n` +
  `- Usa SOLO lo que escribió el vendedor. Si un dato no aparece, déjalo "" o null. No inventes.\n` +
  `- Si el vendedor corrigió un dato, usa el ÚLTIMO valor.\n` +
  `- cliente_celular: 10 dígitos, sin +57 ni espacios.\n` +
  `- cliente_identificacion: SOLO si el vendedor escribió una cédula/NIT aparte; nunca copies el celular.\n` +
  `- departamento: si el municipio es una ciudad colombiana inequívoca puedes poner su departamento; si hay duda, "".\n` +
  `- complemento: apto, torre, casa, interior, conjunto. referencia_dir: indicaciones para llegar.\n` +
  `- prendas: una por cada producto distinto. descripcion = cómo lo nombró el vendedor (marca, equipo, diseño, tipo de prenda). ` +
  `talla tal cual (S, M, L, XL, 2XL, 4, 6…). genero: "Hombre", "Dama" o "Niño" si lo dijo, si no "". cantidad por defecto 1.\n` +
  `- total: el valor total que dijo el vendedor, en pesos, solo número (220000). precio: valor unitario si lo dijo.\n` +
  `- tipo_pago: "contraentrega" por defecto; "contado" o "anticipado" solo si lo dijo.\n` +
  `- Ignora saludos y conversación que no sea de la venta.`;

export async function interpretarVenta(textos: string[], descripcionFotos: string[]): Promise<VentaTexto | null> {
  const cuerpo =
    `MENSAJES DEL VENDEDOR (en orden):\n${textos.map((t, i) => `${i + 1}. ${t}`).join('\n')}` +
    (descripcionFotos.length ? `\n\nLO QUE SE VE EN LAS FOTOS QUE MANDÓ:\n${descripcionFotos.map(d => `- ${d}`).join('\n')}` : '');
  try {
    const r = await chat({ tenantId: 'klixmant', systemPrompt: SISTEMA_INTERPRETAR, messages: [{ role: 'user', content: cuerpo.slice(-8000) }], maxTokens: 900 });
    const j = extraerJSON(r.message);
    if (!j) return null;
    const n = (v: unknown) => { const x = Number(String(v ?? '').replace(/[^\d]/g, '')); return x > 0 ? x : null; };
    const s = (v: unknown) => String(v ?? '').trim();
    return {
      cliente_nombre: s(j.cliente_nombre),
      cliente_celular: s(j.cliente_celular).replace(/\D/g, '').slice(-10),
      cliente_identificacion: s(j.cliente_identificacion).replace(/[^\dA-Za-z-]/g, ''),
      cliente_correo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(j.cliente_correo)) ? s(j.cliente_correo).toLowerCase() : '',
      departamento: s(j.departamento), municipio: s(j.municipio), direccion: s(j.direccion), barrio: s(j.barrio),
      complemento: s(j.complemento), referencia_dir: s(j.referencia_dir),
      tipo_pago: s(j.tipo_pago) || 'contraentrega',
      total: n(j.total), abono: n(j.abono), observaciones: s(j.observaciones),
      prendas: (Array.isArray(j.prendas) ? j.prendas : []).map((p: any) => ({
        descripcion: s(p?.descripcion), color: s(p?.color), talla: limpiarTalla(p?.talla), genero: s(p?.genero),
        cantidad: Math.max(1, Math.min(50, Number(p?.cantidad) || 1)), precio: n(p?.precio),
      })).filter((p: PrendaTexto) => p.descripcion || p.color || p.talla),
    };
  } catch (e: any) {
    console.error('[VV] interpretar:', e?.message);
    return null;
  }
}

/** Describe la foto del vendedor (marca, equipo, textos visibles, color, tipo) para buscar candidatos. */
export async function describirFoto(base64: string, mimeType: string): Promise<string> {
  try {
    const r = await chat({
      tenantId: 'klixmant',
      systemPrompt:
        'Describe la prenda de la foto para buscarla en un catálogo. Responde UNA línea con: tipo de prenda (buzo, chaqueta, cuello alto, camiseta, polo), ' +
        'marcas/equipos/escuderías/logos y TEXTOS visibles, color principal y colores secundarios. Sin frases extra.',
      messages: [{ role: 'user', content: 'Describe esta prenda.' }],
      imagenes: [{ base64, mimeType }],
      maxTokens: 120,
    });
    return String(r.message ?? '').trim().slice(0, 300);
  } catch (e: any) {
    console.error('[VV] describir foto:', e?.message);
    return '';
  }
}

// ── Reconocimiento contra el catálogo ─────────────────────────────────────────
const VACIAS = new Set(['buzo', 'buzos', 'chaqueta', 'chaquetas', 'talla', 'color', 'de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'para',
  'una', 'uno', 'un', 'y', 'en', 'tipo', 'prenda', 'principal', 'secundarios', 'secundario', 'colores', 'logo', 'logos', 'texto', 'textos', 'visible',
  'visibles', 'marca', 'marcas', 'hombre', 'dama', 'mujer', 'caballero', 'nino', 'ninos', 'cuello', 'alto', 'camiseta', 'polo', 'frente', 'espalda',
  'manga', 'mangas', 'cremallera', 'capota', 'blanco', 'negro', 'rojo', 'azul', 'verde', 'gris', 'beige', 'amarillo', 'naranja', 'morado', 'rosado',
  'marfil', 'cocoa', 'vinotinto', 'cafe']);

function tokens(t: string): string[] {
  return [...new Set(sinTildes(t).replace(/[^a-z0-9ñ ]/g, ' ').split(' ').filter(w => w.length >= 3 && !VACIAS.has(w)))].slice(0, 10);
}

const generoId = (g: string) => {
  const t = sinTildes(g);
  if (/dama|mujer|femenin/.test(t)) return 2;
  if (/nin|infantil/.test(t)) return 4;
  if (/hombre|caballero|masculin/.test(t)) return 1;
  return null;
};

export interface Candidato {
  id_item: number; id_catalogo: number; catalogo: string; nombre: string | null; referencia: string | null;
  tipo: string | null; genero_id: number | null; foto_card: string | null; foto_main: string | null;
  colores: string[]; tallas: string[]; puntaje: number;
}

// Copia del catálogo en memoria (≈1.800 productos): se recarga cada 10 min.
let cacheCat: { filas: any[]; leido: number } | null = null;
let intentoAuto = false;
async function catalogoActivo(): Promise<any[]> {
  if (cacheCat && Date.now() - cacheCat.leido < 600_000) return cacheCat.filas;
  const supabase = createServerSupabaseClient();
  const filas: any[] = [];
  for (let desde = 0; desde < 10000; desde += 1000) {
    const { data } = await supabase.from('vv_cat_productos')
      .select('id_item, id_catalogo, catalogo, nombre, referencia, tipo, genero_id, foto_card, foto_main, colores, tallas, busqueda')
      .eq('activo', true).eq('personalizado', false).range(desde, desde + 999);
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // Copia vacía (nunca se sincronizó): se llena una vez aquí mismo
  if (!filas.length && !intentoAuto) {
    intentoAuto = true;
    const { sincronizarCatalogo } = await import('./catalogo');
    const r = await sincronizarCatalogo('cron');
    if (r.ok) return catalogoActivo();
  }
  cacheCat = { filas, leido: Date.now() };
  return filas;
}

const tipoDe = (t: string) => {
  const s = sinTildes(t);
  if (/cuello alto/.test(s)) return 'cuello';
  if (/chaqueta|chamarra/.test(s)) return 'chaqueta';
  if (/camiseta|camisa/.test(s)) return 'camiseta';
  if (/\bpolo\b/.test(s)) return 'polo';
  if (/buzo|saco|hoodie|sudadera/.test(s)) return 'buzo';
  return '';
};
const MODIFICADORES = ['reflectivo', 'estampado', 'bordado'];
/** Cómo dicen los vendedores el color → cómo lo llama el catálogo. */
const SINONIMOS_COLOR: [RegExp, string][] = [
  [/\bbeige\b|\bcafe claro\b|\bcamel\b/, 'cocoa'], [/\bcrema\b|\bhueso\b|\bblanco hueso\b|\bperla\b/, 'marfil'],
  [/azul oscuro|azul marino|\bnavy\b/, 'azul navy'], [/verde oscuro|verde militar|\boliva\b/, 'verde oscuro'],
  [/\bvino\b|\bvinotinto\b|\bburdeos\b/, 'vinotinto'],
];
export function normalizarColor(c: string): string {
  let t = sinTildes(c);
  for (const [re, v] of SINONIMOS_COLOR) if (re.test(t)) { t = v; break; }
  return t;
}
/** "AzulNavy" → "azul navy". */
const colorLegible = (c: string) => sinTildes(String(c).replace(/([a-z])([A-Z])/g, '$1 $2'));

export async function buscarCandidatos(texto: string, color: string, genero: string, max = 6): Promise<Candidato[]> {
  const tk = tokens(texto).filter(t => !MODIFICADORES.includes(t));
  if (!tk.length) return [];
  const todo = sinTildes(texto);
  const col = normalizarColor(color);
  const tipoV = tipoDe(texto);
  const gen = generoId(genero) ?? 1; // regla: si no dice género → Hombre
  const lista = (await catalogoActivo()).map((p: any) => {
    const b = String(p.busqueda ?? '');
    const aciertos = tk.filter(t => b.includes(t)).length;
    if (!aciertos) return null;
    let puntaje = aciertos * 10;
    const cols = (p.colores ?? []).map(colorLegible);
    if (col && cols.some((c: string) => c.includes(col) || col.includes(c))) puntaje += 8;
    else if (!col && cols.some((c: string) => todo.includes(c))) puntaje += 5;
    const tipoC = tipoDe(`${p.catalogo} ${p.tipo ?? ''}`);
    if (tipoV && tipoC) puntaje += tipoV === tipoC ? 8 : -6;
    for (const m of MODIFICADORES) {
      const enV = todo.includes(m), enC = sinTildes(p.catalogo).includes(m);
      if (enV && enC) puntaje += 4; else if (enV !== enC && enV) puntaje -= 2;
    }
    if (p.genero_id === gen) puntaje += 3;
    return { ...p, puntaje } as Candidato;
  }).filter(Boolean) as Candidato[];
  lista.sort((a, b) => b.puntaje - a.puntaje);
  // Un candidato por diseño + color (el de otro género tiene la misma foto)
  const vistos = new Set<string>();
  const unicos: Candidato[] = [];
  for (const c of lista) {
    const k = `${sinTildes(c.catalogo)}|${(c.colores ?? []).map(sinTildes).sort().join('/')}`;
    if (vistos.has(k)) continue;
    vistos.add(k); unicos.push(c);
    if (unicos.length >= max) break;
  }
  return unicos;
}

async function bajarComoBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_500_000) return null;
    return { base64: buf.toString('base64'), mimeType: (r.headers.get('content-type') || 'image/webp').split(';')[0] };
  } catch { return null; }
}

/** Compara la foto del vendedor con las fotos oficiales de los candidatos. */
export async function elegirConFoto(
  fotoVendedor: { base64: string; mimeType: string }, candidatos: Candidato[], textoVendedor: string,
): Promise<{ indice: number; confianza: number; motivo: string } | null> {
  const fotos = await Promise.all(candidatos.map(c => bajarComoBase64(c.foto_card || c.foto_main || '')));
  const validos = candidatos.map((c, i) => ({ c, f: fotos[i], n: i + 1 })).filter(x => x.f);
  if (!validos.length) return null;
  const lista = validos.map(x => `${x.n}. ${x.c.catalogo} — ${x.c.nombre ?? ''} (${(x.c.colores ?? []).join('/')})`).join('\n');
  try {
    const r = await chat({
      tenantId: 'klixmant',
      systemPrompt:
        'Comparas la foto que mandó un vendedor (la PRIMERA imagen) con fotos oficiales de un catálogo (las siguientes, en el orden de la lista). ' +
        'Elige la que sea EXACTAMENTE el mismo diseño (mismos logos, textos, ubicación y colores). Un logo parecido NO basta. ' +
        'Responde SOLO JSON: {"eleccion": número de la lista o 0 si ninguna coincide, "confianza": 0 a 1, "motivo": "corto"}.',
      messages: [{ role: 'user', content: `Texto del vendedor: ${textoVendedor || '(sin texto)'}\nCatálogo (en orden, después de la foto del vendedor):\n${lista}` }],
      imagenes: [fotoVendedor, ...validos.map(x => x.f!)],
      maxTokens: 150,
    });
    const j = extraerJSON(r.message);
    if (!j) return null;
    const n = Number(j.eleccion) || 0;
    const v = validos.find(x => x.n === n);
    return { indice: v ? candidatos.indexOf(v.c) : -1, confianza: Math.max(0, Math.min(1, Number(j.confianza) || 0)), motivo: String(j.motivo ?? '').slice(0, 160) };
  } catch (e: any) {
    console.error('[VV] elegir con foto:', e?.message);
    return null;
  }
}

const tallaNorm = (t: string) => sinTildes(limpiarTalla(t)).replace(/\s+/g, '').replace(/^xxl$/, '2xl').replace(/^xxxl$/, '3xl');

/** Busca la variante REAL (color + talla) del producto elegido. */
export async function resolverVariante(idItem: number, color: string, talla: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('vv_cat_variantes').select('id, color, talla, sku').eq('id_item', idItem).eq('activo', true);
  const vars = data ?? [];
  const colores = [...new Set(vars.map((v: any) => v.color).filter(Boolean))] as string[];
  const tallas = [...new Set(vars.map((v: any) => v.talla).filter(Boolean))] as string[];
  const c = normalizarColor(color);
  let porColor = vars;
  if (colores.length > 1) {
    if (!c) return { variante: null, problema: 'color' as const, colores, tallas };
    porColor = vars.filter((v: any) => { const vc = colorLegible(v.color); return vc === c || vc.includes(c) || c.includes(vc); });
    if (!porColor.length) return { variante: null, problema: 'color' as const, colores, tallas };
  }
  if (!talla) return { variante: null, problema: 'talla' as const, colores, tallas };
  const t = tallaNorm(talla);
  const v = porColor.find((x: any) => tallaNorm(x.talla ?? '') === t);
  if (!v) return { variante: null, problema: 'talla' as const, colores, tallas: [...new Set(porColor.map((x: any) => x.talla).filter(Boolean))] as string[] };
  return { variante: v as { id: number; color: string; talla: string; sku: string | null }, problema: null, colores, tallas };
}

export const nombreGenero = (id: number | null | undefined) => (id ? GENEROS[id] ?? '' : '');
export { bajarComoBase64 };
