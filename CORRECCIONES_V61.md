# CORRECCIONES V61 — Renombrar etiquetas y botones para mayor claridad

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `index.html`, `app.js`

---

## Resumen de cambios

| Archivo | Qué cambió | Por qué |
|---------|-----------|---------|
| index.html | Stat card "Total pedidos" → "Total pedidos en Funnelish" | Más descriptivo para el trabajador |
| index.html | Stat card "Pendientes" → "Pendiente sin mensaje de WhatsApp" | Aclara qué significa "pendiente" |
| index.html | Stat card "Confirmados" → "Mensaje de WhatsApp enviado" | Refleja la acción real: enviar WA = confirmar |
| index.html | Filtro naranja "Pendientes por confirmar" → "Pendiente sin mensaje de WhatsApp" | Consistente con el stat card |
| app.js | Badge Effi por fila "⏳ PENDIENTE" → "⏳ no confirmado" | Más claro: este cliente no está confirmado en Effi |

---

## Instrucciones para Claude Code

> Aplica estos cambios al proyecto ConfirmaYa en los archivos `index.html` y `app.js`:
>
> **En index.html:**
> 1. El texto del stat card de "Total pedidos" cámbialo a "Total pedidos en Funnelish"
> 2. El texto del stat card amarillo (id="stat-pendiente") cámbialo de "Pendientes" a "Pendiente sin mensaje de WhatsApp"
> 3. El texto del stat card verde (id="stat-confirmado") cámbialo de "Confirmados" a "Mensaje de WhatsApp enviado"
> 4. El botón con id="btn-pendientes-effi" cámbialo de "⏳ Pendientes por confirmar" a "⏳ Pendiente sin mensaje de WhatsApp"
>
> **En app.js:**
> 5. En la línea que genera el badge-effi, donde dice `'⏳ PENDIENTE'` (el texto para cuando el cliente NO está en Effi), cámbialo a `'⏳ no confirmado'`

---

## Código exacto de los cambios

### `index.html` — Sección Stats Bar (líneas ~462-479)

```html
<!-- Stats Bar (visible cuando hay datos) -->
<div id="stats-bar" class="stats-bar">
  <div class="stat-tile s-total">
    <div class="stat-tile-val" id="stat-total">0</div>
    <div class="stat-tile-lbl">Total pedidos en Funnelish</div>
  </div>
  <div class="stat-tile s-pendiente">
    <div class="stat-tile-val" id="stat-pendiente">0</div>
    <div class="stat-tile-lbl">Pendiente sin mensaje de WhatsApp</div>
  </div>
  <div class="stat-tile s-confirmado">
    <div class="stat-tile-val" id="stat-confirmado">0</div>
    <div class="stat-tile-lbl">Mensaje de WhatsApp enviado</div>
  </div>
  <div class="stat-tile s-cancelado">
    <div class="stat-tile-val" id="stat-cancelado">0</div>
    <div class="stat-tile-lbl">Cancelados</div>
  </div>
</div>
```

### `index.html` — Botón filtro naranja (línea ~532)

```html
<button type="button" id="btn-pendientes-effi" class="btn-pendientes-effi">⏳ Pendiente sin mensaje de WhatsApp</button>
```

### `app.js` — Badge Effi por fila (línea ~511)

**Antes:**
```js
<span class="badge-effi ${effiPhones.has(tel10(p.telefonoWhatsApp)) ? 'effi-confirmada' : 'effi-pendiente'}">${effiPhones.has(tel10(p.telefonoWhatsApp)) ? '✓ EFFI' : '⏳ PENDIENTE'}</span>
```

**Después:**
```js
<span class="badge-effi ${effiPhones.has(tel10(p.telefonoWhatsApp)) ? 'effi-confirmada' : 'effi-pendiente'}">${effiPhones.has(tel10(p.telefonoWhatsApp)) ? '✓ EFFI' : '⏳ no confirmado'}</span>
```

---

## Verificación

Después de aplicar, comprueba:
- [ ] Las 4 stat cards muestran los nuevos textos al cargar un Excel
- [ ] El filtro naranja dice "⏳ Pendiente sin mensaje de WhatsApp"
- [ ] En la columna Effi, los clientes no subidos muestran "⏳ no confirmado" (en naranja)
- [ ] Los clientes que sí están en Effi siguen mostrando "✓ EFFI" (en azul)
