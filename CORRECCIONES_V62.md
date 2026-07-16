# CORRECCIONES V62 — Anuladas en Effi: nueva stat card + badge amarillo + botón WA "Hola"

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `index.html`, `app.js`

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| app.js | Nuevo Set `effiAnuladosPhones` | Guarda los teléfonos anulados separados |
| app.js | `cargarEffiDeSupabase()` carga también `telefonos_effi_anulados` | Persiste entre sesiones |
| app.js | `procesarArchivoEffi()` detecta columna "Estado remisión" = "Anulado" | Separa automáticamente al subir Effi |
| app.js | `actualizarHeaderEffi()` muestra badge amarillo "⚠ N anuladas" en cabecera | Visibilidad del conteo |
| app.js | Badge por fila: prioridad anulada > en Effi > no confirmado | Muestra "⚠ ANULADA EN EFFI" amarillo |
| app.js | Botón WA amarillo para anuladas → envía solo "Hola" | Mensaje diferente para recuperar anuladas |
| index.html | Nueva stat card "Anuladas en Effi" (amarilla, 5ª columna) | Resumen visual del total |
| index.html | CSS `.effi-anulada`, `.btn-accion-anulada-wa`, `.effi-count-anul` | Estilos amarillos |
| index.html | `actualizarStats()` cuenta anuladas en tiempo real | Número actualizado automáticamente |

---

## ⚠️ PASO PREVIO: Crear tabla en Supabase

Antes de hacer el deploy, crea esta tabla en Supabase → SQL Editor:

```sql
create table if not exists telefonos_effi_anulados (
  telefono text primary key
);
```

---

## Instrucciones para Claude Code

