---
tipo: modulo
titulo: Bot Chat WhatsApp (ventas)
tags: [bot, whatsapp, ventas]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/quinchat/ventas.ts", "quinchat/lib/quinchat/systemPrompt.ts", "quinchat/lib/quinchat/registro-venta.ts"]
---

# Bot Chat WhatsApp

Atiende la línea **ventas**. Entrada principal: `atenderVenta(supabase, value, contactName, baseUrl)`
en `quinchat/lib/quinchat/ventas.ts`.
<!-- verificado: 2026-09-04 — ventas.ts:1011 -->

## Guion de venta

El prompt empuja siempre al siguiente paso:

```
modelo → talla → color → datos de envío → [[PEDIDO]]
```

Las fotos van **después del gancho**: una línea `[[FOTO]]url` por cada color del modelo, y en el
texto se nombran los colores en ese mismo orden. → [[tokens-del-bot]] · [[catalogos]]

## Piezas relacionadas

- `lib/quinchat/systemPrompt.ts` — prompt base.
- `lib/quinchat/claude.ts` — llamada al modelo.
- `lib/quinchat/registro-venta.ts` — registro de la venta cerrada.
- Línea activa y número de salida → [[whatsapp-cloud-api]].
- El pedido resultante → [[pedidos]].

## Cuidado

Cualquier cambio de comportamiento aquí **también va al webhook** → [[bots-quino]].
