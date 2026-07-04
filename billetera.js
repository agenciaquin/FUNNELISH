/* ================================================================
   Billetera QUINO — billetera.js
   Comisiones de ventas Funnelish · Agencia QUIN
   ================================================================ */

const SUPABASE_URL_B  = 'https://glmnuqfnxwaibckufgtr.supabase.co';
const SUPABASE_KEY_B  = 'sb_publishable_TW1nS4T1g8vcZJ-mJeg0EA_8G1HZlKe';
const DEVOLUCION_COSTO = 23000; // costo fijo por devolución

let dbB         = null;
let remisiones  = [];
let filtroActual = 'todos';

/* ── INIT ── */
window.addEventListener('DOMContentLoaded', async () => {
  // Inicializar Supabase
  for (let i = 0; i < 5; i++) {
    if (window.supabase?.createClient) {
      dbB = window.supabase.createClient(SUPABASE_URL_B, SUPABASE_KEY_B);
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Botón subir reporte
  const btnSubir  = document.getElementById('btn-subir-reporte');
  const inputFile = document.getElementById('input-reporte');
  btnSubir.addEventListener('click', () => { inputFile.value = ''; inputFile.click(); });
  inputFile.addEventListener('change', () => {
    if (inputFile.files[0]) procesarArchivo(inputFile.files[0]);
  });

  // Botones de filtro
  document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroActual = btn.dataset.filtro;
      document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTabla();
    });
  });

  cargarDatos();
});

/* ── CARGA DESDE SUPABASE ── */
async function cargarDatos() {
  if (!dbB) {
    document.getElementById('tabla-cuerpo').innerHTML =
      `<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.3);padding:2.5rem;">Sin conexión a Supabase. Sube un reporte para comenzar.</td></tr>`;
    return;
  }

  try {
    const { data, error } = await dbB
      .from('remisiones_effi')
      .select('*')
      .order('fecha_creacion', { ascending: false });

    if (error) { console.warn('Error cargando:', error.message); return; }
    remisiones = data || [];
    actualizarUI();
  } catch(err) {
    console.warn('cargarDatos error:', err);
  }
}

/* ── PROCESAR ARCHIVO ── */
function procesarArchivo(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const nuevas = parsearHTMLXLS(e.target.result);

      if (!nuevas.length) {
        alert('No se encontraron remisiones en el archivo.');
        return;
      }

      // Deduplicar por id_remision
      const existIds  = new Set(remisiones.map(r => r.id_remision));
      const soloNuevas = nuevas.filter(r => !existIds.has(r.id_remision));

      // Guardar solo las nuevas (upsert por si acaso)
      if (dbB && soloNuevas.length) {
        for (let i = 0; i < soloNuevas.length; i += 500) {
          const { error } = await dbB
            .from('remisiones_effi')
            .upsert(soloNuevas.slice(i, i + 500), { onConflict: 'id_remision' });
          if (error) console.warn('Error guardando:', error.message);
        }
      }

      // Merge local: actualizar estados de las existentes + agregar nuevas
      const mapaExistente = new Map(remisiones.map(r => [r.id_remision, r]));
      nuevas.forEach(r => mapaExistente.set(r.id_remision, r));
      remisiones = [...mapaExistente.values()];

      actualizarUI();
      alert(`✅ Reporte actualizado:\n• ${soloNuevas.length} nuevas remisiones agregadas\n• ${nuevas.length - soloNuevas.length} ya existían (estado actualizado)`);
    } catch(err) {
      console.error(err);
      alert('No se pudo leer el archivo. Asegúrate de que sea el reporte de Effi (.xls).');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

/* ── PARSER HTML-XLS ── */
function parsearHTMLXLS(htmlText) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(htmlText, 'text/html');
  const rows   = [...doc.querySelectorAll('tr')];
  if (!rows.length) return [];

  const headers = [...rows[0].querySelectorAll('th, td')].map(c => c.textContent.trim());

  // Búsqueda de columna por palabras clave (tolerante a encoding roto)
  const findCol = (...keywords) => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().replace(/[^\w]/g, ' ').trim();
      if (keywords.every(k => h.includes(k))) return i;
    }
    return -1;
  };

  // Teléfono: prefijo 3 chars por si "Teléfono" está corrompido
  const findTel = () => {
    for (let i = 0; i < headers.length; i++) {
      const p3 = headers[i].slice(0, 3).replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (p3 === 'tel' || p3 === 'cel') return i;
    }
    return findCol('tel');
  };

  const c = {
    id:    findCol('id', 'remis'),
    cli:   findCol('cliente'),
    tel:   findTel(),
    est:   findCol('estado', 'global'),
    neto:  findCol('total', 'neto'),
    costo: findCol('costo', 'manual'),
    flete: findCol('flete'),
    fecha: findCol('fecha', 'creaci'),
  };

  // Convertir número con coma decimal: "149900,00" → 149900
  const num = (v) => parseFloat(String(v || '0').replace(',', '.')) || 0;

  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = [...rows[i].querySelectorAll('td, th')].map(c => c.textContent.trim());
    if (!cells.some(v => v)) continue;

    const idRem = c.id >= 0 ? cells[c.id] : '';
    if (!idRem) continue;

    const estado      = c.est   >= 0 ? cells[c.est]   : '';
    const totalNeto   = num(c.neto  >= 0 ? cells[c.neto]  : '0');
    const costoManual = num(c.costo >= 0 ? cells[c.costo] : '0');
    const valorFlete  = num(c.flete >= 0 ? cells[c.flete] : '0');

    data.push({
      id_remision:   idRem,
      cliente:       c.cli   >= 0 ? cells[c.cli]   : '',
      telefono:      c.tel   >= 0 ? cells[c.tel]   : '',
      estado,
      total_neto:    totalNeto,
      costo_manual:  costoManual,
      valor_flete:   valorFlete,
      comision:      Math.round(totalNeto - costoManual - valorFlete),
      es_devolucion: estado.toLowerCase().includes('devolu'),
      fecha_creacion: c.fecha >= 0 ? cells[c.fecha] : '',
    });
  }

  return data;
}

