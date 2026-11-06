import { generarCollagePack } from '@/lib/collage';

/**
 * Foto REAL del producto de un carrito abandonado, sacada del CATÁLOGO de colores
 * (catalogo_colores), igual que se hace al confirmar una compra. La foto que guarda
 * el formulario en el carrito es la MINIATURA del embudo (logo/portada), no el buzo.
 *
 * Formatos que llegan del formulario:
 *   producto "BLANCO MARFIL REAL MADRID"   + talla "L - HOMBRE"                      → el color ya viene en el producto
 *   producto "CAMISETA HONDA RACING"       + talla "BLANCO HONDA RACING / L - HOMBRE" → la variante es el nombre del catálogo
 *   producto "BUZO MOTO SUZUKI REFLECTIVO" + talla "NEGRO / L - HOMBRE"              → color suelto + producto
 *   producto "PROMO 2 PRENDAS …"           + talla "NEGRO / XXL HOMBRE / NEGRO / XL DAMA" → pack: una foto por prenda (collage)
 */

const COLORES = /\b(NEGRO|NEGRA|ROJO|ROJA|AZUL|OSCURO|REY|CLARO|BLANCO|BLANCA|MARFIL|BEIGE|GRIS|VERDE|AMARILLO|COCOA|NAVY|MILITAR|VINOTINTO|NARANJA|MORADO|ROSADO|CAFE|CAFÉ|PLATA|DORADO|MANZANA|CELESTE|TURQUESA|OLIVA|MOSTAZA)\b/g;
const GENERICAS = new Set(['BUZO', 'MOTO', 'REFLECTIVO', 'ESCUDERIA', 'PACK', 'PAREJA', 'DUO', 'COMBO', 'CUELLO', 'ALTO',
  'HOMBRE', 'DAMA', 'MUJER', 'CABALLERO', 'UNISEX', 'CHAQUETA', 'CAMISETA', 'COLORES', 'COLOR', 'TALLA', 'PRENDA', 'PRENDAS', 'PROMO']);

const norm = (s: unknown) => String(s ?? '').toUpperCase().replace(/REFLECTIVA(S)?\b/g, 'REFLECTIVO').replace(/\s+/g, ' ').trim();
const esTalla = (t: string) => /\b(HOMBRE|DAMA|CABALLERO|MUJER|NI[ÑN]O|NI[ÑN]A)\b/i.test(t)
  || /^(XXXXL|XXXL|XXL|XL|XS|S|M|L|\d{1,2})\b/i.test(t.replace(/[^A-Za-z0-9 ]/g, '').trim());
const coloresDe = (s: string) => (norm(s).match(COLORES) ?? []);

type Fila = { nombre_producto: string; color: string | null; url_imagen: string };

function mejorFoto(filas: Fila[], consulta: string): string | null {
  const q = norm(consulta);
  const exacta = filas.find(f => norm(f.nombre_producto) === q);
  if (exacta) return exacta.url_imagen;
  const palabras = q.split(' ').map(w => w.replace(/[^A-Z0-9]/g, '')).filter(w => w.length >= 3);
  const distintivas = palabras.filter(w => !GENERICAS.has(w) && !coloresDe(w).length);
  const colores = coloresDe(q);
  const quiereReflex = /REFLECTIVO/.test(q);
  let mejor: { url: string; d: number; r: number; c: number } | null = null;
  for (const f of filas) {
    const n = norm(`${f.nombre_producto} ${f.color ?? ''}`);
    // El color pedido DEBE estar (no mandar la beige si pidió negro).
    if (colores.length && !colores.every(c => n.includes(c))) continue;
    const d = distintivas.filter(w => n.includes(w)).length;
    if (distintivas.length && d === 0) continue;
    const r = (/REFLECTIVO/.test(n) === quiereReflex) ? 1 : 0;
    const c = palabras.filter(w => n.includes(w)).length;
    if (!mejor || d > mejor.d || (d === mejor.d && r > mejor.r) || (d === mejor.d && r === mejor.r && c > mejor.c)) {
      mejor = { url: f.url_imagen, d, r, c };
    }
  }
  return mejor?.url ?? null;
}

export async function fotoDelCarrito(supabase: any, producto: string, talla: string): Promise<string | null> {
  const { data } = await supabase.from('catalogo_colores')
    .select('nombre_producto, color, url_imagen').not('url_imagen', 'is', null).eq('activo', true);
  const filas: Fila[] = (data ?? []).filter((f: any) => f.url_imagen && f.nombre_producto);
  if (!filas.length) return null;

  const prod = norm(producto);
  // Partes de la selección que NO son talla/género = el color o la variante de cada prenda
  const partes = String(talla ?? '').split(/[\/|+]/).map(s => s.trim()).filter(Boolean).filter(s => !esTalla(s));
  const consultas = partes.length
    ? partes.map(p => {
        const np = norm(p);
        // "NEGRO" suelto → "NEGRO + producto"; "BLANCO HONDA RACING" ya es el nombre del catálogo
        const soloColor = np.replace(COLORES, '').trim() === '';
        return soloColor ? `${np} ${prod}` : np;
      })
    : [prod];

  const urls = consultas.map(q => mejorFoto(filas, q)).filter((u): u is string => !!u);
  if (!urls.length) return null;
  if (urls.length === 1) return urls[0];
  // Pack de 2–3 prendas: un collage con una foto por prenda (como al confirmar)
  const collage = await generarCollagePack(supabase, consultas.slice(0, 3), urls.slice(0, 3));
  return collage ?? urls[0];
}
