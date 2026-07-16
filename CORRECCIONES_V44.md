# CORRECCIONES V44 — Badge "Mensaje Enviado" en columna Remarketing
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-02  
**Archivos modificados:** `app.js`, `index.html`

---

## Qué cambia

Cuando se hace clic en el botón de WhatsApp de remarketing, aparece encima del badge de Effi un badge verde **✅ MENSAJE ENVIADO**. Este estado se guarda en Supabase y persiste aunque se cierre la página o se reinicie el computador.

---

## PASO 1 — Ejecutar este SQL en Supabase (OBLIGATORIO PRIMERO)

Ir a: **Supabase → SQL Editor** y ejecutar:

```sql
ALTER TABLE clientes_funnelish ADD COLUMN IF NOT EXISTS remarketing_enviado BOOLEAN DEFAULT FALSE;
```

---

## PASO 2 — Aplicar los cambios al código

> El archivo `app.js` e `index.html` ya están actualizados en la carpeta. Solo necesitas hacer:
> `git add app.js index.html && git commit -m "feat: badge mensaje enviado remarketing V44" && git push origin master`

---

## Verificación

- [ ] Ejecutar el SQL en Supabase
- [ ] Hacer clic en el botón WA naranja de remarketing de un cliente
- [ ] Verificar que aparece "✅ MENSAJE ENVIADO" encima del badge Effi
- [ ] Cerrar la página y volver — el badge debe seguir visible
