# CORRECCIONES V60 — Barra de conversión en Confirmación de pedidos
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-11  
**Archivos modificados:** `index.html`, `app.js`

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| `index.html` | CSS + HTML de la barra de conversión | Nueva sección visual entre stats tiles y tabla |
| `index.html` | `actualizarStats()` llama a `actualizarBarraConversion()` | Sincronizar barra con cambios de estado |
| `index.html` | Nueva función `actualizarBarraConversion()` | Calcula deduplicado por tel+fecha y renderiza porcentajes |
| `app.js` | `window.effiPhones = effiPhones` en `cargarEffiDeSupabase` y `procesarArchivoEffi` | Exponer effiPhones al script inline de index.html |

---

## Qué se agregó

**Barra de conversión** entre los 4 stat tiles y la tabla de pedidos:

- 🟠 **% Confirmadas en Effi** — clientes que ya aparecen en el reporte Effi
- 🟡 **% Pendiente por confirmar** — clientes que NO están en Effi y no cancelaron
- ⚫ **% Canceladas** — clientes con estado Cancelado

**Deduplicación:** mismo teléfono + misma fecha = 1 cliente único.
Si la misma persona compró el día X 3 veces → suma 1 en las estadísticas.
Si compró el día X y el día Y → suma 2 (son compras diferentes).

La barra se actualiza automáticamente al:
- Cambiar el estado de un pedido
- Subir un nuevo Excel de Funnelish
- Subir un nuevo reporte Effi

---

## PASO ÚNICO — Claude Code

```
git add index.html app.js && git commit -m "feat: barra conversion deduplicada confirmacion V60" && git push origin master
```

---

## Verificación

- [ ] La barra aparece entre los stat tiles y la barra de filtros
- [ ] Los 3 segmentos (naranja/amarillo/gris) muestran porcentajes correctos
- [ ] El total dice "N clientes únicos"
- [ ] Si la misma persona tiene 3 pedidos el mismo día → cuenta como 1
- [ ] Si un cliente compró en distintas fechas → cuenta como N compras separadas
- [ ] Al subir Effi la barra se actualiza automáticamente
- [ ] Los estados existentes (confirmados, cancelados, mensajes enviados) no se borran
