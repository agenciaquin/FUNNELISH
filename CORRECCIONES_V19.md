# CORRECCIONES V19 — Agregar productos Retro 1990 al catálogo

## Archivo a modificar: `catalogo.js`

### Buscar:

```javascript
  /* Productos pack — imagen genérica propia */
  "PROM PACK X2 1990":           "img/PACK%20X2.jpg",
  "PROM PACK X3 1990":           "img/PACK%20X3.jpg",
  "PROM PACK 3 1990":            "img/PACK%20X3.jpg",
};
```

### Reemplazar por:

```javascript
  /* Productos pack — imagen genérica propia */
  "PROM PACK X2 1990":           "img/PACK%20X2.jpg",
  "PROM PACK X3 1990":           "img/PACK%20X3.jpg",
  "PROM PACK 3 1990":            "img/PACK%20X3.jpg",

  /* Línea Retro 1990 */
  "RETRO BLANCO MARFIL 1990":            "img/RETRO%20%20BLANCO%20MARFIL%201990.jpeg",
  "RETRO  BLANCO MARFIL 1990":           "img/RETRO%20%20BLANCO%20MARFIL%201990.jpeg",
  "RETRO AMARILLO 1990":                 "img/RETRO%20AMARILLO%201990.jpg",
  "RETRO AMARILLO MARIPOSA CUELLO ALTO": "img/RETRO%20AMARILLO%20MARIPOSA%20%20CUELLO%20ALTO.jpeg",
  "RETRO AMARILLO MARIPOSA  CUELLO ALTO":"img/RETRO%20AMARILLO%20MARIPOSA%20%20CUELLO%20ALTO.jpeg",
  "RETRO NEGRO 1990":                    "img/RETRO%20NEGRO%201990.jpeg",
  "RETRO ROJO 1990":                     "img/RETRO%20ROJO%201990.jpeg",
};
```

---

**Nota:** Se agregaron variantes con uno y dos espacios para cubrir posibles diferencias en cómo Funnelish exporta los nombres. También se deben hacer `git add img/ && git commit -m "feat: imágenes Retro 1990" && git push` para que las fotos aparezcan en Vercel.
