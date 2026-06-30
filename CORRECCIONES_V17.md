# CORRECCIONES V17 — Botón copiar teléfono en la tabla

## CAMBIO 1 — `app.js`: Agregar botón copiar al lado del teléfono

### Buscar:

```javascript
      <td>${p.telefonoMensaje || "—"}</td>
```

### Reemplazar por:

```javascript
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
```

---

## CAMBIO 2 — `app.js`: Agregar evento click para los botones de teléfono

Busca este bloque (está dentro de `renderizarTabla`, después del `tr.innerHTML = ...`):

### Buscar:

```javascript
    tbody.querySelectorAll(".prod-thumb").forEach(img => {
```

### Reemplazar por:

```javascript
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
```

---

## CAMBIO 3 — `styles.css`: Estilos para el botón copiar teléfono

### Agregar al final del archivo:

```css
/* ── BOTÓN COPIAR TELÉFONO ───────────────────────────────────── */
.td-telefono-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.btn-copiar-tel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--muted);
  cursor: pointer;
  padding: 3px 5px;
  transition: all var(--tr);
  flex-shrink: 0;
}

.btn-copiar-tel:hover { border-color: var(--gold); color: var(--gold); }
.btn-copiar-tel.copiado { border-color: var(--green); color: var(--green); background: rgba(39,174,96,0.12); }
```
