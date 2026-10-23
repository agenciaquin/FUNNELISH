---
tipo: modulo
titulo: Imágenes — compresión y formatos
tags: [imagenes, compresion, whatsapp, next]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/imagen-comprimir.ts", "quinchat/lib/funnels.ts"]
---

# Imágenes

## Compresión

`quinchat/lib/imagen-comprimir.ts` comprime **en el navegador**, al subir.

| Caso | Formato |
|---|---|
| Fotos y headers de WhatsApp | JPG |
| Necesita transparencia | PNG (se conserva) |
| Headers de plantilla de WhatsApp | **nunca WebP** → [[no-webp-en-headers-de-whatsapp]] |

## Servido en embudos

`imgOptim()` en `quinchat/lib/funnels.ts` sirve la imagen **original**.
El optimizador `/_next/image` rompió producción y quedó **desactivado**
→ [[optimizador-de-imagenes-desactivado]].

Almacenamiento → [[almacenamiento-r2]]. Uso en el bot → [[catalogos]].
