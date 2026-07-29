/**
 * Gasto de publicidad directo desde Meta (Marketing API).
 *
 * Consulta el rendimiento de cada anuncio (nivel "ad") de la cuenta publicitaria
 * y lo devuelve indexado por el ID del anuncio. Ese ID es el mismo `source_id`
 * que WhatsApp manda en el referral cuando un cliente escribe desde un anuncio
 * de clic-a-WhatsApp, así que se puede cruzar 1 a 1 con los mensajes/ventas.
 *
 * Requiere dos variables de entorno (se configuran en Vercel):
 *   META_ADS_TOKEN        → token de un Usuario del sistema con permiso ads_read
 *   META_AD_ACCOUNT_ID    → el id de la cuenta, con o sin "act_" (ej. act_2104131786809936)
 */

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface GastoAnuncio {
  gasto: number;        // en la moneda de la cuenta (COP)
  impresiones: number;
  alcance: number;
  clics: number;
  cpm: number;          // costo por mil impresiones
  cpc: number;          // costo por clic
  ctr: number;          // % de clics sobre impresiones
  frecuencia: number;   // veces promedio que cada persona vio el anuncio
  mensajesMeta: number; // conversaciones iniciadas según Meta (dato oficial CTWA)
  thruplays: number;    // reproducciones de video de 15s+ (o completas)
  nombre: string;       // nombre del anuncio en Meta
  estado: string;       // texto amigable: "Activa", "Apagada", "En revisión"…
  activo: boolean;      // true solo si está corriendo ahora mismo
}

/** Suma el valor de las acciones cuyo tipo contiene alguna de las palabras dadas. */
function sumaAcciones(actions: any, contiene: string[]): number {
  if (!Array.isArray(actions)) return 0;
  let s = 0;
  for (const a of actions) {
    const t = String(a?.action_type ?? '');
    if (contiene.some(x => t.includes(x))) s += num(a?.value);
  }
  return s;
}

/** Traduce el effective_status de Meta a un texto claro en español. */
function traducirEstado(s: string): { estado: string; activo: boolean } {
  switch (String(s ?? '').toUpperCase()) {
    case 'ACTIVE':               return { estado: 'Activa', activo: true };
    case 'PAUSED':               return { estado: 'Apagada', activo: false };
    case 'CAMPAIGN_PAUSED':      return { estado: 'Apagada (campaña)', activo: false };
    case 'ADSET_PAUSED':         return { estado: 'Apagada (conjunto)', activo: false };
    case 'PENDING_REVIEW':       return { estado: 'En revisión', activo: false };
    case 'DISAPPROVED':          return { estado: 'Rechazada', activo: false };
    case 'PREAPPROVED':          return { estado: 'Preaprobada', activo: false };
    case 'PENDING_BILLING_INFO': return { estado: 'Falta pago', activo: false };
    case 'ARCHIVED':             return { estado: 'Archivada', activo: false };
    case 'DELETED':              return { estado: 'Eliminada', activo: false };
    case 'WITH_ISSUES':          return { estado: 'Con problemas', activo: false };
    default:                     return { estado: s ? String(s) : '—', activo: false };
  }
}

