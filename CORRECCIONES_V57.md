# CORRECCIONES V57 — Remarketing KLIXMANT
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-09  
**Archivos nuevos:** `remarketing.html`, `remarketing.js`  
**Archivos modificados:** `index.html`, `billetera.html`, `historial.html`

---

## Qué se creó

Nueva página **📣 Remarketing KLIXMANT** (`remarketing.html` + `remarketing.js`) para gestionar mensajes post-entrega según el estado de cada guía Effi.

### Funcionalidades
- **Mismo Excel de Effi** — comparte los datos de `billetera_remisiones` (localStorage). Subir el reporte en billetera o en remarketing actualiza ambas páginas.
- **4 tiles de stats:** Guías Entregadas (verde), Pendientes (naranja), Devueltas (rojo), Sin Gestionar (morado).
- **Filtros:** Todos / Entregadas / Pendientes / Devueltas / Sin Gestionar (toggle).
- **Filtro de fechas** Desde/Hasta.
- **Tabla:** #, Fecha, Cliente, Estado, WA Remarketing.
- **Mensajes automáticos por estado:**
  - ✓ Entregada → mensaje de bono con descuento (verde)
  - ↩ Devuelta → mensaje de cobro de transporte $22.000 (rojo)
  - ⏳ Pendiente → sin mensaje ("Sin mensaje" en gris)
- **WhatsApp app directa** (`whatsapp://send`) — igual que el resto de la app.
- **Persistencia:** mensajes enviados guardados en `remarketing_enviados` (localStorage). El badge "✅ MENSAJE ENVIADO" permanece al recargar.
- **Sin Gestionar:** muestra todos los entregados + devueltos a los que aún no se les ha enviado mensaje.

### Links en sidebar
- Billetera QUINO → agrega enlace a Remarketing KLIXMANT
- index.html → agrega enlace a Remarketing KLIXMANT  
- historial.html → agrega enlaces a Billetera + Remarketing

---

## PASO ÚNICO — Claude Code

```
git add remarketing.html remarketing.js index.html billetera.html historial.html && git commit -m "feat: Remarketing KLIXMANT V57" && git push origin master
```

---

## Verificación

- [ ] La página carga y muestra los datos del Excel de Effi ya subido
- [ ] Los 4 tiles muestran conteos correctos
- [ ] Botón devuelta (rojo) → abre WhatsApp con mensaje de cobro de transporte
- [ ] Botón entregada (verde) → abre WhatsApp con mensaje de bono
- [ ] Pendientes muestran "Sin mensaje" (sin botón)
- [ ] "✅ MENSAJE ENVIADO" persiste al recargar
- [ ] Filtro "Sin Gestionar" muestra solo entregadas + devueltas sin gestionar
- [ ] Filtro de fechas funciona
- [ ] Sidebar de todas las páginas muestra el enlace a Remarketing KLIXMANT
