---
tipo: modulo
titulo: Pedidos (clientes_funnelish)
tags: [pedidos, funnelish, supabase]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/app/api/funnelish/webhook/route.ts", "quinchat/app/api/pedidos/lista/route.ts", "quinchat/components/panel/PedidosPanel.tsx"]
---

# Pedidos

Tabla central: **`clientes_funnelish`**. Es la tabla más usada del proyecto.

Campos habituales: `estado`, `confirmado`, `funnel_slug`, `valor`, `direccion`, `talla`,
`producto`, `referencia`, `utm_*`, `foto_producto`.
(Verificar contra el esquema real antes de asumir columnas → [[supabase]].)

## Entradas y salidas

| Pieza | Ruta |
|---|---|
| Webhook de entrada (Funnelish) | `quinchat/app/api/funnelish/webhook/route.ts` |
| Lista para el panel | `quinchat/app/api/pedidos/lista/route.ts` |
| Detalle / acciones | `quinchat/app/api/pedidos/detalle`, `.../accion` |
| UI | `quinchat/components/panel/PedidosPanel.tsx` |

## Origen del pedido según `referencia`

<!-- verificado: 2026-09-04 — app/api/pedidos/lista/route.ts:31-36 -->

| Prefijo | Canal |
|---|---|
| `web-*` | Embudo propio de QuinChat → [[embudos]] |
| `wa-*` | WhatsApp (venta tomada por el bot) → [[bot-chat-whatsapp]] |
| `venta-*` | Registro manual de venta |
| solo numérica (ninguno de los anteriores) | Plataforma Funnelish externa |

El filtro `funnelish` del panel se construye por exclusión de los tres prefijos.

## Después del pedido

Confirmación por WhatsApp → [[confirmacion-de-pedidos]].
Estado real de entrega → [[effi]]. Recuperación de pendientes → [[remarketing]].
