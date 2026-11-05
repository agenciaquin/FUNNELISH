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
