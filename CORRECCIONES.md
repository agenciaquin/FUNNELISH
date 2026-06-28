# ConfirmaYa — Correcciones: Formulario → Vista de Tabla

Reemplaza completamente los 4 archivos con el código de abajo.

---

## 1. `index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ConfirmaYa — KLIXMANT</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>

  <!-- ── HEADER ─────────────────────────────────────────────── -->
  <header>
    <div class="header-left">
      <div class="header-logo">CY</div>
      <div class="header-info">
        <span class="header-title">ConfirmaYa</span>
        <span class="header-sub">Klixmant — Equipo Josué &amp; Mallerlis</span>
      </div>
    </div>
    <div class="header-right">
      <span id="badge-estado" class="badge-listo">✓ Listo</span>
    </div>
  </header>

  <main>

    <!-- ── ZONA DE CARGA ──────────────────────────────────────── -->
    <section id="seccion-upload">
      <div id="drop-zone">
        <div class="drop-icon">📂</div>
        <p class="drop-titulo">Arrastra el Excel de Funnelish aquí</p>
        <p class="drop-sub">o haz clic para seleccionar el archivo</p>
        <input type="file" id="input-excel" accept=".xlsx,.xls,.csv" hidden>
        <button type="button" id="btn-subir">Seleccionar archivo</button>
      </div>
    </section>

    <!-- ── TABLA DE PEDIDOS ───────────────────────────────────── -->
    <section id="seccion-tabla" style="display:none;">

      <!-- Barra de herramientas -->
      <div class="tabla-toolbar">
        <div class="toolbar-left">
          <span class="tabla-icono">📦</span>
          <span class="tabla-titulo">Listado de productos / pedidos</span>
          <span id="badge-total" class="badge-count">0</span>
        </div>
        <div class="toolbar-right">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input type="text" id="input-buscar" placeholder="Buscar por cliente, producto o teléfono...">
          </div>
          <button type="button" id="btn-filtros" class="btn-filtro">⚙ Filtros</button>
          <button type="button" id="btn-nueva-carga" class="btn-nueva-carga">↩ Nuevo Excel</button>
        </div>
      </div>

      <!-- Panel de filtros (oculto por defecto) -->
      <div id="panel-filtros" style="display:none;">
        <label>Estado:
          <select id="filtro-estado">
            <option value="">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Confirmado">Confirmado</option>
            <option value="No confirma">No confirma</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </label>
      </div>

      <!-- Tabla -->
      <div class="tabla-wrap">
        <table id="tabla-pedidos">
          <thead>
            <tr>
              <th>#</th>
              <th>Producto</th>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th>Talla</th>
              <th>Ciudad</th>
              <th>Valor a pagar</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-cuerpo">
            <!-- filas generadas por JS -->
          </tbody>
        </table>
      </div>

    </section>

  </main>

  <!-- ── MODAL DE DETALLE ───────────────────────────────────── -->
  <div id="modal-overlay" style="display:none;">
    <div id="modal-caja">
      <button id="modal-cerrar" type="button">✕</button>
      <div class="modal-contenido">
        <div class="modal-foto">
          <img id="modal-img" src="img/placeholder.png" alt="Foto del producto">
          <a id="modal-descarga" class="link-descarga" download>⬇ Descargar foto</a>
        </div>
        <div class="modal-datos">
          <h2 id="modal-producto"></h2>
          <div id="modal-mensaje-wrap">
            <p class="modal-label">Mensaje listo para WhatsApp:</p>
            <textarea id="modal-mensaje" readonly rows="14"></textarea>
          </div>
          <div class="modal-acciones">
            <button type="button" id="modal-btn-copiar" class="btn-secundario">Copiar mensaje</button>
            <button type="button" id="modal-btn-whatsapp" class="btn-whatsapp">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Enviar a cliente
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <footer>
    <p>ConfirmaYa &copy; 2024 — KLIXMANT</p>
  </footer>

  <!-- SheetJS para leer Excel -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <script src="catalogo.js"></script>
  <script src="app.js"></script>

</body>
</html>
```

---

## 2. `styles.css`

```css
/* ================================================================
   ConfirmaYa — KLIXMANT
   styles.css — Negro, dorado y blanco. Diseño tabla premium.
   ================================================================ */

