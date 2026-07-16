# CORRECCIONES V64 — Fix: Anuladas siempre mostraba 0

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `app.js`

---

## Causa del bug

La función `getEstadoRemision()` usaba `.normalize('NFD').replace(/[̀-ͯ]/g, '')` para quitar acentos antes de buscar "remis". El rango de caracteres en esa regex puede corromperse según el encoding del editor, haciendo que nunca quitara nada y la comparación fallara silenciosamente.

**Solución:** "remisión" ya contiene "remis" como substring directo — no hace falta quitar acentos. Se elimina el normalize/replace y se usa solo `.toLowerCase()`.

---

## Instrucciones para Claude Code

```
En app.js, encuentra la función getEstadoRemision y reemplázala completa con:

      // Detecta columna "Estado remisión" para separar anuladas
      // "remisión" ya contiene "remis" como substring — sin necesidad de quitar acentos
      const getEstadoRemision = (row) => {
        for (const k of Object.keys(row)) {
          const kl = k.toLowerCase();
          if (kl.includes('estado') && kl.includes('remis')) {
            return String(row[k] || '').trim().toLowerCase();
          }
        }
        return '';
      };
```

---

## Verificación

- [ ] Subir el Excel de Effi → el alert debe decir "X normales, Y anuladas" (Y > 0)
- [ ] La stat card "Anuladas en Effi" muestra el número correcto
- [ ] Los clientes anulados muestran badge amarillo "⚠ ANULADA EN EFFI"