/* ── CÁLCULO DE STATS ── */
function calcularStats() {
  const entregadas = remisiones.filter(r =>
    r.estado?.toLowerCase().includes('entregad') && !r.es_devolucion
  );
  const devueltas  = remisiones.filter(r => r.es_devolucion);
  const pendientes = remisiones.filter(r =>
    !r.estado?.toLowerCase().includes('entregad') && !r.es_devolucion
  );

  const sum = (arr) => arr.reduce((acc, r) => acc + (r.comision || 0), 0);

  return {
    entregadas,
    devueltas,
    pendientes,
    totalEntregado:  Math.round(sum(entregadas)),
    totalPendiente:  Math.round(sum(pendientes)),
    totalDevolucion: devueltas.length * DEVOLUCION_COSTO,
    gananciaFinal:   Math.round(sum(entregadas)) - (devueltas.length * DEVOLUCION_COSTO),
  };
}

/* ── ACTUALIZAR UI ── */
function actualizarUI() {
  const s   = calcularStats();
  const fmt = (n) => {
    const abs  = Math.abs(Math.round(n));
    const sign = n < 0 ? '-' : '';
    return sign + '$' + abs.toLocaleString('es-CO');
  };

  document.getElementById('stat-entregado').textContent    = fmt(s.totalEntregado);
  document.getElementById('stat-entregado-n').textContent  = `${s.entregadas.length} pedidos entregados`;
  document.getElementById('stat-pendiente').textContent    = fmt(s.totalPendiente);
  document.getElementById('stat-pendiente-n').textContent  = `${s.pendientes.length} pedidos en camino`;
  document.getElementById('stat-devolucion').textContent   = `-$${(s.totalDevolucion).toLocaleString('es-CO')}`;
  document.getElementById('stat-devolucion-n').textContent = `${s.devueltas.length} devoluciones × $23.000`;
  document.getElementById('stat-ganancia').textContent     = fmt(s.gananciaFinal);
  document.getElementById('stat-total').textContent        = `${remisiones.length} registros totales`;

  renderTabla();
}

/* ── RENDERIZAR TABLA ── */
function renderTabla() {
  const s = calcularStats();

  let filas;
  if      (filtroActual === 'entregadas') filas = s.entregadas;
  else if (filtroActual === 'pendientes') filas = s.pendientes;
  else if (filtroActual === 'devueltas')  filas = s.devueltas;
  else                                    filas = remisiones;

  const countEl = document.getElementById('filtro-count');
  if (countEl) countEl.textContent = `${filas.length} registros`;

  const tbody = document.getElementById('tabla-cuerpo');

  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.3);padding:2rem;">
      ${remisiones.length === 0 ? '📁 Sube el reporte de Effi para ver los datos.' : 'Sin registros para este filtro.'}
    </td></tr>`;
    return;
  }

  const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');

  tbody.innerHTML = filas.map((r, i) => {
    const esEnt = r.estado?.toLowerCase().includes('entregad');
    const esDev = r.es_devolucion;

    const badgeClass = esDev ? 'badge-devuelta'  : esEnt ? 'badge-entregada' : 'badge-pendiente';
    const badgeText  = esDev ? '↩ Devuelta'       : esEnt ? '✓ Entregada'    : '⏳ ' + (r.estado || 'Pendiente');

    const comisionVal  = esDev ? -DEVOLUCION_COSTO : (r.comision || 0);
    const comisionTxt  = esDev ? `-$${DEVOLUCION_COSTO.toLocaleString('es-CO')}` : fmt(r.comision || 0);
    const comisionCls  = comisionVal < 0 ? 'val-negativo' : comisionVal > 0 ? 'val-positivo' : '';

    return `<tr>
      <td class="td-num">${i + 1}</td>
      <td>
        <div class="td-cliente">${r.cliente || '—'}</div>
        <div class="td-tel">${r.telefono || ''}</div>
      </td>
      <td><span class="badge-estado-bill ${badgeClass}">${badgeText}</span></td>
      <td class="val-num">${fmt(r.total_neto || 0)}</td>
      <td class="val-num">${fmt(r.costo_manual || 0)}</td>
      <td class="val-num">${fmt(r.valor_flete || 0)}</td>
      <td class="val-num ${comisionCls}"><strong>${comisionTxt}</strong></td>
    </tr>`;
  }).join('');
}
