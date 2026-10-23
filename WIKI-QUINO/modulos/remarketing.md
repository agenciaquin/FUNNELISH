---
tipo: modulo
titulo: Remarketing
tags: [remarketing, whatsapp, plantillas, meta]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/app/api/remarketing/route.ts", "quinchat/components/panel/RemarketingPanel.tsx", "quinchat/lib/whatsapp.ts"]
---

# Remarketing

Reactiva pedidos pendientes y carritos abandonados mandando una **plantilla de Meta aprobada,
categoría MARKETING**, filtrando por etiqueta.

| Pieza | Ruta |
|---|---|
| API | `app/api/remarketing/route.ts` + `/reporte` |
| UI | `components/panel/RemarketingPanel.tsx` |
| Envío | `sendPlantillaRemarketing` en `quinchat/lib/whatsapp.ts` |
| Rastreo | tabla `remarketing_envios` (enviado / entregado / leído / respondió) |
| Origen de datos | `carritos_abandonados`, `clientes_funnelish` → [[pedidos]] |

## Reglas

- Tiene **filtro de antigüedad**: no se le escribe a cualquiera de cualquier fecha.
- Fuera de la ventana de 24h solo salen plantillas aprobadas → [[whatsapp-cloud-api]].
- El header de la plantilla nunca en WebP → [[no-webp-en-headers-de-whatsapp]].
- Es un módulo que **escribe a clientes reales**: cualquier cambio se prueba con un número propio
  antes de correrlo masivo.