:root {
  --bg:         #0d0d0d;
  --surface:    #161616;
  --surface2:   #1e1e1e;
  --border:     #2c2c2c;
  --gold:       #c9a84c;
  --gold-hover: #e8c96b;
  --white:      #f0f0f0;
  --muted:      #777;
  --green:      #27ae60;
  --yellow:     #e6a817;
  --red:        #e05252;
  --gray:       #555;
  --radius:     8px;
  --tr: 0.18s ease;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--white);
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 15px;
  min-height: 100vh;
  line-height: 1.5;
}

/* ── HEADER ──────────────────────────────────────────────────── */
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.5rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.header-logo {
  width: 42px;
  height: 42px;
  background: var(--gold);
  color: #0d0d0d;
  font-weight: 900;
  font-size: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.header-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.header-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--white);
  letter-spacing: 0.04em;
}

.header-sub {
  font-size: 0.72rem;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.badge-listo {
  background: rgba(39,174,96,0.15);
  color: var(--green);
  border: 1px solid var(--green);
  border-radius: 20px;
  padding: 0.3rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
}

/* ── MAIN ────────────────────────────────────────────────────── */
main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}

/* ── ZONA DE CARGA ───────────────────────────────────────────── */
#seccion-upload {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

#drop-zone {
  background: var(--surface);
  border: 2px dashed var(--border);
  border-radius: 16px;
  padding: 3.5rem 3rem;
  text-align: center;
  max-width: 480px;
  width: 100%;
  transition: border-color var(--tr), background var(--tr);
  cursor: pointer;
}

#drop-zone:hover,
#drop-zone.drag-over {
  border-color: var(--gold);
  background: rgba(201,168,76,0.06);
}

.drop-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.drop-titulo {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--white);
  margin-bottom: 0.4rem;
}

.drop-sub {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 1.5rem;
}

#btn-subir {
  background: var(--gold);
  color: #0d0d0d;
  border: none;
  border-radius: var(--radius);
  padding: 0.7rem 2rem;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--tr);
  letter-spacing: 0.03em;
}

#btn-subir:hover { background: var(--gold-hover); }

/* ── TABLA TOOLBAR ───────────────────────────────────────────── */
.tabla-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.tabla-icono { font-size: 1.1rem; }

.tabla-titulo {
  font-size: 1rem;
  font-weight: 700;
  color: var(--white);
}

.badge-count {
  background: var(--surface2);
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 0.15rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.7rem;
  font-size: 0.85rem;
  color: var(--muted);
  pointer-events: none;
}

#input-buscar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--white);
  font-size: 0.85rem;
  padding: 0.5rem 0.85rem 0.5rem 2.1rem;
  width: 280px;
  outline: none;
  transition: border-color var(--tr);
}

#input-buscar:focus { border-color: var(--gold); }
#input-buscar::placeholder { color: var(--muted); }

.btn-filtro,
.btn-nueva-carga {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--white);
  border-radius: var(--radius);
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--tr), color var(--tr);
}

.btn-filtro:hover { border-color: var(--gold); color: var(--gold); }
.btn-nueva-carga:hover { border-color: var(--muted); }

/* ── PANEL FILTROS ───────────────────────────────────────────── */
#panel-filtros {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.85rem 1rem;
  margin-bottom: 1rem;
}

#panel-filtros label {
  font-size: 0.85rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

#filtro-estado {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--white);
  padding: 0.3rem 0.6rem;
  font-size: 0.85rem;
  outline: none;
}

/* ── TABLA ───────────────────────────────────────────────────── */
.tabla-wrap {
  overflow-x: auto;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

#tabla-pedidos {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

#tabla-pedidos thead {
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
}

#tabla-pedidos th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

#tabla-pedidos tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background var(--tr);
}

#tabla-pedidos tbody tr:last-child { border-bottom: none; }

#tabla-pedidos tbody tr:hover { background: rgba(255,255,255,0.025); }

#tabla-pedidos td {
  padding: 0.85rem 1rem;
  vertical-align: middle;
  color: var(--white);
}

.td-num {
  color: var(--muted);
  font-size: 0.8rem;
  width: 40px;
}

.td-producto {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 180px;
}

.prod-thumb {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--border);
  background: var(--surface2);
  flex-shrink: 0;
}

.prod-info { line-height: 1.3; }

.prod-nombre {
  font-weight: 700;
  font-size: 0.88rem;
  color: var(--white);
}

.prod-modelo {
  font-size: 0.75rem;
  color: var(--muted);
}

.td-ciudad { line-height: 1.3; }
.ciudad-nombre { font-weight: 600; }
.ciudad-depto { font-size: 0.75rem; color: var(--muted); }

