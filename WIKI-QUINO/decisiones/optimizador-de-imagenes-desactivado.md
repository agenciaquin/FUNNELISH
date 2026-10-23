---
tipo: decision
titulo: Optimizador /_next/image desactivado en embudos
tags: [decision, imagenes, next, embudos]
actualizado: 2026-09-04
estado: vigente
---

# Decisión: servir la imagen original en los embudos

**Contexto.** Las páginas públicas de embudo (`app/p/[slug]`) muestran muchas imágenes
→ [[embudos]].

**Problema.** El optimizador de imágenes de Next (`/_next/image`) **rompió producción**.

**Decisión.** `imgOptim()` en `quinchat/lib/funnels.ts` devuelve la **imagen original**; el
optimizador queda desactivado. La optimización se hace **antes**, al subir, comprimiendo en el
navegador → [[imagenes]].

**Consecuencias.**
- No reactivar `/_next/image` sin una prueba real en producción de un embudo con muchas fotos.
- El peso de las imágenes depende de la compresión de subida: si alguien sube sin comprimir, el
  embudo se pone lento y no hay red de seguridad.
