# CORRECCIONES V40 — Ventas más recientes primero
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-02  
**Archivos modificados:** `app.js`

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| app.js  | Se agrega `.sort()` por fecha descendente en `aplicarFiltros()` | Los pedidos nuevos subidos por Excel aparecían al final; ahora siempre se muestran los más recientes primero |

---

## Instrucciones para Claude Code

> Aplica estos cambios al proyecto ConfirmaYa: en el archivo `app.js`, dentro de la función `aplicarFiltros`, justo después de que se construye el array `filtrados` con `.filter(...)` y antes del bloque de paginación, agrega este bloque para ordenar de más reciente a más antiguo:
>
> ```js
> // Más recientes primero
> filtrados.sort((a, b) => {
>   if (!a.fechaObj && !b.fechaObj) return 0;
>   if (!a.fechaObj) return 1;
>   if (!b.fechaObj) return -1;
>   return b.fechaObj - a.fechaObj;
> });
> ```
>
> El archivo `app.js` ya está actualizado en la carpeta. Solo necesitas hacer `git add app.js` y luego `git commit -m "feat: ordenar ventas más recientes primero V40"` y `git push origin master` para publicar directo a producción.

---

## Verificación

Después de aplicar, comprueba:
- [ ] Al cargar la página, el pedido con la fecha más reciente aparece en la fila #1
- [ ] Al subir un Excel nuevo con pedidos de hoy, esos pedidos aparecen arriba
- [ ] Los filtros (Sin WA, Canceladas, Effi) siguen funcionando y también muestran los más recientes primero
