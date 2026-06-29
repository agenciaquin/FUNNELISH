# CORRECCIONES V10 — Revertir a estado antes de V7 (sin fondo de inicio)

## Archivos a modificar: `styles.css`, `index.html`, `app.js`

---

## 1. `styles.css` — Quitar imagen de fondo, volver al diseño original

### Buscar:

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

### Reemplazar por:

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

---

## 2. `index.html` — Volver al título ConfirmaYa

### Buscar:

```html
        <span class="header-title">AGENCIA QUIN</span>
        <span class="header-sub">KLIXMANT — EQUIPO JOSUÉ &amp; MALLERLIS</span>
```

### Reemplazar por:

```html
        <span class="header-title">ConfirmaYa</span>
        <span class="header-sub">Klixmant — Equipo Josué &amp; Mallerlis</span>
```

---

## 3. `app.js` — Restaurar mensaje con emojis (versión original)

### Buscar:

```javascript
function generarMensaje(p) {
  return (
    "Hola, te saluda Lilibeth. Tu pedido ya está listo para despacho. Por favor confirma que estos datos estén correctos:\n" +
    "Nombre: "              + p.nombre          + "\n" +
    "Teléfono: "            + p.telefonoMensaje + "\n" +
    "Dirección: "           + p.direccion       + "\n" +
    "Ciudad: "              + p.ciudad          + "\n" +
    "Departamento: "        + p.departamento    + "\n" +
    "Correo: "              + p.correo          + "\n" +
    "Talla: "               + p.talla           + "\n" +
    "Nombre del Producto: " + p.producto        + "\n" +
    "Valor a pagar: "       + p.valor           + "\n" +
    "Si todo está correcto responde: CONFIRMO\n" +
    "Si deseas corregir algún dato, escríbelo en este chat.\n" +
    "Una vez confirmado, tu pedido será despachado en las próximas 24 horas."
  );
}
```

### Reemplazar por:

```javascript
function generarMensaje(p) {
  var SMILE    = "😊"; // 😊
  var TRUCK    = "🚚"; // 🚚
  var SPARKLES = "✨";       // ✨
  var CHECK    = "✅";       // ✅
  var PENCIL   = "✏️"; // ✏️

  return (
    "Hola " + SMILE + " te saluda Lilibeth. Tu pedido ya está listo para despacho " + TRUCK + SPARKLES + " Por favor confirma que estos datos estén correctos:\n" +
    "Nombre: "              + p.nombre          + "\n" +
    "Teléfono: "       + p.telefonoMensaje + "\n" +
    "Dirección: "      + p.direccion       + "\n" +
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
```
