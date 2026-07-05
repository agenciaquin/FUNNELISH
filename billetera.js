/* ================================================================
   Billetera QUINO — billetera.js
   Comisiones de ventas Funnelish · Agencia QUIN
   ================================================================ */

const SUPABASE_URL_B  = 'https://glmnuqfnxwaibckufgtr.supabase.co';
const SUPABASE_KEY_B  = 'sb_publishable_TW1nS4T1g8vcZJ-mJeg0EA_8G1HZlKe';
const DEVOLUCION_COSTO = 23000;
const LS_KEY_REM       = 'billetera_remisiones'; // backup local
const LS_KEY_BONO      = 'billetera_bonos';       // bonos enviados

let dbB          = null;
let remisiones   = [];
let filtroActual = 'todos';
let filtroSinWA  = false;
let fechaDesde   = '';
let fechaHasta   = '';
let bonosEnviados = new Set();

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

  // Cargar bonos enviados desde localStorage
  try {
    const b = JSON.parse(localStorage.getItem(LS_KEY_BONO) || '[]');
    bonosEnviados = new Set(b);
  } catch(e) {}

  // Botón subir reporte
  const btnSubir  = document.getElementById('btn-subir-reporte');
  const inputFile = document.getElementById('input-reporte');
  btnSubir.addEventListener('click', () => { inputFile.value = ''; inputFile.click(); });
  inputFile.addEventListener('change', () => {
    if (inputFile.files[0]) procesarArchivo(inputFile.files[0]);
  });

  // Botones de filtro (categoría + Sin WA)
  document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filtro;
      if (f === 'sin-wa') {
        // toggle sin-wa independiente
        filtroSinWA = !filtroSinWA;
        btn.classList.toggle('active', filtroSinWA);
      } else {
        filtroActual = f;
        document.querySelectorAll('.btn-filtro:not(.sin-wa)').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }
      renderTabla();
    });
  });

  // Filtro de fechas
  document.getElementById('fecha-desde').addEventListener('change', e => {
    fechaDesde = e.target.value;
    renderTabla();
  });
  document.getElementById('fecha-hasta').addEventListener('change', e => {
    fechaHasta = e.target.value;
    renderTabla();
  });
  document.getElementById('btn-limpiar-fechas').addEventListener('click', () => {
    fechaDesde = '';
    fechaHasta = '';
    document.getElementById('fecha-desde').value = '';
    document.getElementById('fecha-hasta').value = '';
    renderTabla();
  });

  cargarDatos();
});

/* ── GUARDAR EN LOCALSTORAGE ── */
function guardarLocalStorage() {
  try {
    localStorage.setItem(LS_KEY_REM, JSON.stringify(remisiones));
  } catch(e) {
    console.warn('localStorage lleno o bloqueado:', e);
  }
}

