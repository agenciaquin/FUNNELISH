import * as XLSX from 'xlsx';

/**
 * Lee los Excel de campañas de TikTok y de Meta.
 * Busca las columnas por su nombre (no por posición), porque el orden cambia
 * entre plataformas y según el idioma de la cuenta.
 */

export interface FilaGasto {
  campana: string;
  campanaId: string;    // identificador de Meta/TikTok — cruza mejor que el nombre
  estado: 'activa' | 'apagada' | '';
  fecha: string;        // YYYY-MM-DD
  gasto: number;
  conversiones: number;
  impresiones: number;
  clics: number;
}

export type Plataforma = 'tiktok' | 'meta';

// Posibles nombres de cada columna, en español e inglés
const COLUMNAS = {
  campana:      ['nombre de la campaña', 'campaign name', 'nombre de campaña', 'campaña'],
  campanaId:    ['identificador de la campaña', 'campaign id', 'id de la campaña', 'campaign_id'],
  estado:       ['entrega de la campaña', 'primary status', 'campaign status', 'estado', 'entrega', 'delivery'],
  gasto:        ['importe gastado', 'spend', 'amount spent', 'costo', 'cost', 'gasto'],
  conversiones: ['resultados', 'conversions', 'results', 'compras', 'purchases'],
  impresiones:  ['impresiones', 'impressions'],
  clics:        ['clicks (destination)', 'clics', 'clicks', 'clics en el enlace'],
  fecha:        ['inicio del informe', 'día', 'dia', 'date', 'day', 'reporting starts'],
};

