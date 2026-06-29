# CORRECCIONES V5 — Botón copiar al lado · Imágenes Pack · Fix emojis WhatsApp
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-06-28  
**Archivos modificados:** `app.js`, `styles.css`, `catalogo.js`

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| `app.js` | Botón copiar movido debajo del nombre; imagen clickeable copia directo | El overlay tapaba la imagen y confundía |
| `app.js` | Eliminado fallback que abría imagen en nueva pestaña | Al copiar no debe abrirse nada |
| `app.js` | Emojis del mensaje usando Unicode escapes | Evita que se corrompan al copiar/pegar el .md |
| `styles.css` | `.btn-copiar-img` convertido de overlay a botón inline | Consistente con la nueva posición |
| `styles.css` | `.prod-thumb-wrap` con cursor pointer y efecto hover dorado | Indica que la imagen es clickeable |
| `catalogo.js` | PROM PACK X2 y PROM PACK 3 → apuntan a `img/PACK X2.jpg` e `img/PACK X3.jpg` | Usar imágenes genéricas propias de los packs |

---

## Instrucciones para Claude Code

Pega este mensaje en Claude Code:

> Aplica estos cambios al proyecto ConfirmaYa en la carpeta FUNNELISH:
> 1. En `catalogo.js`: cambia las rutas de PROM PACK X2 1990 a "img/PACK%20X2.jpg" y PROM PACK 3 1990 a "img/PACK%20X3.jpg"
> 2. En `app.js`: mueve el botón copiar-imagen para que quede dentro de `.prod-info` (debajo del nombre), agrega listener de clic en `.prod-thumb` para que también copie, elimina el fallback que abre en nueva pestaña, y usa Unicode escapes para los emojis del mensaje
> 3. En `styles.css`: convierte `.btn-copiar-img` de overlay absoluto a botón inline con display:inline-flex, y agrega cursor:pointer + efecto hover dorado al `.prod-thumb`

---

## Código completo corregido

### `catalogo.js`

```javascript
/* ================================================================
   ConfirmaYa — KLIXMANT
   catalogo.js — Catálogo de productos KLIXMANT
   IMPORTANTE: La clave debe coincidir exactamente con el
   "Product Name" que exporta Funnelish (case-insensitive).
   Rutas con %20 para compatibilidad con GitHub Pages y navegadores.
   ================================================================ */

const CATALOGO = {
  "NEGRO CO FRANJA 2026":        "img/NEGRO%20CO%20FRANJA%202026.jpg",
  "BLANCO CO FRANJA 2026":       "img/BLANCO%20CO%20FRANJA%202026.jpg",
  "BEIGE CO FRANJA 2026":        "img/BEIGE%20CO%20FRANJA%202026.jpg",
  "ROJO CO FRANJA 2026":         "img/ROJO%20CO%20FRANJA%202026.jpg",
  "BM NEGRO ÉLITE 2026":         "img/BM%20NEGRO%20%C3%89LITE%202026.jpg",
  "BM AMARILLO ÉLITE 2026":      "img/BM%20AMARILLO%20%C3%89LITE%202026.jpg",
  "BM AZUL OSCURO ÉLITE 2026":   "img/BM%20AZUL%20OSCURO%20%C3%89LITE%202026.jpg",
  "BM BLANCO MARFIL ÉLITE 2026": "img/BM%20BLANCO%20MARFIL%20%C3%89LITE%202026.jpg",
  "PROM AMARILLO 1990":          "img/PROM%20AMARILLO%201990.jpg",
  "PROM NEGRO 1990":             "img/PROM%20NEGRO%201990.jpg",
  "PROM ROJO 1990":              "img/PROM%20ROJO%201990.jpg",
  /* Productos pack — imagen genérica propia */
  "PROM PACK X2 1990":           "img/PACK%20X2.jpg",
  "PROM PACK 3 1990":            "img/PACK%20X3.jpg",
};
```

---

### `app.js` — sección renderizarTabla (dentro del forEach)

Reemplazar el bloque `tr.innerHTML` y los event listeners al final de `renderizarTabla`:

```javascript
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
      ...resto de columnas igual...
    `;
```

Y los listeners al final del forEach:

```javascript
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
```

---

### `app.js` — función generarMensaje (completa)

```javascript
function generarMensaje(p) {
  // Unicode escapes garantizan que los emojis no se corrompan al copiar/pegar
  const SMILE    = "😊"; // 😊
  const TRUCK    = "🚚"; // 🚚
  const SPARKLES = "✨";       // ✨
  const CHECK    = "✅";       // ✅
  const PENCIL   = "✏️"; // ✏️

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
```

---

### `app.js` — función copiarImagenAlPortapapeles (catch block)

Eliminar el fallback que abre nueva pestaña. El catch debe quedar así:

```javascript
  } catch (err) {
    console.warn("No se pudo copiar al portapapeles:", err);
    btn.innerHTML = "✕ Error";
    setTimeout(() => { btn.innerHTML = textoOrig; }, 1500);
  }
```

---

### `styles.css` — sección thumbnail y botón copiar

```css
/* Wrapper del thumbnail — clic para copiar */
.prod-thumb-wrap {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  cursor: pointer;
}

.prod-thumb {
  width: 52px;
  height: 52px;
  border-radius: 6px;
  object-fit: cover;
  border: 1px solid var(--border);
  background: var(--surface2);
  display: block;
  transition: border-color var(--tr), opacity var(--tr);
}

.prod-thumb-wrap:hover .prod-thumb {
  border-color: var(--gold);
  opacity: 0.85;
}

/* Botón copiar imagen — al lado de la info, debajo del nombre */
.btn-copiar-img {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 6px;
  margin-top: 4px;
  transition: all var(--tr);
  letter-spacing: 0.02em;
}

.btn-copiar-img:hover {
  border-color: var(--gold);
  color: var(--gold);
}

.btn-copiar-img svg { display: block; }

/* Estado "copiado" */
.btn-copiar-img.copiado {
  border-color: var(--green);
  color: var(--green);
  background: rgba(39,174,96,0.12);
}
```

---

## Nota sobre imágenes Pack

Para que PROM PACK X2 y PROM PACK 3 muestren imagen, guarda en `FUNNELISH/img/`:
- **`PACK X2.jpg`** — imagen genérica del pack de 2
- **`PACK X3.jpg`** — imagen genérica del pack de 3

## Verificación

Después de aplicar, comprueba:
- [ ] El botón "Copiar imagen" aparece debajo del nombre del producto, no encima de la foto
- [ ] Al hacer clic en la foto se copia la imagen directamente (sin abrir nueva pestaña)
- [ ] El mensaje de WhatsApp muestra los emojis correctamente (no como `?`)
- [ ] Los pedidos PACK X2 muestran su imagen propia (si el archivo existe en img/)
