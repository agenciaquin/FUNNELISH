---
tipo: modulo
titulo: Catálogos y fotos por color
tags: [catalogo, fotos, bot]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/product-catalog.ts", "quinchat/components/panel/CatalogosPanel.tsx"]
---

# Catálogos

Dos tablas: **`catalogo_colores`** y **`catalogos_bot`**.

Sirven para que QUINO mande **la foto exacta del color pedido**, no una genérica.

- El bot manda fotos solo con la etiqueta `[[FOTO]]url` → [[tokens-del-bot]].
- Las URLs apuntan a [[almacenamiento-r2|R2]].
- Marca de agua: `quinchat/lib/watermark.ts` y `sql/marca-agua-catalogo.sql`.
- UI: `components/panel/CatalogosPanel.tsx`.

Cuando falta la foto de un color, el bot no debe improvisar ni describir la imagen en texto:
o manda la etiqueta con URL real, o no manda foto.
