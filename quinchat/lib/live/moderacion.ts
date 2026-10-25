// Moderación de comentarios públicos del live (se ejecuta en el SERVIDOR).
// Bloquea: enlaces, celulares/números largos, correos y groserías comunes.
// Lo que pasa el filtro se publica; desde el panel se puede ocultar o borrar.

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Groserías / insultos frecuentes en Colombia. Se comparan como PALABRAS completas
// (sin tildes) para no bloquear palabras normales como "computador" o "cálculo".
const GROSERIAS = /\b(hijueputa\w*|hp|hpta|gonorrea|malparid\w*|maric\w*|put[ao]s?|pirob\w*|careverga|verga|culo|mierda|estafa\w*|ladron\w*|ratas?|perra|zorra|idiota|imbecil\w*|estupid\w*|pendej\w*|mamaguevo|huevon\w*|cabron\w*|cono)\b/;

export interface Revision { ok: boolean; motivo?: string; texto: string }

export function limpiarNombre(n: unknown): string {
  const t = String(n ?? '').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!t) return 'Cliente';
  const r = revisarComentario(t);
  return r.ok ? t : 'Cliente';
}

export function revisarComentario(entrada: unknown): Revision {
  const texto = String(entrada ?? '').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (!texto) return { ok: false, motivo: 'vacio', texto };

  const plano = sinTildes(texto);
  if (/(https?:\/\/|www\.|\.(com|co|net|org|shop|link|ly|io)\b|t\.me|wa\.me|bit\.ly)/i.test(plano)) {
    return { ok: false, motivo: 'enlace', texto };
  }
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(plano)) return { ok: false, motivo: 'correo', texto };
  // 7 o más dígitos (aunque vengan separados por espacios, puntos o guiones) = probable celular
  if ((plano.match(/\d/g) ?? []).length >= 7 && /\d[\d\s.\-]{6,}\d/.test(plano)) {
    return { ok: false, motivo: 'telefono', texto };
  }
  const compacto = plano.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ');
  if (GROSERIAS.test(compacto)) return { ok: false, motivo: 'lenguaje', texto };
  // Mayúsculas gritadas o repetición excesiva (spam)
  if (/(.)\1{7,}/.test(plano)) return { ok: false, motivo: 'spam', texto };
  return { ok: true, texto };
}
