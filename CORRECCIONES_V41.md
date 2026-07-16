# CORRECCIONES V41 — Estados confirmados permanentes (guardados en Supabase)
**Proyecto:** ConfirmaYa — KLIXMANT  
**Fecha:** 2026-07-02  
**Archivos modificados:** `app.js`

---

## El problema

El estado "Confirmado" se guardaba solo en el navegador (localStorage). Si el usuario cerraba la página, apagaba el computador o usaba otra URL, los estados volvían a "Pendiente".

## La solución

Ahora los estados se guardan directamente en la base de datos Supabase (columna `estado` en la tabla `clientes_funnelish`). Así persisten para siempre, sin importar desde dónde se abra la página.

---

## PASO 1 — Ejecutar este SQL en Supabase (OBLIGATORIO PRIMERO)

Ir a: **Supabase → SQL Editor** y ejecutar:

```sql
ALTER TABLE clientes_funnelish ADD COLUMN IF NOT EXISTS estado TEXT;
```

---

## PASO 2 — Aplicar los cambios al código

El archivo `app.js` ya está actualizado en la carpeta. Solo necesitas hacer:

```
git add app.js && git commit -m "feat: estados persistentes en Supabase V41" && git push origin master
```

---

## Qué cambia en app.js

| Función | Cambio |
|---------|--------|
| Nueva: `sincronizarEstadoEnSupabase(key, estado)` | Guarda el estado en Supabase al instante |
| `toggleConfirmar` | Llama a `sincronizarEstadoEnSupabase` al cambiar badge |
| `cancelarVenta` | Llama a `sincronizarEstadoEnSupabase` al cancelar |
| `confirmarSeleccionados` | Llama a `sincronizarEstadoEnSupabase` para cada seleccionado |
| `abrirWhatsApp` | Llama a `sincronizarEstadoEnSupabase` al auto-confirmar |
| `cargarClientesDeSupabase` | Lee la columna `estado` de cada registro y restaura los estados al cargar la página |

---

## Verificación

Después de aplicar:
- [ ] Ejecutar el SQL en Supabase
- [ ] Confirmar un cliente haciendo clic en el botón de WhatsApp
- [ ] Cerrar la página completamente
- [ ] Volver a abrir la página → el cliente debe seguir en "Confirmado"
