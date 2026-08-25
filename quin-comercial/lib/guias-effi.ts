// =====================================================
// GUÍAS EFFI — lee el reporte de remisiones (Excel/HTML) de Effi/Alegra,
// saca teléfono + guía + estado + nombre, y normaliza el estado a los avisos
// que se le mandan al cliente por WhatsApp.
//
// El "Excel" de Effi en realidad es una TABLA HTML con extensión .xls y
// codificación Latin-1 (por eso se decodifica como 'latin1'). La guía sale
// como número gigante → se lee con raw:true y se pasa a texto exacto.
// =====================================================

import * as XLSX from 'xlsx';

export interface FilaEffi {
  telefono: string;      // 10 dígitos
  nombre: string;
  guia: string;          // solo dígitos
  estadoRaw: string;     // estado tal cual lo trae Effi
  estado: EstadoCanon;   // estado normalizado
  remision: string;      // "Pendiente de facturar" / "Anulado" …
}

export type EstadoCanon =
  | 'despachado' | 'reparto' | 'oficina'
  | 'transito' | 'entregado' | 'devuelto' | 'generada' | 'anulado' | 'otro';

// Estados por los que SÍ se le escribe al cliente (los que pidió el negocio).
export const ESTADOS_NOTIFICAR: EstadoCanon[] = ['despachado', 'reparto', 'oficina'];

const sinAcentos = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Traduce el texto de estado de Effi a un estado canónico. */
export function normalizarEstado(raw: string): EstadoCanon {
  const s = sinAcentos(raw);
  if (!s) return 'otro';
  if (/anulad/.test(s)) return 'anulado';
  if (/entregad/.test(s)) return 'entregado';
  if (/devuelt|devoluci|reexpedi|reintegr|rechazad/.test(s)) return 'devuelto';
  if (/oficina|bodega destino|disponible|punto de|retiro|reclamar|pto\b/.test(s)) return 'oficina';
  if (/repart|distribuci|gestion de entrega|para entrega|ruta de entrega|en entrega/.test(s)) return 'reparto';
  if (/despachad|admitid|transito|en camino|recogid|en ruta|enrutad/.test(s)) return 'despachado';
  if (/generad|creada|impresa/.test(s)) return 'generada';
  return 'otro';
}

/** Etiqueta corta y legible del estado (para la previsualización del panel). */
export function etiquetaEstado(e: EstadoCanon): string {
  return ({
    despachado: 'Despachado', reparto: 'En reparto', oficina: 'En oficina',
    transito: 'En tránsito', entregado: 'Entregado', devuelto: 'Devuelto',
    generada: 'Guía generada', anulado: 'Anulado', otro: 'Otro',
  } as Record<EstadoCanon, string>)[e];
}

/** La frase ({{2}}) que se le envía al cliente según el estado. */
export function fraseEstado(e: EstadoCanon): string {
  switch (e) {
    case 'despachado':
      return '¡Buenas noticias! Tu pedido ya fue despachado y va en camino. 🚚';
    case 'reparto':
      return 'Tu pedido está en reparto: hoy el mensajero te lo lleva a tu dirección. Ten el pago listo, por favor. 🚚';
    case 'oficina':
      return 'Tu pedido ya llegó a la oficina de la transportadora. Puedes pasar a reclamarlo presentando tu número de guía. Hazlo pronto, por favor, para que no lo devuelvan. 📦';
    default:
      return 'Tu pedido tuvo una actualización.';
  }
}

// ── Detección de columnas (los encabezados pueden variar un poco) ─────────────
function buscarClave(keys: string[], candidatos: string[]): string | null {
  const norm = keys.map(k => ({ k, n: sinAcentos(k) }));
  for (const cand of candidatos) {
    const c = sinAcentos(cand);
    const exacta = norm.find(x => x.n === c);
    if (exacta) return exacta.k;
  }
  for (const cand of candidatos) {
    const c = sinAcentos(cand);
    const parcial = norm.find(x => x.n.includes(c));
    if (parcial) return parcial.k;
  }
  return null;
}

const soloDigitos = (v: any) => {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(Math.round(v));
  return String(v).replace(/[^0-9]/g, '');
};

/** Parsea el archivo de Effi (HTML-Latin1 o xlsx real) a filas limpias. */
export function parsearReporteEffi(buf: Buffer): FilaEffi[] {
  // xlsx real empieza por 'PK' (zip); si no, es la tabla HTML en Latin-1.
  const esZip = buf.length > 2 && buf[0] === 0x50 && buf[1] === 0x4b;
  const wb = esZip
    ? XLSX.read(buf, { type: 'buffer' })
    : XLSX.read(buf.toString('latin1'), { type: 'string' });

  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' });
  if (!rows.length) return [];

  const keys = Object.keys(rows[0]);
  const colTel   = buscarClave(keys, ['Teléfono', 'telefono', 'celular', 'movil']);
  const colNom   = buscarClave(keys, ['Cliente', 'nombre del cliente', 'destinatario', 'nombre']);
  const colGuia  = buscarClave(keys, ['Guía inicial de transportadora', 'guia inicial de transportadora', 'guia adicional de transportadora', 'numero de guia', 'guia']);
  const colGuia2 = buscarClave(keys, ['Guía adicional de transportadora']);
  const colEst   = buscarClave(keys, ['Estado global guía inicial', 'estado transportadora guia inicial', 'estado de la guia', 'estado envio', 'estado']);
  const colRem   = buscarClave(keys, ['Estado remisión', 'estado remision']);

  const salida: FilaEffi[] = [];
  for (const r of rows) {
    const telefono = colTel ? soloDigitos(r[colTel]).replace(/^57/, '').slice(-10) : '';
    let guia = colGuia ? soloDigitos(r[colGuia]) : '';
    if (!guia && colGuia2) guia = soloDigitos(r[colGuia2]);
    const nombre = colNom ? String(r[colNom] ?? '').trim() : '';
    const estadoRaw = colEst ? String(r[colEst] ?? '').trim() : '';
    const remision = colRem ? String(r[colRem] ?? '').trim() : '';

    if (telefono.length !== 10) continue;         // sin teléfono válido, no sirve
    salida.push({
      telefono, nombre, guia,
      estadoRaw,
      estado: normalizarEstado(estadoRaw),
      remision,
    });
  }
  return salida;
}
