# CORRECCIONES V66 — Fix definitivo: detección de anuladas por valor, no por nombre de columna

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `app.js`

---

## Causa del bug

`getEstadoRemision()` buscaba la columna por nombre ("Estado remisión"), pero SheetJS puede leer el HTML-XLS con un nombre de columna diferente al esperado (espacios extra, encoding distinto, etc.). Por eso siempre retornaba `''` y 0 filas quedaban como anuladas.

**Solución:** buscar el valor "anulado" directamente en cualquier celda de la fila. Es más robusto porque no depende del nombre exacto de la columna.

---

## Instrucciones para Claude Code

```
En app.js, dentro de procesarArchivoEffi(), reemplaza el bloque de detección de anuladas con:

      // Detecta filas anuladas buscando el valor exacto "anulado" en cualquier celda
      // (más robusto que buscar por nombre de columna, que puede variar entre versiones del Excel)
      const esAnulado = (row) =>
        Object.values(row).some(v => String(v || '').trim().toLowerCase() === 'anulado');

      const rowsAnuladas = rows.filter(r => esAnulado(r));
      const rowsNormales = rows.filter(r => !esAnulado(r));

Elimina la función getEstadoRemision anterior y sus referencias.
```

---

## Verificación

- [ ] Subir el Excel de Effi → el alert debe decir "X normales, Y anuladas" (Y > 0)
- [ ] La stat card "Anuladas en Effi" muestra el número correcto
- [ ] Clientes anulados muestran badge amarillo "⚠ ANULADA EN EFFI"
