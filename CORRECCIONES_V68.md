# CORRECCIONES V68 — Fix: anulados que no son vigentes ya no muestran "ANULADA + VIGENTE"

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `app.js`

---

## Causa del bug

Un teléfono podía estar en AMBAS tablas de Supabase (`telefonos_effi` y `telefonos_effi_anulados`) si en una carga anterior era vigente y en una carga posterior aparece anulado. La lógica de display lo marcaba como "ANULADA + VIGENTE" aunque en el Excel actual fuera solo anulado.

## Solución

Al subir un nuevo Excel de Effi, se clasifican los teléfonos y se limpia el cruce:

- **Solo anulados** (no aparecen como vigentes en este Excel) → se eliminan de `telefonos_effi` → muestran ⚠ ANULADA EN EFFI
- **Solo vigentes** (no aparecen como anulados en este Excel) → se eliminan de `telefonos_effi_anulados` → muestran ✓ EFFI
- **En ambos** (mismo Excel tiene filas vigente Y anulado para ese teléfono) → se mantienen en las dos tablas → muestran 🔄 ANULADA + VIGENTE

---

## Instrucciones para Claude Code

```
En app.js, dentro de procesarArchivoEffi(), reemplaza el bloque desde
"if (!telefonos.length && !telefonosAnulados.length)" hasta antes de
"telefonos.forEach(t => effiPhones.add(t))" con:

      if (!telefonos.length && !telefonosAnulados.length) {
        alert('No se encontraron teléfonos en el archivo Effi.'); return;
      }

      // Clasificar: solo-anulados, solo-vigentes, ambos (ANULADA + VIGENTE)
      const setAnulados = new Set(telefonosAnulados);
      const setVigentes = new Set(telefonos);
      const soloAnulados = telefonosAnulados.filter(t => !setVigentes.has(t));
      const soloVigentes = telefonos.filter(t => !setAnulados.has(t));

      // Solo-anulados: sacar de effi (ya no son vigentes)
      if (dbH && soloAnulados.length) {
        for (let i = 0; i < soloAnulados.length; i += 500) {
          await dbH.from('telefonos_effi').delete().in('telefono', soloAnulados.slice(i, i + 500));
        }
        soloAnulados.forEach(t => effiPhones.delete(t));
      }

      // Solo-vigentes: sacar de effi_anulados (ya no están anulados)
      if (dbH && soloVigentes.length) {
        for (let i = 0; i < soloVigentes.length; i += 500) {
          await dbH.from('telefonos_effi_anulados').delete().in('telefono', soloVigentes.slice(i, i + 500));
        }
        soloVigentes.forEach(t => effiAnuladosPhones.delete(t));
      }

      // Guardar teléfonos normales (vigentes)
      if (dbH && telefonos.length) {
        const { data: exist } = await dbH.from('telefonos_effi').select('telefono').in('telefono', telefonos);
        const existSet = new Set((exist || []).map(r => r.telefono));
        const nuevos   = telefonos.filter(t => !existSet.has(t)).map(t => ({ telefono: t }));
        for (let i = 0; i < nuevos.length; i += 500) {
          await dbH.from('telefonos_effi').insert(nuevos.slice(i, i + 500));
        }
      }

      // Guardar teléfonos anulados
      if (dbH && telefonosAnulados.length) {
        const { data: existA } = await dbH.from('telefonos_effi_anulados').select('telefono').in('telefono', telefonosAnulados);
        const existSetA = new Set((existA || []).map(r => r.telefono));
        const nuevosA   = telefonosAnulados.filter(t => !existSetA.has(t)).map(t => ({ telefono: t }));
        for (let i = 0; i < nuevosA.length; i += 500) {
          await dbH.from('telefonos_effi_anulados').insert(nuevosA.slice(i, i + 500));
        }
      }
```

---

## ⚠️ IMPORTANTE: Limpiar tablas en Supabase antes de subir de nuevo

Como hay datos incorrectos en Supabase (teléfonos cruzados entre tablas), ejecuta este SQL primero:

```sql
TRUNCATE TABLE telefonos_effi;
TRUNCATE TABLE telefonos_effi_anulados;
```

Luego sube el Excel de Effi nuevamente para repoblar con los datos correctos.

---

## Verificación

- [ ] Ejecutar SQL de limpieza en Supabase
- [ ] Subir Excel de Effi → el alert muestra "X normales, Y anuladas"
- [ ] Clientes que solo están anulados muestran ⚠ ANULADA EN EFFI (amarillo)
- [ ] Clientes que tienen filas vigente Y anulada en el mismo Excel muestran 🔄 ANULADA + VIGENTE (púrpura)
- [ ] Clientes vigentes muestran ✓ EFFI (azul)
