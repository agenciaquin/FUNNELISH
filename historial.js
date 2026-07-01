/* ================================================================
   ConfirmaYa — Módulo Historial y Comparación
   historial.js
   ================================================================ */

const SUPABASE_URL = 'https://glmnuqfnxwaibckufgtr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TW1nS4T1g8vcZJ-mJeg0EA_8G1HZlKe';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── ESTADO ──────────────────────────────────────────────────────
let historialTab   = 'funnelish';
let clientesData   = [];
let clientesFiltro = [];
let selectedIds    = new Set();
let mensajeWA      = 'Hola {Nombre}, los Buzos se están agotando, aún tengo apartado el tuyo. Necesitamos tu confirmación para enviarlo.';
let filtroEstado     = '';
let estadoIdxGlobal  = 0;

// ── UTILS ────────────────────────────────────────────────────────
function toast(msg, color) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = color || 'rgba(255,255,255,0.1)';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function spinner(show, txt) {
  document.getElementById('spinner').classList.toggle('open', show);
  if (txt) document.getElementById('spinner-text').textContent = txt;
}

function normTel(tel) {
  return String(tel || '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
}

function getField(row, aliases) {
  const rowLow = {};
  Object.keys(row).forEach(k => { rowLow[k.toLowerCase().trim()] = row[k]; });
  for (const a of aliases) {
    const v = String(rowLow[a] ?? '').trim();
    if (rowLow[a] !== undefined && v !== '') return v;
  }
  return '';
}

function diasDesde(fecha) {
  const d = new Date(fecha);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function readExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }));
      } catch(err) { reject(err); }
    };
    reader.readAsBinaryString(file);
  });
}

// ── SUBIR FUNNELISH ──────────────────────────────────────────────
// También se llama desde app.js (index.html) al subir el Excel de confirmación
async function subirFunnelish(fileOrData, filename) {
  const esArchivo = fileOrData instanceof File;
  spinner(true, esArchivo ? 'Leyendo archivo Funnelish...' : 'Guardando en historial...');
  try {
    const data  = esArchivo ? await readExcel(fileOrData) : fileOrData;
    const fname = esArchivo ? fileOrData.name : (filename || 'archivo.csv');
    const now   = new Date();

    spinner(true, `Procesando ${data.length} registros...`);

    const { data: archivo, error: e1 } = await db
      .from('archivos_funnelish')
      .insert({ nombre: fname, anio: now.getFullYear(), mes: now.getMonth()+1, total_registros: data.length })
      .select().single();

    if (e1) throw e1;

    const registros = data.map(row => ({
      archivo_id:   archivo.id,
      telefono:     normTel(getField(row, ['phone','telefono','teléfono','celular','mobile'])),
      nombre:       getField(row, ['name','nombre','shipping name','first name','customer name']),
      ciudad:       getField(row, ['city','ciudad','shipping city']),
      departamento: getField(row, ['province','departamento','state','shipping province']),
      direccion:    getField(row, ['address','dirección','direccion','shipping address','address1']),
      producto:     getField(row, ['lineitem name','product','producto','nombre del producto']),
      talla:        getField(row, ['size','talla','lineitem variant','variant']),
      valor:        getField(row, ['total','valor','price','grand total','subtotal']),
      correo:       getField(row, ['email','correo','payer email','optin email']),
      fecha_pedido: getField(row, ['created at','fecha','date','time','order date']),
    })).filter(r => r.telefono.length >= 7);

    // 1. Deduplicar dentro del mismo archivo por (telefono + fecha_pedido)
    const deduped = [...new Map(
      registros.map(r => [`${r.telefono}|${r.fecha_pedido}`, r])
    ).values()];

    // 2. Verificar cuáles ya existen en la BD para no duplicar entre subidas
    const tels = [...new Set(deduped.map(r => r.telefono))];
    const { data: existentes } = await db
      .from('clientes_funnelish')
      .select('telefono, fecha_pedido')
      .in('telefono', tels);

    const existSet = new Set((existentes || []).map(e => `${e.telefono}|${e.fecha_pedido}`));
    const nuevos   = deduped.filter(r => !existSet.has(`${r.telefono}|${r.fecha_pedido}`));

    spinner(true, `Guardando ${nuevos.length} clientes nuevos (${deduped.length - nuevos.length} ya existían)...`);

    for (let i = 0; i < nuevos.length; i += 500) {
      await db.from('clientes_funnelish').insert(nuevos.slice(i, i + 500));
    }

    toast(`✅ Funnelish: ${nuevos.length} nuevos guardados (${deduped.length - nuevos.length} duplicados ignorados)`, 'rgba(34,197,94,0.4)');
    await cargarHistorial();
    await cargarStats();
  } catch(err) {
    console.error(err);
    toast('❌ Error al subir Funnelish: ' + (err.message || err), 'rgba(239,68,68,0.4)');
  } finally {
    spinner(false);
  }
}

