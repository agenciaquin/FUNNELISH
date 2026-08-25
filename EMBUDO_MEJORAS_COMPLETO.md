# Mejoras del Editor de Embudos — Guía completa para replicar

Documento de referencia con **todo lo que se construyó** en el constructor visual de embudos
(ejemplo en vivo: `https://pedido.klixmant.shop/f1-escuderia-tk`).
Sirve para replicar cada función en otros proyectos (Next.js 16 + Supabase + Tailwind).

> Regla base de todo: **cada cambio es retrocompatible**. Si un campo no existe en un
> embudo viejo, se usa el valor por defecto y se comporta como antes. Nada rompe los
> embudos ya publicados.

---

## 0) Arquitectura del sistema de bloques

- Un embudo guarda su diseño en una columna `layout` (jsonb) con la forma:
  `{ bloques: Bloque[], checkout?: {...} }`.
- `Bloque = { id: string, tipo: string, visible?: boolean, props?: Record<string, any> }`.
- Cada bloque guarda TODO su estilo en `props` (tamaño, color, fondo, fuente, alineación,
  animación, margen arriba/abajo `mt`/`mb`, ancho `w`, url de media, etc.).
- Componentes presentacionales compartidos entre la **página pública** (servidor) y la
  **vista previa** del panel (navegador): así se ven idénticos.
- Archivos clave:
  - `lib/bloques.ts` — catálogo de bloques, defaults, helpers (`botonVariante`, `estiloBloque`, paletas, fuentes, animaciones).
  - `app/p/[slug]/page.tsx` — render público desde el layout.
  - `components/panel/EmbudosPanel.tsx` — editor principal (3 columnas: paleta | editor | teléfono).
  - `components/panel/VistaPreviaEmbudo.tsx` — el teléfono que además organiza (arrastrar/▲▼/👁/✕/⧉ + paleta "+").
  - `components/panel/EditorBloqueLateral.tsx` — editor del bloque seleccionado.
  - `components/publico/*` — componentes que se ven en la página real.

---

## 1) Editor visual dentro del teléfono (organizar + editar)

**Qué hace:** el teléfono de la derecha no es solo vista previa; también organiza.

- Cada bloque tiene controles al pasar el mouse: **▲ subir**, **▼ bajar**, **⧉ duplicar**,
  **👁 mostrar/ocultar**, **✕ borrar**, **⠿ arrastrar** para reordenar.
- Se puede **arrastrar** (drag & drop) para cambiar el orden.
- Al **tocar un bloque** se abre su editor en la columna del centro (que arranca vacía con
  el aviso "👉 Toca un bloque en el teléfono para editarlo").
- Cabecera del editor: solo **Dirección (slug)** + **Nombre del producto** + switch
  **Embudo PRENDIDO/APAGADO**.
- El botón **"💾 Guardar cambios"** de cada bloque guarda SIN sacarte del editor (aviso
  "✅ Cambios guardados"); si cambias de bloque sin guardar, avisa.

**Proporciones reales del teléfono:** el marco usa `max-w-[360px]` y la pantalla
`height: min(80vh, 720px)` para verse como un celular real.

---

## 2) Paleta de bloques + botón "+" al final de cada bloque

**Qué hace:** agregar bloques desde la izquierda o insertarlos en un punto exacto.

- Columna izquierda: **"＋ Agregar bloque"** lista todo el catálogo (`CATALOGO_BLOQUES`).
  Los **repetibles** siempre se pueden agregar; los **únicos** solo si no están ya.
- En el teléfono, **al final de cada bloque** aparece un botón redondo **"＋"** para
  insertar un bloque JUSTO en esa posición.
  - **Solo aparece en el bloque SELECCIONADO** (al que le diste clic). En los demás está
    oculto para no saturar. Condición: `onLayout && selectedId === b.id`.
  - Al tocarlo se despliega la paleta con todas las opciones e inserta en `idx + 1`.

**Cómo:** estado `paletaIdx`, función `agregarEn(idx, tipo)` que inserta el bloque nuevo
en la posición siguiente. Cada bloque del `map` se envuelve en `<Fragment>` para poder
poner la barra del "+" después.

---

## 3) Mini-barra de texto (Fuente · Color · Tamaño · Emoji)

**Qué hace:** encima de cada campo de texto sale una barrita compacta con las opciones de
formato, sin llenar el panel de controles.

- Componente `components/panel/MiniBarraTexto.tsx` con props:
  `{ p, setProp, fontKey?, colorKey?, sizeKey?, textKey?, sizeMin, sizeMax, colorDefault }`.
- Muestra chips pequeños: **🔤 Fuente ▾**, **● Color ▾**, **🅰 Tamaño ▾**, **😊 Emoji ▾**.
  Cada uno abre un pop pequeño que edita la prop correspondiente (fuente, color, tamaño) o
  inserta el emoji al final del texto.
- Solo se muestran los chips cuyas keys se le pasen.
- Está puesta encima de: texto libre, etiqueta de botón, título de "Clientes felices" y
  título de "Stock". Los públicos leen esas props y las aplican (`fontFamily`, `color`, `fontSize`).

