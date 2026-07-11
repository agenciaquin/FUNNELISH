/* ================================================================
   ConfirmaYa — KLIXMANT
   app.js — Lógica: Excel → Tabla → WhatsApp
   ================================================================ */

/* ── CONSTANTES ─────────────────────────────────────────────── */
const CORREO_POR_DEFECTO  = "Gerenciaquin7@gmail.com";
const VALOR_POR_DEFECTO   = "$130.000";
const GENERO_POR_DEFECTO  = "Hombre";
const INDICADORES_GENERO  = ["dama", "mujer", "femenino", "hombre", "caballero"];
const LS_KEY              = "confirmaYa_estados";

/* Mapeo de columnas — nombres reales del CSV de Funnelish */
const COL_MAP = {
  nombre:      ["first name", "nombre", "name", "nombre completo", "cliente"],
  apellido:    ["last name", "apellido", "surname"],
  telefono:    ["phone", "telefono", "teléfono", "celular", "móvil", "movil", "tel"],
  direccion:   ["shipping address", "dirección", "direccion", "address"],
  ciudad:      ["shipping city", "ciudad", "city", "municipio"],
  departamento:["shipping state", "departamento", "department", "depto"],
  correo:      ["payer email", "optin email", "correo", "email", "e-mail"],
  talla:       ["variant title", "talla", "size"],
  producto:    ["product name", "producto", "product", "nombre del producto", "referencia"],
  valor:       ["total", "valor", "valor a pagar", "precio", "price", "monto"],
  fecha:       ["time", "created at", "fecha", "fecha creación", "date", "order date"],
};

/* ── SUPABASE (Historial automático) ─────────────────────────── */
const SUPABASE_URL_H = 'https://glmnuqfnxwaibckufgtr.supabase.co';
const SUPABASE_KEY_H = 'sb_publishable_TW1nS4T1g8vcZJ-mJeg0EA_8G1HZlKe';
let dbH = null;
// Se inicializa después de que la librería Supabase cargue
window.addEventListener('DOMContentLoaded', () => {
  if (window.supabase && window.supabase.createClient) {
    dbH = window.supabase.createClient(SUPABASE_URL_H, SUPABASE_KEY_H);
  }
});

/* ── ESTADO GLOBAL ───────────────────────────────────────────── */
let pedidos        = [];
let estados        = {};
let modoSinWA          = false;   // solo muestra clientes sin mensaje enviado
let modoCanceladas     = false;   // muestra solo cancelados
let modoPendientesEffi = false;   // solo muestra clientes sin confirmar en Effi
let effiPhones         = new Set(); // teléfonos 10 dígitos que aparecen en Effi
let paginaActual       = 1;
const ITEMS_POR_PAG    = 30;
let seleccionados        = new Set(); // _keys seleccionados para acción masiva
let remarketingEnviados  = new Set(); // _keys con 1er mensaje de remarketing enviado
let remarketing2Enviados = new Set(); // _keys con 2do mensaje de remarketing enviado
const LS_KEY_REMARKETING  = "confirmaYa_remarketing";
const LS_KEY_REMARKETING2 = "confirmaYa_remarketing2";

/* ── INICIALIZACIÓN ──────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  estados = cargarEstados();
  window.estados = estados;
  remarketingEnviados  = cargarRemarketingLS();
  remarketing2Enviados = cargarRemarketingLS2();
  window.pedidos = pedidos;
  initUpload();
  initModal();
  initBuscar();
  initFiltros();
  cargarClientesDeSupabase();
  cargarEffiDeSupabase();
});

/* ================================================================
   CARGA DE EXCEL
   ================================================================ */
function initUpload() {
  const inputFile     = document.getElementById("input-excel");
  const btnActualizar = document.getElementById("btn-actualizar");
  const btnActualizarTop = document.getElementById("btn-actualizar-top");

  const abrirSelector = () => {
    inputFile.value = "";
    inputFile.click();
  };

  if (btnActualizar)    btnActualizar.addEventListener("click", abrirSelector);
  if (btnActualizarTop) btnActualizarTop.addEventListener("click", abrirSelector);

  inputFile.addEventListener("change", () => {
    if (inputFile.files[0]) procesarArchivo(inputFile.files[0]);
  });

  // Botón Subir Effi
  const inputEffi   = document.getElementById("input-effi");
  const btnSubirEff = document.getElementById("btn-subir-effi");
  if (btnSubirEff && inputEffi) {
    btnSubirEff.addEventListener("click", () => { inputEffi.value = ""; inputEffi.click(); });
    inputEffi.addEventListener("change", () => { if (inputEffi.files[0]) procesarArchivoEffi(inputEffi.files[0]); });
  }
}

/* ================================================================
   GUARDAR EN HISTORIAL (SUPABASE)
   Se llama silenciosamente al subir cada Excel de confirmación
   ================================================================ */
