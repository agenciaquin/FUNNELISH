/**
 * Integración con Lupap — API de geocodificación de Colombia
 * Docs: https://developer.lupap.com/documentation
 *
 * Auth: Basic Auth (LUPAP_API_KEY : LUPAP_API_SECRET)
 * Endpoint: GET https://api.lupap.co/1.0/search?country=co&q={query}
 *
 * Códigos de footnote clave:
 *  D01 = Address found (exacto)
 *  D02 = Address not found
 *  D03 = Insufficient/Incorrect address data
 *  D04 = Ambiguous address
 *  S01 = Missing secondary number (falta apto/torre/local)
 *  S02 = Unrecognized secondary number
 *  S03 = House Number not found
 *  S04 = Missing House Number
 */

export type LupapStatus =
  | 'verified' | 'partial' | 'ambiguous' | 'plausible'
  | 'nonvalid' | 'none' | 'unknown' | 'expired' | 'retired'
  | 'not-an-address';

export interface LupapValidation {
  found: boolean;                   // geocode.ok
  score: number;                    // 0.0–1.0
  partialMatch: boolean;            // partial_match field
  status: LupapStatus | null;       // analysis.status
  accuracy: string | null;          // geocode.accuracy
  addressPrecision: string | null;  // analysis.address_precision
  footnotes: string[];              // e.g. ['D01','S01']
  fullAddress: string | null;       // address.full_address (dirección estandarizada)
}

const LUPAP_URL = 'https://api.lupap.co/1.0/search';
const TIMEOUT_MS = 5_000;

export async function validateAddressLupap(
  address: string,
  ciudad: string
): Promise<LupapValidation | null> {
  const apiKey    = process.env.LUPAP_API_KEY;
  const apiSecret = process.env.LUPAP_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.warn('[Lupap] Credenciales no configuradas (LUPAP_API_KEY / LUPAP_API_SECRET) — se omite validación');
    return null;
  }

  const q           = `${address}, ${ciudad || 'Colombia'}, Colombia`;
  const url         = `${LUPAP_URL}?country=co&q=${encodeURIComponent(q)}`;
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const resp = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!resp.ok) {
      console.error('[Lupap] HTTP error:', resp.status);
      return null;
    }

    const data = await resp.json();

    // Sin resultados → dirección no encontrada
    if (!data.results || data.results.length === 0) {
      return {
        found: false, score: 0, partialMatch: true,
        status: 'nonvalid', accuracy: null, addressPrecision: null,
        footnotes: ['D02'], fullAddress: null,
      };
    }

    const r = data.results[0];

    // Extraer códigos de footnotes de changes[] y footnotes[]
    const fromChanges: string[] = (r.analysis?.changes ?? [])
      .map((c: any) => c.footnote).filter(Boolean);
    const fromArray: string[] = (r.analysis?.footnotes ?? [])
      .map((f: any) => typeof f === 'string' ? f : f.code).filter(Boolean);
    const footnotes = [...new Set([...fromChanges, ...fromArray])];

    return {
      found:            r.geocode?.ok ?? false,
      score:            typeof r.score === 'number' ? r.score : 0,
      partialMatch:     r.partial_match ?? false,
      status:           r.analysis?.status ?? null,
      accuracy:         r.geocode?.accuracy ?? null,
      addressPrecision: r.analysis?.address_precision ?? null,
      footnotes,
      fullAddress:      r.address?.full_address ?? null,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[Lupap] Timeout — se omite validación');
    } else {
      console.error('[Lupap] Error:', err);
    }
    return null; // Nunca bloquear el flujo por error externo
  }
}

/**
 * Devuelve el mensaje WhatsApp a enviar según el resultado Lupap.
 * Retorna null si la dirección está verificada y no requiere acción.
 */
export function getLupapMessage(
  v: LupapValidation | null,
  direccion: string
): string | null {
  if (!v) return null; // Sin validación = no bloquear

  // ── 1. Dirección no encontrada → pedir recibo de luz o agua ──────────────
  if (!v.found || v.status === 'nonvalid' || v.status === 'not-an-address' || v.score < 0.2) {
    return (
      `⚠️ La dirección *${direccion}* no fue encontrada en nuestro sistema de geocodificación.\n\n` +
      `Para garantizar la entrega de tu pedido, por favor envíanos una foto de tu ` +
      `*recibo de luz o de agua* donde aparezca tu dirección completa. 📄`
    );
  }

  // ── 2. Falta número secundario (torre / apartamento / local) → S01 ────────
  if (v.footnotes.includes('S01')) {
    return (
      `📍 La dirección *${direccion}* corresponde a un edificio o conjunto residencial.\n\n` +
      `¿Cuál es el número de *torre y apartamento*? Por ejemplo: *Torre 2, Apto 301*.`
    );
  }

  // ── 3. Número de casa no encontrado → S03 / S04 ──────────────────────────
  if (v.footnotes.includes('S03') || v.footnotes.includes('S04')) {
    return (
      `📍 No encontramos el número exacto en la dirección *${direccion}*.\n\n` +
      `¿Puedes verificar el número de placa? Por ejemplo: *Calle 45 # 23-18*.`
    );
  }

  // ── 4. Componentes insuficientes → D03 / partial / partialMatch ──────────
  const isLowPrecision = ['thoroughfare', 'locality', 'administrative_area', 'undetermined']
    .includes(v.addressPrecision ?? '');
  if (v.footnotes.includes('D03') || v.status === 'partial' || (v.partialMatch && v.score < 0.7)) {
    if (isLowPrecision) {
      return (
        `📍 La dirección *${direccion}* está incompleta.\n\n` +
        `¿Podrías añadir el número o complemento? Por ejemplo: *${direccion} # 23-18*.`
      );
    }
    return (
      `📍 La dirección *${direccion}* parece incompleta.\n\n` +
      `¿Falta algún dato como torre, apartamento o número de casa? Por favor complétala.`
    );
  }

  // ── 5. Ambigua → D04 / status = ambiguous ────────────────────────────────
  if (v.status === 'ambiguous' || v.footnotes.includes('D04')) {
    return (
      `📍 La dirección *${direccion}* puede ser ambigua.\n\n` +
      `¿Puedes indicarnos si falta torre, apartamento, bloque o algún complemento?`
    );
  }

  // ── 6. Score bajo (encontrada pero poca confianza) ───────────────────────
  if (v.score < 0.6 && v.status !== 'verified') {
    const ref = v.fullAddress ?? direccion;
    return (
      `📍 ¿Es correcta esta dirección: *${ref}*?\n\n` +
      `Si falta torre, apartamento o local, por favor escríbelo.`
    );
  }

  // ── Dirección verificada — sin acción necesaria ──────────────────────────
  return null;
}
