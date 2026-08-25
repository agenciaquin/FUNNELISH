// Inyecta en el prompt del bot el CATÁLOGO REAL de la empresa (las categorías y
// productos que el dueño creó en el panel → Catálogos). Así el bot NO inventa
// modelos ni nombres: solo ofrece lo que de verdad existe.

interface CatalogoLite {
  familia: string;
  productos: string[]; // nombres reales de catalogo_colores
}

/** Lee los catálogos activos del tenant y arma un resumen liviano. */
export async function leerCatalogos(supabase: any): Promise<CatalogoLite[]> {
  try {
    const { data } = await supabase
      .from('catalogos_bot')
      .select('familia, patron, catalogo_colores(nombre_producto)')
      .eq('activo', true)
      .order('created_at', { ascending: true });
    if (!Array.isArray(data)) return [];
    return data
      .map((c: any) => {
        const familia = String(c?.familia ?? c?.patron ?? '').trim();
        // Nombres de producto únicos (sin repetir por color)
        const nombres = Array.from(new Set(
          (c?.catalogo_colores ?? [])
            .map((x: any) => String(x?.nombre_producto ?? '').trim())
            .filter(Boolean)
        )) as string[];
        return { familia, productos: nombres.slice(0, 40) };
      })
      .filter((c: CatalogoLite) => c.familia);
  } catch {
    return [];
  }
}

/** Bloque de instrucciones con el catálogo real, para pegar al prompt del bot.
 *  Si la empresa no tiene catálogos, devuelve cadena vacía (no inventa nada). */
export async function bloqueCatalogos(supabase: any): Promise<string> {
  const cats = await leerCatalogos(supabase);
  if (!cats.length) return '';

  const lineas = cats.map(c => {
    const prods = c.productos.length ? ` (ej: ${c.productos.slice(0, 8).join(', ')})` : '';
    return `• ${c.familia}${prods}`;
  }).join('\n');

  const nombresCategorias = cats.map(c => c.familia).join(', ');

  return `\n\n[CATÁLOGO REAL DE LA TIENDA — úsalo, NO inventes]\n` +
    `Estas son las ÚNICAS categorías/productos que la tienda maneja de verdad:\n${lineas}\n\n` +
    `REGLAS AL HABLAR DE PRODUCTOS:\n` +
    `- NUNCA inventes nombres de modelos, diseños, colecciones ni referencias que no estén arriba. Si no aparece, no existe.\n` +
    `- Si el cliente pregunta "¿qué tienen?" o pide ver el catálogo/categorías, responde con estas categorías reales (${nombresCategorias}) y pregúntale cuál le interesa. NO lo pases a un humano solo por esto.\n` +
    `- Si el cliente pide una categoría que SÍ está en la lista, contéstale con lo que hay en ella. Si el sistema envía las fotos, no las describas de más.\n` +
    `- Solo si el cliente insiste en un producto que de verdad NO está en la lista, o pide algo que no puedes resolver, dile con naturalidad que lo pasas con un asesor para ayudarle mejor.\n` +
    `- No prometas colores o tallas de un producto si no estás seguro de que existan; ofrece lo que hay.\n\n` +
    `[ENVIAR FOTOS REALES — MUY IMPORTANTE]\n` +
    `Tú SÍ puedes hacer que se envíen las fotos reales de un producto. Cuando el cliente pida VER un producto o sus fotos (dice cosas como "mándame fotos", "muéstramelo", "cómo es", "cómo son", "quiero verla", "tienes imágenes", "el diseño", "fotos del/de la ...", "a ver el de ..."), y ese producto ESTÁ en la lista de arriba, termina tu mensaje con el marcador:\n` +
    `[[FOTOS: NOMBRE EXACTO DE LA CATEGORÍA]]\n` +
    `Ejemplo: si tienen la categoría "${cats[0]?.familia ?? 'Camisetas'}" y el cliente dice "muéstrame ${cats[0]?.familia ?? 'las camisetas'}", responde algo corto y natural (ej: "¡Claro! Mira 👇") y AL FINAL agrega [[FOTOS: ${cats[0]?.familia ?? 'Camisetas'}]].\n` +
    `Reglas del marcador:\n` +
    `- El NOMBRE dentro del marcador debe ser una de las categorías reales de arriba, escrito igual.\n` +
    `- El cliente NUNCA ve el marcador; solo sirve para que el sistema envíe las fotos. No lo expliques ni lo menciones.\n` +
    `- Cuando uses el marcador, no describas los colores/diseños con texto largo: deja que las fotos hablen. Un mensaje corto basta.\n` +
    `- MUY IMPORTANTE: al usar el marcador, las fotos SE ENVÍAN solas de inmediato. Por eso tu texto NUNCA debe preguntar "¿quieres ver las fotos?" ni "¿te gustaría ver las fotos?" — sería absurdo porque ya se están enviando. Da por hecho que el cliente YA las está viendo y pasa al SIGUIENTE paso: invítalo a elegir el color/modelo o pídele la talla. Ejemplo correcto: "Aquí tienes los colores disponibles 👇 ¿Cuál te gustaría: rojo, blanco, beige o negro?".\n` +
    `- Úsalo solo cuando el cliente quiere VER el producto. Si solo pregunta precio o disponibilidad, responde con texto normal (sin marcador).\n` +
    `- CATÁLOGO COMPLETO una sola vez: el marcador con SOLO la categoría (ej. [[FOTOS: ${cats[0]?.familia ?? 'Camisetas'}]]) envía TODOS los colores. Úsalo UNA vez, la primera vez que el cliente quiere ver esa categoría. Si ya se envió antes, NO lo repitas.\n` +
    `- UN COLOR ESPECÍFICO: cuando el cliente pida ver UN color/modelo puntual (ej. "muéstrame el negro", "¿tienes foto del beige?", "quiero ver la roja"), incluye el COLOR dentro del marcador: [[FOTOS: <COLOR> ${cats[0]?.familia ?? 'CATEGORÍA'}]] (ej. [[FOTOS: NEGRO SPIDERMAN]]). El sistema enviará SOLO la foto de ese color, no todo el catálogo. Esto SÍ puedes hacerlo aunque ya hayas mostrado el catálogo completo antes.\n` +
    `- NUNCA reenvíes el catálogo completo por segunda vez. Si el cliente ya eligió color y estás cerrando (pidiendo talla o datos), continúa con TEXTO; solo manda foto de un color si te lo pide expresamente.\n`;
}
