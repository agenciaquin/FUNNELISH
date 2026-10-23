---
tipo: arquitectura
titulo: WhatsApp Cloud API y eventos de conversión
tags: [whatsapp, meta, capi, tiktok]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/whatsapp.ts", "quinchat/lib/whatsapp-contexto.ts", "quinchat/lib/whatsapp-templates.ts"]
---

# Mensajería

- **WhatsApp Cloud API**: envío de texto, plantillas y media (`quinchat/lib/whatsapp.ts`).
- **Meta CAPI**: eventos de conversión (`lib/capi.ts`, `lib/meta-capi.ts`).
- **Pixel TikTok**.

## Dos líneas

`quinchat/lib/whatsapp-contexto.ts` decide con qué número se responde:

- `funnel` — línea por defecto → [[bot-chat-funnel]]
- `ventas` → [[bot-chat-whatsapp]]

La función clave es `phoneIdActual()`.
<!-- verificado: 2026-09-04 — quinchat/lib/whatsapp-contexto.ts:33 -->

## Plantillas de Meta

- Las plantillas fuera de la ventana de 24h deben estar **aprobadas** por Meta.
- Remarketing usa categoría **MARKETING** → [[remarketing]].
- **Nunca WebP en headers de plantilla**: Meta los acepta pero no los entrega
  → [[no-webp-en-headers-de-whatsapp]].

## Antes de construir algo aquí

Avisar qué configuración o permiso hace falta en Meta (número, plantilla aprobada, token, webhook)
**antes** de que Josué gaste tiempo. Ver [[reglas-duras]].
