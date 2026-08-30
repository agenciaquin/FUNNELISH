# FUNNELISH — Historial completo y estructura del proyecto

> Documento maestro del repositorio `github.com/agenciaquin/FUNNELISH`.
> Cubre **qué hay, cómo está organizado y cómo llegó a ser lo que es** — desde el
> primer commit (28 de junio de 2026) hasta hoy (28 de agosto de 2026).
>
> Generado el **2026-08-28** sobre el commit `0cface9` (v169).

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Los tres productos del repositorio](#2-los-tres-productos-del-repositorio)
3. [Línea de tiempo — las 5 eras del proyecto](#3-línea-de-tiempo--las-5-eras-del-proyecto)
4. [Estructura de carpetas (raíz)](#4-estructura-de-carpetas-raíz)
5. [Producto A — ConfirmaYa (app estática)](#5-producto-a--confirmaya-app-estática)
6. [Producto B — QuinChat (Next.js, el sistema principal)](#6-producto-b--quinchat-nextjs-el-sistema-principal)
7. [Producto C — quin-comercial (SaaS multi-tenant)](#7-producto-c--quin-comercial-saas-multi-tenant)
8. [Base de datos (Supabase)](#8-base-de-datos-supabase)
9. [Despliegue, dominios y entornos](#9-despliegue-dominios-y-entornos)
10. [Convenciones y flujo de trabajo](#10-convenciones-y-flujo-de-trabajo)
11. [Documentación del repo (mapa de los .md)](#11-documentación-del-repo-mapa-de-los-md)
12. [Historial completo de commits (166)](#12-historial-completo-de-commits-166)
13. [Estado actual y pendientes](#13-estado-actual-y-pendientes)

---

## 1. Resumen ejecutivo

| Dato | Valor |
|---|---|
| Repositorio | `github.com/agenciaquin/FUNNELISH` |
| Ramas | `master` (producción), `dev` |
| Commits totales | **166** |
| Rango | 2026-06-28 → 2026-08-27 |
| Autores | `agenciaquin` (164), `Vanesa Meneses` (2) |
| Ritmo | jun: 40 · jul: 100 · ago: 26 |
| Negocio | **KLIXMANT** (ropa, venta contra entrega en Colombia) — equipo Josué y Mallerlis |
| Agencia | **Agencia Quin** |
| Stack principal | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 3 + Supabase (Postgres) + Vercel |
| IA | Claude (Anthropic SDK) para el bot de WhatsApp y el asistente comercial |
| Volumen de código (quinchat) | ~38.500 líneas TS/TSX · 82 rutas API · 70 componentes · 37 módulos de `lib` |

**Qué pasó en 2 meses:** el repo nació como una herramienta interna de una sola
pantalla (armar el mensaje de confirmación de WhatsApp a mano) y terminó siendo
una **plataforma completa de e-commerce contra entrega**: constructor visual de
embudos de venta, checkout propio, bot de WhatsApp con IA, panel de administración
con 22 secciones, seguimiento de Meta Ads, remarketing, ranking de vendedores, y
una versión multi-tenant para vender el sistema a terceros.

---

## 2. Los tres productos del repositorio

El repo contiene **tres aplicaciones distintas** que comparten historia:

| # | Producto | Carpeta | Stack | Estado |
|---|---|---|---|---|
| **A** | **ConfirmaYa** | raíz (`index.html`, `app.js`…) | HTML/CSS/JS puro, GitHub Pages | 🟢 **Terminado y estable** — sin cambios desde el 17-jul-2026 |
| **B** | **QuinChat** | `quinchat/` | Next.js 16 + Supabase + Vercel | 🔵 **En desarrollo activo** — es donde pasa todo hoy |
| **C** | **quin-comercial** | `quin-comercial/` | Fork multi-tenant de QuinChat | 🟡 **En pausa** — Fase 5 de 6 pendiente desde 29-jul-2026 |

Además hay carpetas de **activos** (imágenes, audios, PDFs de marca y de ventas)
que alimentan al bot y al catálogo.

---

## 3. Línea de tiempo — las 5 eras del proyecto

### 🟤 Era 1 — ConfirmaYa v1: el generador de mensajes (28 jun 2026)
**20 commits en un solo día.** Nace con el flujo de 3 agentes (planeador →
implementador → auditor) definido en `CLAUDE.md`. Objetivo: pegar los datos del
pedido en un formulario y obtener el mensaje de WhatsApp + la foto del producto.

- `tarea 01` a `tarea 20`: carpeta `/img`, `index.html`, formulario de 9 campos,
  `styles.css` (negro/dorado/blanco), `catalogo.js`, `app.js` con las reglas de
  negocio, preview, botones copiar/enviar/nuevo, aviso de mensaje largo.
- Auditoría formal → `AUDIT.md` con tabla de criterios ✅.
- **Mismo día, giro de producto:** `413db5f` *"rediseño completo — Excel a tabla,
  modal, filtros y estados por pedido"*. Deja de ser un formulario manual y pasa a
  **cargar el CSV/Excel de Funnelish** y mostrar una tabla de pedidos.
- Cierra con `4a8de67 VERSION1`.

### 🟠 Era 2 — ConfirmaYa se convierte en un mini-CRM (29 jun – 17 jul 2026)
Versionado manual `V5` … `V70`, cada versión con su `CORRECCIONES_VNN.md`.

Hitos:
- **V17–V21**: filtros por fecha/hora, copiar teléfono, WhatsApp abre la app directa.
- **V22–V24**: rediseño premium (fuente Inter, gradientes dorados, glass blur), sidebar.
- **V23**: módulo **Historial y comparación de Excel** (`historial.html`).
- **V25–V32**: deduplicación de clientes, auto-guardado, estadísticas con filtro de
  fechas, días reales de atraso, badges.
- **V33–V41**: persistencia en **Supabase**, paginación 30×30, cancelar venta,
  selección masiva, cruce con el Excel de **Effi** (la transportadora).
- **V44–V48**: remarketing por WhatsApp con badges de "mensaje enviado".
- **V49–V56**: **Billetera QUINO** (`billetera.html`) — comisiones sobre Effi, filtros
  de fecha, bono de WhatsApp.
- **V57–V60**: **Remarketing KLIXMANT** (`remarketing.html`) con barras de distribución.
- **V62–V69**: manejo de guías **anuladas vs vigentes** en Effi, rediseño visual.

### 🔵 Era 3 — Nace QuinChat: el bot de WhatsApp (15 jul – 19 jul 2026)
El 15 de julio aparece la carpeta `quinchat/`. En **5 días** se construye el núcleo:

- `1099d54` UI de admin de 4 paneles → `95eb72a` plantillas con foto →
  `8f7ee94` disparadores estilo SellerChat → `56e146c` panel de Ajustes.
- `e856fc9` ManualPanel con la identidad de Agencia Quin.
- **Webhook de Funnelish** (`app/api/funnelish/webhook/route.ts`) que recibe el pedido
  y dispara la plantilla de WhatsApp con la foto del producto.
- `34bbfac` **refactor clave**: el bot *solo confirma pedidos*; cambio de color y
  catálogo pasan a un humano.
- `b756a86` panel **Catálogos** + el bot consulta la BD para el cambio de color.
- Serie larga de fixes de scroll en `CatalogosPanel` (10 commits seguidos el 17-jul).
- `461780f` drag & drop para reordenar colores.
- 18-jul: **3 bugs de producción** documentados en `MEMORIA_QUINCHAT.md` (dirección
  sin `#`, "quiero otro" en pending, familias de color) → corregidos.
- 19-jul: color correcto en productos individuales, validación de direcciones, handoff.

### 🟣 Era 4 — quin-comercial: el SaaS multi-tenant (28 jul – 25 ago 2026)
- `607bed9` (28-jul) Simulador con 2 escenarios: WhatsApp y ventas web.
- Se crea el fork `quin-comercial/` para **vender el sistema a otros negocios**,
  estilo SellerChat, con Supabase propio (`confirma-ya`) y Vercel propio
  (`quinchat-comercial`).
- Fases 1–4 completadas (tablas `tenants`/`usuarios`, columna `tenant_id`, login por
  empresa, webhook de WhatsApp por cliente). **Fase 5 quedó a medio camino.**
- `1b4c58d` y `320628c` (25-ago) suben todo `quin-comercial` al repo para colaborar.

### 🟢 Era 5 — Embudos propios: el constructor visual (25 – 27 ago 2026) ← **AQUÍ ESTAMOS**
Se abandona la dependencia de Funnelish. QuinChat pasa a tener **sus propias páginas
de venta y su propio checkout**, editables visualmente desde el panel.

Versionado `v155` → `v169`, todo en 3 días:

| Versión | Qué trajo |
|---|---|
| v155 | Ocultar lo básico en el checkout |
| v156 | Pestañas Inicio / Checkout en la vista previa |
| v158 | Los botones del "teléfono" navegan entre página de inicio y checkout |
| v159 | Una sola versión de la página (se quita el toggle Actual/Nueva) |
| v160 | Pie de página editable por embudo (ya no "Klixmant" fijo) |
| **v161** | **Constructor de Embudos en 3 columnas** — arrastrar y soltar + panel de propiedades |
| v162 | Departamento y ciudad como desplegables dependientes (Colombia) |
| v163 | Campos personalizados + renombrar/ocultar campos del checkout |
| v164 | Los campos personalizados también en Productos del checkout (una sola fuente) |
| v165 | Modo desplegable de color y talla con foto (opcional) |
| v166 | Bloque de producto arriba del checkout (foto + precio antiguo/promoción) |
| v167 | Editor de productos estilo mockup (foto portada, precio rojo/verde) + duplicar |
| v168 | Colores del producto en formato tabla (foto/color por fila) |
| **v169** | Checkout: departamento arriba del municipio ← **último commit** |

En paralelo (25-ago) se reforzó **Pedidos**: embudo de origen exacto por
`funnel_slug` + referrer, columna Embudo, botón de editar embudo, y
**carritos abandonados** que excluyen a quien ya hizo pedido.

---

## 4. Estructura de carpetas (raíz)

```
FUNNELISH/
├── CLAUDE.md                     ← instrucciones del proyecto para el agente
├── .claude/
│   ├── settings.local.json
│   └── agents/                   ← los 3 agentes del flujo de trabajo
│       ├── planeador.md          (modelo: opus)
│       ├── implementador.md      (modelo: sonnet)
│       └── auditor.md            (modelo: opus)
│
├── ── PRODUCTO A: ConfirmaYa (estático, GitHub Pages) ──
├── index.html                    ← tabla de pedidos + modal + filtros
├── app.js                        ← reglas de negocio, mensaje, WhatsApp
├── styles.css                    ← paleta negro/dorado/blanco
├── catalogo.js                   ← catálogo de productos → foto
├── generar-catalogo.js           ← script que regenera catalogo.js desde /img
├── historial.html + historial.js ← comparación de Excel entre fechas
├── billetera.html + billetera.js ← comisiones QUINO sobre Effi
├── remarketing.html + remarketing.js
├── supabase_setup.sql            ← esquema de la app estática
├── limpiar_historial.sql
├── setup-github.ps1
├── img/                          ← 34 fotos de producto
│
├── ── PRODUCTO B: QuinChat ──
├── quinchat/                     ← (detalle en §6)
│
├── ── PRODUCTO C: quin-comercial ──
├── quin-comercial/               ← (detalle en §7)
│
├── ── ACTIVOS ──
├── IDENTIDAD DE MARCA/           ← 18 ilustraciones de QUINO + logos + 2 manuales PDF
├── AUDIOS/                       ← 2 audios de voz (abono municipio / abono oficina)
├── LIBROS DE VENTAS/             ← 28 PDFs de técnica de ventas (material del bot)
│
└── ── DOCUMENTACIÓN (~45 .md) ──  ← (mapa en §11)
```

---

## 5. Producto A — ConfirmaYa (app estática)

**Estado: terminado.** Última modificación funcional: 17-jul-2026.

### Reglas de negocio (de `CLAUDE.md`)
- Teléfono con prefijo `+57` → se elimina, quedan 10 dígitos.
- Sin correo → `Gerenciaquin7@gmail.com`.
- Sin valor a pagar → `$130.000`.
- Talla sin género → se asume "Hombre".

### Plantilla del mensaje (exacta, sin líneas en blanco)
```
Hola 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚✨ Por favor confirma que estos datos estén correctos:
Nombre: {nombre}
Teléfono: {telefono}
Dirección: {direccion}
Ciudad: {ciudad}
Departamento: {departamento}
Correo: {correo}
Talla: {talla}
Nombre del Producto: {producto}
Valor a pagar: {valor}
✅ Si todo está correcto responde: CONFIRMO
✏️ Si deseas corregir algún dato, escríbelo en este chat.
🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas.
```

### Botón "Enviar a cliente"
1. Descarga la foto del producto al equipo.
2. Abre `https://wa.me/57{telefono}?text={mensaje_codificado}`.
3. WhatsApp no permite adjuntar foto por URL → el usuario arrastra la foto al chat.

### Las 4 pantallas
| Archivo | Título | Función |
|---|---|---|
| `index.html` | ConfirmaYa — KLIXMANT | Sube el Excel de Funnelish, tabla de pedidos, estados, envío por WhatsApp |
| `historial.html` | Historial y Comparación | Compara Excels de distintas fechas, deduplica clientes |
| `billetera.html` | Billetera QUINO | Comisiones calculadas sobre las guías de Effi, filtros y bonos |
| `remarketing.html` | Remarketing KLIXMANT | Distribución porcentual y envío de segundos mensajes |

Persistencia: `localStorage` primero + **Supabase** como respaldo (`supabase_setup.sql`).

---

## 6. Producto B — QuinChat (Next.js, el sistema principal)

### 6.1 Arquitectura general

**Dos sitios en un mismo proyecto**, separados por dominio en `middleware.ts`:

```
pedido.klixmant.shop  →  TIENDA PÚBLICA (sin login)
                          /             → redirige a /tienda (embudo activo más reciente)
                          /{slug}       → reescribe a /p/{slug}   (el cliente no ve el /p/)
                          /p/{slug}/gracias, /p/{slug}/pedido

cualquier otro host   →  PANEL (protegido con next-auth)
                          rutas públicas: /login, /api/auth, webhooks de WhatsApp y
                          Funnelish, los 14 /api/cron/*, /api/pedidos, /p/, PWA
```

**Modelo de datos central:** *un embudo = una fila de la tabla `funnels`*.
Su diseño visual vive en la columna `layout` (jsonb):

```ts
LayoutEmbudo = {
  bloques: { id, tipo, visible?, props? }[],
  checkout?: { titulo, subtitulo, textoBoton, colorBoton, sellos[], ... }
}
```

**Regla de oro del proyecto:** todo lo nuevo es **opcional y con valor por defecto**,
para que los embudos viejos no se rompan. Verificar siempre con `npx tsc --noEmit`
antes de desplegar.

### 6.2 Stack y dependencias (`package.json`)

```json
"@anthropic-ai/sdk": "^0.36.3"    ← el bot y el asistente
"@supabase/supabase-js": "^2.110.5"
"next": "^16.2.10"  ·  "react": "^19.0.0"
"next-auth": "^4.24.14"            ← login del panel
"jimp": "^0.22.12"                 ← marca de agua del catálogo
"opus-recorder": "^8.0.5"          ← notas de voz
"web-push": "^3.6.7"               ← notificaciones PWA
"xlsx": "^0.18.5"                  ← lectura de Excel (Effi, campañas)
"tailwindcss": "^3.4.17"
```

### 6.3 El constructor de bloques (`lib/bloques.ts`)

19 tipos de bloque disponibles para armar una página de venta:

| Clave | Nombre | Repetible |
|---|---|---|
| `banner` | Banner de clientes | no |
| `titular` | Titular (rota entre frases) | no |
| `portada` | Portada (galería / video) | no |
| `boton` | Botón COMPRAR | **sí** |
| `precio` | Precio (hoy + tachado) | no |
| `contador` | Contador de oferta | no |
| `ultimas_unidades` | Últimas unidades + detalle | no |
| `caracteristicas` | Características | no |
| `estrellas` | Estrellas de reseña | **sí** |
| `testimonios` | Clientes felices | **sí** |
| `gatillos` | Gatillos mentales | **sí** |
| `stock` | Stock / escasez | **sí** |
| `mas_vendido` | Botón flotante MÁS VENDIDO | no |
| `ventas` | Ventas en vivo (flotante) | no |
| `checkout` | Checkout (formulario) | no |
| `checkout_pro` | Checkout PRO (cierre alto) | no |
| `texto` | Texto libre | **sí** |
| `imagen` | Imagen / Video extra | **sí** |
| `espacio` | Espacio en blanco | **sí** |

Además define: 7 tipografías, 5 animaciones, 6 variantes de botón, paleta de 16
colores, y **dos layouts prefabricados** — `layoutPorDefecto()` (el orden histórico,
para no romper embudos viejos) y `layoutCierreAlto()` (una sola pantalla con
`checkout_pro` embebido, pensado para máxima conversión).

### 6.4 El panel — 22 secciones (`components/panel/Sidebar.tsx`)

**Menú principal (11):**

| Icono | Sección | Qué hace |
|---|---|---|
| 🔵 embudo | **Chat Funnel** | Bandeja de los pedidos que entran por embudo |
| 🟢 WA | **Chat WhatsApp** | Bandeja del bot de ventas (segunda línea) |
| 🏅 | **Tus metas** | Metas de venta del equipo |
| 📊 | **Estadísticas** | KPIs y conversión |
| 🚀 | **Embudos** | El constructor visual + papelera + stats por embudo |
| 🛒 | **Pedidos** | Pedidos con embudo de origen, detalle y acciones |
| 🔵 | **Estado en Effi** | Cruce con las guías de la transportadora |
| 🏆 | **Vendedores** | Ranking, preguntas y reportes |
| 🎯 | **META ADS** | Gasto por campaña, alertas, CAPI |
| 🔎 | **Objeciones** | Análisis de objeciones detectadas por IA |
| 📣 | **Remarketing** | Campañas de recuperación |

**Herramientas (11):** 🧠 Memoria del bot · 💬 Preguntas frecuentes · 🎓 Entrenamiento ·
📋 Plantillas · ⚡ Disparadores · 👥 Contactos · 🏷️ Etiquetas · 📦 Catálogos ·
🔗 Integraciones · ⚙️ Ajustes · 📖 Manual

Identidad visual del panel: degradado teal `#00B5A6 → #00A89D → #00847A`, logo
`logo-quin-app.png`, ancho de sidebar 190px.

### 6.5 Componentes (70 archivos)

**`components/panel/` (45)** — los más grandes marcan dónde está la complejidad:

| Componente | Tamaño | Rol |
|---|---|---|
| `EmbudosPanel.tsx` | **119.7 KB** | El constructor de embudos completo (lista, editor, 3 columnas) |
| `ChatArea.tsx` | 74.2 KB | La conversación de WhatsApp con todo su tooling |
| `EditorBloqueLateral.tsx` | 66.9 KB | Panel de propiedades del bloque seleccionado |
| `CatalogosPanel.tsx` | 41.1 KB | Catálogo, colores, fotos, marca de agua |
| `SeguimientoPanel.tsx` | 37.4 KB | Meta Ads |
| `VistaPreviaEmbudo.tsx` | 35.6 KB | El "teléfono" con la vista previa en vivo |
| `PedidosPanel.tsx` | 35.2 KB | Pedidos |
| `ConversationList.tsx` | 32.7 KB | Lista de chats |
| `DisparadoresPanel.tsx` | 29.0 KB | Condiciones → acciones |
| `CampanasPanel.tsx` | 25.6 KB | Campañas |
| `ManualPanel.tsx` | 24.9 KB | Manual para el equipo |
| `VentasPanel.tsx` | 24.3 KB | Effi |
| `PlantillasPanel.tsx` | 21.2 KB | Plantillas de mensaje |
| `AjustesPanel.tsx` | 20.5 KB | Configuración |
| Otros 31 | — | Etiquetas, FAQ, Memoria, Metas, Municipios, Objeciones, Vendedores, Carritos abandonados, Papelera, Insignia, Pareja, Bloques, etc. |

**`components/publico/` (25)** — lo que ve el cliente en la página de venta:
`FormularioPedido.tsx` (53 KB, el checkout completo), `CheckoutPro.tsx` (21.4 KB),
`ArmarPackSelector.tsx` (13.2 KB, el constructor escudería→color→talla),
`Galeria`, `VideoPortada`, `Contador`, `Stock`, `BarraStockAnimada`, `Gatillos`,
`Testimonios`, `ResenaGatillo`, `NotifVentas`, `PersonasComprando`,
`MasVendidoFlotante`, `InsigniaFlotante`, `MiniaturaFlotante`, `MusicaFondo`,
`Pixeles`, `FunnelTracker`, `FrasesRotativas`, `ResumenGracias`, `Medio`,
`BotonBajarCheckout`, `TemaSpiderman`, `SpidermanJala`.

**`components/quinchat/` (4)** — el chat web interno: `ChatWindow`, `ChatInput`,
`MessageBubble`, `TypingIndicator`.

### 6.6 Rutas API (82)

**Webhooks (los dos archivos más grandes del repo):**
- `api/whatsapp/webhook/route.ts` — **162.2 KB**. Todo el cerebro del bot: recibe
  mensajes, decide, responde con Claude, gestiona etiquetas, estados y handoff a humano.
- `api/funnelish/webhook/route.ts` — **41.7 KB**. Entrada de pedidos desde Funnelish.

**Por familia:**

| Familia | Rutas | Para qué |
|---|---|---|
| `api/funnels/*` | 12 | Embudos: CRUD, ajustes, carrito, evento, imagen, audio, video, plantillas, stats, upload-url, diagnóstico, probar-capi |
| `api/whatsapp/*` | 6 | webhook, confirmar, registrar, send, send-media, send-media-url |
| `api/catalogos/*` | 7 | CRUD, colores, buscar-imagen, upload-imagen, re-estampar (marca de agua) |
| `api/pedidos/*` | 4 | lista, detalle, acción |
| `api/ventas/*` | 4 | lista, registrar, contacto, papelera |
| `api/campanas/*` | 4 | lista, días, importar, ventas |
| `api/seguimiento/*` | 3 | campañas, effi, lista |
| `api/plantillas*` | 5 | plantillas y plantillas-wa (+ enviar, imagen) |
| `api/cron/*` | **14** | ver abajo |
| Resto | ~23 | ajustes, auth, configuración, contactos, conversations, debug, disparadores, etiquetas, faq, memoria, metas, objeciones, push, quinchat, remarketing, vendedores |

**Los 14 trabajos programados (`api/cron/`):**

| Cron | Tamaño | Qué automatiza |
|---|---|---|
| `vendedores` | 12.6 KB | Ranking y reportes del equipo |
| `aprendizaje` | 9.1 KB | El bot aprende de las conversaciones |
| `objeciones` | 8.5 KB | Detecta y clasifica objeciones |
| `seguimiento-ia` | 7.8 KB | Seguimiento automático con IA |
| `remarketing` | 6.3 KB | Campañas de recuperación |
| `ventas-seguimiento` | 5.7 KB | Post-venta |
| `oficina-rescate` | 4.1 KB | Rescate de pedidos en oficina |
| `carrito-recuperacion` | 3.3 KB | Carritos abandonados |
| `meta-alertas` | 3.3 KB | Alertas de Meta Ads |
| `capi` | 3.1 KB | Conversions API de Meta |
| `mantener-chat` | 2.6 KB | Mantiene viva la ventana de 24h |
| `registros-funnel` | 2.5 KB | Registros del embudo |
| `apagar-vendidos` | 2.1 KB | Apaga el bot en chats ya vendidos |
| `promo-cierre` | 0.7 KB | Promo de cierre |

### 6.7 Librerías (`lib/`, 37 módulos)

| Módulo | KB | Rol |
|---|---|---|
| `quinchat/ventas.ts` | **78.4** | La lógica de venta del bot (el archivo de negocio más grande) |
| `whatsapp.ts` | 25.3 | Envío, media, formatos, contexto |
| `bloques.ts` | 13.6 | Catálogo de bloques y layouts (§6.3) |
| `vendedores.ts` | 11.7 | Ranking y métricas |
| `product-catalog.ts` | 11.6 | Catálogo de productos |
| `quinchat/systemPrompt.ts` | 11.3 | El prompt del bot |
| `meta-ads.ts` | 9.1 | API de Meta Ads |
| `campanas.ts` | 8.8 | Campañas |
| `whatsapp-templates.ts` | 8.6 | Plantillas aprobadas por Meta |
| `leer-excel-campanas.ts` | 7.5 | Import de Excel |
| `funnels.ts` | 7.2 | Modelo `Funnel`, variantes, packs, `imgOptim`, `pesos` |
| `lupap.ts` | 6.9 | Geocodificación de direcciones de Colombia |
| `faq.ts` / `objeciones.ts` / `memoria.ts` | 5.1 / 2.3 / 2.3 | Conocimiento del bot |
| `watermark.ts` / `collage.ts` / `imagen-comprimir.ts` | 4.6 / 2.1 / 2.6 | Imagen (Jimp) |
| `r2.ts` | 3.7 | Storage |
| `auth.ts` | 3.6 | next-auth |
| `address.ts` | 3.7 | Validación de direcciones colombianas |
| `capi.ts` / `meta-capi.ts` | 2.9 / 2.8 | Conversions API |
| `celebracion.ts`, `etiqueta-oficina.ts`, `prendas.ts`, `formato-pedido.ts`, `funnel-track.ts`, `push.ts`, `supabase.ts`, `transcribir.ts`, `whatsapp-contexto.ts` | — | Utilidades |
| `panel/types.ts` | 5.1 | Modelo de conversaciones, estados y etiquetas |
| `panel/cambios.ts` | 1.2 | Confirmación de salida con cambios sin guardar |

### 6.8 Estados y etiquetas del CRM (`lib/panel/types.ts`)

**Estados del pedido** (uno solo a la vez, se reemplazan):
`PENDIENTE POR CONFIRMACIÓN` · `VENTA REALIZADA` · `ABONO POR VERIFICAR` ·
`ANULADO EN EFFI` · `PEDIDO PROGRAMADO` · `PEDIDO CANCELADO`

**Etiquetas adicionales** (se suman al estado):
`HUMANO` · `PENDIENTE DE ABONO` · `OFICINA SIN ABONO` · `OFICINA CON ABONO`

Se guardan concatenadas con ` | ` en la columna `label` de `conversations`.
Estado de la conversación: `nuevo` · `en_proceso` · `resuelto` · `cerrado`.

### 6.9 PWA

`public/manifest.json` — nombre "QuinChat — Agencia Quin", `display: standalone`,
orientación vertical, fondo `#0D0D0D`, tema `#00847A`, iconos 192/512/maskable.
`sw.js` + `PWARegister.tsx` + notificaciones push con VAPID.

### 6.10 Configuración especial (`next.config.ts`)

Incluye la carpeta `fonts/` (bitmap fonts de Jimp: Open Sans 16/32/64) en el bundle
de las rutas de catálogo. **Sin esto, la marca de agua falla en producción con ENOENT.**

---

## 7. Producto C — quin-comercial (SaaS multi-tenant)

Versión comercial de QuinChat para **vender o rentar el sistema a otros negocios**,
estilo SellerChat. Cada cliente trae **sus propias credenciales de WhatsApp**, así que
no se necesita ser Meta Tech Provider.

### Infraestructura
| Recurso | Valor |
|---|---|
| Supabase | proyecto **confirma-ya** (`glmnuqfnxwaibckufgtr`), org Pro |
| Vercel | proyecto **quinchat-comercial** → `quinchat-comercial.vercel.app` |
| Deploy | `vercel --prod` desde la carpeta (**no** está conectado a Git) |
| Storage | bucket público `chat-media` |

> ⚠️ **Nunca tocar** la base de Klixmant producción (`bjbjqmbuzpyjvcugbusx`).
> Usar las llaves **Legacy** (anon / service_role JWT), no las `sb_publishable`/`sb_secret`.

### Fases del multi-tenant
| # | Fase | Estado |
|---|---|---|
| 1 | Tablas `tenants` + `usuarios` (`sql/mt-01-tenants.sql`) | ✅ |
| 2 | Columna `tenant_id` en todas las tablas (`sql/mt-02-tenant-id.sql`) | ✅ |
| 3 | Login por empresa (`lib/auth.ts` + `lib/tenant.ts`) | ✅ 29-jul-2026 |
| 4 | Webhook de WhatsApp por cliente (`api/whatsapp/webhook/[tenant]`) | ✅ 29-jul-2026 |
| 5 | **Filtrar TODAS las consultas por `tenant_id`** — 66 archivos, 21 tablas | ⏳ **pendiente** |
| 6 | Pantalla de alta de clientes + Ajustes de WhatsApp por tenant | ⏳ pendiente |

**Aprendizaje caro que quedó documentado:** al clonar el esquema, los roles del API
quedaron sin permisos DML. El error *"Correo o contraseña incorrectos"* era en realidad
`permission denied for table usuarios`. Se resolvió con
`grant all privileges on all tables in schema public to service_role;` +
`alter default privileges`. No se dio SELECT a `anon` (protege las contraseñas).

### Novedades propias de quin-comercial (no están en quinchat)
- `api/admin/tenants` — administración de clientes.
- `api/asistente-bot/*` — **entrevista, compilar, actualizar, transcribir, leer-archivo**:
  un asistente que configura el bot del cliente conversando con él.
- `api/asistente-conexion` / `api/asistente-etiqueta` — asistentes de configuración.
- `api/catalogos/categorias` y `api/catalogos/variables` — catálogo más flexible.
- `api/embudos/ventas`, `api/entrenamiento/guardar`, `api/diag-bot`.
- `AGENTS.md` — formaliza que **los 3 agentes deben dar APROBADO antes de entregar**.

---

## 8. Base de datos (Supabase)

### Tablas usadas por QuinChat (por número de accesos en el código)

| Tabla | Accesos | Qué guarda |
|---|---|---|
| `clientes_funnelish` | 94 | **La tabla central**: cada pedido/cliente con todos sus datos y estado |
| `messages` | 84 | Mensajes de WhatsApp (rol user/assistant/agent, tipo, wamid, status) |
| `conversations` | 83 | Un chat por teléfono: nombre, último mensaje, bot on/off, etiquetas, línea |
| `funnels` | 20 | **Un embudo por fila**: slug, producto, precios, imágenes, variantes, `layout` jsonb, píxeles, insignia |
| `catalogo_colores` | 17 | Colores con foto por producto |
| `faq_bot` | 14 | Preguntas frecuentes que responde el bot |
| `memoria_bot` | 13 | Memoria persistente del bot |
| `catalogos_bot` | 12 | Catálogo que consulta el bot |
| `carritos_abandonados` | 9 | Checkouts iniciados sin terminar |
| `vendedor_preguntas` | 8 | Preguntas del equipo de ventas |
| `vendedor_reportes` | 7 | Reportes de vendedores |
| `remarketing_envios` | 6 | Registro de envíos de remarketing |
| `push_subscriptions` | 6 | Suscripciones PWA |
| `campanas_gasto` | 6 | Gasto de Meta Ads por campaña |
| `funnel_eventos` | 5 | Eventos de tracking del embudo |
| `configuracion` | 5 | Configuración general |
| `plantillas_embudo` | 4 | Plantillas por embudo |
| `plantillas` | 4 | Plantillas de mensaje |
| `etiquetas` | 4 | Etiquetas personalizadas |
| `effi_guias` | 4 | Guías de la transportadora Effi |
| `disparadores` | 4 | Reglas condición → acción |
| `contactos` | 4 | Agenda |
| `objeciones_analisis` | 3 | Objeciones detectadas por IA |
| `bot_config` | 2 | Config del bot |
| `ajustes` | 2 | Ajustes del panel |
| `usuarios`, `tenants` | — | Solo en quin-comercial (multi-tenant) |

### Migraciones SQL (`quinchat/sql/`, 29 archivos)

Cada funcionalidad nueva trae su `.sql` de migración. Los más relevantes:
`embudo-f1-pro.sql`, `embudo-analitica-carritos.sql`, `embudos-papelera.sql`,
`funnels-insignia.sql`, `plantilla-parejas.sql`, `plantillas-embudo.sql`,
`funnel-slug-pedido.sql`, `carritos-datos-completos.sql`, `objeciones-analisis.sql`,
`seguimiento-ia.sql`, `faq-bot.sql`, `fix-vendedores-permisos.sql`,
`reset-vendedores.sql`, `marca-agua-catalogo.sql`, `promo-cierre.sql`,
`apagar-bot-vendido.sql`, `entrega-fallida.sql`, `interaccion-bot.sql`,
`papelera-ventas.sql`, `effi-flete.sql`, `effi-motivo.sql`, `contacto-effi.sql`,
`etiqueta-tipo.sql`, `capi-marca.sql`, `cantidad-prendas.sql`,
`actualizar-precios.sql`, `foto-producto-pedido.sql`, `ficha-periodo-gracia.sql`,
`agregar-caption-mensajes.sql`.

---

## 9. Despliegue, dominios y entornos

| Producto | Dónde vive | Cómo se despliega |
|---|---|---|
| **ConfirmaYa** | GitHub Pages desde `master` | `git push` + subir el número de versión (cache bust). **Ambas cosas son necesarias** para que salga en vivo |
| **QuinChat** | Vercel `quinchat-agencia-quin` (`prj_0Ncuz…`, team `EZLmPFGx…`) | Conectado a Git — push a `master` despliega |
| **Tienda pública** | `pedido.klixmant.shop` | Mismo proyecto Vercel, separado por `middleware.ts` |
| **quin-comercial** | Vercel `quinchat-comercial` | `vercel --prod` manual (no conectado a Git) |

### Variables de entorno (`quinchat/.env.local`)

```
ANTHROPIC_API_KEY                  ← Claude (bot + asistente)
NEXTAUTH_SECRET · NEXTAUTH_URL
USER_AGENCIA_QUIN_PASSWORD · USER_GERENCIA_PASSWORD · USER_GENERICO_QUIN_PASSWORD
WHATSAPP_PHONE_NUMBER_ID · WHATSAPP_ACCESS_TOKEN · WHATSAPP_VERIFY_TOKEN
LUPAP_API_KEY · LUPAP_API_SECRET   ← geocodificación de direcciones Colombia
NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY   ← push del panel (PWA)
```

En quin-comercial se añaden: `GROQ_API_KEY`, `QUINCHAT_MODEL`, `CRON_SECRET`
(y WhatsApp deja de ir en env: es por-tenant).

### Verificación antes de desplegar
```bash
cd quinchat
npx tsc --noEmit      # obligatorio
vercel --prod         # si aplica
```

---

## 10. Convenciones y flujo de trabajo

### Los 3 agentes (`.claude/agents/`)
```
PLANEADOR (opus)  → PLAN.md + TASKS.md → "APROBADO PARA IMPLEMENTAR"
   ↓
IMPLEMENTADOR (sonnet) → código tarea por tarea + tsc → "APROBADO PARA AUDITAR"
   ↓
AUDITOR (opus) → AUDIT.md → "APROBADO PARA ENTREGAR" o "RECHAZADO"
   ↓
ENTREGA (solo con los 3 APROBADO)
```
Si el auditor rechaza → vuelve al implementador → el auditor revisa de nuevo.

### Versionado
Cada cambio entregable lleva un número de versión incremental en el mensaje del commit:
- Era ConfirmaYa: `V5` … `V70` (mayúscula)
- Era Embudos: `v155` … `v169` (minúscula)

Formato del commit: `v169: checkout - departamento arriba del municipio`

### Documentos de corrección
Cada versión con arreglos deja su `CORRECCIONES_VNN.md` con el detalle exacto de
qué se cambió y por qué. Hay ~35 de estos archivos.

### Reglas de código observadas
- **Comentarios en español**, explicando el *porqué* de negocio, no el *qué* técnico.
- Nombres de variables, tipos y props **en español** (`Funnel`, `VarianteFunnel`,
  `bloquesARenderizar`, `acentoDe`, `pesos`).
- Todo lo nuevo es **opcional con valor por defecto** → retrocompatibilidad.
- Componentes presentacionales **compartidos** entre la página pública (servidor) y
  la vista previa del panel (navegador) → se ven idénticos.

---

## 11. Documentación del repo (mapa de los .md)

### Del proyecto (raíz)
| Archivo | Contenido |
|---|---|
| `CLAUDE.md` | Instrucciones del proyecto: identidad, stack, reglas de negocio, plantilla del mensaje, flujo de agentes |
| `PLAN.md` · `TASKS.md` · `AUDIT.md` | El ciclo completo del ConfirmaYa original (28-jun) |
| `AUDIT_PLAN.md` · `CORRECCIONES_PLAN.md` · `CORRECCIONES.md` | El giro de formulario → tabla |
| `CORRECCIONES_V40…V70.md` (~30) | Detalle de cada versión de ConfirmaYa |

### De QuinChat
| Archivo | Contenido |
|---|---|
| `ESTRUCTURA_COMPLETA_EMBUDOS.md` | **Documento maestro** de cómo está construido el sistema de embudos |
| `SOLO_ESTRUCTURA_EMBUDOS.md` | Versión resumida de lo anterior |
| `PAQUETE_REPLICACION_QUINCHAT.md` | Cómo dejar el sistema idéntico en otra app: código + SQL + env |
| `MEMORIA_QUINCHAT.md` | Memoria de sesión del bot y sus bugs históricos |
| `PLAN_BOT_VENTAS.md` | Plan del segundo bot (número nuevo) que **vende** en vez de solo confirmar |
| `EMBUDO_MEJORAS_COMPLETO.md/.html` | Propuesta de mejoras del embudo |
| `PROMPTS_BLOQUES_UNO_POR_UNO.md` | Prompts para construir cada bloque |
| `PROMPT_EDITAR_CHECKOUT_EN_TELEFONO.md` | Prompt del editor en vista móvil |
| `PROMPT_PRODUCTOS_DEL_CHECKOUT.md` | Prompt de productos del checkout |
| `REVERTIR_CHECKOUT_EDITABLE.md` | Cómo revertir el checkout editable |
| `COPIAR-CARRITOS-ABANDONADOS.md` · `COPIAR-VARIABLES-POLOS.md` | Guías de replicación puntual |
| `PROMPT_CONFIRMAYA.md` | Prompt original de ConfirmaYa |
| `quinchat/SETUP_WHATSAPP.md` | Configuración de WhatsApp Cloud API |
| `quinchat/PROMPT_JOSUE.md` | Prompt de trabajo |
| `quinchat/CORRECCIONES_V70…V81.md` | Correcciones de la era QuinChat |

### De quin-comercial
| Archivo | Contenido |
|---|---|
| `CONTINUACION-PROYECTO.md` | **Estado exacto del multi-tenant**, fase por fase, con causas raíz de los bugs resueltos |
| `AGENTS.md` | El flujo de 3 agentes formalizado |
| `PLAN-FASE5.md` | Mapa de los 66 archivos y 21 tablas a filtrar por `tenant_id` |

---

## 12. Historial completo de commits (166)

### 2026-08 — Era Embudos (26 commits)

| Hash | Fecha | Mensaje |
|---|---|---|
| `0cface9` | 08-27 | v169: checkout - departamento arriba del municipio |
| `d5eaf64` | 08-27 | v168: editor - colores del producto en formato tabla (foto/color por fila) |
| `33ed152` | 08-27 | v167: editor de productos estilo mockup (foto portada + precio rojo/verde) + duplicar producto |
| `3bca23c` | 08-27 | v166: checkout - bloque de producto arriba (foto + precio antiguo/promocion) |
| `9c5ce38` | 08-27 | v165: checkout - modo desplegable de color y talla con foto (opcional) |
| `72edfd4` | 08-27 | v164: checkout - campos personalizados tambien en Productos del checkout (una sola fuente) |
| `9a14840` | 08-27 | v163: checkout - campos personalizados + renombrar/ocultar campos (etapa 2) |
| `650d346` | 08-27 | v162: checkout - departamento y ciudad como desplegables dependientes de Colombia |
| `dc6125f` | 08-27 | v161: editor Constructor de Embudos 3 columnas (arrastrar-y-soltar + panel de propiedades) |
| `1f6c60b` | 08-27 | v160: pie de pagina editable por embudo (nombre de empresa, ya no Klixmant fijo) |
| `d0ffc33` | 08-26 | v159: una sola version de la pagina (se quita toggle Version Actual/Nueva) |
| `0569dfc` | 08-26 | v158: botones Inicio/Checkout del telefono navegan entre pagina de inicio y checkout |
| `16ca1db` | 08-26 | checkout v156 pestanas inicio y checkout |
| `6598d83` | 08-26 | Merge branch 'master' |
| `850e691` | 08-26 | checkout v155 ocultar lo basico |
| `57490f5` | 08-26 | Merge branch 'master' |
| `371e935` | 08-26 | feat(catalogos): "al llegar a 0" con popover y aplicar a todas las filas |
| `af08e99` | 08-25 | Carritos abandonados: excluir a quien ya hizo pedido (no solo confirmados) |
| `7a354cd` | 08-25 | Embudos: al duplicar pedir nombre (slug desde el nombre) + guardar siempre activo (fix papelera) |
| `127f5af` | 08-25 | Pedidos: botón editar embudo (abre en el editor) + mostrar producto del embudo |
| `6f53e93` | 08-25 | Pedidos: mostrar el producto del embudo (no el nombre interno duplicado) |
| `c3454fb` | 08-25 | Pedidos: embudo exacto por funnel_slug + referrer; columna Embudo; panel ancho completo |
| `1cba0b9` | 08-25 | Pedidos: embudo de origen (funnel_slug) + enlace vista previa; checkout espera guardado; stats = ventas reales |
| `7330f06` | 08-25 | Docs (prompts y correcciones) + ajustes en quinchat |
| `320628c` | 08-25 | quin-comercial completo |
| `1b4c58d` | 08-25 | quin-comercial: SaaS de embudos + catalogo (subida al repo para colaborar) |

### 2026-07 — Era QuinChat + Effi (100 commits)

| Hash | Fecha | Mensaje |
|---|---|---|
| `607bed9` | 07-28 | Simulador con 2 escenarios: WhatsApp y ventas web (demo:whatsapp / demo:web) |
| `e966af0` | 07-19 | fix: color correcto en productos individuales, validación de direcciones, producción para todos y aviso de handoff |
| `a4f2408` | 07-18 | feat: menú verde agua, colores de pestañas y reenvío de ventas al admin |
| `909f440` | 07-18 | feat: remarketing, PACK X2 collage, FAQ empresa, etiquetas y mensajes naturales |
| `b637d14` | 07-18 | feat: manejo correcto de abono/oficina — no negar recogida, objeción y cuentas |
| `98c9765` | 07-18 | fix: scroll en panel de catálogos — reemplazar position:fixed por flex layout |
| `4ac3eec` | 07-18 | fix: 3 bugs QuinChat — dirección sin #/-, "quiero otro" en pending, familias de color |
| `3eba201` | 07-18 | fix: 3 bugs QuinChat (idem) |
| `503a868` | 07-17 | fix: guardar pedido con insert defensivo — evita fallo silencioso del upsert |
| `0cd7f7a` | 07-17 | fix: quitar wa_enviado=true de queries — race condition y post-confirmación |
| `6beea01` | 07-17 | fix: responder en contexto post-confirmación cuando cliente sigue escribiendo |
| `64e89f1` | 07-17 | fix: imagen desde catálogo Supabase en webhook Funnelish |
| `8142a19` | 07-17 | fix: template solo si hay imagen real del producto — evita entrega silenciosa fallida |
| `8b27bf4` | 07-17 | fix: scrollbar visible 8px en catalogo |
| `75cb362` | 07-17 | fix: position fixed en catalogo para scroll garantizado |
| `f1d4ba9` | 07-17 | fix: scroll catalogo con inline styles para forzar altura |
| `bd03efd` | 07-17 | fix: revertir overflow-hidden body + overflow-y-scroll catalogo |
| `b3f4af2` | 07-17 | fix: min-h-0 en CatalogosPanel (igual que ContactosPanel) |
| `345b4fb` | 07-17 | fix: scroll con absolute inset-0 en CatalogosPanel |
| `b2076fe` | 07-17 | fix: min-w-0 overflow-hidden en CatalogosPanel |
| `7dba0db` | 07-17 | fix: h-screen en CatalogosPanel para scroll correcto |
| `e330ce0` | 07-17 | fix: scrollbar visible + overflow hidden en body |
| `cca2eea` | 07-17 | fix: scroll en panel de catálogos |
| `461780f` | 07-17 | feat: drag & drop para reordenar colores del catálogo |
| `488df92` | 07-17 | feat: botones subir/bajar al lado derecho de cada color |
| `19c494a` | 07-17 | feat: botones subir/bajar colores con orden persistido |
| `526ad18` | 07-17 | feat: formulario inline para agregar colores sin modal |
| `3f62f3b` | 07-17 | feat: upload foto desde computador en modal de color |
| `6a01790` | 07-17 | fix: whatsapp return null + params Promise |
| `59cf121` | 07-17 | fix: params como Promise en routes dinamicas Next.js 15 |
| `b756a86` | 07-17 | feat: panel Catalogos + bot usa DB para cambio de color |
| `fefef23` | 07-17 | feat: confirmacion lenguaje natural + recordatorio abono oficina + mensaje final |
| `51bede9` | 07-17 | fix: capturar wamid del template + loguear errores de DB en funnelish webhook |
| `34bbfac` | 07-17 | refactor: bot solo confirma pedidos - cambio color + catalogo a humano |
| `6dc85f7` | 07-16 | fotos nuevas |
| `602dc77` | 07-16 | fix: usar raw.githubusercontent.com para imagenes del catalogo |
| `4097206` | 07-16 | fix: template 10 variables (agregar saludo {{1}}) |
| `7912d53` | 07-16 | fix: renombrar imagenes NEW YORK (quitar doble .jpg) |
| `7727599` | 07-16 | feat: agregar productos NEW YORK al catálogo + imágenes |
| `de905c2` | 07-16 | feat: template WA con catálogo de imágenes por producto |
| `6510d2b` | 07-16 | debug: log meta extra_data avatar from Funnelish |
| `5cc1b93` | 07-16 | debug: console.error product fields |
| `1b73048` | 07-16 | debug: log product fields from Funnelish webhook |
| `64bfc4f` | 07-16 | fix: remove invalid truncate CSS property in ManualPanel |
| `4a58474` | 07-16 | fix: params as Promise for Next.js 15 route handler |
| `0ecc7aa` | 07-16 | feat: eliminar conversación |
| `e856fc9` | 07-16 | feat: add ManualPanel with Agencia Quin brand identity |
| `56e146c` | 07-15 | feat: panel Ajustes con config WhatsApp |
| `8f7ee94` | 07-15 | feat: DisparadoresPanel condiciones/acciones estilo SellerChat |
| `daf5352` | 07-15 | fix: plantillas via API routes (service role) |
| `95eb72a` | 07-15 | feat: PlantillasPanel photo support |
| `1099d54` | 07-15 | **feat: 4-panel admin UI** ← nace QuinChat |
| `8e52bca` | 07-15 | fix: filtro Anuladas en Effi excluye los que volvieron como vigentes V69 |
| `f31db41` | 07-15 | fix: limpiar cruce entre effi vigentes y anulados al subir Excel V68 |
| `3109c5f` | 07-15 | feat: boton filtro Anuladas en Effi V67 |
| `f9d9d8e` | 07-15 | fix: detectar anuladas por valor de celda en vez de nombre de columna V66 |
| `409d902` | 07-15 | feat: badge ANULADA + VIGENTE para clientes que volvieron V65 |
| `c2878de` | 07-15 | feat: rediseno visual V63 - iconos en stats, botones pill, sidebar premium |
| `65e6c33` | 07-15 | feat: anuladas en Effi V62 - stat card, badge amarillo y WA Hola |
| `6e69347` | 07-15 | fix: textos de stats y badge mas claros para el equipo |
| `6c68ea2` | 07-11 | feat: barra conversion deduplicada confirmacion V60 |
| `be091d9` | 07-09 | fix: stats tiles respetan filtro de fecha V59 |
| `0c2789a` | 07-09 | feat: barra distribucion porcentual remarketing V58 |
| `bcf6fe6` | 07-09 | feat: Remarketing KLIXMANT V57 |
| `0d17573` | 07-05 | fix: bono WA abre app directa V56 |
| `3fdf195` | 07-04 | fix: persistencia definitiva localStorage-first V55 |
| `145937d` | 07-04 | fix: boton bono igual a confirmado V54 |
| `2e249dc` | 07-04 | fix: subir BONO.png + icono WA SVG V53 |
| `31f070b` | 07-04 | feat: bono WhatsApp + imagen bono + filtro sin WA V52 |
| `1527fd3` | 07-04 | fix: persistencia permanente billetera QUINO V51 |
| `1c072e3` | 07-04 | feat: filtro de fechas en billetera QUINO V50 |
| `23274e4` | 07-04 | feat: billetera QUINO comisiones Effi V49 |
| `becb440` | 07-04 | fix: cancelar venta mantiene página actual V48 |
| `615e0f1` | 07-04 | feat: badge 2 mensajes enviados azul celeste V47 |
| `a8117fc` | 07-04 | feat: segundo mensaje remarketing para clientes ya contactados V46 |
| `7730aac` | 07-03 | feat: nuevo mensaje confirmación Santiago + mayúsculas V45 |
| `63d7089` | 07-03 | feat: badge mensaje enviado remarketing V44 |
| `3ddcbb2` | 07-02 | fix: agregar Portugal y Argentina al catálogo V43 |
| `f5ecdf6` | 07-02 | fix: agregar productos RETRO al catálogo V42 |
| `b2cdd59` | 07-02 | feat: estados persistentes en Supabase V41 |
| `e1f4ca0` | 07-02 | feat: ordenar ventas más recientes primero V40 |
| `ed9693c` | 07-02 | chore: allow git add/commit in Bash permissions, remove CORRECCIONES version logs |
| `3b527f5` | 07-02 | feat: selección masiva + toggle 2 estados + conteo effi V39 |
| `a1e556c` | 07-02 | feat: columnas separadas confirmar datos y estado effi V38 |
| `0719527` | 07-02 | feat: fecha pedido + remarketing WA + confirmar datos separados V37 |
| `5b1905a` | 07-02 | feat: paginación 30x30 + sin mensaje WA + effi en main V36 |
| `8ab31a5` | 07-02 | feat: boton destacado 'Actualizar clientes' en la parte superior |
| `b736799` | 07-02 | feat: tabla persistente desde Supabase + empalme clientes V35 |
| `4888fe4` | 07-02 | feat: filtros columna + cancelar venta + sin WA + vista canceladas V34 |
| `70b0b75` | 07-02 | feat: auto-confirmar pedido al enviar WhatsApp V33 |
| `8f37cf1` | 07-01 | feat: filtro stats sincroniza tabla clientes + badge V32 |
| `3df75ea` | 07-01 | feat: filtro por fecha_pedido + dedup Effi + auto-eliminar confirmados V31 |
| `d42c179` | 07-01 | feat: filtro de fechas en estadísticas V30 |
| `d82d22d` | 07-01 | feat: fecha de compra visible + días reales de atraso V29 |
| `ffb8f15` | 07-01 | fix: prefijo ASCII 3 chars para Teléfono — comparación Effi V28 |
| `03126a3` | 07-01 | debug: log de columnas detectadas al subir Effi (V27 diagnóstico) |
| `652f0f1` | 07-01 | fix: getField con fallback ASCII para columnas con encoding corrupto V27 |
| `d5ae6a3` | 07-01 | feat: filtro de fechas desde/hasta en historial V26 |
| `d15b582` | 07-01 | feat: deduplicación clientes + limpiar filtros + auto-guardado historial V25 |
| `9839167` | 07-01 | feat: sidebar premium + stats bar V24 |

### 2026-06 — Era ConfirmaYa (40 commits)

| Hash | Fecha | Mensaje |
|---|---|---|
| `7157f31` | 06-30 | feat V23: módulo Historial y Comparación de Excel |
| `bde6edf` | 06-30 | feat V22: rediseño visual premium — Inter font, gradientes dorado, glass blur |
| `2dbeb28` | 06-30 | init: activar rama dev en Vercel |
| `45204f9` | 06-29 | chore: cache bust v21 |
| `ad5b45b` | 06-29 | fix V21: abrir WhatsApp app directo |
| `3d286c7` | 06-29 | chore: cache bust v20 en scripts y styles |
| `2b0b079` | 06-29 | fix V20: WhatsApp misma pestaña |
| `55bcd3e` | 06-29 | chore: force GitHub Pages cache bust |
| `9dee91e` | 06-29 | feat: time picker AM/PM con hora escribible en filtro de fechas |
| `013ff59` | 06-29 | feat V19: productos Retro 1990 + imágenes |
| `203ecf3` | 06-29 | feat: agregar filtro de hora en fecha de creación desde/hasta |
| `4887197` | 06-29 | feat V17+V18: botón copiar teléfono y filtro por fecha de creación |
| `bdf000f` | 06-29 | feat V18: filtro por fecha de creación |
| `ce84232` | 06-29 | fix V15: tabla visible + correcciones pendientes |
| `1044f2f` | 06-28 | fix: eliminar todos los emojis del mensaje WhatsApp |
| `bddc108` | 06-28 | fix: app.js estaba truncado - restaurar funcion buscarFotoProducto completa |
| `f1b2123` | 06-28 | fix: input file visible para navegador, stopPropagation en boton subir |
| `ceb2b38` | 06-28 | fix V14: restaurar carga de archivo |
| `da42528` | 06-28 | fix: V13 — boton seleccionar archivo abre explorador correctamente |
| `913c9ac` | 06-28 | fix: V12 — label nativo para subir archivo, fix correo cliente vacio |
| `2f307d8` | 06-28 | revert: V10 — quitar fondo inicio, restaurar header y emojis en mensaje |
| `3828cc7` | 06-28 | fix: clic seleccionar archivo no abria dialogo |
| `bd17daa` | 06-28 | feat: V5-V9 — fondo hero, logo, packs, emojis eliminados del mensaje |
| `4a8de67` | 06-28 | **VERSION1** |
| `c82b781` | 06-28 | fix: v3 - rutas imagenes con %20, catalogo completo 13 productos, busqueda en 3 niveles |
| `1cf1170` | 06-28 | fix: lectura correcta CSV Funnelish - columnas en ingles, nombre completo, formato valor |
| `fe8e2a1` | 06-28 | fix: catalogo.js con nombres reales de imagenes existentes en /img |
| `413db5f` | 06-28 | **feat: rediseno completo - Excel a tabla, modal, filtros y estados por pedido** |
| `100f39f` | 06-28 | tarea 20: advertencia mensaje largo (limite 1900 chars) |
| `eeac0ce` | 06-28 | tarea 19: verificar compatibilidad GitHub Pages |
| `b07f835` | 06-28 | tarea 18: prueba de integración completa |
| `5a9f647` | 06-28 | tarea 17: verificar y confirmar estilos preview |
| `8f4e9ee` | 06-28 | tareas 07-16: implementar app.js con todas las reglas de negocio |
| `ba60c46` | 06-28 | tarea 06: crear catalogo.js con objeto CATALOGO global |
| `8a27afc` | 06-28 | tarea 05: crear styles.css paleta negro/dorado/blanco |
| `80ecea1` | 06-28 | tarea 04: sección preview con imagen, textarea, botones |
| `7da960f` | 06-28 | tarea 03: formulario completo con 9 campos y datalist |
| `78701f4` | 06-28 | tarea 02: crear index.html con estructura base |
| `c3aa092` | 06-28 | tarea 01: crear carpeta img y placeholder PNG válido |
| `da54cff` | 06-28 | **Initial commit** |

---

## 13. Estado actual y pendientes

### Dónde estamos (28-ago-2026)
Fase de **pulido del Constructor de Embudos y del checkout** en `quinchat/`.
Rama `master`, último commit `0cface9` (v169).

### Trabajo sin commitear (candidato a **v170**)

| Archivo | Cambio |
|---|---|
| `components/panel/EditorBloqueLateral.tsx` | + Recuadro "💲 Editar precios" (precio de hoy / tachado) dentro del bloque lateral · + Botón ✕ rojo para **borrar una foto de la galería del embudo** con confirmación |
| `components/panel/EditorPareja.tsx` | El modo "pack numerado" ya no depende del nombre POLO: detecta cualquier grupo con número (BUZO 1, BUZO 2…) y al agregar variante respeta el nombre base en vez de forzar "POLO 3" |
| `components/panel/EmbudosPanel.tsx` | La miniatura de la lista usa `variantes[0].imagen` como portada (porque `imagenes[0]` quedaba compartida al duplicar embudos) · El nombre del producto ya no se corta con `truncate` |

> ⚠️ Estos cambios **no están en producción** — falta el push y el bump de versión.

### Pendientes conocidos

| # | Pendiente | Dónde está documentado |
|---|---|---|
| 1 | **quin-comercial Fase 5**: filtrar 66 archivos / 21 tablas por `tenant_id` | `quin-comercial/PLAN-FASE5.md` |
| 2 | **quin-comercial Fase 6**: pantalla de alta de clientes + Ajustes de WhatsApp por tenant | `quin-comercial/CONTINUACION-PROYECTO.md` |
| 3 | quin-comercial: rutas `api/whatsapp/send*`, `registrar` y `lib/whatsapp-templates.ts` todavía usan env en vez de contexto de tenant | idem |
| 4 | quin-comercial: revisar grants/RLS de `anon` y `authenticated` (páginas públicas y realtime) | idem |
| 5 | quin-comercial: faltan vars en Vercel (`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `QUINCHAT_MODEL`, VAPID, `CRON_SECRET`) y el `.env.local` local apunta a la base de producción de Klixmant | idem |
| 6 | **Bot de ventas** (segundo número, el que vende en vez de solo confirmar) | `PLAN_BOT_VENTAS.md` |
| 7 | `imgOptim()` devuelve la imagen original — la optimización con `/_next/image` rompía las fotos en producción y quedó desactivada | `lib/funnels.ts:118` |

### Deuda técnica visible
- `api/whatsapp/webhook/route.ts` (162 KB) y `EmbudosPanel.tsx` (120 KB) son archivos
  muy grandes; concentran la mayor parte del riesgo de regresión.
- `vercel.json` está vacío (`{}`) — los 14 crons no están declarados ahí, se disparan
  desde fuera.
- La rama `dev` existe pero no se usa desde el 30-jun-2026; todo va directo a `master`.

---

*Fin del documento.*