function normalizar(s: any): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function buscarColumna(encabezados: string[], candidatos: string[]): number {
  const norm = encabezados.map(normalizar);
  const cands = candidatos.map(normalizar);
  // Primero coincidencia exacta, luego parcial
  for (const c of cands) {
    const i = norm.findIndex(h => h === c);
    if (i >= 0) return i;
  }
  for (const c of cands) {
    const i = norm.findIndex(h => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}

/** "active" / "Activa" → activa · "inactive" / "Pausada" → apagada */
function leerEstado(v: any): 'activa' | 'apagada' | '' {
  const s = normalizar(v);
  if (!s) return '';
  // Ojo: "inactivo" también contiene "activ", por eso se revisa primero
  if (/inactiv|pausa|paused|off|desactiv|apagad|no se publica|not delivering|finalizad|completed/.test(s)) return 'apagada';
  if (/activ|active|en circulacion|publicando|delivering|en curso/.test(s)) return 'activa';
  return '';
}

function aNumero(v: any): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Saca la fecha del nombre del archivo (los reportes de TikTok no traen columna
 * de fecha). Si el nombre trae un rango ("13 to 19"), se usa la fecha FINAL y se
 * avisa, porque todo el gasto del período quedaría cargado en un solo día.
 */
export function fechasDesdeNombre(nombreArchivo: string): { fecha: string | null; esRango: boolean } {
  const meses: Record<string, string> = {
    ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
    jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
  };

  // Formato ISO: 2026-07-13 to 2026-07-19
  const iso = [...nombreArchivo.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)]
    .map(m => `${m[1]}-${m[2]}-${m[3]}`);
  if (iso.length > 0) {
    const unicas = [...new Set(iso)];
    return { fecha: unicas[unicas.length - 1], esRango: unicas.length > 1 };
  }

  // Formato de Meta en español: 20-jul-2026---21-jul-2026
  const es = [...nombreArchivo.toLowerCase().matchAll(/(\d{1,2})-([a-z]{3})-(\d{4})/g)]
    .filter(m => meses[m[2]])
    .map(m => `${m[3]}-${meses[m[2]]}-${m[1].padStart(2, '0')}`);
  if (es.length > 0) {
    const unicas = [...new Set(es)];
    return { fecha: unicas[unicas.length - 1], esRango: unicas.length > 1 };
  }

  return { fecha: null, esRango: false };
}

function normalizarFecha(v: any, respaldo: string): string {
  if (!v) return respaldo;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return respaldo;
}

/** Detecta si el archivo es de TikTok o de Meta por sus encabezados. */
export function detectarPlataforma(encabezados: string[]): Plataforma {
  const texto = encabezados.map(normalizar).join(' | ');
  if (texto.includes('importe gastado') || texto.includes('inicio del informe')) return 'meta';
  return 'tiktok';
}

export interface ResultadoLectura {
  plataforma: Plataforma;
  filas: FilaGasto[];
  fecha: string;
  ignoradas: number;
  esRango?: boolean;   // el archivo cubre varios días sin desglosarlos
  error?: string;
}

export function leerExcelCampanas(buffer: ArrayBuffer, nombreArchivo: string): ResultadoLectura {
  const hoy = new Date().toISOString().slice(0, 10);
  const { fecha: fechaDetectada, esRango } = fechasDesdeNombre(nombreArchivo);
  const fechaArchivo = fechaDetectada ?? hoy;

  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const matriz: any[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });

  if (matriz.length < 2) {
    return { plataforma: 'tiktok', filas: [], fecha: fechaArchivo, ignoradas: 0, error: 'El archivo está vacío.' };
  }

  const encabezados = (matriz[0] ?? []).map((h: any) => String(h ?? ''));
  const plataforma  = detectarPlataforma(encabezados);

  const iCampana   = buscarColumna(encabezados, COLUMNAS.campana);
  const iCampanaId = buscarColumna(encabezados, COLUMNAS.campanaId);
  const iEstado    = buscarColumna(encabezados, COLUMNAS.estado);
  const iGasto   = buscarColumna(encabezados, COLUMNAS.gasto);
  const iConv    = buscarColumna(encabezados, COLUMNAS.conversiones);
  const iImpr    = buscarColumna(encabezados, COLUMNAS.impresiones);
  const iClics   = buscarColumna(encabezados, COLUMNAS.clics);
  const iFecha   = buscarColumna(encabezados, COLUMNAS.fecha);

  if (iCampana < 0 || iGasto < 0) {
    return {
      plataforma, filas: [], fecha: fechaArchivo, ignoradas: 0,
      error: 'No encontré las columnas de campaña y gasto. ¿Es el archivo correcto?',
    };
  }

  const filas: FilaGasto[] = [];
  let ignoradas = 0;

  for (const fila of matriz.slice(1)) {
    const nombre = String(fila?.[iCampana] ?? '').trim();
    if (!nombre) { ignoradas++; continue; }
    // TikTok cierra con una fila "Total of N results"
    if (/^total\b/i.test(nombre) || /total of \d+ results/i.test(nombre)) { ignoradas++; continue; }

    const gasto = aNumero(fila[iGasto]);
    // Las campañas apagadas que no gastaron nada solo ensucian el informe.
    // Meta exporta más de cien de esas en cada archivo.
    if (gasto <= 0) { ignoradas++; continue; }

    filas.push({
      campana: nombre,
      campanaId: iCampanaId >= 0 ? String(fila[iCampanaId] ?? '').trim() : '',
      estado: iEstado >= 0 ? leerEstado(fila[iEstado]) : '',
      fecha: iFecha >= 0 ? normalizarFecha(fila[iFecha], fechaArchivo) : fechaArchivo,
      gasto,
      conversiones: iConv  >= 0 ? aNumero(fila[iConv])  : 0,
      impresiones:  iImpr  >= 0 ? aNumero(fila[iImpr])  : 0,
      clics:        iClics >= 0 ? aNumero(fila[iClics]) : 0,
    });
  }

  // Si el archivo trae columna de fecha propia, el rango del nombre da igual
  const rangoSinDesglose = esRango && iFecha < 0;
  return { plataforma, filas, fecha: fechaArchivo, ignoradas, esRango: rangoSinDesglose };
}
