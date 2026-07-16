# CORRECCIONES V45 — Nuevo mensaje de confirmación (Santiago + datos en MAYÚSCULAS)
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-03  
**Archivos modificados:** `app.js`

---

## Qué cambia

- Saludo actualizado: "Hola, te saluda Santiago..."
- Campos en formato WhatsApp bold: `*NOMBRE:*`, `*TELEFONO:*`, etc.
- Todos los datos del cliente se envían en MAYÚSCULAS
- Texto de cierre actualizado: "escribeme: CONFIRMO" / "escribeme cual seria"

---

## Instrucciones para Claude Code

> El archivo `app.js` ya está actualizado en la carpeta. Solo necesitas hacer:
> `git add app.js && git commit -m "feat: nuevo mensaje confirmación Santiago + mayúsculas V45" && git push origin master`

---

## Verificación

- [ ] Abrir el detalle de un cliente (👁) y ver que el mensaje usa el nuevo formato
- [ ] Confirmar que los datos del cliente aparecen en MAYÚSCULAS
- [ ] Confirmar que los campos tienen asteriscos para negrita en WhatsApp
