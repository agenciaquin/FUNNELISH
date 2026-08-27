# QuinChat — Estructura completa de los Embudos (guía para replicar)

Documento maestro de **cómo está construido** todo el sistema de embudos: la página de
inicio (venta), el checkout, el registro del pedido, el panel y cada función/botón.
Stack: **Next.js 16 (App Router) + Supabase (Postgres) + Tailwind + Vercel**.
Dominio de la tienda: `pedido.klixmant.shop`.

> Regla de oro: todo lo nuevo es **opcional y con valor por defecto** → los embudos
> viejos no se rompen. Verificar siempre con `tsc --noEmit` antes de desplegar.

---

## 1. Arquitectura general

- **Dos sitios en un mismo proyecto** (por dominio, con `middleware.ts`):
  - `pedido.` (tienda pública) → sin login; `/{slug}` reescribe a `/p/{slug}`; la raíz
    va a `/tienda` (muestra el embudo activo más reciente).
  - Cualquier otro host → el **panel**, protegido con login (next-auth).
- **Un embudo = una fila** en la tabla `funnels`. Su diseño visual vive en la columna
  `layout` (jsonb): `{ bloques: Bloque[], checkout?: {...} }`.
- **Bloque**: `{ id, tipo, visible?, props? }`. Cada bloque guarda TODO su estilo en
  `props` (size, color, bg, font, align, anim, mt, mb, w, url…).
- Componentes **presentacionales compartidos** entre la página pública (servidor) y la
  vista previa del panel (navegador) → se ven idénticos.

### Archivos clave
- `lib/bloques.ts` — catálogo de bloques, defaults, helpers y paletas.
- `app/p/[slug]/page.tsx` — página de venta pública (renderiza desde el layout).
- `app/p/[slug]/pedido/page.tsx` — checkout clásico (FormularioPedido).
- `app/p/[slug]/gracias/page.tsx` — "¡Gracias!" + registra el paso 'compra'.
- `components/publico/*` — lo que ve el cliente (Galeria, Testimonios, Gatillos, Stock,
  CheckoutPro, FormularioPedido, MasVendidoFlotante, NotifVentas, ResenaGatillo…).
- `components/panel/EmbudosPanel.tsx` — editor del embudo (lista + editor 3 columnas).
- `components/panel/VistaPreviaEmbudo.tsx` — el teléfono que organiza y previsualiza.
- `components/panel/EditorBloqueLateral.tsx` — editor del bloque seleccionado.
- `app/api/funnels/*` — guardar embudos, imágenes, plantillas, carrito, stats, evento.
- `app/api/pedidos/*` — recibir/guardar/listar pedidos.
- `app/api/funnelish/webhook/route.ts` — guarda el pedido en `clientes_funnelish` + WhatsApp.

---

## 2. Editor del embudo (panel) — 3 columnas

- **Izquierda**: paleta "➕ Agregar bloque" (todo el catálogo).
- **Centro**: editor del bloque seleccionado (vacío hasta tocar un bloque). Botón
  "⚙️ Contenido y ajustes" despliega el formulario completo (fotos, productos, textos, color…).
- **Derecha (TELÉFONO)**: además de previsualizar, **organiza**: arrastrar, ▲▼ mover,
  ⧉ duplicar, 👁 ocultar, ✕ borrar, ⠿ arrastrar. Proporciones reales (`max-w-[360px]`,
  `height: min(80vh,720px)`). Botón "＋" al final del bloque **seleccionado** para
  insertar otro ahí.
- **Cabecera**: solo Dirección (slug) + Nombre del producto + switch PRENDIDO/APAGADO.
- Pestañas del teléfono: **🏠 Inicio** / **🛒 Checkout**. Al tocar Checkout, el editor
  del centro muestra SOLO "Productos del checkout" + Textos y ajustes + Color.

---

## 3. Bloques de la PÁGINA DE INICIO

