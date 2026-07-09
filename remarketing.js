/* ================================================================
   Remarketing KLIXMANT — remarketing.js
   Gestión post-entrega según estado de guía · Agencia QUIN
   ================================================================ */

// Misma clave que billetera.js — datos compartidos del reporte Effi
const LS_KEY_REM      = 'billetera_remisiones';
// Clave propia de remarketing — rastrea mensajes enviados
const LS_KEY_REM_ENV  = 'remarketing_enviados';

const SUPABASE_URL_R  = 'https://glmnuqfnxwaibckufgtr.supabase.co';
const SUPABASE_KEY_R  = 'sb_publishable_TW1nS4T1g8vcZJ-mJeg0EA_8G1HZlKe';

const MSG_DEVOLUCION = 'Hola, esperamos que estés muy bien. 😊\nLa transportadora nos informó que tu pedido fue devuelto y nos está cobrando el costo del envío de ida y regreso.\n¿Nos podrías colaborar, por favor, con el pago de los $22.000 correspondientes al transporte? 🙏 Este es un cobro que la transportadora nos realiza directamente.\nTe compartimos el número de cuenta para la transferencia. ¡Muchas gracias por tu apoyo y comprensión!';

const MSG_ENTREGADA  = 'Esto es para ti: 20.000 de descuento en tu próxima compra Klixmant. Gracias por ser parte de nuestra familia. Escríbenos ahora y asegura tu bono.\nVARIEDAD DE MODELOS Y COLORES DISPONIBLES';

let dbR           = null;
let remisiones    = [];
let filtroActual  = 'todos';
let filtroSinGest = false;
let fechaDesde    = '';
let fechaHasta    = '';
let remEnviados   = new Set(); // ids donde ya se envió mensaje de remarketing