---

## 4) Espacios más compactos + juntar bloques

- Se redujo el aire por defecto: menos margen en botones y menos padding en Stock y reseñas.
- Los sliders **"Espacio arriba / Espacio abajo"** (props `mt`/`mb`) ahora aceptan
  **valores negativos** (min -40) para **juntar** un bloque con el de al lado y quitar
  espacio. Se aplican como `marginTop`/`marginBottom` en el contenedor del bloque (público
  y preview).

---

## 5) Bloque "Clientes felices" (reseñas) — rediseño + extras

**Estructura:** foto grande a la izquierda + tarjeta con borde a la derecha (nombre en
mayúsculas, comentario, estrellas). Lista compacta (`space-y-2`).

Cada reseña (item) tiene: `nombre`, `estrellas`, `texto`, `foto`, y dos banderas nuevas:

### 5.1 Reseña gatillo (`gatillo: boolean`)
- La reseña marcada se resalta (borde rojo + etiqueta "🆕 NUEVA RESEÑA").
- Dispara un **aviso flotante** (ver punto 6).

### 5.2 Botón de compra entre reseñas (`boton: boolean`)
- Marca 🛒 en las reseñas donde quieras que, **después** de esa reseña, salga un botón de
  compra a todo el ancho (para hacer la venta más agresiva).
- El botón trae **todas las opciones de un botón normal** (props del bloque):
  - `botonTexto`, `botonColor`, `botonColorTexto`
  - `botonVariante` (pill / redondeado / cuadrado / borde / sombra / degradado)
  - `botonEscala` (tamaño del botón %), `botonSize` (tamaño de letra)
  - `botonAncho` (40–100%) y `botonAlign` (izquierda / centro / derecha) = **ubicación**
- Enlace: baja al `#checkout` si el checkout está embebido, o va a la página de pedido.

### 5.3 Título editable
- El título usa la mini-barra (props `tituloFont`, `tituloColor`, `tituloSize`).

---

## 6) Aviso flotante "Nueva reseña agregada" (editable)

**Qué hace:** cuando una reseña está marcada como *gatillo*, aparece un aviso flotante que
al tocarlo lleva (scroll) a esa reseña.

- Componente `components/publico/ResenaGatillo.tsx`. Props editables:
  - `texto` (ej. "Nueva reseña"), `color`, `colorTexto`
  - `posicion` (sup-izq / sup-der / inf-izq / inf-der)
  - `aparece` (segundos antes de salir), `dura` (segundos visible; luego se borra solo)
- Se edita dentro del bloque de reseñas, sección **"🆕 Aviso flotante de reseña gatillo"**
  (props `avisoTexto`, `avisoColor`, `avisoColorTexto`, `avisoPosicion`, `avisoAparece`,
  `avisoDura`).
- Muestra la foto y el primer nombre de la reseña gatillo.

---

## 7) Bloque "Botón MÁS VENDIDO" (flotante + preselección en checkout)

**Qué hace:** sello flotante "MÁS VENDIDO" que al tocarlo baja al checkout y deja
**preseleccionado** tu producto estrella (con etiqueta 🔥 MÁS VENDIDO sobre esa opción).

- Es un **bloque** del catálogo (clave `mas_vendido`), se agrega/elimina como los demás.
- Props: `texto`, `emoji`, `color`, `colorTexto`, `modelo` (nombre del producto estrella),
  `posicion` (arriba/centro/abajo), `size`.
- Componente `components/publico/MasVendidoFlotante.tsx`: al hacer clic dispara
  `window.dispatchEvent(new CustomEvent('quin:mas-vendido', { detail:{ modelo }}))` y hace
  scroll a `#checkout`.
- El checkout (`CheckoutPro`) escucha ese evento, selecciona el modelo por nombre y muestra
  la etiqueta "🔥 MÁS VENDIDO" sobre esa opción (prop `modeloMasVendido`).
- El editor del bloque muestra un **dropdown con las variantes** del embudo para elegir el
  producto estrella (o texto libre).
- **Se eliminó la insignia flotante antigua** (`InsigniaFlotante` / campo `insignia`): ya no
  se renderiza ni se edita; el campo queda en datos por compatibilidad pero no se muestra.

---

## 8) Bloque "Stock / escasez" — barra que baja sola

**Qué hace:** barra de urgencia que baja lento sola, sin vaciarse nunca.

- Componente `components/publico/BarraStockAnimada.tsx`.
- Se activa con la casilla **"📉 Barra que baja sola"**. Props:
  - `barraInicial` (dónde arranca %), `barraFinal` (mínimo, nunca baja de ahí)
  - `cadaSeg` (baja cada X seg, def 15), `paso` (cuánto baja cada vez %, def 1)
- Empieza en el inicial y con `setInterval` baja `paso` puntos hasta el `barraFinal`, ahí se
  queda. Backward compatible: sin activar, es barra fija con `porcentaje`.
- El título del bloque usa la mini-barra (props `tituloFont`, `tituloColor`, `tituloSize`).