| Bloque | clave | Qué hace |
|---|---|---|
| Banner de clientes | `banner` | Foto/video arriba (o collage 2x2). |
| Titular | `titular` | Título grande que rota entre frases (cada 3s). |
| Portada | `portada` | Galería/video. Modo **Carrusel**: fotos elegidas que cambian solas cada 2s, con flechas, puntitos y miniaturas + subir varias fotos. |
| Botón COMPRAR | `boton` (repetible) | Baja al checkout o va a /pedido. Variantes, tamaño (escala), color, flotante. |
| Precio | `precio` | Precio de hoy + tachado, con etiquetas y colores. |
| Contador | `contador` | Cuenta regresiva de urgencia. |
| Últimas unidades | `ultimas_unidades` | Aviso + foto de detalle. |
| Características | `caracteristicas` | Lista de beneficios. |
| Estrellas | `estrellas` (repetible) | Fila de 5 estrellas. |
| Clientes felices | `testimonios` (repetible) | Reseñas (foto + tarjeta), con: reseña "gatillo" (aviso flotante a los X seg) y botón de compra intercalado con todas las opciones. |
| Gatillos mentales | `gatillos` (repetible) | Oferta + barra de stock + precio + CTA, todo editable (tamaño/color/%). |
| Stock / escasez | `stock` (repetible) | Barra de urgencia; opción "baja sola" (de inicial a final, sin vaciarse). Puede ir flotante. |
| Botón MÁS VENDIDO | `mas_vendido` | Sello flotante; al tocarlo baja al checkout y preselecciona el producto estrella (etiqueta 🔥). |
| Ventas en vivo | `ventas` | Aviso flotante "NUEVA VENTA REALIZADA" que rota mensajes (tiempos editables). |
| Texto libre | `texto` (repetible) | Texto tuyo, con mini-barra (fuente/color/tamaño/emoji). |
| Imagen/Video extra | `imagen` (repetible) | Media por bloque (independiente al duplicar). |
| Espacio | `espacio` (repetible) | Separador (alto configurable). |

Extras transversales: **mini-barra de texto** encima de cada campo, sliders de espacio
`mt`/`mb` con **valores negativos** para juntar bloques, y los **flotantes**
(`boton` flotante, `stock`, `mas_vendido`, `ventas`) salen del flujo y se fijan.

---

## 4. CHECKOUT

Dos componentes según el embudo:
- **`FormularioPedido`** (clásico): página aparte `/{slug}/pedido`. Elige color/talla,
  llena datos, "COMPLETAR MI PEDIDO".
- **`CheckoutPro`** (cierre alto): por pasos (modelo con foto → género → talla →
  cantidad); el botón se enciende al completar. Se puede embeber con el bloque
  `checkout_pro` (una sola pantalla; el botón COMPRAR baja hasta ahí, id `#checkout`).

### Productos del checkout (variantes)
- En el editor, sección "Productos del checkout": "+ Agregar producto", "+ Producto
  variable (color+talla)", "Editar masivo" (Unidad / Pack x2 / Pack x3).
