/**
 * Red de seguridad del TONO para lo que escribe la IA a un cliente.
 * Los prompts ya prohíben las risas y la jerga, pero el modelo a veces las cuela
 * ("Jaja, ¡entendido!", "¡Ja! Entiendo la frustración, hermano."). Esto las quita
 * antes de enviar. Solo toca el arranque (risas) y los apelativos sueltos.
 */
const RISA_INICIO = /^[\s¡!😅😄😂🤣😆]*(?:(?:j[aeiou])+h?(?=[\s,.!¡]|$)[\s,.!]*)+(?:[😄😂🤣😅😆]\s*)*/iu;
const APELATIVO = /[,\s]+(hermano|hermana|herma|parcero|parce|bro|mijo|mija|papi|mami|mi rey|mi amor|coraz[oó]n)(?=\s*[.!?,;)]|\s*$)/giu;

export function limpiarTono(texto: string): string {
  if (!texto) return texto;
  return texto
    .replace(RISA_INICIO, '')
    .replace(APELATIVO, '')
    .replace(/^(¡?\s*)([a-záéíóúñ])/i, (_m, a: string, b: string) => a + b.toUpperCase())
    .trim();
}

/** Tono que pidió el dueño (05-nov-2026): MUY FORMAL. Se antepone a los prompts del bot. */
export const TONO_FORMAL =
  'TONO (obligatorio, por encima de cualquier otra indicación de estilo): MUY FORMAL, respetuoso y ' +
  'profesional, como el servicio al cliente de una marca seria. Trata al cliente por su nombre o de forma ' +
  'neutral. PROHIBIDO: bromas, risas ("jaja", "jeje", "ja"), jerga o apelativos ("hermano", "parce", "bro", ' +
  '"mi amor"…), muletillas ("de una", "listo pues", "fresco") y exclamaciones exageradas. Máximo 1 emoji por ' +
  'mensaje y solo si aporta (✅ 📦 🚚). Ante una queja o frustración (por ejemplo, por el abono), responde con ' +
  'empatía y seriedad, explicando con claridad; nunca con humor. Frases completas, claras y con buena ortografía.\n\n';

/**
 * ¿La respuesta de la IA es solo relleno? (vacía, solo emojis/puntuación como "👍" o
 * "👋😊", o un marcador cortado "[[F"). Esos salían en el chat como burbujas "BOT IA"
 * casi vacías y, ante un "ok"/👍 del cliente, repetían la despedida. No se envían.
 */
export function esRelleno(texto: string | null | undefined): boolean {
  const t = String(texto ?? '').replace(/\[\[[A-Z]*\]\]/g, '').trim();
  if (!t) return true;
  if (/^\[\[?[A-Z]{0,8}$/i.test(t)) return true;
  const sinEmojis = t
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}⃣‍️]/gu, '')
    .replace(/[\s.,;:!¡?¿*_~\-—–()]/g, '');
  return sinEmojis.length === 0;
}
