---
tipo: modulo
titulo: Embudos
tags: [embudos, funnels, checkout]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/bloques.ts", "quinchat/lib/funnels.ts", "quinchat/components/panel/EmbudosPanel.tsx", "quinchat/app/p/[slug]/page.tsx", "quinchat/app/api/funnels/route.ts"]
---

# Embudos

Páginas de venta propias de QuinChat. Un embudo se guarda en la tabla `funnels`, con el diseño
completo en la columna **`layout` jsonb**:

```ts
{ bloques: Bloque[], checkout?: { ... } }
```

## Piezas

| Pieza | Ruta |
|---|---|
| Registro de bloques | `quinchat/lib/bloques.ts` |
| Helpers | `quinchat/lib/funnels.ts` (incluye `imgOptim()` → [[imagenes]]) |
| Editor | `components/panel/EmbudosPanel.tsx`, `VistaPreviaEmbudo.tsx`, `EditorBloqueLateral.tsx` |
| Página pública | `quinchat/app/p/[slug]/page.tsx` |
| API | `app/api/funnels/route.ts` + `/ajustes`, `/optimizar-fotos`, `/upload-url`, `/imagen`, `/stats`, `/evento`, `/carrito` |
| Analítica | tabla `funnel_eventos` |
| Papelera | `components/panel/EmbudosPapelera.tsx` |

## Cuidado

Los embudos publicados están vendiendo. Cualquier cambio en el `layout` o en el render debe ser
retrocompatible con los embudos ya guardados: bloques viejos deben seguir renderizando.
Ver [[reglas-duras]].

Un pedido nacido aquí lleva `referencia` con prefijo `web-` → [[pedidos]].