- Cada producto: nombre, precio, precio tachado, **colores con foto** (+ "Traer de
  Catálogos", que trae colores y tallas), **tallas** (una vez para todos), y
  "📦 Opciones de pack" (Pareja, Variables Polos x2/x3, Arma tu pack).
- **Variables Polos**: cada prenda con su propio color y talla; "+ Agregar otra
  variable (pasa a pack x3)".
- Modelo: `variantes` jsonb con `selectores` (COLOR/TALLA, con `grupo` para packs).

### Robustez del envío (que no se pierda ni una venta)
- El checkout **espera hasta 12s** a que el servidor confirme el guardado antes de
  mostrar "Gracias". Si falla, deja reintentar; si va lento, igual guarda (keepalive).

---

## 5. Registro del PEDIDO (flujo de datos)

1. El cliente completa el checkout → `POST /api/pedidos` con `slug`, datos, producto,
   fotos, utms, referrer, y píxeles (fbq Purchase + ttq CompletePayment).
2. `/api/pedidos` reenvía a `/api/funnelish/webhook` que:
   - Arma el pedido (packs, colores, collage x2), detecta duplicados (mismo tel+producto
     en 30 min → 'duplicado').
   - Inserta en **`clientes_funnelish`** (estado 'pendiente', `foto_producto`,
     `funnel_slug` = embudo de origen, utms, referrer).
   - Envía la **plantilla de WhatsApp** de confirmación al cliente (marca `wa_enviado`).
   - Manda la **Purchase a Meta por CAPI** (server-side) con el mismo `eventId`.
3. La página `/gracias` registra el paso de rastreo 'compra'.

### Tablas principales
- `funnels`: slug, nombre, producto, precio, precio_antes, imagenes, tallas, variantes,
  color, pixel_meta(+token), pixel_tiktok(+token), layout (jsonb), insignia, activo,
  eliminado/eliminado_at (papelera), creado_at.
- `clientes_funnelish`: pedidos (nombre, telefono, producto, talla, valor, direccion…,
  estado, confirmado, wa_enviado, foto_producto, **funnel_slug**, utm_*, referrer).
- `carritos_abandonados`: nombre+telefono que no completaron (slug, producto, datos jsonb, nota, recuperado).
- `funnel_eventos`: pasos del embudo (landing, scroll_fin, pedido, talla, datos, boton, compra).

---

## 6. Panel — secciones y botones

- **Embudos**: lista con Copiar (enlace), Ver (vista previa), Estadísticas, **Editar**,
  **Duplicar** (pregunta el nombre → crea el slug desde el nombre, queda activo), 🗑
  (papelera). Arriba: Campañas, Plantillas, **Carritos abandonados**, Papelera, Eliminar
  (selección múltiple), + Nuevo embudo.
- **Pedidos**: lista full-width; columnas Fecha, Estado, Cliente, Producto, **Embudo**
  (nombre real + 🚀 ver en vista previa + ✏️ editar el embudo), Campaña, Valor. Cruza el
  embudo por `funnel_slug` (exacto) → referrer → nombre único. "Confirmadas por día",
  totales (pedidos/confirmados/cancelados/vendido), buscador, filtros (Funnel/WhatsApp/
  Todas, Hoy/7/30 días).
- **Carritos abandonados**: solo los que NO completaron; se **excluye** a quien ya hizo
  un pedido (cualquier estado menos cancelado/duplicado) creado en o después del carrito.
  Botones: WhatsApp, marcar recuperado, agregar nota, eliminar; selección masiva.
- **Estadísticas del embudo**: embudo por pasos y dónde se cae; "Compra realizada" =
  **ventas reales guardadas** (no el contador de la página de gracias).
- **Remarketing**: elige etiqueta(s) → envía una plantilla de Meta aprobada a esos
  clientes (funciona fuera de la ventana de 24h).
- Otras: Chat Funnel, Chat WhatsApp, Tus metas, Estado en Effi, Vendedores, META ADS,
  Objeciones, Herramientas (Memoria, Plantillas, Disparadores, Contactos, Etiquetas,
  Catálogos, Integraciones, Ajustes, Manual).

---

## 7. Píxeles y anuncios

- Cada embudo guarda `pixel_meta` (+token CAPI) y `pixel_tiktok` (+token). La página
  dispara ViewContent al abrir y Purchase al comprar (navegador **y** servidor/CAPI con
  el mismo eventId para no duplicar).
- Los anuncios deben apuntar al **enlace con el slug** (`pedido.klixmant.shop/{slug}`)
  para que cada venta quede atribuida a su embudo.
- Meta marca un evento "activo" solo cuando **recibe** compras; si sale "inactivo",
  verifica que el pixel del anuncio sea el mismo del embudo y haz una compra de prueba.

---

## 8. Reglas al replicar (resumen)

1. Todo campo nuevo es opcional con default → no rompe embudos viejos.
2. Público y vista previa leen los MISMOS props.
3. Los flotantes se sacan del flujo (`return null`) y se renderizan fijos aparte.
4. Migraciones SQL **idempotentes** (`add column if not exists`); columnas nuevas que se
   escriben en el pedido van en un `update` aparte para no romper el guardado.
5. Verificar con `tsc --noEmit`. Deploy en PowerShell: `cd "...\quinchat"; vercel --prod`
   (usa `;`, no `&&`).