/* ── BADGES DE ESTADO ────────────────────────────────────────── */
.badge-estado {
  display: inline-block;
  border-radius: 20px;
  padding: 0.28rem 0.8rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  border: 1.5px solid transparent;
  transition: opacity var(--tr);
  user-select: none;
}

.badge-estado:hover { opacity: 0.8; }

.estado-pendiente {
  background: rgba(230,168,23,0.15);
  color: var(--yellow);
  border-color: var(--yellow);
}

.estado-confirmado {
  background: rgba(39,174,96,0.15);
  color: var(--green);
  border-color: var(--green);
}

.estado-no-confirma {
  background: rgba(224,82,82,0.15);
  color: var(--red);
  border-color: var(--red);
}

.estado-cancelado {
  background: rgba(85,85,85,0.2);
  color: var(--gray);
  border-color: var(--gray);
}

/* ── BOTONES DE ACCIÓN (por fila) ────────────────────────────── */
.td-acciones {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-accion {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--tr), background var(--tr);
  flex-shrink: 0;
}

.btn-accion:hover { border-color: var(--gold); }

.btn-accion-wa {
  border-color: rgba(39,174,96,0.4);
  color: var(--green);
}

.btn-accion-wa:hover { background: rgba(39,174,96,0.12); border-color: var(--green); }

.btn-accion svg { display: block; }

/* ── MODAL ───────────────────────────────────────────────────── */
#modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

#modal-caja {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 780px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 1.75rem;
  position: relative;
}

#modal-cerrar {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 1.1rem;
  cursor: pointer;
  line-height: 1;
  padding: 0.25rem;
}

#modal-cerrar:hover { color: var(--white); }

.modal-contenido {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.modal-foto {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

#modal-img {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--gold);
  background: var(--surface2);
}

.link-descarga {
  font-size: 0.8rem;
  color: var(--gold);
  text-decoration: underline;
  cursor: pointer;
}

.modal-datos {
  flex: 1 1 280px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

#modal-producto {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--gold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.modal-label {
  font-size: 0.78rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.35rem;
}

#modal-mensaje {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--white);
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  padding: 0.85rem;
  resize: vertical;
  outline: none;
  min-height: 220px;
}

