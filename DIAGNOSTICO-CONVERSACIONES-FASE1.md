# FASE 1 — DIAGNÓSTICO · Rediseño visual del módulo de Conversaciones (QUINCHAT)

> Solo análisis. **No se modificó ningún archivo ni dato.** Objetivo: adaptar la APARIENCIA del módulo de conversaciones a la maqueta QUINNOVA, sin tocar la lógica real (mensajería, bots, webhooks, etiquetas, pedidos).

---

## 1. Cómo está hecho hoy el módulo de Conversaciones en QUINCHAT

El chat vive dentro del panel y hoy son **2 columnas** (lista + chat). NO existe todavía la 3ª columna de "Información del cliente" de la maqueta.

| Archivo | Rol | Líneas |
|---|---|---|
| `components/panel/WhatsAppPanel.tsx` | **Orquestador**: trae conversaciones y mensajes, maneja `selectedId`, arma el layout y monta las columnas. | 407 |
| `components/panel/ConversationList.tsx` | **Columna izquierda**: pestañas de filtro, buscador, filtro de no leídos, filtros por etiqueta, tarjetas de conversación. | 690 |
| `components/panel/ChatArea.tsx` | **Columna central**: encabezado, burbujas de mensajes, separadores de día, envío de texto/foto/audio/video, toggle del bot, etiquetas y estado del pedido. | 1606 |
| `components/panel/Sidebar.tsx` | Menú lateral (Chat Funnel / Chat WhatsApp / etc.). | 188 |
| `lib/panel/types.ts` | Tipos `Conversation`, `Message`, `Etiqueta` y lista de etiquetas/estados reales. | — |

Datos que ya existen y se reutilizan (NO se tocan):
- Conversaciones y mensajes: `/api/conversations`, `/api/conversations/[id]`.
- Etiquetas: `/api/etiquetas`.
- Envío: `/api/whatsapp/send`, `/api/whatsapp/send-media`, `/api/whatsapp/send-media-url`.
- Pedido del cliente (para la ficha): `/api/pedidos/detalle` (cruce por teléfono).
- Toggle del bot: se guarda en `conversations.bot_enabled` (Supabase) — ya funciona por conversación.

Separación de orígenes (importante): hoy QUINCHAT ya separa **Chat Funnel** (`convsFunnel`) y **Chat Ventas/bot** (`convsVentas`) como DOS secciones distintas del menú lateral. La maqueta las quiere como **pestañas dentro de una sola bandeja** (Todas / Del embudo / Del chatbot).

---

## 2. Qué se puede adaptar (solo visual) y qué NO se toca

### ✅ Se adapta (apariencia / distribución)
- **Layout de 3 columnas** en `WhatsAppPanel.tsx`: añadir la columna derecha "Información del cliente". Solo maquetación; los datos salen de lo que ya existe.
- **Tarjetas de la lista** (`ConversationList.tsx`): rediseñar cada conversación como tarjeta compacta (avatar, nombre, último mensaje, hora, no-leídos, origen embudo/chatbot, estado del bot), fondo turquesa + borde lateral en la seleccionada. **Se conservan TODAS las pestañas y filtros actuales** (Todos, No leído, Interacción bot, Pendiente por confirmar, Venta realizada, Humano, Abono, Effi, Vendedores, Oficina…).
- **Pestañas "Todas / Del embudo / Del chatbot"**: se pueden mostrar como en la maqueta reutilizando los conjuntos `convsFunnel` y `convsVentas` que ya existen (sin duplicar conversaciones).
- **Encabezado del chat** (`ChatArea.tsx`): avatar, nombre, teléfono, origen, estado, interruptor bot activo/pausado, acceso a etiquetas, botón mostrar/ocultar ficha.
- **Burbujas de mensajes**: estilo más moderno, separadores de día (ya existen), hora, estados de envío/lectura si están disponibles, multimedia existente.
- **Barra inferior**: campo de texto, enviar, adjuntar, imagen, audio — reusando las funciones reales que ya están.
- **Responsive** (360/390/430/768/1920): móvil = lista a pantalla completa → al tocar, chat a pantalla completa con botón "volver" → ficha del cliente en panel aparte; tablet = 2 columnas con ficha desplegable; escritorio = 3 columnas.

