# CORRECCIONES V63 — Rediseño visual: iconos en stat cards, botones pill, sidebar premium

**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `index.html`

---

## Resumen de cambios

| Elemento | Antes | Después |
|---------|-------|---------|
| Stat cards | Solo número + texto | Icono circular de color + número + texto |
| Filtros | Botones cuadrados | Botones tipo pill (border-radius: 20px) con efecto hover |
| Sidebar logo | 30px cuadrado, fondo blanco | 42px, más prominente, sombra dorada |
| Sidebar brand | Sin acento | Fondo con gradiente dorado sutil + texto "KLIXMANT" en dorado |
| Header | Borde gris | Borde dorado sutil + gradiente descendente |
| Botones header | Cuadrados | Pill con sombra y hover mejorado |

---

## Instrucciones para Claude Code

```
Aplica este rediseño visual a index.html manteniendo el negro/dorado de KLIXMANT:

1. SIDEBAR — cambiar .sidebar, .sb-brand, .sb-logo y .sb-sub:
   - Ancho: 228px
   - .sb-brand: border-bottom: 1px solid rgba(201,168,76,0.12); background: linear-gradient(180deg, rgba(201,168,76,0.04) 0%, transparent 100%);
   - .sb-logo: width:42px; height:42px; border-radius:10px; box-shadow: 0 2px 12px rgba(201,168,76,0.2);
   - .sb-sub: color: #C9A84C; font-weight: 600;

2. PAGE HEADER — .page-hdr:
   - border-bottom: 1px solid rgba(201,168,76,0.12)
   - background: linear-gradient(180deg, rgba(201,168,76,0.02) 0%, transparent 100%)

3. STAT CARDS — cambiar HTML y CSS:

   HTML: Cada stat-tile ahora tiene icono + body:
   <div class="stat-tile s-total">
     <div class="stat-ico-wrap st-total-ico">🛍️</div>
     <div class="stat-tile-body">
       <div class="stat-tile-val" id="stat-total">0</div>
       <div class="stat-tile-lbl">Total pedidos en Funnelish</div>
     </div>
   </div>
   (repetir para cada card con sus iconos: ⏱️ pendiente, 💬 confirmado, 🚫 cancelado, ⚠️ anuladas)

   CSS nuevos:
   .stat-tile { display: flex; align-items: center; gap: 0.875rem; border-radius: 14px; }
   .stat-ico-wrap { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0; }
   .st-total-ico      { background: rgba(255,255,255,0.07); }
   .st-pendiente-ico  { background: rgba(234,179,8,0.14); }
   .st-confirmado-ico { background: rgba(34,197,94,0.14); }
   .st-cancelado-ico  { background: rgba(107,114,128,0.14); }
   .st-anuladas-ico   { background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.2); }
   .stat-tile-body { display: flex; flex-direction: column; min-width: 0; }
   .stat-tile:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,0,0,0.35); }
   .stat-tile.s-confirmado { border-color: rgba(34,197,94,0.12); }
   .stat-tile.s-pendiente  { border-color: rgba(234,179,8,0.12); }

4. BOTONES FILTRO — cambiar todos a border-radius: 20px con efecto hover:
   .btn-sin-wa, .btn-pendientes-effi, .btn-ver-canceladas, .btn-limpiar-wa, .btn-subir-effi
   → border-radius: 20px; padding: 0.35rem 0.9rem; transition: all 0.18s;
   → En hover agregar: transform: translateY(-1px)
   → En active: box-shadow: 0 0 0 2px rgba(color,0.2)

5. BTN ACTUALIZAR CLIENTES:
   border-radius: 20px; box-shadow: 0 2px 14px rgba(201,168,76,0.3);
```

---

## Verificación

- [ ] Las stat cards muestran icono circular a la izquierda del número
- [ ] Los botones de filtro son pill-shaped (redondeados)
- [ ] El sidebar muestra el logo más grande con sombra dorada
- [ ] "KLIXMANT" en el sidebar aparece en color dorado
- [ ] El page header tiene borde y gradiente dorado sutil
- [ ] Los botones tienen efecto hover con movimiento hacia arriba