export interface ResultadoGastoMeta {
  ok: boolean;
  porAnuncio: Map<string, GastoAnuncio>;
  moneda: string;
  error?: string;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza el id de cuenta a la forma "act_XXXXXXXX". */
function normalizarCuenta(id: string): string {
  const limpio = String(id ?? '').trim();
  if (!limpio) return '';
  return limpio.startsWith('act_') ? limpio : `act_${limpio}`;
}

/**
 * Trae el gasto por anuncio entre dos fechas (YYYY-MM-DD).
 * Si no se pasan fechas, usa todo el histórico de la cuenta (date_preset=maximum).
 */
export async function gastoPorAnuncioMeta(
  desde?: string | null,
  hasta?: string | null,
): Promise<ResultadoGastoMeta> {
  const token = String(process.env.META_ADS_TOKEN ?? '').trim();
  const cuenta = normalizarCuenta(process.env.META_AD_ACCOUNT_ID ?? '');
  const porAnuncio = new Map<string, GastoAnuncio>();

  if (!token || !cuenta) {
    return { ok: false, porAnuncio, moneda: 'COP', error: 'Falta META_ADS_TOKEN o META_AD_ACCOUNT_ID' };
  }

  const fields = 'ad_id,ad_name,spend,impressions,reach,frequency,clicks,cpm,cpc,ctr,actions,video_thruplay_watched_actions,account_currency';
  const params = new URLSearchParams({
    level: 'ad',
    fields,
    limit: '500',
    access_token: token,
  });
  if (desde && hasta) {
    params.set('time_range', JSON.stringify({ since: desde, until: hasta }));
  } else {
    params.set('date_preset', 'maximum');
  }

  let url: string | null = `${GRAPH}/${cuenta}/insights?${params.toString()}`;
  let moneda = 'COP';

  // ── Estado de cada anuncio (activo / apagado) ────────────────────────────
  // El gasto (insights) no trae el estado; se pide por separado a /ads.
  const estados = new Map<string, { estado: string; activo: boolean; nombre: string }>();
  try {
    let urlAds: string | null =
      `${GRAPH}/${cuenta}/ads?fields=id,name,effective_status&limit=500&access_token=${encodeURIComponent(token)}`;
    let v = 0;
    while (urlAds && v < 20) {
      v++;
      const r = await fetch(urlAds, { method: 'GET' });
      const j: any = await r.json();
      if (!r.ok || j?.error) break; // si falla, seguimos sin estado
      for (const a of j?.data ?? []) {
        const id = String(a?.id ?? '').trim();
        if (!id) continue;
        const t = traducirEstado(a?.effective_status);
        estados.set(id, { ...t, nombre: String(a?.name ?? '') });
      }
      urlAds = j?.paging?.next ?? null;
    }
  } catch { /* sin estado, no es crítico */ }

  try {
    // La API pagina: se sigue el cursor "next" hasta agotar los resultados.
    let vueltas = 0;
    while (url && vueltas < 20) {
      vueltas++;
      const res = await fetch(url, { method: 'GET' });
      const json: any = await res.json();

      if (!res.ok || json?.error) {
        const msg = json?.error?.message || `HTTP ${res.status}`;
        return { ok: false, porAnuncio, moneda, error: msg };
      }

      for (const fila of json?.data ?? []) {
        const id = String(fila?.ad_id ?? '').trim();
        if (!id) continue;
        if (fila?.account_currency) moneda = String(fila.account_currency);

        // Puede haber varias filas del mismo anuncio (por día); se acumulan.
        const prev = porAnuncio.get(id);
        const est = estados.get(id);
        const g: GastoAnuncio = prev ?? {
          gasto: 0, impresiones: 0, alcance: 0, clics: 0,
          cpm: 0, cpc: 0, ctr: 0, frecuencia: 0, mensajesMeta: 0, thruplays: 0,
          nombre: String(fila?.ad_name ?? ''),
          estado: est?.estado ?? '—', activo: est?.activo ?? false,
        };
        g.gasto       += num(fila?.spend);
        g.impresiones += num(fila?.impressions);
        g.alcance     += num(fila?.reach);
        g.clics       += num(fila?.clicks);
        g.mensajesMeta += sumaAcciones(fila?.actions, ['messaging_conversation_started', 'messaging_first_reply']);
        g.thruplays   += sumaAcciones(fila?.video_thruplay_watched_actions, ['video_view', 'thruplay']);
        // cpm/cpc/ctr se recalculan al final para que el promedio sea correcto
        g.cpm = num(fila?.cpm);
        g.cpc = num(fila?.cpc);
        g.ctr = num(fila?.ctr);
        if (!g.nombre && fila?.ad_name) g.nombre = String(fila.ad_name);
        porAnuncio.set(id, g);
      }

      url = json?.paging?.next ?? null;
    }

    // Anuncios con estado pero sin gasto en el rango: se agregan igual para
    // que en el panel se sepa si están activos o apagados.
    for (const [id, est] of estados) {
      if (!porAnuncio.has(id)) {
        porAnuncio.set(id, {
          gasto: 0, impresiones: 0, alcance: 0, clics: 0, cpm: 0, cpc: 0, ctr: 0,
          frecuencia: 0, mensajesMeta: 0, thruplays: 0,
          nombre: est.nombre, estado: est.estado, activo: est.activo,
        });
      } else {
        const g = porAnuncio.get(id)!;
        g.estado = est.estado;
        g.activo = est.activo;
        if (!g.nombre) g.nombre = est.nombre;
      }
    }

    // Recalcular métricas derivadas sobre los totales acumulados
    for (const g of porAnuncio.values()) {
      g.cpm = g.impresiones > 0 ? (g.gasto / g.impresiones) * 1000 : 0;
      g.cpc = g.clics > 0 ? g.gasto / g.clics : 0;
      g.ctr = g.impresiones > 0 ? (g.clics / g.impresiones) * 100 : 0;
      g.frecuencia = g.alcance > 0 ? g.impresiones / g.alcance : 0;
    }

    return { ok: true, porAnuncio, moneda };
  } catch (e: any) {
    return { ok: false, porAnuncio, moneda, error: e?.message || 'fallo de red' };
  }
}