async function guardarFunnelishEnDB(pedidosArr, filename) {
  if (!dbH) return; // Supabase no disponible
  try {
    const now = new Date();
    const { data: archivo, error: e1 } = await dbH
      .from('archivos_funnelish')
      .insert({ nombre: filename, anio: now.getFullYear(), mes: now.getMonth()+1, total_registros: pedidosArr.length })
      .select().single();

    if (e1) { console.warn('Historial: no se creó el archivo:', e1.message); return; }

    const normTelH = (tel) => String(tel || '').replace(/\D/g,'').replace(/^57/,'').slice(-10);

    const registros = pedidosArr
      .filter(p => p.telefonoWhatsApp && p.telefonoWhatsApp.length >= 7)
      .map(p => ({
        archivo_id:   archivo.id,
        telefono:     normTelH(p.telefonoWhatsApp),
        nombre:       p.nombre === '—' ? '' : p.nombre,
        ciudad:       p.ciudad       || '',
        departamento: p.departamento || '',
        direccion:    p.direccion    || '',
        producto:     p.producto     || '',
        talla:        p.talla        || '',
        valor:        p.valor        || '',
        correo:       p.correo       || '',
        fecha_pedido: p.fechaObj ? p.fechaObj.toISOString().slice(0,10) : '',
      }));

    // Deduplicar dentro del batch por (telefono + fecha_pedido)
    const deduped = [...new Map(
      registros.map(r => [`${r.telefono}|${r.fecha_pedido}`, r])
    ).values()];

    // Verificar cuáles ya existen para no duplicar entre subidas del mismo archivo
    const tels = [...new Set(deduped.map(r => r.telefono))];
    const { data: exist } = await dbH
      .from('clientes_funnelish')
      .select('telefono, fecha_pedido')
      .in('telefono', tels);

    const existSet = new Set((exist || []).map(e => `${e.telefono}|${e.fecha_pedido}`));
    const nuevos   = deduped.filter(r => !existSet.has(`${r.telefono}|${r.fecha_pedido}`));

    for (let i = 0; i < nuevos.length; i += 500) {
      await dbH.from('clientes_funnelish').insert(nuevos.slice(i, i + 500));
    }
    console.log(`[ConfirmaYa] Historial: ${nuevos.length} nuevos, ${deduped.length - nuevos.length} duplicados ignorados`);
  } catch(err) {
    console.warn('[ConfirmaYa] Historial Supabase error:', err.message || err);
  }
}

function procesarArchivo(file) {
  const esCSV = file.name.toLowerCase().endsWith(".csv");
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      let wb;
      if (esCSV) {
        const texto = e.target.result;
        const primeraLinea = texto.split("\n")[0];
        const sep = (primeraLinea.split(";").length > primeraLinea.split(",").length) ? ";" : ",";
        wb = XLSX.read(texto, { type: "string", FS: sep });
      } else {
        const data = new Uint8Array(e.target.result);
        wb = XLSX.read(data, { type: "array" });
      }

      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rows.length) {
        alert("El archivo está vacío o no tiene datos.");
        return;
      }

      // Parsear con offset para que los ids no colisionen con los existentes
      const offset    = pedidos.length;
      const nuevosRaw = rows.map((row, i) => normalizarFila(row, offset + i));

      // Empalme: solo los que no existen por _key
      const existingKeys = new Set(pedidos.map(p => p._key));
      const nuevos       = nuevosRaw.filter(p => !existingKeys.has(p._key));

      if (!nuevos.length) {
        alert("Todos los clientes del Excel ya están en la lista. No hay datos nuevos.");
        return;
      }

      // Re-indexar con id correcto
      nuevos.forEach((p, i) => { p.id = offset + i; });

      // Merge y re-render
      pedidos = [...pedidos, ...nuevos];
      window.pedidos = pedidos;
      aplicarFiltros();

      // Guardar solo los nuevos en Supabase
      guardarFunnelishEnDB(nuevos, file.name).catch(() => {});

      console.log(`[ConfirmaYa] Empalme: ${nuevos.length} nuevos clientes agregados`);
    } catch (err) {
      console.error(err);
      alert("No se pudo leer el archivo. Asegúrate de que sea un archivo válido (.xlsx / .xls / .csv).");
    }
  };

  if (esCSV) reader.readAsText(file, "UTF-8");
  else        reader.readAsArrayBuffer(file);
}

/* ================================================================
   CARGA INICIAL DESDE SUPABASE
   ================================================================ */
function supabaseAFormatoLocal(rec, index) {
  const telefonoRaw = rec.telefono || '';
  const { telefonoMensaje, telefonoWhatsApp } = normalizarTelefono(telefonoRaw);
  const fechaObj = rec.fecha_pedido ? new Date(rec.fecha_pedido + 'T00:00:00') : null;
  const fechaKey = fechaObj ? fechaObj.toISOString().slice(0, 10) : String(index);
  return {
    id:              index,
    _key:            telefonoWhatsApp + '|' + fechaKey,
    nombre:          rec.nombre || '—',
    fechaObj,
    telefonoMensaje,
    telefonoWhatsApp,
    direccion:       rec.direccion    || '',
    ciudad:          rec.ciudad       || '',
    departamento:    rec.departamento || '',
    correo:          rec.correo       || CORREO_POR_DEFECTO,
    talla:           rec.talla        || '',
    producto:        rec.producto     || '',
    valor:           rec.valor        || VALOR_POR_DEFECTO,
  };
}

async function cargarClientesDeSupabase() {
  const tbody = document.getElementById("tabla-cuerpo");
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem;">⏳ Cargando clientes...</td></tr>`;

  // Supabase puede no estar listo aún — reintentamos hasta 3 veces
  for (let intento = 0; intento < 3; intento++) {
    if (dbH) break;
    await new Promise(r => setTimeout(r, 300));
    if (window.supabase && window.supabase.createClient) {
      dbH = window.supabase.createClient(SUPABASE_URL_H, SUPABASE_KEY_H);
    }
  }

  if (!dbH) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem;">Sin datos. Sube un Excel para comenzar.</td></tr>`;
    return;
  }

  try {
    const { data, error } = await dbH
      .from('clientes_funnelish')
      .select('*')
      .order('fecha_pedido', { ascending: false })
      .range(0, 9999);

    if (error) { console.warn('Error cargando clientes:', error.message); return; }
    if (!data || !data.length) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem;">Sin clientes. Usa "Actualizar clientes" para subir el Excel.</td></tr>`;
      return;
    }

    pedidos = data.map((rec, i) => supabaseAFormatoLocal(rec, i));
    window.pedidos = pedidos;

    // Cargar estados y remarketing desde Supabase
    data.forEach(rec => {
      const tel10d = String(rec.telefono || '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
      const key    = '57' + tel10d + '|' + (rec.fecha_pedido || '');
      if (rec.estado) estados[key] = rec.estado;
      if (rec.remarketing_enviado)   remarketingEnviados.add(key);
      if (rec.remarketing_2_enviado) remarketing2Enviados.add(key);
    });
    guardarEstados();
    guardarRemarketingLS();
    guardarRemarketingLS2();

    renderizarTabla(pedidos);
    if (typeof window.actualizarStats === 'function') window.actualizarStats();
    console.log(`[ConfirmaYa] ${pedidos.length} clientes cargados desde Supabase`);
  } catch(err) {
    console.warn('[ConfirmaYa] cargarClientesDeSupabase error:', err);
  }
}

