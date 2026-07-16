# CORRECCIONES V69 — Filtro "Anuladas en Effi" excluye las que volvieron

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `app.js`

---

## Cambio

En `aplicarFiltros()`, el filtro `modoAnuladas` ahora solo muestra clientes que están
en `effiAnuladosPhones` pero NO en `effiPhones` (es decir, solo los que siguen anulados
y nunca volvieron a subirse como vigentes).

---

## Instrucciones para Claude Code

```
En app.js, en aplicarFiltros(), reemplaza:

    // Filtro Anuladas en Effi: solo los que están en effiAnuladosPhones
    if (modoAnuladas && !effiAnuladosPhones.has(tel10(p.telefonoWhatsApp))) return false;

Con:

    // Filtro Anuladas en Effi: solo puras anuladas (NO las que también son vigentes "volvieron")
    if (modoAnuladas) {
      const t = tel10(p.telefonoWhatsApp);
      if (!effiAnuladosPhones.has(t) || effiPhones.has(t)) return false;
    }
```

---

## Verificación

- [ ] El botón "⚠ Anuladas en Effi" muestra SOLO clientes con badge amarillo "⚠ ANULADA EN EFFI"
- [ ] Los clientes "🔄 ANULADA + VIGENTE" NO aparecen en ese filtro