### 🚫 NO se toca (lógica real)
- Motor de los bots, webhooks de WhatsApp y Funnelish, automatizaciones, confirmaciones.
- Recepción/envío de mensajes y su guardado.
- Lógica de `bot_enabled` (el interruptor nuevo llama a la MISMA función real; pausar un chat NO pausa los demás).
- Comportamiento e identificadores de las etiquetas/estados (`lib/panel/types.ts`).
- Endpoints, rutas y base de datos. Sin librerías nuevas. Sin CSS global que afecte otras pantallas (estilos encapsulados en estos componentes).

---

## 3. Lo que la maqueta muestra pero hay que verificar contra datos reales

La maqueta trae campos de demostración. En QUINCHAT:
- **Ficha "Pedido relacionado"** (nº, estado, producto, foto, talla, valor, botón "Ver pedido"): SÍ existe, cruzando por teléfono con `/api/pedidos/detalle`. Cuando el cliente no tiene pedido → mostrar "Sin información disponible".
- **Atribución "De dónde llegó"** (embudo, campaña, plataforma TikTok/Meta, anuncio): existe vía `utm_source`/`utm_campaign` del pedido; se reaprovecha la misma clasificación que ya hicimos en Pedidos. Si no hay datos → estado vacío, nunca inventado.
- **Correo / foto del cliente**: pueden no existir → "Sin información".
- Estados de la maqueta ("Esperando cliente", "Finalizada", "Requiere atención"): son ejemplos visuales. Se respetan los **estados reales** de QUINCHAT, no se sustituyen.

---

## 4. Archivos que se modificarían vs. que quedan intactos

**Se modificarían (solo UI):**
- `components/panel/WhatsAppPanel.tsx` — layout 3 columnas + responsive (sin cambiar la carga de datos ni el estado).
- `components/panel/ConversationList.tsx` — rediseño de tarjetas y pestañas (sin cambiar la lógica de filtros).
- `components/panel/ChatArea.tsx` — rediseño de encabezado, burbujas y barra inferior (sin cambiar envío/recepción/bot/etiquetas).
- **NUEVO** `components/panel/ClienteInfo.tsx` — columna derecha (solo lectura; consume datos existentes).
- Posible CSS encapsulado para las 3 columnas (sin tocar estilos globales).

**Quedan 100% intactos:**
- Todos los `app/api/**` (conversations, whatsapp/*, pedidos/*, etiquetas, webhooks).
- `lib/quinchat/*` (motor del bot, ventas), `lib/panel/types.ts`, Supabase, automatizaciones, crons.
- Los demás módulos (Pedidos, Estadísticas, Embudos, Vendedores, etc.).

---

## 5. Riesgos y cuidados
- `ChatArea.tsx` es grande (1606 líneas) y mezcla UI + lógica de envío. El rediseño debe tocar SOLO el JSX/estilos, dejando intactas las funciones de envío, bot y etiquetas. Riesgo medio → se hace por partes y se prueba.
- Las pestañas "Todas/Embudo/Chatbot" deben usar los conjuntos ya separados para **no duplicar** conversaciones.
- No se puede validar envío/recepción real desde aquí (requiere WhatsApp en vivo): esas pruebas las harás tú en Preview.

---

## 6. Plan por fases (como pediste)

- **FASE 2 — Diseño:** construyo la nueva interfaz (3 columnas + responsive) con la tecnología actual de QUINCHAT, conservando funciones. Te la muestro primero como **maqueta HTML** (para aprobar el look) o directamente en una rama, como prefieras.
- **FASE 3 — Implementación:** tras tu aprobación, cambios en los 4 archivos de arriba + el nuevo `ClienteInfo.tsx`, en rama/Preview. (Nota: el panel con login no carga bien en el dominio de Preview, como ya vimos; probablemente convenga probarlo en producción con reversión lista, o configurar el Preview.)
- **FASE 4 — Validación:** revisar que conversaciones, historial, envío/recepción, multimedia, etiquetas, bot, pedidos y responsive funcionen; entregar archivos modificados e instrucciones de reversión.

---

## 7. Necesito que me confirmes antes de la Fase 2
1. ¿Quieres las pestañas **Todas / Del embudo / Del chatbot** dentro de una sola bandeja (como la maqueta), o prefieres dejar como está hoy (dos secciones separadas en el menú)?
2. La columna derecha "Información del cliente", ¿la quieres **siempre visible** en escritorio, o **plegable** con un botón (como el ícono de la maqueta)?
3. ¿Te muestro primero una **maqueta HTML** del nuevo diseño para aprobarlo, o paso directo a implementarlo en el código en una rama?
