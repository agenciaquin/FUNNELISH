# CORRECCIONES V70 — 4 Paneles QuinChat (Chat, Entrenamiento, Plantillas, Disparadores)

**Proyecto:** QuinChat — KLIXMANT  
**Fecha:** 2026-07-15  
**Archivos modificados/creados:**
- `components/panel/Sidebar.tsx` ← REESCRITO
- `components/panel/WhatsAppPanel.tsx` ← REESCRITO
- `components/panel/ConversationList.tsx` ← REESCRITO (status filter tabs + dots)
- `components/panel/ChatArea.tsx` ← REESCRITO (status selector dropdown)
- `components/panel/EntrenamientoPanel.tsx` ← NUEVO
- `components/panel/PlantillasPanel.tsx` ← NUEVO
- `components/panel/DisparadoresPanel.tsx` ← NUEVO
- `lib/panel/types.ts` ← YA ACTUALIZADO (ConversationStatus + STATUS_CONFIG)

---

## SQL — Ejecutar en Supabase antes del deploy

```sql
-- 1. Estado de conversaciones (ya existente en types.ts)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status text DEFAULT 'nuevo';

-- 2. Configuración del bot (para Entrenamiento)
CREATE TABLE IF NOT EXISTS bot_config (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 3. Plantillas de mensajes
CREATE TABLE IF NOT EXISTS plantillas (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text NOT NULL,
  contenido  text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Disparadores / automatizaciones
CREATE TABLE IF NOT EXISTS disparadores (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  tipo        text NOT NULL DEFAULT 'Lógica',
  condiciones int  NOT NULL DEFAULT 0,
  acciones    int  NOT NULL DEFAULT 1,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
```

---

## Cambios por archivo

### `Sidebar.tsx`
- Ahora 190px de ancho (antes 68px iconos solo)
- Exporta tipo `PanelSection = 'chat' | 'entrenamiento' | 'plantillas' | 'disparadores'`
- Recibe props `activeSection` + `onSectionChange`
- Muestra 4 botones de nav con ícono + label

### `WhatsAppPanel.tsx`
- Agrega estado `activeSection`
- Pasa `activeSection` y `onSectionChange` al Sidebar
- Renderiza condicionalmente el panel correcto
- EntrenamientoPanel, PlantillasPanel, DisparadoresPanel se cargan con `dynamic` (no SSR)

### `ConversationList.tsx`
- Pestañas de filtro por status (Todos | Nuevo | En proceso | Resuelto | Cerrado) debajo del buscador
- Punto de color (status dot) en cada ítem de conversación

### `ChatArea.tsx`
- Dropdown de status junto al botón "Bot ON/OFF"
- Al cambiar status → actualiza en Supabase + notifica al padre para recargar lista

### `EntrenamientoPanel.tsx` (NUEVO)
- Textarea con el system prompt (carga desde Supabase `bot_config`)
- Botón "Guardar" que hace upsert en `bot_config` key=`system_prompt`
- Panel derecho "Simulador de chat" que llama `/api/quinchat` con el prompt actual

### `PlantillasPanel.tsx` (NUEVO)
- Tabla con nombre, mensajes, fecha creación
- Botón + para crear, ícono ✏️ para editar
- Modal de crear/editar con nombre + contenido

### `DisparadoresPanel.tsx` (NUEVO)
- Tabla con nombre, tipo, condiciones, acciones, fecha, toggle activo
- Toggle on/off actualiza Supabase en tiempo real
- Modal de crear/editar

---

## Instrucciones para Claude Code

```
commit: "feat: add 4-panel admin UI (Chat, Entrenamiento, Plantillas, Disparadores)"

Files to commit:
- quinchat/components/panel/Sidebar.tsx
- quinchat/components/panel/WhatsAppPanel.tsx
- quinchat/components/panel/ConversationList.tsx
- quinchat/components/panel/ChatArea.tsx
- quinchat/components/panel/EntrenamientoPanel.tsx (NEW)
- quinchat/components/panel/PlantillasPanel.tsx (NEW)
- quinchat/components/panel/DisparadoresPanel.tsx (NEW)
- quinchat/lib/panel/types.ts

BEFORE pushing: run the SQL above in Supabase dashboard.
```

---

## Verificación

- [ ] SQL ejecutado en Supabase (4 comandos)
- [ ] `npm run build` en quinchat/ sin errores TypeScript
- [ ] Sidebar muestra 4 secciones con íconos
- [ ] Clic en "Entrenamiento" → editor de prompt + simulador
- [ ] Clic en "Plantillas" → tabla vacía con botón + funcional
- [ ] Clic en "Disparadores" → tabla vacía con botón + funcional
- [ ] En Chat, dropdown de status funciona y persiste en Supabase
- [ ] Pestañas de filtro (Nuevo/En proceso/etc.) filtran la lista de conversaciones
