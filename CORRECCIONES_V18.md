# CORRECCIONES V18 — Filtro de fechas en la tabla

La columna de fecha en el CSV se llama "Time" y tiene formato: `2026-06-29 23:58:27.443174291 +0000 UTC`

---

## CAMBIO 1 — `app.js`: Agregar "time" al COL_MAP

### Buscar:
```javascript
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
```

### Reemplazar por:
```javascript
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
```

---

## CAMBIO 2 — `app.js`: Leer y guardar la fecha en normalizarFila

### Buscar:
```javascript
  const talla    = aplicarReglasTalla(get(COL_MAP.talla));
  const producto = get(COL_MAP.producto);

  return {
    id: index,
    nombre,
```

### Reemplazar por:
```javascript
  const talla    = aplicarReglasTalla(get(COL_MAP.talla));
  const producto = get(COL_MAP.producto);
  const fechaRaw = get(COL_MAP.fecha);
  // Parsear "2026-06-29 23:58:27.443174291 +0000 UTC" → Date
  const fechaObj = fechaRaw ? new Date(fechaRaw.replace(/\.\d+/, "").replace(" UTC", "")) : null;

  return {
    id: index,
    nombre,
    fechaObj,
```

---

## CAMBIO 3 — `app.js`: Actualizar el filtro aplicarFiltros para incluir fechas

### Buscar:
```javascript
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
```

### Reemplazar por:
```javascript
function aplicarFiltros() {
  const q        = document.getElementById("input-buscar").value.toLowerCase().trim();
  const estado   = document.getElementById("filtro-estado").value;
  const desdeVal = document.getElementById("filtro-fecha-desde").value;
  const hastaVal = document.getElementById("filtro-fecha-hasta").value;
  const desde    = desdeVal ? new Date(desdeVal + "T00:00:00") : null;
  const hasta    = hastaVal ? new Date(hastaVal + "T23:59:59") : null;

  const filtrados = pedidos.filter(p => {
    const matchQ = !q || [p.nombre, p.producto, p.telefonoMensaje, p.ciudad]
      .some(v => v && v.toLowerCase().includes(q));
    const matchE = !estado || (estados[p.id] || "Pendiente") === estado;
    const matchDesde = !desde || (p.fechaObj && p.fechaObj >= desde);
    const matchHasta = !hasta || (p.fechaObj && p.fechaObj <= hasta);
    return matchQ && matchE && matchDesde && matchHasta;
  });

  renderizarTabla(filtrados);
}
```

---

## CAMBIO 4 — `app.js`: Conectar los nuevos inputs de fecha en initFiltros

### Buscar:
```javascript
function initFiltros() {
  document.getElementById("btn-filtros").addEventListener("click", () => {
    const panel = document.getElementById("panel-filtros");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  document.getElementById("filtro-estado").addEventListener("change", aplicarFiltros);
}
```

### Reemplazar por:
```javascript
function initFiltros() {
  document.getElementById("btn-filtros").addEventListener("click", () => {
    const panel = document.getElementById("panel-filtros");
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });
  document.getElementById("filtro-estado").addEventListener("change", aplicarFiltros);
  document.getElementById("filtro-fecha-desde").addEventListener("change", aplicarFiltros);
  document.getElementById("filtro-fecha-hasta").addEventListener("change", aplicarFiltros);
  document.getElementById("btn-limpiar-fechas").addEventListener("click", () => {
    document.getElementById("filtro-fecha-desde").value = "";
    document.getElementById("filtro-fecha-hasta").value = "";
    aplicarFiltros();
  });
}
```

---

## CAMBIO 5 — `index.html`: Agregar inputs de fecha al panel de filtros

### Buscar:
```html
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
```

### Reemplazar por:
```html
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
        <label>F. creación: Desde
          <input type="date" id="filtro-fecha-desde">
        </label>
        <label>F. creación: Hasta
          <input type="date" id="filtro-fecha-hasta">
        </label>
        <button type="button" id="btn-limpiar-fechas" class="btn-limpiar">✕ Limpiar fechas</button>
      </div>
```

---

## CAMBIO 6 — `styles.css`: Estilos para el panel de filtros con fechas

### Buscar:
```css
#panel-filtros {
```

Si existe, reemplázalo. Si no existe, **agrega al final del archivo**:

```css
/* ── PANEL FILTROS ───────────────────────────────────────────── */
#panel-filtros {
  display: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 0.75rem;
}

#panel-filtros label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

#panel-filtros select,
#panel-filtros input[type="date"] {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--white);
  font-size: 0.85rem;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
}

#panel-filtros input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
}

.btn-limpiar {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--muted);
  font-size: 0.78rem;
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  margin-top: 16px;
  transition: all var(--tr);
}
.btn-limpiar:hover { border-color: var(--gold); color: var(--gold); }
```
