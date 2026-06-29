# CORRECCIONES V6 — Imágenes Pack X2 y Pack X3 por palabra clave
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-06-28  
**Archivos modificados:** `app.js`, `catalogo.js`

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| `app.js` | `buscarFotoProducto()` detecta "pack x2" y "pack x3" por palabra clave | Funnelish puede variar el nombre exacto del pack |
| `catalogo.js` | Añadida clave `"PROM PACK X3 1990"` además de `"PROM PACK 3 1990"` | Cubre ambas variantes del nombre |

---

## Instrucciones para Claude Code

> En el proyecto ConfirmaYa, aplica estos dos cambios:
> 1. En `catalogo.js`: agrega la clave `"PROM PACK X3 1990": "img/PACK%20X3.jpg"` junto a la de PACK 3
> 2. En `app.js`, al inicio de `buscarFotoProducto()` (después de normalizar `q`): agrega detección por palabra clave para packs antes de buscar en el catálogo

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
  "PROM PACK X3 1990":           "img/PACK%20X3.jpg",
  "PROM PACK 3 1990":            "img/PACK%20X3.jpg",
};
```

---

### `app.js` — función `buscarFotoProducto` (completa)

```javascript
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
```

---

## Verificación

Después de aplicar, comprueba:
- [ ] Pedido con "PROM PACK X2 1990 - ELIGE DOS COLORES..." muestra imagen PACK X2
- [ ] Pedido con "PROM PACK X3 1990 - TRES COLORES..." muestra imagen PACK X3
- [ ] Los demás productos siguen mostrando su imagen correcta
