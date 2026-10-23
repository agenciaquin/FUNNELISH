---
tipo: modulo
titulo: Bot Chat Funnel (webhook de WhatsApp)
tags: [bot, whatsapp, funnel, webhook]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/app/api/whatsapp/webhook/route.ts"]
---

# Bot Chat Funnel

Es el **webhook entrante** de WhatsApp: `quinchat/app/api/whatsapp/webhook/route.ts`.
Atiende la línea `funnel` (la de por defecto) → [[whatsapp-cloud-api]].

Es el bot que confirma los pedidos que llegan de [[embudos|los embudos]] y de Funnelish
→ [[pedidos]].

## Particularidades

- Su prompt vive dentro del propio `route.ts` y es independiente del de `ventas.ts`.
- Instrucción fuerte de **dirección por partes**: si el cliente la completa a pedazos, el bot arma
  la dirección completa y la guarda en `[[ACTUALIZAR]]`. Si se la muestra al cliente
  ("Recibirás tu pedido en: ..."), esa misma dirección debe quedar guardada.
  <!-- verificado: 2026-09-04 — webhook/route.ts:1955 -->
- Usa los mismos tokens → [[tokens-del-bot]].

## Cuidado

Cualquier cambio de comportamiento aquí **también va a `ventas.ts`** → [[bots-quino]].