/* ── INIT ── */
window.addEventListener('DOMContentLoaded', async () => {
  // Inicializar Supabase
  for (let i = 0; i < 5; i++) {
    if (window.supabase?.createClient) {
      dbR = window.supabase.createClient(SUPABASE_URL_R, SUPABASE_KEY_R);
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Cargar mensajes enviados de remarketing
  try {
    const e = JSON.parse(localStorage.getItem(LS_KEY_REM_ENV) || '[]');
    remEnviados = new Set(e);
  } catch(e) {}

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
      const f = btn.dataset.filtro;
      if (f === 'sin-gest') {
        filtroSinGest = !filtroSinGest;
        btn.classList.toggle('active', filtroSinGest);
        // Si se activa sin-gest, quitar filtro de categoría activo visualmente
        // pero mantener lógica — sin-gest es independiente
        renderTabla();
        return;
      }
      filtroActual = f;
      document.querySelectorAll('.btn-filtro[data-filtro]:not([data-filtro="sin-gest"])').forEach(b => {
        b.classList.remove('active', 'todos', 'entregadas', 'pendientes', 'devueltas');
      });
      btn.classList.add('active', f);
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

/* ── CARGA DE DATOS ── */
async function cargarDatos() {
  // 1. localStorage PRIMERO — instantáneo, siempre disponible
  try {
    const local = localStorage.getItem(LS_KEY_REM);
    if (local) {
      remisiones = JSON.parse(local);
      actualizarUI();
    }
  } catch(e) { console.warn('localStorage parse error:', e); }

  // 2. Supabase en segundo plano — solo AGREGA/ACTUALIZA
  if (!dbR) return;
  try {
    const { data, error } = await dbR
      .from('remisiones_effi')
      .select('*')
      .order('fecha_creacion', { ascending: true });

    if (!error && data && data.length > 0) {
      const mapa = new Map(remisiones.map(r => [r.id_remision, r]));
      data.forEach(r => mapa.set(r.id_remision, r));
      remisiones = [...mapa.values()];
      guardarLocalStorage();
      actualizarUI();
    }
  } catch(err) {
    console.warn('Supabase merge error:', err);
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

      // Merge
      const mapaExistente = new Map(remisiones.map(r => [r.id_remision, r]));
      const soloNuevas = nuevas.filter(r => !mapaExistente.has(r.id_remision));
      nuevas.forEach(r => mapaExistente.set(r.id_remision, r));
      remisiones = [...mapaExistente.values()];

      // 1. localStorage PRIMERO
      guardarLocalStorage();
      actualizarUI();
      alert(`✅ Reporte actualizado:\n• ${soloNuevas.length} nuevas remisiones agregadas\n• ${nuevas.length - soloNuevas.length} actualizadas\n• Total acumulado: ${remisiones.length} registros`);

      // 2. Supabase en background
      if (dbR) {
        for (let i = 0; i < nuevas.length; i += 500) {
          const { error } = await dbR
            .from('remisiones_effi')
            .upsert(nuevas.slice(i, i + 500), { onConflict: 'id_remision' });
          if (error) console.warn('Error Supabase (no crítico):', error.message);
        }
      }
    } catch(err) {
      console.error(err);
      alert('No se pudo leer el archivo. Asegúrate de que sea el reporte de Effi (.xls).');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

/* ── PARSER HTML-XLS (mismo que billetera.js) ── */
function parsearHTMLXLS(htmlText) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(htmlText, 'text/html');
  const rows   = [...doc.querySelectorAll('tr')];
  if (!rows.length) return [];

  const headers = [...rows[0].querySelectorAll('th, td')].map(c => c.textContent.trim());

  const findCol = (...keywords) => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().replace(/[^\w]/g, ' ').trim();
      if (keywords.every(k => h.includes(k))) return i;
    }
    return -1;
  };

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

/* ── CLASIFICACIÓN DE ESTADOS ── */
function clasificar() {
  const entregadas = remisiones.filter(r =>
    r.estado?.toLowerCase().includes('entregad') && !r.es_devolucion
  );
  const devueltas  = remisiones.filter(r => r.es_devolucion);
  const pendientes = remisiones.filter(r =>
    !r.estado?.toLowerCase().includes('entregad') && !r.es_devolucion
  );
  // Sin gestionar = entregadas + devueltas donde no se envió mensaje
  const sinGestionar = [...entregadas, ...devueltas].filter(r => !remEnviados.has(r.id_remision));
  return { entregadas, devueltas, pendientes, sinGestionar };
}

/* ── ACTUALIZAR UI ── */
function actualizarUI() {
  const s = clasificar();
  document.getElementById('stat-entregadas').textContent   = s.entregadas.length;
  document.getElementById('stat-entregadas-n').textContent = `${s.entregadas.length} guías`;
  document.getElementById('stat-pendientes').textContent   = s.pendientes.length;
  document.getElementById('stat-pendientes-n').textContent = `${s.pendientes.length} guías`;
  document.getElementById('stat-devueltas').textContent    = s.devueltas.length;
  document.getElementById('stat-devueltas-n').textContent  = `${s.devueltas.length} guías`;
  document.getElementById('stat-sin-gest').textContent     = s.sinGestionar.length;
  document.getElementById('stat-sin-gest-n').textContent   = 'por contactar';
  actualizarDistribucion(s);
  renderTabla();
}

/* ── BARRA DE DISTRIBUCIÓN PORCENTUAL ── */
function actualizarDistribucion(s) {
  const total = s.entregadas.length + s.pendientes.length + s.devueltas.length;
  if (total === 0) return;

  const pEnt = (s.entregadas.length / total * 100);
  const pPen = (s.pendientes.length / total * 100);
  const pDev = (s.devueltas.length  / total * 100);

  // Ajuste para que sumen exactamente 100 (error de redondeo)
  const pEntR = Math.round(pEnt * 10) / 10;
  const pPenR = Math.round(pPen * 10) / 10;
  const pDevR = Math.round((100 - pEntR - pPenR) * 10) / 10;

  document.getElementById('dist-total').textContent    = `${total} guías totales`;
  document.getElementById('dist-seg-ent').style.width  = `${pEntR}%`;
  document.getElementById('dist-seg-pen').style.width  = `${pPenR}%`;
  document.getElementById('dist-seg-dev').style.width  = `${pDevR}%`;
  document.getElementById('dist-pct-ent').textContent  = `${pEntR}%`;
  document.getElementById('dist-pct-pen').textContent  = `${pPenR}%`;
  document.getElementById('dist-pct-dev').textContent  = `${pDevR}%`;
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

/* ── ENVIAR MENSAJE REMARKETING ── */
function abrirRemarketingWA(idRem, tel, tipoMsg) {
  const telLimpio = limpiarTel(tel);
  const msg = tipoMsg === 'devolucion' ? MSG_DEVOLUCION : MSG_ENTREGADA;

  window.open(`whatsapp://send?phone=57${telLimpio}&text=${encodeURIComponent(msg)}`, '_self');

  remEnviados.add(idRem);
  try { localStorage.setItem(LS_KEY_REM_ENV, JSON.stringify([...remEnviados])); } catch(e) {}

  // Actualizar DOM sin re-render completo
  const cellTarget = document.querySelector(`[data-rem-id="${idRem}"]`)?.closest('td');
  if (cellTarget && !cellTarget.querySelector('.badge-rem-enviado')) {
    const badge = document.createElement('span');
    badge.className = 'badge-rem-enviado';
    badge.textContent = '✅ MENSAJE ENVIADO';
    cellTarget.insertBefore(badge, cellTarget.firstChild);
  }

  // Actualizar stats (sin-gestionar baja en 1)
  actualizarUI();
}

/* ── WA ICON SVG ── */
const WA_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

/* ── RENDERIZAR TABLA ── */
function renderTabla() {
  const s = clasificar();

  let filas;
  if (filtroSinGest) {
    // Sin gestionar ignora el filtro de categoría
    filas = s.sinGestionar;
  } else if (filtroActual === 'entregadas') {
    filas = s.entregadas;
  } else if (filtroActual === 'pendientes') {
    filas = s.pendientes;
  } else if (filtroActual === 'devueltas') {
    filas = s.devueltas;
  } else {
    filas = [...remisiones];
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);padding:2rem;">
      ${remisiones.length === 0 ? '📁 Sube el reporte de Effi para ver los datos.' : 'Sin registros para este filtro.'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map((r, i) => {
    const esEnt = r.estado?.toLowerCase().includes('entregad') && !r.es_devolucion;
    const esDev = r.es_devolucion;
    const esPen = !esEnt && !esDev;

    // Badge estado
    const badgeClass = esDev ? 'badge-dev' : esEnt ? 'badge-ent' : 'badge-pen';
    const badgeText  = esDev ? '↩ Devuelta' : esEnt ? '✓ Entregada' : '⏳ Pendiente';

    const telLimpio = limpiarTel(r.telefono);
    const enviado   = remEnviados.has(r.id_remision);
    const idEsc     = r.id_remision.replace(/'/g, "\\'");

    // Celda WA
    let celdaWA;
    if (esPen) {
      // Sin mensaje para pendientes
      celdaWA = `<span style="font-size:0.65rem;color:rgba(255,255,255,0.25);font-style:italic;">Sin mensaje</span>`;
    } else {
      const tipoMsg = esDev ? 'devolucion' : 'entregada';
      const labelCls  = esDev ? 'label-dev-wa' : 'label-ent-wa';
      const btnCls    = esDev ? 'btn-accion-dev' : 'btn-accion-ent';
      const labelTxt  = esDev ? '↩ Gestionar Dev.' : '✓ Enviar Bono';

      celdaWA = `
        ${enviado ? '<span class="badge-rem-enviado">✅ MENSAJE ENVIADO</span>' : ''}
        <div class="rem-accion-grupo">
          <span class="label-rem-wa ${labelCls}">${labelTxt}</span>
          <button class="btn-accion-rem ${btnCls}" data-rem-id="${r.id_remision}"
            onclick="abrirRemarketingWA('${idEsc}','${telLimpio}','${tipoMsg}')">
            ${WA_SVG}
          </button>
        </div>`;
    }

    return `<tr>
      <td class="td-num">${i + 1}</td>
      <td class="td-fecha">${formatFecha(r.fecha_creacion)}</td>
      <td>
        <div class="td-cli">${r.cliente || '—'}</div>
        <div class="td-tel">${r.telefono || ''}</div>
      </td>
      <td><span class="badge-estado-rem ${badgeClass}">${badgeText}</span></td>
      <td class="td-wa">${celdaWA}</td>
    </tr>`;
  }).join('');
}