---

## 9) Bloque "Ventas en vivo" (prueba social flotante)

**Qué hace:** aviso flotante "NUEVA VENTA REALIZADA" que aparece solo, dura unos segundos,
desaparece y va rotando por los mensajes que pongas.

- Bloque del catálogo (clave `ventas`). Componente `components/publico/NotifVentas.tsx`.
- Props editables:
  - `titulo` (fijo arriba, ej. "NUEVA VENTA REALIZADA")
  - `items: string[]` (mensajes que rotan, ej. "RED BULL NEGRO: Felipe P.")
  - `emoji`, `color`, `colorTexto`, `size`
  - `posicion` (inf-izq / inf-der / sup-izq / sup-der / centro)
  - `delayInicial` (sale por 1ª vez a los X seg, def 10)
  - `intervalo` (vuelve cada X seg, def 15)
  - `duracion` (dura visible X seg, def 3)
- Lógica: primer aviso a `delayInicial`; luego `setInterval` cada `intervalo`; cada aparición
  se muestra `duracion` seg (fade) y rota por `items` en orden.
- En la página pública se saca del flujo normal (`return null`) y se renderiza flotante aparte.

---

## 10) Checkout editable (Fase 1) — textos, colores, sellos, botón

**Qué hace:** al entrar a la pestaña **Checkout** del editor se abre un panel para editar el
checkout en vivo, reflejado también en el checkout real, **sin tocar la lógica de pedidos**.

- La config se guarda dentro del mismo `layout` bajo `layout.checkout` (jsonb, sin columna nueva).
- Campos (`CHECKOUT_DEFAULT`):
  - `titulo`, `subtitulo`, `tituloDatos` (encabezado "datos de envío")
  - `textoBoton`, `colorBoton` (vacío = usa el color de acento del embudo)
  - `sellos: [{emoji, texto}]` y `mostrarSellos` (mostrar/ocultar sellos de confianza)
- Se aplican en los dos checkouts públicos (`CheckoutPro` moderno y `FormularioPedido`
  clásico) y en la vista previa del panel. Backward compatible.

> **Pendiente (Fase 2):** reordenar/mostrar-ocultar las secciones del checkout y meter
> bloques libres entre los pasos. No hecho aún por ser lo más delicado (afecta el orden del
> formulario y el envío del pedido).

---

## 11) Editor de producto/variantes — pack desplegable + traer del catálogo

- Las **opciones de pack** (Pareja, Polos x2/x3, Armar pack 2/3, Arma tu pack) ahora están
  **ocultas** detrás de un botón **"📦 Opciones de pack ▸"** por variante (estado
  `packsOpen[i]`). Se abren solo si lo tocas.
- **"📥 Traer de Catálogos"** trae los colores con foto **y también las tallas** (las del
  embudo o unas por defecto S–XXXL si no hay). Todo queda editable: agregar/borrar colores
  y tallas. El precio se edita arriba (el catálogo no guarda precio).

---

## Catálogo de bloques disponibles (resumen)

| Bloque | Clave | Repetible | Notas |
|---|---|---|---|
| Banner de clientes | `banner` | no | Foto/video arriba |
| Titular | `titular` | no | Rota frases |
| Portada (galería/video) | `portada` | no | Galería o video |
| Botón COMPRAR | `boton` | sí | Variantes, tamaño, flotante |
| Precio | `precio` | no | Hoy + tachado |
| Contador de oferta | `contador` | no | Cuenta regresiva |
| Últimas unidades | `ultimas_unidades` | no | Aviso + foto detalle |
| Características | `caracteristicas` | no | Lista de beneficios |
| Estrellas de reseña | `estrellas` | sí | Fila de estrellas |
| Clientes felices | `testimonios` | sí | Reseñas + botón + aviso |
| Gatillos mentales | `gatillos` | sí | Oferta + stock + CTA |
| Stock / escasez | `stock` | sí | Barra que baja sola |
| Botón MÁS VENDIDO | `mas_vendido` | no | Flotante → preselecciona en checkout |
| Ventas en vivo | `ventas` | no | Prueba social flotante rotativa |
| Checkout (formulario) | `checkout` | no | Formulario clásico |
| Checkout PRO | `checkout_pro` | no | Cierre alto por pasos |
| Texto libre | `texto` | sí | Con mini-barra |
| Imagen / Video extra | `imagen` | sí | Media por bloque |
| Espacio en blanco | `espacio` | sí | Separador |

---

## Reglas de oro al replicar

1. Todo lo nuevo es **opcional y con default**: los embudos viejos no cambian.
2. Los flotantes (`mas_vendido`, `ventas`) se **sacan del flujo normal** (`return null` en el
   map) y se renderizan aparte, fijos.
3. Los estilos por bloque viven en `props`; los componentes públicos y la vista previa leen
   los mismos props para verse igual.
4. Verificar SIEMPRE con `tsc --noEmit` antes de desplegar.
5. Deploy: `cd "...\\quinchat"; vercel --prod` (en PowerShell usar `;`, no `&&`).
