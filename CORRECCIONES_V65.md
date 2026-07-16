# CORRECCIONES V65 — Nuevo estado "ANULADA + VIGENTE" para clientes que volvieron

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `app.js`, `index.html`

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| app.js | Nueva condición `esVolvio` en `renderizarTabla()` | Detecta cuando el teléfono está en AMBAS listas (anulada Y vigente) |
| app.js | `actualizarHeaderEffi()` muestra contador "🔄 N volvieron" | Visibilidad del caso en cabecera de columna |
| index.html | CSS `.effi-volvio` (púrpura) | Badge distintivo para el caso "volvió" |
| index.html | CSS `.effi-count-volvio` (púrpura) | Contador púrpura en cabecera de columna |

---

## Lógica de prioridad en columna Effi (de mayor a menor):

1. 🔄 **ANULADA + VIGENTE** (púrpura) — teléfono en AMBAS listas → botón remarketing normal
2. ⚠ **ANULADA EN EFFI** (amarillo) — solo en lista de anuladas → botón "Hola"
3. ✓ **EFFI** (azul) — solo en lista vigente → botón remarketing
4. ⏳ **no confirmado** (naranja) — en ninguna lista → botón remarketing

---

## Instrucciones para Claude Code

```
Aplica estos cambios al proyecto ConfirmaYa en app.js e index.html:

=== APP.JS ===

1. En renderizarTabla(), en el bloque que genera el badge Effi (td-col-effi),
   agrega `esVolvio` y ponlo como primera prioridad:

   ANTES (primeras líneas del bloque):
   const t = tel10(p.telefonoWhatsApp);
   const esAnulada = effiAnuladosPhones.has(t);
   const esEnEffi  = effiPhones.has(t);
   const waIcon = `...`;
   if (esAnulada) return `...ANULADA EN EFFI...`;

   DESPUÉS:
   const t = tel10(p.telefonoWhatsApp);
   const esAnulada = effiAnuladosPhones.has(t);
   const esEnEffi  = effiPhones.has(t);
   const esVolvio  = esAnulada && esEnEffi; // se anuló antes pero volvió como vigente
   const waIcon = `...`;
   if (esVolvio) return `
     <div class="accion-grupo effi-grupo">
       <span class="badge-effi effi-volvio">🔄 ANULADA + VIGENTE</span>
       <button class="btn-accion btn-accion-remarketing" data-id="${p.id}" title="Enviar remarketing" aria-label="Remarketing WA">${waIcon}</button>
     </div>`;
   if (esAnulada) return `...` // igual que antes

2. Reemplaza actualizarHeaderEffi() completa con:

function actualizarHeaderEffi() {
  const th = document.getElementById("th-effi");
  if (!th || (effiPhones.size === 0 && effiAnuladosPhones.size === 0)) return;
  const enEffi    = pedidos.filter(p => { const t = tel10(p.telefonoWhatsApp); return effiPhones.has(t) && !effiAnuladosPhones.has(t); }).length;
  const anuladas  = pedidos.filter(p => { const t = tel10(p.telefonoWhatsApp); return effiAnuladosPhones.has(t) && !effiPhones.has(t); }).length;
  const volvieron = pedidos.filter(p => { const t = tel10(p.telefonoWhatsApp); return effiAnuladosPhones.has(t) && effiPhones.has(t); }).length;
  const pend      = pedidos.filter(p => { const t = tel10(p.telefonoWhatsApp); return !effiPhones.has(t) && !effiAnuladosPhones.has(t); }).length;
  th.innerHTML = `Estado Effi / Remarketing
    <div class="effi-header-counts">
      <span class="effi-count effi-count-conf">✓ ${enEffi} en Effi</span>
      ${volvieron > 0 ? `<span class="effi-count effi-count-volvio">🔄 ${volvieron} volvieron</span>` : ''}
      ${anuladas  > 0 ? `<span class="effi-count effi-count-anul">⚠ ${anuladas} anuladas</span>` : ''}
      <span class="effi-count effi-count-pend">⏳ ${pend} pendientes</span>
    </div>`;
}

=== INDEX.HTML ===

3. Después de la línea `.effi-anulada { ... }`, agrega:
   .effi-volvio { background: rgba(168,85,247,0.18); border: 1px solid rgba(168,85,247,0.5); color: #A855F7; font-weight: 800; }

4. Después de la línea `.effi-count-anul { ... }`, agrega:
   .effi-count-volvio { background: rgba(168,85,247,0.15); color: #A855F7; border: 1px solid rgba(168,85,247,0.3); font-weight: 800; }
```

---

## Verificación

- [ ] Un cliente que estaba anulado y se volvió a subir muestra badge púrpura "🔄 ANULADA + VIGENTE"
- [ ] La cabecera de columna Effi muestra "🔄 N volvieron" en púrpura cuando hay casos
- [ ] Los conteos de "en Effi" y "anuladas" en la cabecera ya NO incluyen los "volvieron"
- [ ] El botón WA de "ANULADA + VIGENTE" usa el mensaje de remarketing normal (no "Hola")
- [ ] Los clientes solo-anulados siguen mostrando badge amarillo con botón "Hola"
