# CORRECCIONES V67 — Botón filtro "Anuladas en Effi"

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `app.js`, `index.html`

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| app.js | Nueva variable `modoAnuladas` | Estado del filtro |
| app.js | Lógica en `aplicarFiltros()` para filtrar anuladas | Solo muestra clientes en effiAnuladosPhones |
| app.js | Listener en `initBuscar()` para `btn-ver-anuladas` | Activa/desactiva el filtro |
| app.js | `limpiarTodosLosFiltros()` resetea `modoAnuladas` | Consistencia con limpiar filtro |
| index.html | Botón `⚠ Anuladas en Effi` en toolbar | Acceso rápido al filtro |
| index.html | CSS `.btn-ver-anuladas` en amarillo | Identidad visual del estado anulada |

---

## Instrucciones para Claude Code

```
Aplica estos cambios al proyecto ConfirmaYa en app.js e index.html:

=== APP.JS ===

1. En el estado global, después de modoPendientesEffi agrega:
   let modoAnuladas = false; // solo muestra clientes anulados en Effi

2. En limpiarTodosLosFiltros(), agrega:
   modoAnuladas = false;
   document.getElementById("btn-ver-anuladas")?.classList.remove("active");

3. En aplicarFiltros(), después del bloque modoPendientesEffi agrega:
   // Filtro Anuladas en Effi: solo los que están en effiAnuladosPhones
   if (modoAnuladas && !effiAnuladosPhones.has(tel10(p.telefonoWhatsApp))) return false;

4. En initBuscar(), después del listener de btn-ver-canceladas agrega:
   document.getElementById("btn-ver-anuladas")?.addEventListener("click", () => {
     modoAnuladas = !modoAnuladas;
     if (modoAnuladas) { modoSinWA = false; modoCanceladas = false; modoPendientesEffi = false; }
     document.getElementById("btn-ver-anuladas").classList.toggle("active", modoAnuladas);
     document.getElementById("btn-sin-wa").classList.remove("active");
     document.getElementById("btn-ver-canceladas").classList.remove("active");
     document.getElementById("btn-ver-canceladas").textContent = "🗑 Canceladas";
     document.getElementById("btn-pendientes-effi")?.classList.remove("active");
     aplicarFiltros();
   });

5. En el listener de btn-ver-canceladas, agrega dentro del if(modoCanceladas):
   modoAnuladas = false;
   Y después: document.getElementById("btn-ver-anuladas")?.classList.remove("active");

=== INDEX.HTML ===

6. Agrega este CSS antes de .btn-ver-canceladas:
   .btn-ver-anuladas {
     background: rgba(234,179,8,0.10); border: 1px solid rgba(234,179,8,0.35);
     color: #EAB308; border-radius: 20px; padding: 0.35rem 0.9rem;
     font-size: 0.7rem; font-weight: 600; cursor: pointer; transition: all 0.18s;
     display: inline-flex; align-items: center; gap: 0.3rem;
   }
   .btn-ver-anuladas:hover { background: rgba(234,179,8,0.20); transform: translateY(-1px); }
   .btn-ver-anuladas.active {
     background: rgba(234,179,8,0.22); border-color: rgba(234,179,8,0.7);
     box-shadow: 0 0 0 2px rgba(234,179,8,0.2), 0 2px 10px rgba(234,179,8,0.15);
   }

7. En la toolbar-right, antes del btn-ver-canceladas agrega:
   <button type="button" id="btn-ver-anuladas" class="btn-ver-anuladas">⚠ Anuladas en Effi</button>
```

---

## Verificación

- [ ] El botón "⚠ Anuladas en Effi" aparece en la barra de filtros (amarillo)
- [ ] Al hacer clic muestra solo los clientes anulados (badge ⚠ ANULADA EN EFFI o 🔄 ANULADA + VIGENTE)
- [ ] Al hacer clic de nuevo desactiva el filtro
- [ ] "Limpiar filtro" también lo desactiva
- [ ] Es mutuamente exclusivo con los demás filtros