// ── SUBIR EFFI + COMPARACIÓN AUTOMÁTICA ──────────────────────────
async function subirEffi(file) {
  spinner(true, 'Leyendo reporte Effi...');
  try {
    const data = await readExcel(file);
    const now  = new Date();
    spinner(true, `Guardando ${data.length} confirmados...`);

    const { data: archivo, error: e1 } = await db
      .from('archivos_effi')
      .insert({ nombre: file.name, anio: now.getFullYear(), mes: now.getMonth()+1, total_registros: data.length })
      .select().single();

    if (e1) throw e1;

    const telefonos = data.map(row => ({
      archivo_id: archivo.id,
      telefono:   normTel(getField(row, ['phone','telefono','teléfono','celular','mobile','whatsapp'])),
      nombre:     getField(row, ['name','nombre','cliente','customer']),
    })).filter(r => r.telefono.length >= 7);

    for (let i = 0; i < telefonos.length; i += 500) {
      await db.from('telefonos_effi').insert(telefonos.slice(i, i + 500));
    }

    spinner(true, 'Ejecutando comparación automática...');
    await ejecutarComparacion();

    toast(`✅ Effi cargado: ${telefonos.length} confirmados. Comparación ejecutada.`, 'rgba(34,197,94,0.4)');
    await cargarHistorial();
    await cargarStats();
    await cargarClientes();
  } catch(err) {
    console.error(err);
    toast('❌ Error al subir Effi: ' + (err.message || err), 'rgba(239,68,68,0.4)');
  } finally {
    spinner(false);
  }
}

// ── COMPARACIÓN ──────────────────────────────────────────────────
async function ejecutarComparacion() {
  const hace30 = new Date(Date.now() - 30*24*60*60*1000).toISOString();

  // Todos los clientes Funnelish últimos 30 días
  const { data: fClientes } = await db
    .from('clientes_funnelish')
    .select('telefono,nombre,ciudad,departamento,direccion,producto,talla,valor,correo,fecha_pedido')
    .gte('fecha_carga', hace30);

  // Todos los teléfonos Effi últimos 30 días
  const { data: eTels } = await db
    .from('telefonos_effi')
    .select('telefono')
    .gte('fecha_carga', hace30);

  const effiSet = new Set((eTels || []).map(e => e.telefono));

  // Clientes en Funnelish pero NO en Effi
  const pendientes = (fClientes || []).filter(c => !effiSet.has(c.telefono));

  // Deduplicar por teléfono (quedarse con el más reciente)
  const unique = [...new Map(pendientes.map(c => [c.telefono, c])).values()];

  // Insertar solo los nuevos (ignorar duplicados)
  for (const c of unique) {
    await db.from('clientes_por_confirmar')
      .upsert({
        telefono:    c.telefono,
        nombre:      c.nombre,
        ciudad:      c.ciudad,
        departamento:c.departamento,
        direccion:   c.direccion,
        producto:    c.producto,
        talla:       c.talla,
        valor:       c.valor,
        correo:      c.correo,
        fecha_pedido:c.fecha_pedido,
      }, { onConflict: 'telefono', ignoreDuplicates: true });
  }

  // Marcar alertas: clientes en "por confirmar" que ahora están en Effi
  const { data: porConfirmar } = await db
    .from('clientes_por_confirmar')
    .select('id,telefono')
    .eq('alerta_effi', false);

  const conAlerta = (porConfirmar || []).filter(c => effiSet.has(c.telefono));
  if (conAlerta.length > 0) {
    const ids = conAlerta.map(c => c.id);
    await db.from('clientes_por_confirmar')
      .update({ alerta_effi: true, fecha_alerta_effi: new Date().toISOString() })
      .in('id', ids);
  }
}

