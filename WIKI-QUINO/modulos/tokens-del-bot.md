---
tipo: modulo
titulo: Tokens del bot (contrato modelo ↔ sistema)
tags: [bot, tokens, prompt]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/quinchat/ventas.ts", "quinchat/app/api/whatsapp/webhook/route.ts"]
---

# Tokens del bot

El modelo escribe estos marcadores dentro de su respuesta; el sistema los intercepta, ejecuta la
acción y los quita del texto que ve el cliente.

| Token | Qué hace |
|---|---|
| `[[HUMANO]]` | Pasa la conversación a un asesor. Silencioso para el cliente + aviso a Lilibeth con nombre y celular. |
| `[[ACTUALIZAR]]{...}` | Guarda cambios del pedido: producto, talla, dirección, ciudad/municipio, departamento, correo. |
| `[[PEDIDO]]{...}` | Cierra el pedido y crea la venta. |
| `[[FOTO]]url` | Envía la foto de esa URL exacta del catálogo. |

## Reglas del contrato

- `[[PEDIDO]]` se usa **una sola vez** por cliente. Del segundo en adelante es `[[ACTUALIZAR]]`.
  <!-- verificado: 2026-09-04 — ventas.ts:565 -->
- El sistema protege contra `[[PEDIDO]]` repetido para no crear dos ventas ni mandar dos fichas.
  <!-- verificado: 2026-09-04 — ventas.ts:808 -->
- La **única** forma de mandar una foto es la etiqueta. Si el modelo describe la imagen en texto o
  escribe un texto-marcador, no sale foto; hay limpieza defensiva para esos casos.
  <!-- verificado: 2026-09-04 — ventas.ts:485-491, 689 -->
- Dirección por partes: si el cliente la completa a pedazos (torre, apto, barrio, conjunto,
  ciudadela), el bot arma la dirección completa y la **guarda** en `[[ACTUALIZAR]]`, no solo la
  muestra. → [[confirmacion-de-pedidos]]
- Pedido a oficina: **nunca** cerrar con `[[PEDIDO]]` si el cliente no aceptó y coordinó el abono.
  <!-- verificado: 2026-09-04 — ventas.ts:555 -->

Si cambias el contrato, cámbialo en los dos bots → [[bots-quino]].
