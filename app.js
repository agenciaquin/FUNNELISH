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
};

/* ── ESTADO GLOBAL ───────────────────────────────────────────── */
let pedidos = [];
let estados = {};

/* ── INICIALIZACIÓN ──────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  estados = cargarEstados();
  initUpload();
  initModal();
  initBuscar();
  initFiltros();
});

/* ================================================================
   CARGA DE EXCEL
   ================================================================ */
function initUpload() {
  const dropZone  = document.getElementById("drop-zone");
  const inputFile = document.getElementById("input-excel");
  const btnSubir  = document.getElementById("btn-subir");
  const btnNueva  = document.getElementById("btn-nueva-carga");

  // El label #btn-subir abre el explorador de archivos de forma nativa (sin JS)
  // Solo necesitamos el clic en la zona para clicks fuera del label
  dropZone.addEventListener("click", (e) => {
    if (e.target === btnSubir || e.target === inputFile) return;
    inputFile.click();
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
  });

  inputFile.addEventListener("change", () => {
    if (inputFile.files[0]) procesarArchivo(inputFile.files[0]);
  });

  btnNueva.addEventListener("click", () => {
    pedidos = [];
    document.getElementById("seccion-tabla").style.display = "none";
    document.getElementById("seccion-upload").style.display = "flex";
    inputFile.value = "";
  });
}

function procesarArchivo(file) {
  const esCSV = file.name.toLowerCase().endsWith(".csv");
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      let wb;
      if (esCSV) {
        const texto = e.target.result;
        // Detectar separador: si hay más ";" que "," en la primera línea → punto y coma
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

      pedidos = rows.map((row, i) => normalizarFila(row, i));
      renderizarTabla(pedidos);

      document.getElementById("seccion-upload").style.display = "none";
      document.getElementById("seccion-tabla").style.display  = "block";
    } catch (err) {
      console.error(err);
      alert("No se pudo leer el archivo. Asegúrate de que sea un archivo válido (.xlsx / .xls / .csv).");
    }
  };

  if (esCSV) reader.readAsText(file, "UTF-8");
  else        reader.readAsArrayBuffer(file);
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

  return {
    id: index,
    nombre,
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
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem;">Sin resultados.</td></tr>`;
    return;
  }

  filas.forEach((p, i) => {
    const estado   = estados[p.id] || "Pendiente";
    const rutaFoto = buscarFotoProducto(p.producto);
    const tr       = document.createElement("tr");

    tr.innerHTML = `
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
      <td>${p.nombre || "—"}</td>
      <td>${p.telefonoMensaje || "—"}</td>
      <td>${p.talla || "—"}</td>
      <td>
        <div class="td-ciudad">
          <div class="ciudad-nombre">${p.ciudad || "—"}</div>
          <div class="ciudad-depto">${p.departamento}</div>
        </div>
      </td>
      <td>${p.valor}</td>
      <td>
        <span class="badge-estado ${claseEstado(estado)}" data-id="${p.id}">${estado}</span>
      </td>
      <td>
        <div class="td-acciones">
          <button class="btn-accion btn-accion-wa" data-id="${p.id}" title="Enviar por WhatsApp" aria-label="WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
          <button class="btn-accion btn-accion-ver" data-id="${p.id}" title="Ver detalle" aria-label="Ver detalle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".badge-estado").forEach(badge => {
    badge.addEventListener("click", () => ciclarEstado(Number(badge.dataset.id), badge));
  });
  tbody.querySelectorAll(".btn-accion-wa").forEach(btn => {
    btn.addEventListener("click", () => abrirWhatsApp(Number(btn.dataset.id)));
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

function ciclarEstado(id, badge) {
  const actual = estados[id] || "Pendiente";
  const nuevo  = CICLO_ESTADOS[(CICLO_ESTADOS.indexOf(actual) + 1) % CICLO_ESTADOS.length];
  estados[id]  = nuevo;
  guardarEstados();
  badge.textContent = nuevo;
  badge.className   = "badge-estado " + claseEstado(nuevo);
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
function initBuscar() {
  document.getElementById("input-buscar").addEventListener("input", aplicarFiltros);
}

function initFiltros() {
  document.getElementById("btn-filtros").addEventListener("click", () => {
    const panel = document.getElementById("panel-filtros");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  document.getElementById("filtro-estado").addEventListener("change", aplicarFiltros);
}

function aplicarFiltros() {
  const q      = document.getElementById("input-buscar").value.toLowerCase().trim();
  const estado = document.getElementById("filtro-estado").value;

  const filtrados = pedidos.filter(p => {
    const matchQ = !q || [p.nombre, p.producto, p.telefonoMensaje, p.ciudad]
      .some(v => v && v.toLowerCase().includes(q));
    const matchE = !estado || (estados[p.id] || "Pendiente") === estado;
    return matchQ && matchE;
  });

  renderizarTabla(filtrados);
}

/* ================================================================
   WHATSAPP
   ================================================================ */
function abrirWhatsApp(id) {
  const p   = pedidos[id];
  const url = "https://wa.me/" + p.telefonoWhatsApp + "?text=" + encodeURIComponent(generarMensaje(p));
  window.open(url, "_blank");
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
  var SMILE    = "😊"; // 😊
  var TRUCK    = "🚚"; // 🚚
  var SPARKLES = "✨";       // ✨
  var CHECK    = "✅";       // ✅
  var PENCIL   = "✏️"; // ✏️

  return (
    "Hola " + SMILE + " te saluda Lilibeth. Tu pedido ya está listo para despacho " + TRUCK + SPARKLES + " Por favor confirma que estos datos estén correctos:\n" +
    "Nombre: "              + p.nombre          + "\n" +
    "Teléfono: "            + p.telefonoMensaje + "\n" +
    "Dirección: "           + p.direccion       + "\n" +
    "Ciudad: "              + p.ciudad          + "\n" +
    "Departamento: "        + p.departamento    + "\n" +
    "Correo: "              + p.correo          + "\n" +
    "Talla: "               + p.talla           + "\n" +
    "Nombre del Producto: " + p.producto        + "\n" +
    "Valor a pagar: "       + p.valor           + "\n" +
    CHECK + " Si todo está correcto responde: CONFIRMO\n" +
    PENCIL + " Si deseas corregir algún dato, escríbelo en este chat.\n" +
    TRUCK + " Una vez confirmado, tu pedido será despachado en las próximas 24 horas."
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
  