// ── CARGAR HISTORIAL ─────────────────────────────────────────────
async function cargarHistorial() {
  const tabla = historialTab === 'funnelish' ? 'archivos_funnelish' : 'archivos_effi';
  const { data } = await db.from(tabla).select('*').order('fecha_carga', { ascending: false });

  const body = document.getElementById('historial-body');
  if (!data || data.length === 0) {
    body.innerHTML = '<div class="historial-empty">No hay archivos cargados aún</div>';
    return;
  }

  // Agrupar por año → mes
  const grupos = {};
  for (const a of data) {
    if (!grupos[a.anio]) grupos[a.anio] = {};
    if (!grupos[a.anio][a.mes]) grupos[a.anio][a.mes] = [];
    grupos[a.anio][a.mes].push(a);
  }

  const tipo = historialTab === 'funnelish' ? 'funne' : 'effi';
  let html = '';
  for (const anio of Object.keys(grupos).sort((a,b) => b-a)) {
    html += `<div class="anio-grupo">
      <div class="anio-label">📅 ${anio}</div>`;
    for (const mes of Object.keys(grupos[anio]).sort((a,b) => b-a)) {
      const archivos = grupos[anio][mes];
      html += `<div class="mes-grupo">
        <div class="mes-label">
          <span>${MESES[parseInt(mes)]} (${archivos.length})</span>
          <span class="mes-count">${archivos.reduce((s,a)=>s+a.total_registros,0)} reg.</span>
        </div>`;
      for (const a of archivos) {
        html += `<div class="archivo-item">
          <div class="archivo-dot ${tipo}"></div>
          <span class="archivo-nombre" title="${a.nombre}">${a.nombre}</span>
          <span class="archivo-total">${a.total_registros}</span>
        </div>`;
      }
      html += '</div>';
    }
    html += '</div>';
  }
  body.innerHTML = html;
}

// ── CARGAR ESTADÍSTICAS ──────────────────────────────────────────
async function cargarStats() {
  const hace30 = new Date(Date.now() - 30*24*60*60*1000).toISOString();

  const [
    { count: cF },
    { count: cE },
    { count: cP },
    { count: cEnv },
    { count: cAlerta },
  ] = await Promise.all([
    db.from('clientes_funnelish').select('*', { count:'exact', head:true }).gte('fecha_carga', hace30),
    db.from('telefonos_effi').select('*', { count:'exact', head:true }).gte('fecha_carga', hace30),
    db.from('clientes_por_confirmar').select('*', { count:'exact', head:true }),
    db.from('clientes_por_confirmar').select('*', { count:'exact', head:true }).eq('estado','mensaje_enviado'),
    db.from('clientes_por_confirmar').select('*', { count:'exact', head:true }).eq('alerta_effi', true),
  ]);

  // Recuperación = alertas / total por confirmar
  const recup = cP > 0 ? Math.round(((cAlerta||0) / cP) * 100) : 0;

  document.getElementById('stat-funnelish').textContent   = (cF    || 0).toLocaleString();
  document.getElementById('stat-effi').textContent        = (cE    || 0).toLocaleString();
  document.getElementById('stat-pendientes').textContent  = (cP    || 0).toLocaleString();
  document.getElementById('stat-enviados').textContent    = (cEnv  || 0).toLocaleString();
  document.getElementById('stat-alertas').textContent     = (cAlerta||0).toLocaleString();
  document.getElementById('stat-recuperacion').textContent = recup + '%';
}

// ── LIMPIAR FILTROS ──────────────────────────────────────────────
function limpiarFiltros() {
  document.getElementById('buscar-clientes').value = '';
  filtroEstado = '';
  document.getElementById('btn-filtro-estado').textContent = 'Todos';
  estadoIdxGlobal = 0;
  filtrarYRenderClientes();
}

// ── CARGAR CLIENTES POR CONFIRMAR ────────────────────────────────
async function cargarClientes() {
  const { data } = await db
    .from('clientes_por_confirmar')
    .select('*')
    .order('fecha_primer_registro', { ascending: false });

  clientesData = data || [];
  filtrarYRenderClientes();
  document.getElementById('badge-clientes').textContent = clientesData.length;
}

function filtrarYRenderClientes() {
  const busq = (document.getElementById('buscar-clientes').value || '').toLowerCase();

  clientesFiltro = clientesData.filter(c => {
    const matchBusq = !busq ||
      (c.nombre || '').toLowerCase().includes(busq) ||
      (c.telefono || '').includes(busq) ||
      (c.producto || '').toLowerCase().includes(busq);

    const matchEstado = !filtroEstado || c.estado === filtroEstado;
    return matchBusq && matchEstado;
  });

  renderTablaClientes();
}