```
Aplica estos cambios al proyecto ConfirmaYa en los archivos index.html y app.js:

=== APP.JS ===

1. En el estado global, después de la línea de effiPhones, agrega:
   let effiAnuladosPhones = new Set(); // teléfonos anulados en Effi

2. Reemplaza la función cargarEffiDeSupabase() completa con:

async function cargarEffiDeSupabase() {
  for (let i = 0; i < 5; i++) {
    if (dbH) break;
    await new Promise(r => setTimeout(r, 300));
    if (window.supabase?.createClient) dbH = window.supabase.createClient(SUPABASE_URL_H, SUPABASE_KEY_H);
  }
  if (!dbH) return;
  try {
    const [{ data: effiData }, { data: anulData }] = await Promise.all([
      dbH.from('telefonos_effi').select('telefono').range(0, 9999),
      dbH.from('telefonos_effi_anulados').select('telefono').range(0, 9999),
    ]);
    effiPhones         = new Set((effiData || []).map(r => tel10(r.telefono)));
    effiAnuladosPhones = new Set((anulData  || []).map(r => tel10(r.telefono)));
    window.effiPhones         = effiPhones;
    window.effiAnuladosPhones = effiAnuladosPhones;
    if (pedidos.length) { aplicarFiltros(); actualizarHeaderEffi(); }
    if (typeof window.actualizarBarraConversion === 'function') window.actualizarBarraConversion();
    if (typeof window.actualizarStats === 'function') window.actualizarStats();
  } catch(err) { console.warn('cargarEffiDeSupabase error:', err); }
}

3. En procesarArchivoEffi(), dentro del try{}, reemplaza desde "// Extrae teléfono" hasta el alert() final con:

      // Extrae teléfono: busca columna cuyo prefijo 3 ASCII sea "tel" o "cel"
      const getPhone = (row) => {
        for (const k of Object.keys(row)) {
          const p3 = k.slice(0, 3).replace(/[^a-zA-Z]/g, '').toLowerCase();
          if (p3 === 'tel' || p3 === 'cel' || p3 === 'fon' || p3 === 'pho') {
            const v = String(row[k] || '').trim();
            if (v && v.replace(/\D/g,'').length >= 7) return v;
          }
        }
        return '';
      };

      // Detecta columna "Estado remisión" para separar anuladas
      const getEstadoRemision = (row) => {
        for (const k of Object.keys(row)) {
          const kn = k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
          if (kn.includes('estado') && (kn.includes('remis') || kn.includes('remission'))) {
            return String(row[k] || '').trim().toLowerCase();
          }
        }
        return '';
      };

      const rowsAnuladas = rows.filter(r => getEstadoRemision(r) === 'anulado');
      const rowsNormales = rows.filter(r => getEstadoRemision(r) !== 'anulado');

      const telefonosAnulados = [...new Set(
        rowsAnuladas.map(r => tel10(getPhone(r))).filter(t => t.length === 10)
      )];
      const telefonos = [...new Set(
        rowsNormales.map(r => tel10(getPhone(r))).filter(t => t.length === 10)
      )];

      if (!telefonos.length && !telefonosAnulados.length) {
        alert('No se encontraron teléfonos en el archivo Effi.'); return;
      }

      // Guardar teléfonos normales
      if (dbH && telefonos.length) {
        const { data: exist } = await dbH.from('telefonos_effi').select('telefono').in('telefono', telefonos);
        const existSet = new Set((exist || []).map(r => r.telefono));
        const nuevos   = telefonos.filter(t => !existSet.has(t)).map(t => ({ telefono: t }));
        for (let i = 0; i < nuevos.length; i += 500) {
          await dbH.from('telefonos_effi').insert(nuevos.slice(i, i + 500));
        }
      }

      // Guardar teléfonos anulados en tabla separada
      if (dbH && telefonosAnulados.length) {
        const { data: existA } = await dbH.from('telefonos_effi_anulados').select('telefono').in('telefono', telefonosAnulados);
        const existSetA = new Set((existA || []).map(r => r.telefono));
        const nuevosA   = telefonosAnulados.filter(t => !existSetA.has(t)).map(t => ({ telefono: t }));
        for (let i = 0; i < nuevosA.length; i += 500) {
          await dbH.from('telefonos_effi_anulados').insert(nuevosA.slice(i, i + 500));
        }
      }

      telefonos.forEach(t => effiPhones.add(t));
      telefonosAnulados.forEach(t => effiAnuladosPhones.add(t));
      window.effiPhones         = effiPhones;
      window.effiAnuladosPhones = effiAnuladosPhones;
      aplicarFiltros();
      actualizarHeaderEffi();
      if (typeof window.actualizarBarraConversion === 'function') window.actualizarBarraConversion();
      if (typeof window.actualizarStats === 'function') window.actualizarStats();
      alert(`✅ Effi actualizado: ${telefonos.length} normales, ${telefonosAnulados.length} anuladas.`);

4. Reemplaza actualizarHeaderEffi() con:

function actualizarHeaderEffi() {
  const th = document.getElementById("th-effi");
  if (!th || (effiPhones.size === 0 && effiAnuladosPhones.size === 0)) return;
  const enEffi   = pedidos.filter(p => effiPhones.has(tel10(p.telefonoWhatsApp))).length;
  const anuladas = pedidos.filter(p => effiAnuladosPhones.has(tel10(p.telefonoWhatsApp))).length;
  const pend     = pedidos.filter(p => !effiPhones.has(tel10(p.telefonoWhatsApp)) && !effiAnuladosPhones.has(tel10(p.telefonoWhatsApp))).length;
  th.innerHTML = `Estado Effi / Remarketing
    <div class="effi-header-counts">
      <span class="effi-count effi-count-conf">✓ ${enEffi} en Effi</span>
      ${anuladas > 0 ? `<span class="effi-count effi-count-anul">⚠ ${anuladas} anuladas</span>` : ''}
      <span class="effi-count effi-count-pend">⏳ ${pend} pendientes</span>
    </div>`;
}

5. En la celda td-col-effi de renderizarTabla(), reemplaza el bloque que genera el badge de Effi con:

        ${(effiPhones.size > 0 || effiAnuladosPhones.size > 0) ? (() => {
          const t = tel10(p.telefonoWhatsApp);
          const esAnulada = effiAnuladosPhones.has(t);
          const esEnEffi  = effiPhones.has(t);
          const waIcon = `<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
          if (esAnulada) return `
        <div class="accion-grupo effi-grupo">
          <span class="badge-effi effi-anulada">⚠ ANULADA EN EFFI</span>
          <button class="btn-accion btn-accion-anulada-wa" data-id="${p.id}" title="Enviar Hola" aria-label="WA Anulada">${waIcon}</button>
        </div>`;
          if (esEnEffi) return `
        <div class="accion-grupo effi-grupo">
          <span class="badge-effi effi-confirmada">✓ EFFI</span>
          <button class="btn-accion btn-accion-remarketing" data-id="${p.id}" title="Enviar remarketing" aria-label="Remarketing WA">${waIcon}</button>
        </div>`;
          return `
        <div class="accion-grupo effi-grupo">
          <span class="badge-effi effi-pendiente">⏳ no confirmado</span>
          <button class="btn-accion btn-accion-remarketing" data-id="${p.id}" title="Enviar remarketing" aria-label="Remarketing WA">${waIcon}</button>
        </div>`;
        })() : '<span style="font-size:0.65rem;color:rgba(255,255,255,0.2)">—</span>'}