.modal-acciones {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-secundario {
  background: transparent;
  color: var(--gold);
  border: 2px solid var(--gold);
  border-radius: var(--radius);
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: background var(--tr);
  font-family: inherit;
}

.btn-secundario:hover { background: rgba(201,168,76,0.1); }

.btn-whatsapp {
  background: var(--green);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: opacity var(--tr);
  font-family: inherit;
}

.btn-whatsapp:hover { opacity: 0.88; }

/* ── FOOTER ──────────────────────────────────────────────────── */
footer {
  text-align: center;
  padding: 1.25rem 1rem;
  color: var(--muted);
  font-size: 0.78rem;
  border-top: 1px solid var(--border);
}

/* ── RESPONSIVE ──────────────────────────────────────────────── */
@media (max-width: 700px) {
  header { padding: 0.7rem 1rem; }
  main { padding: 1.25rem 0.75rem 3rem; }
  #input-buscar { width: 180px; }
  .modal-foto { width: 100%; align-items: flex-start; }
  #modal-img { width: 140px; height: 140px; }
  .tabla-toolbar { flex-direction: column; align-items: flex-start; }
  .toolbar-right { width: 100%; }
  #input-buscar { width: 100%; }
}
```

---

## 3. `app.js`

```js
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

/* Mapeo flexible de nombres de columna del Excel de Funnelish */
const COL_MAP = {
  nombre:      ["nombre", "name", "nombre completo", "cliente", "full name"],
  telefono:    ["telefono", "teléfono", "phone", "celular", "móvil", "movil", "tel"],
  direccion:   ["dirección", "direccion", "address", "dirección de envío", "dir"],
  ciudad:      ["ciudad", "city", "municipio"],
  departamento:["departamento", "department", "estado", "depto"],
  correo:      ["correo", "email", "e-mail", "correo electrónico"],
  talla:       ["talla", "size", "talla/size"],
  producto:    ["producto", "product", "nombre del producto", "referencia", "artículo", "articulo", "modelo"],
  valor:       ["valor", "valor a pagar", "total", "precio", "price", "monto"],
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

  btnSubir.addEventListener("click", () => inputFile.click());
  dropZone.addEventListener("click", (e) => {
    if (e.target !== btnSubir) inputFile.click();
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
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb   = XLSX.read(data, { type: "array" });
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
      alert("No se pudo leer el archivo. Asegúrate de que sea un Excel válido (.xlsx / .xls).");
    }
  };
  reader.readAsArrayBuffer(file);
}

/* ================================================================
   NORMALIZACIÓN DE FILAS
   ================================================================ */
function normalizarFila(row, index) {
  const get = (aliases) => {
    const rowLower = {};
    for (const k of Object.keys(row)) rowLower[k.toLowerCase().trim()] = row[k];
    for (const alias of aliases) {
      if (rowLower[alias] !== undefined) return String(rowLower[alias]).trim();
    }
    return "";
  };

  const telefonoRaw   = get(COL_MAP.telefono);
  const { telefonoMensaje, telefonoWhatsApp } = normalizarTelefono(telefonoRaw);
  const correo        = get(COL_MAP.correo)  || CORREO_POR_DEFECTO;
  const valor         = get(COL_MAP.valor)   || VALOR_POR_DEFECTO;
  const talla         = aplicarReglasTalla(get(COL_MAP.talla));
  const producto      = get(COL_MAP.producto);

  return {
    id: index,
    nombre:          get(COL_MAP.nombre),
    telefonoMensaje,
    telefonoWhatsApp,
    direccion:       get(COL_MAP.direccion),
    ciudad:          get(COL_MAP.ciudad),
    departamento:    get(COL_MAP.departamento),
    correo,
    talla,
    producto,
    valor,
  };
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
          <img class="prod-thumb" src="${rutaFoto}" alt="${p.producto}" loading="lazy">
          <div class="prod-info">
            <div class="prod-nombre">${p.producto || "—"}</div>
            <div class="prod-modelo">Ref. #${String(p.id + 1).padStart(2,"0")}</div>
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
  return (
    "Hola 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚✨ Por favor confirma que estos datos estén correctos:\n" +
    "Nombre: "              + p.nombre          + "\n" +
    "Teléfono: "            + p.telefonoMensaje + "\n" +
    "Dirección: "           + p.direccion       + "\n" +
    "Ciudad: "              + p.ciudad          + "\n" +
    "Departamento: "        + p.departamento    + "\n" +
    "Correo: "              + p.correo          + "\n" +
    "Talla: "               + p.talla           + "\n" +
    "Nombre del Producto: " + p.producto        + "\n" +
    "Valor a pagar: "       + p.valor           + "\n" +
    "✅ Si todo está correcto responde: CONFIRMO\n" +
    "✏️ Si deseas corregir algún dato, escríbelo en este chat.\n" +
    "🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas."
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
   CATÁLOGO — foto del producto
   ================================================================ */
function buscarFotoProducto(nombre) {
  if (!nombre) return "img/placeholder.png";
  const q = nombre.trim().toLowerCase();
  for (const clave of Object.keys(CATALOGO)) {
    if (clave.trim().toLowerCase() === q) return CATALOGO[clave];
  }
  return "img/placeholder.png";
}
```

---

## 4. `catalogo.js`

```js
/* ================================================================
   ConfirmaYa — KLIXMANT
   catalogo.js — Catálogo de productos KLIXMANT
   Para agregar producto: "NOMBRE EXACTO": "img/archivo.jpg",
   ================================================================ */

const CATALOGO = {
  "NEGRO CO FRANJA 2026":    "img/negro-co-franja-2026.jpg",
  "BLANCO CO FRANJA 2026":   "img/blanco-co-franja-2026.jpg",
  "BM NEGRO ÉLITE 2026":     "img/bm-negro-elite-2026.jpg",
  "PROM BLANCO MARFIL 1990": "img/prom-blanco-marfil-1990.jpg",
  "PROM ROJO 1990":          "img/prom-rojo-1990.jpg",
  "NEGRO CO XXXL HOMBRE":    "img/negro-co-xxxl-hombre.jpg",
  "BLANCO CO ELIGE TALLA":   "img/blanco-co-elige-talla.jpg",
  "PROM PACK X2 1990":       "img/prom-pack-x2-1990.jpg",
};
```

---

## Notas de implementación

- **Imágenes:** Sube los archivos `.jpg` de cada producto a la carpeta `/img/` con los nombres exactos del catálogo.
- **Excel de Funnelish:** El sistema detecta automáticamente los encabezados de columna (acepta variantes en español e inglés).
- **Estados:** Se guardan en `localStorage` — persisten aunque recargues la página.
- **Agregar producto nuevo:** Una sola línea en `catalogo.js` + la imagen en `/img/`.