/* ================================================================
   EFFI — Carga y comparación
   ================================================================ */
function tel10(telefono) {
  return String(telefono || '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
}

async function cargarEffiDeSupabase() {
  for (let i = 0; i < 5; i++) {
    if (dbH) break;
    await new Promise(r => setTimeout(r, 300));
    if (window.supabase?.createClient) dbH = window.supabase.createClient(SUPABASE_URL_H, SUPABASE_KEY_H);
  }
  if (!dbH) return;
  try {
    const { data } = await dbH.from('telefonos_effi').select('telefono').range(0, 9999);
    effiPhones = new Set((data || []).map(r => tel10(r.telefono)));
    window.effiPhones = effiPhones; // exponer para barra de conversión
    if (pedidos.length) { aplicarFiltros(); actualizarHeaderEffi(); }
    if (typeof window.actualizarBarraConversion === 'function') window.actualizarBarraConversion();
  } catch(err) { console.warn('cargarEffiDeSupabase error:', err); }
}

async function procesarArchivoEffi(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { alert('El archivo Effi está vacío.'); return; }

      // Extrae teléfono: busca columna cuyo prefijo 3 ASCII sea "tel" o "cel"
      const getPhone = (row) => {
        for (const k of Object.keys(row)) {
          const p3 = k.slice(0, 3).replace(/[^a-zA-Z]/g, '').toLowerCase();
          if (p3 === 'tel' || p3 === 'cel' || p3 === 'fon' || p3 === 'pho') {
            const v = String(row[k] || '').trim();
            if (v && v.replace(/\D/g,'').length >= 7) return v;
          }
        }
        return '';
      };

      const telefonos = [...new Set(
        rows.map(r => tel10(getPhone(r))).filter(t => t.length === 10)
      )];

      if (!telefonos.length) { alert('No se encontraron teléfonos en el archivo Effi.'); return; }

      // Guardar solo los nuevos en Supabase
      if (dbH) {
        const { data: exist } = await dbH.from('telefonos_effi').select('telefono').in('telefono', telefonos);
        const existSet = new Set((exist || []).map(r => r.telefono));
        const nuevos   = telefonos.filter(t => !existSet.has(t)).map(t => ({ telefono: t }));
        for (let i = 0; i < nuevos.length; i += 500) {
          await dbH.from('telefonos_effi').insert(nuevos.slice(i, i + 500));
        }
      }

      telefonos.forEach(t => effiPhones.add(t));
      window.effiPhones = effiPhones; // exponer para barra de conversión
      aplicarFiltros();
      actualizarHeaderEffi();
      if (typeof window.actualizarBarraConversion === 'function') window.actualizarBarraConversion();
      alert(`✅ Effi actualizado: ${telefonos.length} teléfonos procesados.`);
    } catch(err) {
      console.error(err);
      alert('No se pudo leer el archivo Effi. Asegúrate de que sea .xlsx o .xls');
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ================================================================
   NORMALIZACIÓN DE FILAS
   ================================================================ */
function normalizarFila(row, index) {
  /* Busca el valor de una columna probando múltiples alias en minúsculas */
  const get = (aliases) => {
    const rowLower = {};
    for (const k of Object.keys(row)) rowLower[k.toLowerCase().trim()] = row[k];
    for (const alias of aliases) {
      const val = String(rowLower[alias] ?? "").trim();
      if (rowLower[alias] !== undefined && val !== "") return val;
    }
    return "";
  };

  // Nombre completo = First Name + Last Name
  const primerNombre = get(COL_MAP.nombre);
  const apellido     = get(COL_MAP.apellido);
  const nombre       = [primerNombre, apellido].filter(Boolean).join(" ") || "—";

  const telefonoRaw  = get(COL_MAP.telefono);
  const { telefonoMensaje, telefonoWhatsApp } = normalizarTelefono(telefonoRaw);

  const correo   = get(COL_MAP.correo)  || CORREO_POR_DEFECTO;
  const valorRaw = get(COL_MAP.valor);
  const valor    = formatearValor(valorRaw);
  const talla    = aplicarReglasTalla(get(COL_MAP.talla));
  const producto = get(COL_MAP.producto);
  const fechaRaw = get(COL_MAP.fecha);
  const fechaObj = fechaRaw ? new Date(fechaRaw.replace(/\.\d+/, "").replace(" UTC", "")) : null;

  const fechaKey = fechaObj ? fechaObj.toISOString().slice(0, 10) : String(index);
  return {
    id:              index,
    _key:            telefonoWhatsApp + '|' + fechaKey, // clave estable: teléfono|fecha_pedido
    nombre,
    fechaObj,
    telefonoMensaje,
    telefonoWhatsApp,
    direccion:    get(COL_MAP.direccion),
    ciudad:       get(COL_MAP.ciudad),
    departamento: get(COL_MAP.departamento),
    correo,
    talla,
    producto,
    valor,
  };
}

/* Formatea número a moneda colombiana: 149900 → $149.900 */
function formatearValor(raw) {
  if (!raw && raw !== 0) return VALOR_POR_DEFECTO;
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return raw || VALOR_POR_DEFECTO;
  return "$" + Math.round(num).toLocaleString("es-CO");
}

/* ================================================================
   RENDERIZADO DE LA TABLA
   ================================================================ */
function renderizarTabla(filas) {
  const tbody = document.getElementById("tabla-cuerpo");
  tbody.innerHTML = "";
  document.getElementById("badge-total").textContent = filas.length;

  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:2rem;">Sin resultados.</td></tr>`;
    return;
  }

  filas.forEach((p, i) => {
    const estado   = estados[p._key] || "Pendiente";
    const rutaFoto = buscarFotoProducto(p.producto);
    const tr       = document.createElement("tr");

    const estaSeleccionado = seleccionados.has(p._key);
    tr.innerHTML = `
      <td class="td-check">
        <input type="checkbox" class="row-check" data-key="${p._key}" ${estaSeleccionado ? 'checked' : ''}>
      </td>
      <td class="td-num">${i + 1}</td>
      <td>
        <div class="td-producto">
          <div class="prod-thumb-wrap">
            <img class="prod-thumb" src="${rutaFoto}" alt="${p.producto}" loading="lazy"
                 data-foto="${rutaFoto}" title="Clic para copiar imagen">
          </div>
          <div class="prod-info">
            <div class="prod-nombre">${p.producto || "—"}</div>
            <div class="prod-modelo">Ref. #${String(p.id + 1).padStart(2,"0")}</div>
            <button class="btn-copiar-img" data-foto="${rutaFoto}" title="Copiar imagen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copiar imagen
            </button>
          </div>
        </div>
      </td>
      <td>
        <div>${p.nombre || "—"}</div>
        ${p.fechaObj ? `<div style="font-size:0.6rem;color:rgba(255,255,255,0.32);margin-top:0.18rem">📅 ${p.fechaObj.toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</div>` : ''}
      </td>
      <td>
        <div class="td-telefono-wrap">
          <span>${p.telefonoMensaje || "—"}</span>
          ${p.telefonoMensaje ? `<button class="btn-copiar-tel" data-tel="${p.telefonoMensaje}" title="Copiar teléfono">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>` : ""}
        </div>
      </td>
      <td>${p.talla || "—"}</td>
      <td>
        <div class="td-ciudad">
          <div class="ciudad-nombre">${p.ciudad || "—"}</div>
          <div class="ciudad-depto">${p.departamento}</div>
        </div>
      </td>
      <td>${p.valor}</td>
      <td class="td-col-confirmar">
        ${!modoCanceladas ? `
        <div class="accion-grupo confirmar-grupo">
          <span class="badge-estado ${claseEstado(estado)}" data-key="${p._key}" data-id="${p.id}">${estado}</span>
          <button class="btn-accion btn-accion-wa" data-id="${p.id}" title="Confirmar datos cliente" aria-label="Confirmar datos">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
          <button class="btn-accion btn-accion-ver" data-id="${p.id}" title="Ver detalle" aria-label="Ver detalle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn-cancelar-venta" data-key="${p._key}">🚫</button>
        </div>
        ` : `<span style="font-size:0.68rem;color:rgba(239,68,68,0.6)">Cancelada</span>`}
      </td>
      <td class="td-col-effi">
        ${remarketing2Enviados.has(p._key)
            ? '<div class="badge-remarketing-2">📨 2 MENSAJES ENVIADOS</div>'
            : remarketingEnviados.has(p._key)
              ? '<div class="badge-remarketing-enviado">✅ MENSAJE ENVIADO</div>'
              : ''}
        ${effiPhones.size > 0 ? `
        <div class="accion-grupo effi-grupo">
          <span class="badge-effi ${effiPhones.has(tel10(p.telefonoWhatsApp)) ? 'effi-confirmada' : 'effi-pendiente'}">${effiPhones.has(tel10(p.telefonoWhatsApp)) ? '✓ EFFI' : '⏳ PENDIENTE'}</span>
          <button class="btn-accion btn-accion-remarketing" data-id="${p.id}" title="Enviar remarketing" aria-label="Remarketing WA">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>` : '<span style="font-size:0.65rem;color:rgba(255,255,255,0.2)">—</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Badge en columna "Confirmar datos": solo alterna Pendiente ↔ Confirmado
  tbody.querySelectorAll(".badge-estado").forEach(badge => {
    badge.addEventListener("click", () => toggleConfirmar(badge.dataset.key, badge));
  });

  // Checkboxes de selección masiva
  tbody.querySelectorAll(".row-check").forEach(chk => {
    chk.addEventListener("change", () => {
      if (chk.checked) seleccionados.add(chk.dataset.key);
      else             seleccionados.delete(chk.dataset.key);
      actualizarBarraSeleccion();
    });
  });
  tbody.querySelectorAll(".btn-accion-wa").forEach(btn => {
    btn.addEventListener("click", () => abrirWhatsApp(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll(".btn-accion-remarketing").forEach(btn => {
    btn.addEventListener("click", () => abrirWhatsAppRemarketing(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll(".btn-cancelar-venta").forEach(btn => {
    btn.addEventListener("click", () => cancelarVenta(btn.dataset.key));
  });
  tbody.querySelectorAll(".btn-accion-ver").forEach(btn => {
    btn.addEventListener("click", () => abrirModal(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll(".btn-copiar-img").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copiarImagenAlPortapapeles(btn.dataset.foto, btn);
    });
  });
  // Clic en la imagen también copia (sin abrir nueva pestaña)
  tbody.querySelectorAll(".btn-copiar-tel").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tel = btn.dataset.tel;
      navigator.clipboard.writeText(tel).then(() => {
        btn.classList.add("copiado");
        setTimeout(() => btn.classList.remove("copiado"), 1500);
      });
    });
  });

  tbody.querySelectorAll(".prod-thumb").forEach(img => {
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      const btn = img.closest(".td-producto").querySelector(".btn-copiar-img");
      copiarImagenAlPortapapeles(img.dataset.foto, btn);
    });
  });
}

/* ================================================================
   ESTADO DE PEDIDOS
   ================================================================ */
const CICLO_ESTADOS = ["Pendiente", "Confirmado", "No confirma", "Cancelado"];

function cancelarVenta(key) {
  estados[key] = "Cancelado";
  guardarEstados();
  sincronizarEstadoEnSupabase(key, "Cancelado");
  aplicarFiltros(false); // mantener página actual
}

/* Guarda el estado de un cliente en Supabase (fire & forget) */
async function sincronizarEstadoEnSupabase(key, nuevoEstado) {
  if (!dbH) return;
  try {
    const partes  = key.split('|');
    const tel10   = partes[0].replace(/^57/, ''); // quitar prefijo 57
    const fecha   = partes[1] || '';
    await dbH.from('clientes_funnelish')
      .update({ estado: nuevoEstado })
      .eq('telefono', tel10)
      .eq('fecha_pedido', fecha);
  } catch(err) {
    console.warn('[ConfirmaYa] No se pudo guardar estado en Supabase:', err);
  }
}

function ciclarEstado(key, badge) {
  const actual = estados[key] || "Pendiente";
  const nuevo  = CICLO_ESTADOS[(CICLO_ESTADOS.indexOf(actual) + 1) % CICLO_ESTADOS.length];
  estados[key] = nuevo;
  guardarEstados();
  badge.textContent = nuevo;
  badge.className   = "badge-estado " + claseEstado(nuevo);
}

/* Toggle 2 estados: Pendiente ↔ Confirmado */
function toggleConfirmar(key, badge) {
  const actual = estados[key] || "Pendiente";
  if (actual === "Cancelado") return;
  const nuevo = actual === "Confirmado" ? "Pendiente" : "Confirmado";
  estados[key] = nuevo;
  guardarEstados();
  badge.textContent = nuevo;
  badge.className   = "badge-estado " + claseEstado(nuevo);
  sincronizarEstadoEnSupabase(key, nuevo);
}

/* Confirmar todos los seleccionados */
function confirmarSeleccionados() {
  if (!seleccionados.size) return;
  seleccionados.forEach(key => {
    estados[key] = "Confirmado";
    sincronizarEstadoEnSupabase(key, "Confirmado");
  });
  guardarEstados();
  seleccionados.clear();
  aplicarFiltros(false);
  actualizarBarraSeleccion();
}

/* Limpiar selección */
function limpiarSeleccion() {
  seleccionados.clear();
  document.querySelectorAll(".row-check").forEach(c => { c.checked = false; });
  const chkAll = document.getElementById("check-all");
  if (chkAll) chkAll.checked = false;
  actualizarBarraSeleccion();
}

/* Mostrar/ocultar barra de acción masiva */
function actualizarBarraSeleccion() {
  const barra = document.getElementById("barra-seleccion");
  if (!barra) return;
  const n = seleccionados.size;
  barra.style.display = n > 0 ? "flex" : "none";
  const btn = document.getElementById("btn-confirmar-sel");
  if (btn) btn.textContent = `✓ Confirmar seleccionados (${n})`;
}

/* Actualizar conteo en cabecera de columna Effi */
function actualizarHeaderEffi() {
  const th = document.getElementById("th-effi");
  if (!th || effiPhones.size === 0) return;
  const enEffi     = pedidos.filter(p => effiPhones.has(tel10(p.telefonoWhatsApp))).length;
  const pendientes = pedidos.filter(p => !effiPhones.has(tel10(p.telefonoWhatsApp))).length;
  th.innerHTML = `Estado Effi / Remarketing
    <div class="effi-header-counts">
      <span class="effi-count effi-count-conf">✓ ${enEffi} en Effi</span>
      <span class="effi-count effi-count-pend">⏳ ${pendientes} pendientes</span>
    </div>`;
}

function claseEstado(estado) {
  const m = {
    "Pendiente":   "estado-pendiente",
    "Confirmado":  "estado-confirmado",
    "No confirma": "estado-no-confirma",
    "Cancelado":   "estado-cancelado",
  };
  return m[estado] || "estado-pendiente";
}

function cargarEstados() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}

function guardarEstados() {
  localStorage.setItem(LS_KEY, JSON.stringify(estados));
}

/* ================================================================
   BÚSQUEDA Y FILTROS
   ================================================================ */
function limpiarTodosLosFiltros() {
  modoSinWA          = false;
  modoCanceladas     = false;
  modoPendientesEffi = false;
  document.getElementById("btn-sin-wa")?.classList.remove("active");
  document.getElementById("btn-ver-canceladas")?.classList.remove("active");
  const btnPend = document.getElementById("btn-pendientes-effi");
  if (btnPend) { btnPend.classList.remove("active"); }
  const btnVer = document.getElementById("btn-ver-canceladas");
  if (btnVer) btnVer.textContent = "🗑 Canceladas";
  aplicarFiltros();
}

function initBuscar() {
  document.getElementById("input-buscar").addEventListener("input", aplicarFiltros);
  document.getElementById("filtro-nombre").addEventListener("input", aplicarFiltros);
  document.getElementById("filtro-tel").addEventListener("input",    aplicarFiltros);

  // "Seleccionar todos" del header
  document.addEventListener("change", (e) => {
    if (e.target.id === "check-all") {
      const checked = e.target.checked;
      document.querySelectorAll(".row-check").forEach(c => {
        c.checked = checked;
        if (checked) seleccionados.add(c.dataset.key);
        else         seleccionados.delete(c.dataset.key);
      });
      actualizarBarraSeleccion();
    }
  });

  // "Sin mensaje WhatsApp" — solo Pendiente
  document.getElementById("btn-sin-wa").addEventListener("click", () => {
    modoSinWA = !modoSinWA;
    if (modoSinWA) { modoCanceladas = false; modoPendientesEffi = false; }
    document.getElementById("btn-sin-wa").classList.toggle("active", modoSinWA);
    document.getElementById("btn-ver-canceladas").classList.remove("active");
    document.getElementById("btn-ver-canceladas").textContent = "🗑 Canceladas";
    document.getElementById("btn-pendientes-effi")?.classList.remove("active");
    aplicarFiltros();
  });

  // "Limpiar filtro" — regresa a vista normal completa
  document.getElementById("btn-limpiar-wa")?.addEventListener("click", limpiarTodosLosFiltros);

  // "Pendientes por confirmar" (Effi) — naranja
  document.getElementById("btn-pendientes-effi")?.addEventListener("click", () => {
    modoPendientesEffi = !modoPendientesEffi;
    if (modoPendientesEffi) { modoSinWA = false; modoCanceladas = false; }
    document.getElementById("btn-pendientes-effi").classList.toggle("active", modoPendientesEffi);
    document.getElementById("btn-sin-wa").classList.remove("active");
    document.getElementById("btn-ver-canceladas").classList.remove("active");
    document.getElementById("btn-ver-canceladas").textContent = "🗑 Canceladas";
    aplicarFiltros();
  });

  // "Canceladas"
  document.getElementById("btn-ver-canceladas").addEventListener("click", () => {
    modoCanceladas = !modoCanceladas;
    if (modoCanceladas) { modoSinWA = false; modoPendientesEffi = false; }
    document.getElementById("btn-ver-canceladas").classList.toggle("active", modoCanceladas);
    document.getElementById("btn-ver-canceladas").textContent = modoCanceladas ? "← Ver activos" : "🗑 Canceladas";
    document.getElementById("btn-sin-wa").classList.remove("active");
    document.getElementById("btn-pendientes-effi")?.classList.remove("active");
    aplicarFiltros();
  });
}

function initFiltros() {
  document.getElementById("btn-filtros").addEventListener("click", () => {
    const panel = document.getElementById("panel-filtros");
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });
  document.getElementById("filtro-estado").addEventListener("change", aplicarFiltros);
  ["filtro-fecha-desde","filtro-hora-desde-h","filtro-hora-desde-m","filtro-hora-desde-p",
   "filtro-fecha-hasta","filtro-hora-hasta-h","filtro-hora-hasta-m","filtro-hora-hasta-p"]
    .forEach(id => document.getElementById(id).addEventListener("change", aplicarFiltros));
  ["filtro-hora-desde-h","filtro-hora-desde-m","filtro-hora-hasta-h","filtro-hora-hasta-m"]
    .forEach(id => document.getElementById(id).addEventListener("input", aplicarFiltros));
  document.getElementById("btn-limpiar-fechas").addEventListener("click", () => {
    ["filtro-fecha-desde","filtro-hora-desde-h","filtro-hora-desde-m",
     "filtro-fecha-hasta","filtro-hora-hasta-h","filtro-hora-hasta-m"]
      .forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("filtro-hora-desde-p").value = "AM";
    document.getElementById("filtro-hora-hasta-p").value = "AM";
    aplicarFiltros();
  });
}

function leerHora12(prefijo, porDefecto) {
  const hRaw = parseInt(document.getElementById("filtro-hora-" + prefijo + "-h").value);
  const mRaw = parseInt(document.getElementById("filtro-hora-" + prefijo + "-m").value);
  const p    = document.getElementById("filtro-hora-" + prefijo + "-p").value;
  if (isNaN(hRaw)) return porDefecto;
  let h24 = hRaw % 12;
  if (p === "PM") h24 += 12;
  const mm = isNaN(mRaw) ? "00" : String(Math.min(mRaw, 59)).padStart(2, "0");
  return String(h24).padStart(2, "0") + ":" + mm;
}

function aplicarFiltros(resetPage = true) {
  if (resetPage) paginaActual = 1;

  const q        = document.getElementById("input-buscar").value.toLowerCase().trim();
  const qNombre  = (document.getElementById("filtro-nombre")?.value || "").toLowerCase().trim();
  const qTel     = (document.getElementById("filtro-tel")?.value    || "").trim();
  const estado   = document.getElementById("filtro-estado").value;
  const desdeVal = document.getElementById("filtro-fecha-desde").value;
  const hastaVal = document.getElementById("filtro-fecha-hasta").value;
  const desde    = desdeVal ? new Date(desdeVal + "T" + leerHora12("desde", "00:00") + ":00") : null;
  const hasta    = hastaVal ? new Date(hastaVal + "T" + leerHora12("hasta", "23:59") + ":59") : null;

  const filtrados = pedidos.filter(p => {
    const estadoActual = estados[p._key] || "Pendiente";

    if (modoCanceladas) return estadoActual === "Cancelado";
    if (estadoActual === "Cancelado") return false;
    if (modoSinWA && estadoActual !== "Pendiente") return false;

    // Filtro Pendientes por confirmar Effi: solo los que NO están en Effi
    if (modoPendientesEffi && effiPhones.size > 0 && effiPhones.has(tel10(p.telefonoWhatsApp))) return false;

    const matchQ      = !q       || [p.nombre, p.producto, p.telefonoMensaje, p.ciudad].some(v => v && v.toLowerCase().includes(q));
    const matchNombre = !qNombre || (p.nombre           || "").toLowerCase().includes(qNombre);
    const matchTel    = !qTel    || (p.telefonoMensaje  || "").includes(qTel);
    const matchE      = !estado  || estadoActual === estado;
    const matchDesde  = !desde   || (p.fechaObj && p.fechaObj >= desde);
    const matchHasta  = !hasta   || (p.fechaObj && p.fechaObj <= hasta);

    return matchQ && matchNombre && matchTel && matchE && matchDesde && matchHasta;
  });

  // Más recientes primero
  filtrados.sort((a, b) => {
    if (!a.fechaObj && !b.fechaObj) return 0;
    if (!a.fechaObj) return 1;
    if (!b.fechaObj) return -1;
    return b.fechaObj - a.fechaObj;
  });

  // Paginación
  const inicio  = (paginaActual - 1) * ITEMS_POR_PAG;
  const pagina  = filtrados.slice(inicio, inicio + ITEMS_POR_PAG);
  renderizarTabla(pagina);
  renderPaginacion(filtrados.length);
}

function renderPaginacion(total) {
  const contenedor = document.getElementById("paginacion");
  if (!contenedor) return;
  const totalPags = Math.ceil(total / ITEMS_POR_PAG);
  if (totalPags <= 1) { contenedor.innerHTML = ""; return; }

  let html = '<div class="paginacion-inner">';
  for (let i = 1; i <= totalPags; i++) {
    html += `<button class="btn-pag ${i === paginaActual ? 'pag-activa' : ''}" onclick="irAPagina(${i})">${i}</button>`;
  }
  html += '</div>';
  contenedor.innerHTML = html;
}

function irAPagina(n) {
  paginaActual = n;
  aplicarFiltros(false);
  document.getElementById("seccion-tabla")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ================================================================
   WHATSAPP
   ================================================================ */
function abrirWhatsApp(id) {
  const p   = pedidos[id];
  const url = "whatsapp://send?phone=" + p.telefonoWhatsApp + "&text=" + encodeURIComponent(generarMensaje(p));
  window.open(url, "_self");

  // Auto-confirmar: si estaba Pendiente, pasa a Confirmado al enviar el mensaje
  if ((estados[p._key] || "Pendiente") === "Pendiente") {
    estados[p._key] = "Confirmado";
    guardarEstados();
    sincronizarEstadoEnSupabase(p._key, "Confirmado");
    const badge = document.querySelector(`.badge-estado[data-key="${p._key}"]`);
    if (badge) {
      badge.textContent = "Confirmado";
      badge.className   = "badge-estado " + claseEstado("Confirmado");
    }
  }
}

/* Botón de Remarketing Effi */
function abrirWhatsAppRemarketing(id) {
  const p = pedidos[id];
  const primerNombre = (p.nombre === '—' ? 'cliente' : p.nombre.split(' ')[0]);

  // Si ya se envió el primer mensaje → segundo mensaje de seguimiento
  const yaEnviado = remarketingEnviados.has(p._key);
  const msg = yaEnviado
    ? `Hola ${primerNombre}, Necesitamos tu confirmación para enviarlo. me confirmas el pedido?`
    : `Hola ${primerNombre}, los Buzos se están agotando, aún tengo apartado el tuyo. Necesitamos tu confirmación para enviarlo.`;

  const url = "whatsapp://send?phone=" + p.telefonoWhatsApp + "&text=" + encodeURIComponent(msg);
  window.open(url, "_self");

  // Actualizar estado según si es 1er o 2do mensaje
  const btn = document.querySelector(`.btn-accion-remarketing[data-id="${id}"]`);
  const td  = btn?.closest('td');
  const badgeExistente = td?.querySelector('.badge-remarketing-enviado, .badge-remarketing-2');

  if (yaEnviado) {
    // Segundo mensaje → cambiar badge a azul
    remarketing2Enviados.add(p._key);
    guardarRemarketingLS2();
    sincronizarRemarketingEnSupabase2(p._key);
    if (badgeExistente) {
      badgeExistente.className   = 'badge-remarketing-2';
      badgeExistente.textContent = '📨 2 MENSAJES ENVIADOS';
    }
  } else {
    // Primer mensaje → badge verde
    remarketingEnviados.add(p._key);
    guardarRemarketingLS();
    sincronizarRemarketingEnSupabase(p._key);
    if (td && !badgeExistente) {
      const badge = document.createElement('div');
      badge.className   = 'badge-remarketing-enviado';
      badge.textContent = '✅ MENSAJE ENVIADO';
      td.insertBefore(badge, td.firstChild);
    }
  }
}

/* Guarda/carga el estado de remarketing en localStorage */
function guardarRemarketingLS() {
  localStorage.setItem(LS_KEY_REMARKETING, JSON.stringify([...remarketingEnviados]));
}
function cargarRemarketingLS() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY_REMARKETING)) || []); }
  catch { return new Set(); }
}
function guardarRemarketingLS2() {
  localStorage.setItem(LS_KEY_REMARKETING2, JSON.stringify([...remarketing2Enviados]));
}
function cargarRemarketingLS2() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY_REMARKETING2)) || []); }
  catch { return new Set(); }
}

/* Sincroniza remarketing con Supabase (fire & forget) */
async function sincronizarRemarketingEnSupabase(key) {
  if (!dbH) return;
  try {
    const partes = key.split('|');
    const tel10  = partes[0].replace(/^57/, '');
    const fecha  = partes[1] || '';
    await dbH.from('clientes_funnelish')
      .update({ remarketing_enviado: true })
      .eq('telefono', tel10)
      .eq('fecha_pedido', fecha);
  } catch(err) {
    console.warn('[ConfirmaYa] No se pudo guardar remarketing en Supabase:', err);
  }
}
async function sincronizarRemarketingEnSupabase2(key) {
  if (!dbH) return;
  try {
    const partes = key.split('|');
    const tel10  = partes[0].replace(/^57/, '');
    const fecha  = partes[1] || '';
    await dbH.from('clientes_funnelish')
      .update({ remarketing_2_enviado: true })
      .eq('telefono', tel10)
      .eq('fecha_pedido', fecha);
  } catch(err) {
    console.warn('[ConfirmaYa] No se pudo guardar remarketing 2 en Supabase:', err);
  }
}

/* ================================================================
   MODAL DE DETALLE
   ================================================================ */
function initModal() {
  document.getElementById("modal-cerrar").addEventListener("click", cerrarModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) cerrarModal();
  });

  document.getElementById("modal-btn-copiar").addEventListener("click", () => {
    const ta  = document.getElementById("modal-mensaje");
    const btn = document.getElementById("modal-btn-copiar");
    navigator.clipboard?.writeText(ta.value).then(() => {
      const orig = btn.textContent;
      btn.textContent = "¡Copiado! ✓";
      setTimeout(() => btn.textContent = orig, 2000);
    }).catch(() => { ta.select(); document.execCommand("copy"); });
  });

  document.getElementById("modal-btn-whatsapp").addEventListener("click", () => {
    const id = Number(document.getElementById("modal-overlay").dataset.pedidoId);
    descargarFoto(buscarFotoProducto(pedidos[id].producto));
    abrirWhatsApp(id);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal();
  });
}

function abrirModal(id) {
  const p        = pedidos[id];
  const rutaFoto = buscarFotoProducto(p.producto);

  document.getElementById("modal-producto").textContent         = p.producto || "Sin nombre";
  document.getElementById("modal-img").src                      = rutaFoto;
  document.getElementById("modal-descarga").href                = rutaFoto;
  document.getElementById("modal-mensaje").value                = generarMensaje(p);
  document.getElementById("modal-overlay").dataset.pedidoId     = id;
  document.getElementById("modal-overlay").style.display        = "flex";
  document.body.style.overflow = "hidden";
}

function cerrarModal() {
  document.getElementById("modal-overlay").style.display = "none";
  document.body.style.overflow = "";
}

function descargarFoto(src) {
  const a = document.createElement("a");
  a.href = src; a.download = "";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ================================================================
   GENERACIÓN DEL MENSAJE (plantilla exacta del proyecto)
   ================================================================ */
function generarMensaje(p) {
  const uc  = (v) => (v || '').toUpperCase();
  const val = p.valor.replace(/^\$/, ''); // quitar $ del inicio para no duplicar
  return (
    "Hola, te saluda Santiago Tu pedido ya está listo para despacho. me confirmas si los datos estén correctos:\n\n" +
    "*NOMBRE:* "              + uc(p.nombre)          + "\n" +
    "*TELEFONO:* "            + uc(p.telefonoMensaje) + "\n" +
    "*DIRECCION:* "           + uc(p.direccion)       + "\n" +
    "*CIUDAD:* "              + uc(p.ciudad)          + "\n" +
    "*DEPARTAMENTO:* "        + uc(p.departamento)    + "\n" +
    "*CORREO :* "             + uc(p.correo)          + "\n" +
    "*TALLA :* "              + uc(p.talla)           + "\n" +
    "*Nombre del Producto:* " + uc(p.producto)        + "\n" +
    "*Valor a pagar: $* "     + val                   + "\n\n" +
    "Si todo está correcto escribeme: CONFIRMO\n" +
    "Si deseas corregir algún dato, escribeme cual seria.\n" +
    "Una vez confirmado, tu pedido será despachado en las próximas 24 horas."
  );
}

/* ================================================================
   REGLAS DE NEGOCIO
   ================================================================ */
function normalizarTelefono(raw) {
  const digits = raw.replace(/\D/g, "");
  const d10 = digits.length === 12 && digits.startsWith("57") ? digits.slice(2) : digits;
  return { telefonoMensaje: "+57" + d10, telefonoWhatsApp: "57" + d10 };
}

function aplicarReglasTalla(raw) {
  const t = raw.trim();
  if (!t) return "";
  if (INDICADORES_GENERO.some(g => t.toLowerCase().includes(g))) return t;
  return t + " " + GENERO_POR_DEFECTO;
}

/* ================================================================
   COPIAR IMAGEN AL PORTAPAPELES
   Usa canvas directamente (más fiable que fetch en servidor local)
   ================================================================ */
async function copiarImagenAlPortapapeles(rutaFoto, btn) {
  const textoOrig = btn.innerHTML;
  btn.innerHTML = "...";

  try {
    // Cargar imagen en un elemento <img> y dibujar en canvas
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = rutaFoto;
    });

    const canvas = document.createElement("canvas");
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);

    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    if (!blob) throw new Error("canvas.toBlob falló");

    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

    btn.innerHTML = "✓ Copiada";
    btn.classList.add("copiado");
    setTimeout(() => {
      btn.innerHTML = textoOrig;
      btn.classList.remove("copiado");
    }, 1500);

  } catch (err) {
    console.warn("No se pudo copiar al portapapeles:", err);
    btn.innerHTML = "✕ Error";
    setTimeout(() => { btn.innerHTML = textoOrig; }, 1500);
  }
}

/* ================================================================
   CATÁLOGO — foto del producto
   3 niveles de búsqueda:
   1. Exacta (case-insensitive)
   2. El catálogo empieza por lo que trae el CSV (ej: "NEGRO CO FRANJA 2026 - ...")
   3. El CSV empieza por una clave del catálogo (ej: "PROM PACK X2 1990 - ELIGE...")
   ================================================================ */
function buscarFotoProducto(nombre) {
  if (!nombre) return "img/placeholder.png";

  // Normalizar: colapsar espacios múltiples, minúsculas, trim
  const q = nombre.trim().replace(/\s+/g, " ").toLowerCase();

  // Detección por palabra clave para packs (antes del catálogo)
  // Captura cualquier variante: "pack x2", "pack 2", "packx2", etc.
  if (q.includes("pack x2") || q.includes("pack2") || (q.includes("pack") && q.includes("x2"))) return "img/PACK%20X2.jpg";
  if (q.includes("pack x3") || q.includes("pack3") || (q.includes("pack") && q.includes("x3")) || q.includes("pack 3")) return "img/PACK%20X3.jpg";

  // 1. Coincidencia exacta
  for (const clave of Object.keys(CATALOGO)) {
    const k = clave.trim().replace(/\s+/g, " ").toLowerCase();
    if (k === q) return CATALOGO[clave];
  }

  // 2. El nombre del CSV empieza por una clave del catálogo
  for (const clave of Object.keys(CATALOGO)) {
    const k = clave.trim().replace(/\s+/g, " ").toLowerCase();
    if (q.startsWith(k)) return CATALOGO[clave];
  }

  // 3. La clave del catálogo empieza por el nombre del CSV
  for (const clave of Object.keys(CATALOGO)) {
    const k = clave.trim().replace(/\s+/g, " ").toLowerCase();
    if (k.startsWith(q)) return CATALOGO[clave];
  }

  return "img/placeholder.png";
}