6. En el bloque de event listeners de renderizarTabla(), después de los listeners de btn-accion-remarketing, agrega:

  tbody.querySelectorAll(".btn-accion-anulada-wa").forEach(btn => {
    btn.addEventListener("click", () => abrirWhatsAppAnulada(Number(btn.dataset.id)));
  });

7. Agrega esta función nueva (junto a las otras funciones de WhatsApp):

function abrirWhatsAppAnulada(id) {
  const p = pedidos[id];
  if (!p) return;
  const url = "whatsapp://send?phone=" + p.telefonoWhatsApp + "&text=" + encodeURIComponent("Hola");
  window.open(url, "_self");
}

=== INDEX.HTML ===

8. En .stats-bar, cambia grid-template-columns a repeat(5, 1fr)

9. Agrega estos estilos CSS:
   .stat-tile.s-anuladas .stat-tile-val { color: #EAB308; }
   .stat-tile.s-anuladas { border-color: rgba(234,179,8,0.2); }
   .effi-anulada { background: rgba(234,179,8,0.18); border: 1px solid rgba(234,179,8,0.5); color: #EAB308; font-weight: 800; }
   .effi-count-anul { background: rgba(234,179,8,0.15); color: #EAB308; border: 1px solid rgba(234,179,8,0.3); font-weight: 800; }
   .btn-accion-anulada-wa { background: rgba(234,179,8,0.18); border: 1px solid rgba(234,179,8,0.55); color: #EAB308 !important; }
   .btn-accion-anulada-wa:hover { background: rgba(234,179,8,0.32) !important; }

10. En la stats-bar del HTML, agrega una 5ª tarjeta después de Cancelados:
    <div class="stat-tile s-anuladas">
      <div class="stat-tile-val" id="stat-anuladas">0</div>
      <div class="stat-tile-lbl">Anuladas en Effi</div>
    </div>

11. En la función actualizarStats() del script inline, agrega el conteo de anuladas:
    const aSet = window.effiAnuladosPhones || new Set();
    const anuladas = aSet.size > 0
      ? arr.filter(p => aSet.has((p.telefonoWhatsApp||'').replace(/^57/,''))).length
      : 0;
    document.getElementById('stat-anuladas').textContent = anuladas;
    
    Y expón la función: window.actualizarStats = actualizarStats;
```

---

## Verificación

Después de aplicar:
- [ ] Crear tabla `telefonos_effi_anulados` en Supabase (SQL arriba)
- [ ] Subir el Excel de Effi → el alert debe decir "X normales, Y anuladas"
- [ ] Clientes anulados muestran badge amarillo "⚠ ANULADA EN EFFI"
- [ ] El botón WA amarillo de anuladas abre WhatsApp con solo "Hola"
- [ ] La stat card "Anuladas en Effi" muestra el número correcto
- [ ] La cabecera de la columna muestra "⚠ N anuladas" en amarillo
- [ ] Clientes normales de Effi siguen mostrando "✓ EFFI" en azul