function renderTablaClientes() {
  const tbody = document.getElementById('tabla-clientes');
  if (clientesFiltro.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="clientes-empty">No hay clientes que coincidan con el filtro</td></tr>';
    return;
  }

  tbody.innerHTML = clientesFiltro.map((c, i) => {
    const dias  = diasDesde(c.fecha_primer_registro);
    const clsDias = dias <= 7 ? 'dias-ok' : dias <= 15 ? 'dias-warn' : 'dias-crit';
    const sel   = selectedIds.has(c.id);

    let estadoHtml;
    if (c.alerta_effi) {
      estadoHtml = '<span class="badge-estado-h est-alerta">⚠ Revisar</span>';
    } else if (c.estado === 'mensaje_enviado') {
      estadoHtml = '<span class="badge-estado-h est-enviado">✓ Mensaje enviado</span>';
    } else {
      estadoHtml = '<span class="badge-estado-h est-pendiente">⏳ Pendiente</span>';
    }

    const alertaHtml = c.alerta_effi
      ? '<span class="alerta-badge">⚠ En Effi</span>'
      : '—';

    return `<tr class="${sel ? 'selected' : ''}" data-id="${c.id}">
      <td class="ct-check"><input type="checkbox" class="chk-row" data-id="${c.id}" ${sel ? 'checked' : ''}></td>
      <td class="ct-num">${i+1}</td>
      <td>
        <div class="ct-nombre">${c.nombre || '—'}</div>
        <div style="font-size:0.68rem;color:var(--text-2)">${c.ciudad || ''} ${c.departamento ? '· '+c.departamento : ''}</div>
      </td>
      <td class="ct-tel">${c.telefono}</td>
      <td class="ct-producto" title="${c.producto}">${c.producto || '—'}</td>
      <td class="ct-dias"><span class="${clsDias}">${dias} días</span></td>
      <td>${estadoHtml}</td>
      <td>${alertaHtml}</td>
      <td class="ct-actions">
        <button class="btn-wa-row btn-wa" data-id="${c.id}" title="Enviar WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </button>
      </td>
    </tr>`;
  }).join('');

  // Bind checkboxes
  tbody.querySelectorAll('.chk-row').forEach(chk => {
    chk.addEventListener('change', e => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      e.target.closest('tr').classList.toggle('selected', e.target.checked);
    });
  });

  // Bind WA buttons
  tbody.querySelectorAll('.btn-wa').forEach(btn => {
    btn.addEventListener('click', () => enviarWhatsApp(btn.dataset.id));
  });
}

// ── WHATSAPP ─────────────────────────────────────────────────────
async function enviarWhatsApp(id) {
  const cliente = clientesData.find(c => c.id === id);
  if (!cliente) return;

  const msg = mensajeWA.replace('{Nombre}', cliente.nombre || 'cliente');
  const url = `whatsapp://send?phone=57${cliente.telefono}&text=${encodeURIComponent(msg)}`;
  window.open(url, '_self');

  // Marcar como enviado
  await db.from('clientes_por_confirmar')
    .update({
      estado: 'mensaje_enviado',
      fecha_ultimo_mensaje: new Date().toISOString(),
      mensajes_enviados: (cliente.mensajes_enviados || 0) + 1
    })
    .eq('id', id);

  // Actualizar local
  const idx = clientesData.findIndex(c => c.id === id);
  if (idx !== -1) { clientesData[idx].estado = 'mensaje_enviado'; clientesData[idx].mensajes_enviados = (clientesData[idx].mensajes_enviados||0)+1; }

  filtrarYRenderClientes();
  await cargarStats();
  toast('✅ Mensaje enviado — estado actualizado', 'rgba(34,197,94,0.4)');
}

