# CORRECCIONES V15 — Tabla completa visible (botón WhatsApp no queda oculto)

## Archivo a modificar: `styles.css`

---

### CAMBIO 1 — Ampliar el contenedor principal

#### Buscar:
```css
/* ── MAIN ────────────────────────────────────────────────────── */
main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
```
#### Reemplazar por:
```css
/* ── MAIN ────────────────────────────────────────────────────── */
main {
  max-width: 1440px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
```

---

### CAMBIO 2 — Reducir padding de celdas para que entren todas las columnas

#### Buscar:
```css
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
```
#### Reemplazar por:
```css
#tabla-pedidos th {
  padding: 0.6rem 0.6rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

#tabla-pedidos tbody tr {
  border-bottom: 1px solid var(--border);
  transition: background var(--tr);
}

#tabla-pedidos tbody tr:last-child { border-bottom: none; }

#tabla-pedidos tbody tr:hover { background: rgba(255,255,255,0.025); }

#tabla-pedidos td {
  padding: 0.65rem 0.6rem;
  vertical-align: middle;
  color: var(--white);
}
```

---

### CAMBIO 3 — Reducir min-width de columna producto

#### Buscar:
```css
.td-producto {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 180px;
}
```
#### Reemplazar por:
```css
.td-producto {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 160px;
}
```
