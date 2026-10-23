---
tipo: arquitectura
titulo: Almacenamiento de medios (Cloudflare R2)
tags: [r2, cloudflare, media, imagenes]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/r2.ts"]
---

# Cloudflare R2

- Bucket público: `https://pub-8499fdbc1c274674b1ce7274b4865d43.r2.dev`
- Firma **SigV4** en `quinchat/lib/r2.ts`.
- **Respaldo:** Supabase Storage, bucket `chat-media`.

Ahí viven: fotos de producto del catálogo, medios del chat, imágenes de los embudos y headers de
plantillas de WhatsApp.

Reglas de formato y compresión → [[imagenes]].
Uso desde el bot (token `[[FOTO]]url`) → [[tokens-del-bot]].