// ── MODO CAMPAÑA ─────────────────────────────────────────────────
async function iniciarCampana() {
  const seleccionados = clientesData.filter(c => selectedIds.has(c.id));
  if (seleccionados.length === 0) {
    toast('⚠ Selecciona al menos un cliente', 'rgba(234,179,8,0.4)');
    return;
  }

  const bar  = document.getElementById('campana-bar');
  const txt  = document.getElementById('campana-text');
  const prog = document.getElementById('campana-progress');
  const btnI = document.getElementById('btn-iniciar-campana');

  prog.style.display = 'block';
  btnI.disabled = true;

  for (let i = 0; i < seleccionados.length; i++) {
    const c   = seleccionados[i];
    const msg = mensajeWA.replace('{Nombre}', c.nombre || 'cliente');
    const url = `whatsapp://send?phone=57${c.telefono}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_self');

    // Marcar enviado
    await db.from('clientes_por_confirmar')
      .update({ estado: 'mensaje_enviado', fecha_ultimo_mensaje: new Date().toISOString() })
      .eq('id', c.id);

    const pct = Math.round(((i+1) / seleccionados.length) * 100);
    bar.style.width = pct + '%';
    txt.textContent = `Enviando ${i+1} de ${seleccionados.length}...`;

    // Pausa de 2s entre chats
    if (i < seleccionados.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  txt.textContent = `✅ Campaña completada — ${seleccionados.length} mensajes`;
  btnI.disabled = false;
  selectedIds.clear();
  await cargarClientes();
  await cargarStats();
  toast(`📢 Campaña completada: ${seleccionados.length} mensajes enviados`, 'rgba(34,197,94,0.4)');
}

// ── CARGAR MENSAJE CONFIG ────────────────────────────────────────
async function cargarMensajeConfig() {
  const { data } = await db.from('config').select('valor').eq('clave','mensaje_whatsapp').single();
  if (data) mensajeWA = data.valor;
  document.getElementById('textarea-mensaje').value = mensajeWA;
}

async function guardarMensajeConfig() {
  const nuevo = document.getElementById('textarea-mensaje').value.trim();
  if (!nuevo) { toast('⚠ El mensaje no puede estar vacío', 'rgba(234,179,8,0.4)'); return; }
  await db.from('config').upsert({ clave:'mensaje_whatsapp', valor: nuevo });
  mensajeWA = nuevo;
  cerrarModal('modal-config');
  toast('✅ Mensaje guardado', 'rgba(34,197,94,0.4)');
}

// ── MODALES ──────────────────────────────────────────────────────
function abrirModal(id)  { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

// ── INIT ─────────────────────────────────────────────────────────
async function init() {
  await Promise.all([
    cargarHistorial(),
    cargarStats(),
    cargarClientes(),
    cargarMensajeConfig(),
  ]);

  // Tabs historial
  document.querySelectorAll('.htab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.htab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      historialTab = tab.dataset.tab;
      cargarHistorial();
    });
  });

  // Upload Effi
  document.getElementById('btn-subir-effi').addEventListener('click', () =>
    document.getElementById('input-effi').click());
  document.getElementById('input-effi').addEventListener('change', e => {
    if (e.target.files[0]) { subirEffi(e.target.files[0]); e.target.value=''; }
  });

  // Búsqueda
  document.getElementById('buscar-clientes').addEventListener('input', filtrarYRenderClientes);

  // Checkbox all
  document.getElementById('chk-all').addEventListener('change', e => {
    if (e.target.checked) {
      clientesFiltro.forEach(c => selectedIds.add(c.id));
    } else {
      selectedIds.clear();
    }
    renderTablaClientes();
  });

  // Filtro estado
  const estadosOpts = ['', 'pendiente', 'mensaje_enviado'];
  const labelsOpts  = ['Todos', 'Pendiente', 'Msg enviado'];
  document.getElementById('btn-filtro-estado').addEventListener('click', () => {
    estadoIdxGlobal = (estadoIdxGlobal + 1) % estadosOpts.length;
    filtroEstado = estadosOpts[estadoIdxGlobal];
    document.getElementById('btn-filtro-estado').textContent = labelsOpts[estadoIdxGlobal];
    filtrarYRenderClientes();
  });

  // Limpiar filtros
  document.getElementById('btn-limpiar-filtros').addEventListener('click', limpiarFiltros);

  // Config mensaje
  document.getElementById('btn-config-msg').addEventListener('click', () => {
    document.getElementById('textarea-mensaje').value = mensajeWA;
    abrirModal('modal-config');
  });
  document.getElementById('cerrar-config').addEventListener('click',   () => cerrarModal('modal-config'));
  document.getElementById('cancelar-config').addEventListener('click', () => cerrarModal('modal-config'));
  document.getElementById('guardar-config').addEventListener('click',  guardarMensajeConfig);

  // Modo campaña
  document.getElementById('btn-modo-campana').addEventListener('click', () => {
    const sel = clientesData.filter(c => selectedIds.has(c.id));
    document.getElementById('campana-info').textContent =
      sel.length > 0
        ? `${sel.length} cliente(s) seleccionados. Se abrirán los chats de WhatsApp uno a uno con el mensaje preparado.`
        : 'Selecciona clientes en la tabla primero, luego presiona "Iniciar campaña".';
    document.getElementById('campana-progress').style.display = 'none';
    document.getElementById('campana-bar').style.width = '0%';
    abrirModal('modal-campana');
  });
  document.getElementById('cerrar-campana').addEventListener('click', () => cerrarModal('modal-campana'));
  document.getElementById('btn-iniciar-campana').addEventListener('click', iniciarCampana);

  // Cerrar modales al hacer clic en overlay
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  });
}

document.addEventListener('DOMContentLoaded', init);