/* ── CARGA DESDE SUPABASE (con fallback a localStorage) ── */
async function cargarDatos() {
  // Intentar Supabase primero
  if (dbB) {
    try {
      const { data, error } = await dbB
        .from('remisiones_effi')
        .select('*')
        .order('fecha_creacion', { ascending: true });

      if (!error && data && data.length > 0) {
        remisiones = data;
        guardarLocalStorage(); // sincronizar localStorage
        actualizarUI();
        return;
      }
      if (error) console.warn('Supabase error:', error.message);
    } catch(err) {
      console.warn('cargarDatos error:', err);
    }
  }

  // Fallback: localStorage
  try {
    const local = localStorage.getItem(LS_KEY_REM);
    if (local) {
      remisiones = JSON.parse(local);
      actualizarUI();
      return;
    }
  } catch(e) { console.warn('localStorage parse error:', e); }

  // Sin datos
  remisiones = [];
  actualizarUI();
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

      // Merge: las del archivo sobreescriben las existentes (actualiza estado)
      const mapaExistente = new Map(remisiones.map(r => [r.id_remision, r]));
      const soloNuevas = nuevas.filter(r => !mapaExistente.has(r.id_remision));
      nuevas.forEach(r => mapaExistente.set(r.id_remision, r));
      remisiones = [...mapaExistente.values()];

      // Guardar TODAS las del archivo en Supabase (upsert actualiza estado también)
      if (dbB) {
        for (let i = 0; i < nuevas.length; i += 500) {
          const { error } = await dbB
            .from('remisiones_effi')
            .upsert(nuevas.slice(i, i + 500), { onConflict: 'id_remision' });
          if (error) console.warn('Error guardando en Supabase:', error.message);
        }
      }

      // Guardar TODO en localStorage como respaldo permanente
      guardarLocalStorage();

      actualizarUI();
      alert(`✅ Reporte actualizado:\n• ${soloNuevas.length} nuevas remisiones agregadas\n• ${nuevas.length - soloNuevas.length} actualizadas\n• Total acumulado: ${remisiones.length} registros`);
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

/* ── HELPERS ── */
function limpiarTel(tel) {
  let t = String(tel || '').replace(/\D/g, '');
  if (t.startsWith('57') && t.length === 12) t = t.slice(2);
  return t;
}

function formatFecha(f) {
  if (!f) return '—';
  const d = new Date(String(f).replace(' ', 'T'));
  if (isNaN(d)) return String(f).slice(0, 10) || '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── ENVIAR BONO WA ── */
function abrirBonoWA(idRem, tel, nombre) {
  const telLimpio = limpiarTel(tel);
  const msg = 'Esto es para ti: 20.000 de descuento en tu próxima compra Klixmant. Gracias por ser parte de nuestra familia. Escríbenos ahora y asegura tu bono.';
  window.open(`https://wa.me/57${telLimpio}?text=${encodeURIComponent(msg)}`, '_blank');

  bonosEnviados.add(idRem);
  try { localStorage.setItem(LS_KEY_BONO, JSON.stringify([...bonosEnviados])); } catch(e) {}

  // Actualizar DOM sin re-render completo
  const td = document.querySelector(`[data-bono-id="${idRem}"]`)?.closest('td');
  if (td && !td.querySelector('.badge-bono-enviado')) {
    const badge = document.createElement('div');
    badge.className = 'badge-bono-enviado';
    badge.textContent = '✅ MENSAJE ENVIADO';
    td.insertBefore(badge, td.firstChild);
  }
}

/* ── COPIAR IMAGEN BONO ── */
async function copiarImagenBono(btn) {
  try {
    const resp = await fetch('img/BONO.png');
    const blob = await resp.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    const orig = btn.textContent;
    btn.textContent = '✅ Copiada';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch(e) {
    alert('No se pudo copiar la imagen. Haz clic derecho → Copiar imagen.');
  }
}

/* ── RENDERIZAR TABLA ── */
function renderTabla() {
  const s = calcularStats();

  let filas;
  if      (filtroActual === 'entregadas') filas = s.entregadas;
  else if (filtroActual === 'pendientes') filas = s.pendientes;
  else if (filtroActual === 'devueltas')  filas = s.devueltas;
  else                                    filas = [...remisiones];

  // Filtro "Sin WA Bono"
  if (filtroSinWA) {
    filas = filas.filter(r => !bonosEnviados.has(r.id_remision));
  }

  // Filtro de fechas
  if (fechaDesde) filas = filas.filter(r => r.fecha_creacion && r.fecha_creacion.slice(0, 10) >= fechaDesde);
  if (fechaHasta) filas = filas.filter(r => r.fecha_creacion && r.fecha_creacion.slice(0, 10) <= fechaHasta);

  // Orden: más antiguo primero
  filas.sort((a, b) => {
    const fa = a.fecha_creacion || '';
    const fb = b.fecha_creacion || '';
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });

  const countEl = document.getElementById('filtro-count');
  if (countEl) countEl.textContent = `${filas.length} registros`;

  const tbody = document.getElementById('tabla-cuerpo');

  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:rgba(255,255,255,0.3);padding:2rem;">
      ${remisiones.length === 0 ? '📁 Sube el reporte de Effi para ver los datos.' : 'Sin registros para este filtro.'}
    </td></tr>`;
    return;
  }

  const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO');

  tbody.innerHTML = filas.map((r, i) => {
    const esEnt = r.estado?.toLowerCase().includes('entregad');
    const esDev = r.es_devolucion;

    const badgeClass = esDev ? 'badge-devuelta'  : esEnt ? 'badge-entregada' : 'badge-pendiente';
    const badgeText  = esDev ? '↩ Devuelta'      : esEnt ? '✓ Entregada'    : '⏳ ' + (r.estado || 'Pendiente');

    const comisionVal = esDev ? -DEVOLUCION_COSTO : (r.comision || 0);
    const comisionTxt = esDev ? `-$${DEVOLUCION_COSTO.toLocaleString('es-CO')}` : fmt(r.comision || 0);
    const comisionCls = comisionVal < 0 ? 'val-negativo' : comisionVal > 0 ? 'val-positivo' : '';

    const telLimpio = limpiarTel(r.telefono);
    const bonoEnv   = bonosEnviados.has(r.id_remision);

    return `<tr>
      <td class="td-num">${i + 1}</td>
      <td class="td-fecha">${formatFecha(r.fecha_creacion)}</td>
      <td>
        <div class="td-cliente">${r.cliente || '—'}</div>
        <div class="td-tel">${r.telefono || ''}</div>
      </td>
      <td><span class="badge-estado-bill ${badgeClass}">${badgeText}</span></td>
      <td class="val-num">${fmt(r.total_neto || 0)}</td>
      <td class="val-num">${fmt(r.costo_manual || 0)}</td>
      <td class="val-num">${fmt(r.valor_flete || 0)}</td>
      <td class="val-num ${comisionCls}"><strong>${comisionTxt}</strong></td>
      <td class="td-wa-bono">
        ${bonoEnv ? '<div class="badge-bono-enviado">✅ MENSAJE ENVIADO</div>' : ''}
        <div class="bono-accion-grupo">
          <span class="label-enviar-bono">Enviar Bono</span>
          <button class="btn-accion-bono" data-bono-id="${r.id_remision}"
            onclick="abrirBonoWA('${r.id_remision.replace(/'/g,"\\'")}','${telLimpio}','${(r.cliente||'').replace(/'/g,"\\'")}')">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>
      </td>
      <td class="td-img-bono">
        <img src="img/BONO.png" class="img-bono-thumb" alt="Bono">
        <button class="btn-copiar-bono" onclick="copiarImagenBono(this)">📋 Copiar</button>
      </td>
    </tr>`;
  }).join('');
}
