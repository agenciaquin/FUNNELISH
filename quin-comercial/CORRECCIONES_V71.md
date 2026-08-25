# CORRECCIONES V71 — PlantillasPanel con previsualización y soporte de fotos

**Proyecto:** QuinChat — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados:** `components/panel/PlantillasPanel.tsx`

---

## SQL — Ejecutar en Supabase ANTES del deploy

```sql
-- Agregar columnas nuevas a la tabla plantillas
ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'texto';
ALTER TABLE plantillas ADD COLUMN IF NOT EXISTS imagen_url text NOT NULL DEFAULT '';
```

---

## Cambios en PlantillasPanel.tsx

Panel completamente rediseñado con dos modos:

### Modo lista
- Tabla igual que antes con columna "Tipo" nueva
- Cada fila es clickeable para abrir el editor

### Modo edición (split layout — estilo SellerChat)
**Columna izquierda (formulario):**
- Nombre de la plantilla
- Selector de tipo: 💬 Solo texto / 🖼 Solo imagen / 📎 Texto + imagen
- Campo URL de imagen (visible si tipo incluye imagen)
- Mini-preview de la imagen cargada
- Textarea del mensaje (visible si tipo incluye texto)

**Columna derecha (preview WhatsApp):**
- Toggle "Vista chat" para fondo tipo WhatsApp
- Burbuja de mensaje en tiempo real que muestra imagen + texto
- Barra de input falsa decorativa
- Hora actual + checkmarks ✓✓

---

## Instrucciones para Claude Code

```
1. Primero ejecuta el SQL en Supabase (ver arriba)
2. Luego commit:

git add quinchat/components/panel/PlantillasPanel.tsx quinchat/CORRECCIONES_V71.md
git commit -m "feat: PlantillasPanel with photo support and WhatsApp preview"
git push
```

---

## Verificación

- [ ] SQL ejecutado en Supabase (2 ALTER TABLE)
- [ ] Panel Plantillas muestra tabla con columna "Tipo"
- [ ] Crear plantilla → abre vista split (formulario + preview)
- [ ] Selector de tipo cambia los campos visibles
- [ ] URL de imagen muestra miniatura en el formulario
- [ ] Preview derecha actualiza en tiempo real al escribir
- [ ] Toggle "Vista chat" activa/desactiva el fondo
- [ ] Guardar → vuelve a la lista con la nueva plantilla
