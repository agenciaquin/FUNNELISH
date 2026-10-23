---
tipo: decision
titulo: Nunca WebP en headers de plantilla de WhatsApp
tags: [decision, whatsapp, imagenes, meta]
actualizado: 2026-09-04
estado: vigente
---

# Decisión: nunca WebP en headers de plantilla

**Contexto.** Los headers de imagen de las plantillas de Meta se suben desde el panel, que comprime
las imágenes en el navegador → [[imagenes]].

**Problema.** Meta **acepta** un WebP sin error, pero **no lo entrega** al cliente. Falla silencioso:
la plantilla sale sin imagen y nada en el log lo delata.

**Decisión.** Header de plantilla siempre en **JPG** (PNG solo si necesita transparencia).
Nunca WebP.

**Consecuencias.** `lib/imagen-comprimir.ts` fuerza JPG para fotos y headers.
Cualquier cambio en la compresión debe respetar esto → [[remarketing]], [[whatsapp-cloud-api]].
