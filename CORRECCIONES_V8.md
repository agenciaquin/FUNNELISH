# CORRECCIONES V8 — Fondo hero + Header AGENCIA QUIN

## Archivos modificados: `styles.css` e `index.html`

---

## 1. `styles.css` — Zona de carga con imagen de fondo

### Buscar:

```css
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
```

### Reemplazar por:

```css
/* ── ZONA DE CARGA ───────────────────────────────────────────── */
#seccion-upload {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 64px);
  background-image: url('img/FONDO%20INICIO.png');
  background-size: cover;
  background-position: center top;
  background-repeat: no-repeat;
}

#drop-zone {
  background: rgba(10, 14, 20, 0.82);
  border: 2px dashed rgba(0, 200, 190, 0.5);
  border-radius: 16px;
  padding: 3.5rem 3rem;
  text-align: center;
  max-width: 480px;
  width: 100%;
  transition: border-color var(--tr), background var(--tr);
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

#drop-zone:hover,
#drop-zone.drag-over {
  border-color: var(--gold);
  background: rgba(201,168,76,0.08);
}
```

---

## 2. `index.html` — Header: texto AGENCIA QUIN

### Buscar:

```html
        <span class="header-title">ConfirmaYa</span>
        <span class="header-sub">Klixmant — Equipo Josué &amp; Mallerlis</span>
```

### Reemplazar por:

```html
        <span class="header-title">AGENCIA QUIN</span>
        <span class="header-sub">KLIXMANT — EQUIPO JOSUÉ &amp; MALLERLIS</span>
```

---

## Requisito
La imagen `FONDO INICIO.png` y `ROBOT QUINO.png` deben estar guardadas en la carpeta `img/`.
