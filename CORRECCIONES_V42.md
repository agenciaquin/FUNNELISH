# CORRECCIONES V42 — Fotos productos RETRO en catálogo
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-02  
**Archivos modificados:** `catalogo.js`

---

## El problema

Las referencias RETRO (RETRO BLANCO MARFIL 1990, RETRO NEGRO 1990, etc.) no encontraban su foto porque no estaban registradas en el catálogo. Mostraban cuadro rojo (placeholder).

Adicionalmente, los archivos en la carpeta `/img` tienen dobles espacios en el nombre ("RETRO  BLANCO MARFIL 1990.jpeg"), por lo que la ruta URL usa `%20%20` para representarlos correctamente.

---

## Instrucciones para Claude Code

> El archivo `catalogo.js` ya está actualizado en la carpeta. Solo necesitas hacer `git add catalogo.js && git commit -m "fix: agregar productos RETRO al catálogo V42" && git push origin master`

---

## Verificación

- [ ] "RETRO BLANCO MARFIL 1990" muestra la foto del buzo blanco
- [ ] "RETRO NEGRO 1990" muestra la foto del buzo negro
- [ ] "RETRO AMARILLO 1990" muestra la foto del buzo amarillo
- [ ] "RETRO ROJO 1990" muestra la foto del buzo rojo
- [ ] "RETRO AMARILLO MARIPOSA CUELLO ALTO" muestra su foto
