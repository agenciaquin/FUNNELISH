# CORRECCIONES V50 — Filtro de fechas en Billetera QUINO
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-04  
**Archivos modificados:** `billetera.html`, `billetera.js`

---

## Qué se agrega

Filtro Desde / Hasta en la Billetera QUINO para filtrar remisiones por fecha de creación.

- Los inputs de fecha aparecen debajo de los botones Todos / Entregados / Pendientes / Devueltos.
- El filtro de fechas se combina con el filtro de categoría (puedes ver solo "Pendientes" de una semana concreta).
- El botón "✕ Limpiar fechas" reinicia los dos inputs.

---

## PASO ÚNICO — Claude Code

```
git add billetera.html billetera.js && git commit -m "feat: filtro de fechas en billetera QUINO V50" && git push origin master
```

---

## Verificación

- [ ] Aparecen los campos Desde / Hasta debajo de los filtros
- [ ] Al seleccionar una fecha Desde, la tabla filtra correctamente
- [ ] Al seleccionar Desde + Hasta, solo aparecen registros de ese rango
- [ ] El botón Limpiar fechas borra los inputs y muestra todos los registros
- [ ] El filtro de fechas se combina con Entregados / Pendientes / Devueltos
