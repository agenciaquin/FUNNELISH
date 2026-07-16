# CORRECCIONES V47 — Badge "2 Mensajes Enviados" azul celeste
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-03  
**Archivos modificados:** `app.js`, `index.html`

---

## Qué cambia

Al enviar el segundo mensaje de remarketing, el badge cambia de verde a azul celeste:

- **Verde** ✅ MENSAJE ENVIADO → primer mensaje enviado  
- **Azul celeste** 📨 2 MENSAJES ENVIADOS → segundo mensaje enviado

El estado se guarda en Supabase (columna `remarketing_2_enviado`).

---

## PASO 1 — Ejecutar este SQL en Supabase

```sql
ALTER TABLE clientes_funnelish ADD COLUMN IF NOT EXISTS remarketing_2_enviado BOOLEAN DEFAULT FALSE;
```

---

## PASO 2 — Claude Code

> `git add app.js index.html && git commit -m "feat: badge 2 mensajes enviados azul celeste V47" && git push origin master`

---

## Verificación

- [ ] Cliente sin badge → 1er clic WA naranja → badge verde "✅ MENSAJE ENVIADO"
- [ ] 2do clic WA naranja en mismo cliente → badge cambia a azul "📨 2 MENSAJES ENVIADOS"
- [ ] Al recargar la página el badge correcto persiste
