# Prompts para replicar el editor de embudos — BLOQUE POR BLOQUE

Copia y pega **un prompt a la vez** en tu otra app (en orden). Cada uno es
independiente y retrocompatible (no daña lo ya hecho). Empieza por el 0 (la base)
y sigue en orden.

---

## 0) BASE — Sistema de bloques (hazlo primero)

```
Crea un sistema de página por BLOQUES para mis embudos (Next.js + Tailwind + Supabase):

1. El embudo guarda su diseño en una columna `layout` (jsonb) con la forma:
   { bloques: Bloque[], checkout?: {...} }.
   Bloque = { id: string, tipo: string, visible?: boolean, props?: Record<string,any> }.
   Cada bloque guarda TODO su estilo en props (size, color, bg, font, align, anim,
   mt, mb, w, url…).

2. lib/bloques.ts (puro, sin React): CATALOGO_BLOQUES (lista de tipos con clave,
   nombre, emoji, desc, repetible, contenido), helpers estiloBloque(props),
   botonVariante(v,bg), nuevoIdBloque(), layoutPorDefecto(), bloquesARenderizar(layout),
   y las paletas: FUENTES, ANIMACIONES, PALETA_COLORES, VARIANTES_BOTON.

3. Página pública app/p/[slug]/page.tsx: recorre bloquesARenderizar(layout) y con un
   switch renderBloque(b) dibuja cada tipo, aplicando margin/ancho desde props (mt, mb, w).

4. Editor en 3 columnas: izquierda = paleta "Agregar bloque"; centro = editor del
   bloque seleccionado (vacío hasta que tocas un bloque); derecha = TELÉFONO que además
   organiza (arrastrar, ▲▼ mover, ⧉ duplicar, 👁 ocultar, ✕ borrar, ⠿ arrastrar).
   Cabecera: solo Dirección (slug) + Nombre del producto + switch Prendido/Apagado.

5. Proporciones reales del teléfono: marco max-w-[360px], pantalla height:min(80vh,720px).

Verifica con tsc --noEmit y despliega.
```

---

## 1) BLOQUE Banner de clientes

```
Agrega el bloque "banner" (foto/video de clientes, arriba del todo):
- clave 'banner', no repetible. Props: url (media propia), h (alto), modo ('individual'|'collage').
- Público: si modo 'collage' muestra grid 2x2 de las primeras 4 fotos de la galería;
  si no, muestra p.url (o la imagen de clientes del embudo) a ancho completo, con alto
  opcional (props.h).
- Editor (media): recuadro para subir/arrastrar archivo (Foto/GIF o Video), toggle
  Foto/Video vs Collage, slider de alto.
Verifica con tsc y despliega.
```

---

## 2) BLOQUE Titular

```
Agrega el bloque "titular" (título grande que rota entre frases):
- clave 'titular', no repetible. Usa las frases del embudo (o el título) y las rota
  cada 3s (componente FrasesRotativas).
- Estilo desde props: size, color, font, align, anim (aplica estiloBloque).
- Editor: mini-barra de texto (fuente/color/tamaño/emoji) + editor de frases
  desplegable (hasta 5).
Verifica con tsc y despliega.
```

---

## 3) BLOQUE Portada (galería / video / carrusel)

```
Agrega el bloque "portada" (la galería/video del producto) con modo CARRUSEL:
- clave 'portada', no repetible. Props: url, h, modo ('individual'|'carrusel'), fotos (string[]).
- Público:
  * modo 'carrusel': muestra las fotos elegidas (props.fotos o todas las de la galería)
    en un carrusel que auto-avanza cada 2s, con flechas, puntitos y tira de miniaturas
    (componente Galeria con segundos=2).
  * si hay url: muestra esa foto/video.
  * si no: Galeria con todas las fotos, o el video del embudo.
- Editor: recuadro para subir archivo; toggle "Cómo se ve": Foto/Video vs Carrusel.
  Cuando es Carrusel: cuadrícula con las fotos de la galería (checkbox para incluir cada
  una en props.fotos; si no eliges ninguna, salen todas) + botón "➕ Subir varias fotos"
  con <input type="file" multiple> que sube todas, las agrega a la galería y las marca.
- En el TELÉFONO del editor, debajo de la imagen del carrusel muestra la tira de
  miniaturas y al final una casilla "➕ agregar más fotos" que sube varias desde ahí.
Verifica con tsc y despliega.
```

---

## 4) BLOQUE Botón COMPRAR

```
Agrega el bloque "boton" (botón de compra contra entrega), repetible:
- clave 'boton', repetible. Props: label (texto), variante (pill/redondeado/cuadrado/
  borde/sombra/degradado), bg (color), escala (tamaño %), compacto, flotante, anim, font, size.
- Público: si la página tiene checkout embebido, el botón BAJA hasta el checkout;
  si no, enlaza a la página de pedido. Usa botonVariante(variante,bg) para clase+estilo
  y aplica escala al padding y tamaño de letra.
- Los botones marcados como flotante (props.flotante) se sacan del flujo y se muestran
  fijos en una barra abajo.
- Editor: texto (con mini-barra), tipos de botón (variantes), slider "Tamaño del botón"
  (escala), color, y casilla "Botón flotante".
Verifica con tsc y despliega.
```

---

## 5) BLOQUE Precio

```
Agrega el bloque "precio":
- clave 'precio', no repetible. Muestra el precio de hoy y el precio tachado (antes).
- Props: números y etiquetas (labelHoy, labelAntes) y colores. 
- Editor: precio de hoy / tachado (números), textos de las etiquetas y colores.
Verifica con tsc y despliega.
```

---

## 6) BLOQUE Contador de oferta

```
Agrega el bloque "contador" (cuenta regresiva de urgencia):
- clave 'contador', no repetible. Usa las horas del embudo; componente Contador cliente.
Verifica con tsc y despliega.
```

---

## 7) BLOQUE Últimas unidades + detalle

```
Agrega el bloque "ultimas_unidades" (aviso "últimas unidades" + foto de detalle):
- clave 'ultimas_unidades', no repetible. Props: soloTexto (bool) para ocultar la foto.
Verifica con tsc y despliega.
```

---

## 8) BLOQUE Características

```
Agrega el bloque "caracteristicas" (lista de beneficios del producto):
- clave 'caracteristicas', no repetible. Usa la lista de características del embudo.
Verifica con tsc y despliega.
```

---

## 9) BLOQUE Estrellas de reseña

```
Agrega el bloque "estrellas" (fila de 5 estrellas), repetible:
- clave 'estrellas', repetible. Estilo desde props (size, color, anim).
Verifica con tsc y despliega.
```

---

## 10) BLOQUE Clientes felices (reseñas) — completo

```
Agrega el bloque "testimonios" (reseñas) con extras, repetible:
- clave 'testimonios', repetible, contenido. Props: titulo (+tituloFont/tituloColor/
  tituloSize), items[], badges[]. Cada item: nombre, estrellas, texto, foto, gatillo(bool),
  boton(bool). Props del botón: botonTexto, botonColor, botonColorTexto, botonVariante,
  botonEscala, botonSize, botonAncho (40-100%), botonAlign (left/center/right). Props del
  aviso: avisoTexto, avisoColor, avisoColorTexto, avisoPosicion, avisoAparece, avisoDura.

- Público (componente Testimonios): foto grande izquierda + tarjeta con borde derecha
  (nombre en mayúsculas, texto, estrellas), lista compacta. Contenedor id="clientes-felices".
  * Si un item tiene gatillo:true, resáltalo (borde rojo + "🆕 NUEVA RESEÑA").
  * Después de cada item con boton:true, renderiza un botón de compra a todo el ancho
    (Link a href) usando botonVariante + botonAncho + botonAlign + tamaños.
  * Título aplica tituloFont/tituloColor/tituloSize.

- Aviso flotante (componente ResenaGatillo): si hay un item gatillo, aparece a los
  `avisoAparece` seg en una esquina (avisoPosicion), dura `avisoDura` seg y se borra;
  al tocarlo hace scrollIntoView a #clientes-felices. Muestra foto + primer nombre.

- Editor: título (mini-barra); lista de reseñas (nombre, estrellas, texto, subir foto,
  casilla "🆕 Reseña gatillo", casilla "🛒 Botón después de esta reseña"); sección del
  botón entre reseñas (texto, tipo, tamaño botón, tamaño letra, colores, ancho, ubicación);
  sección del aviso flotante (texto, ubicación 4 esquinas, colores, aparece/dura); sellos.
Verifica con tsc y despliega.
```

---

## 11) BLOQUE Gatillos mentales

```
Agrega el bloque "gatillos" (urgencia: oferta + stock a un lado, precio + CTA al otro),
repetible:
- clave 'gatillos', repetible, contenido. Props (todo editable con tamaño/color): titulo,
  colorTitulo, tituloSize, mensaje, colorMensaje, mensajeSize, porcentaje, colorBarra,
  descripcion, descSize, colorDesc, badges[], labelNormal, labelOferta, colorPrecio,
  ofertaSize, precioSize, colorOferta, cta, colorCta, ctaSize, ctaEscala, ctaVariante, font.
- Público (componente Gatillos): 2 columnas (caja de oferta+barra sin borde | precio),
  CTA a todo el ancho (botonVariante + ctaSize*ctaEscala), instrucción opcional, sellos arriba.
- Editor: cada texto con su tamaño y color; badges editables; CTA con forma/tamaño/color.
Verifica con tsc y despliega.
```

---

## 12) BLOQUE Stock / escasez (barra que baja sola)

```
Agrega el bloque "stock" (barra de escasez), repetible, con opción de barra animada:
- clave 'stock', repetible, contenido. Props: titulo (+tituloFont/tituloColor/tituloSize),
  porcentaje, mensaje, alerta, color, flotante, y para la animación: animar(bool),
  barraInicial, barraFinal, cadaSeg (def 15), paso (def 1).
- Componente BarraStockAnimada ('use client'): arranca en barraInicial y con setInterval
  cada cadaSeg baja `paso` puntos, NUNCA por debajo de barraFinal (no se vacía).
- Público (componente Stock): si animar y barraInicial>barraFinal usa BarraStockAnimada;
  si no, barra fija con porcentaje. Puede ir flotante.
- Editor: título (mini-barra), % barra, mensaje, alerta, color, casilla "📉 Barra que baja
  sola" con sliders (inicial, final, cada X seg, cuánto baja), casilla flotante.
Verifica con tsc y despliega.
```

---

## 13) BLOQUE Botón MÁS VENDIDO (flotante)

```
Agrega el bloque "mas_vendido" (sello flotante que preselecciona el producto estrella):
- clave 'mas_vendido', no repetible, contenido. Props: texto, emoji, color, colorTexto,
  modelo (nombre del producto estrella), posicion (arriba/centro/abajo), size.
- Componente MasVendidoFlotante ('use client'): botón fijo palpitante; al hacer clic
  dispara window.dispatchEvent(new CustomEvent('quin:mas-vendido',{detail:{modelo}})) y
  hace scroll a #checkout.
- El checkout escucha ese evento (prop modeloMasVendido): selecciona el modelo por nombre
  y le pone etiqueta "🔥 MÁS VENDIDO" a esa opción.
- En la página pública saca el bloque del flujo normal (return null) y renderízalo flotante.
- Editor: texto, dropdown con las variantes del embudo (producto estrella), emoji, posición,
  tamaño y colores.
Verifica con tsc y despliega.
```

---

## 14) BLOQUE Ventas en vivo (prueba social flotante)

```
Agrega el bloque "ventas" (aviso flotante "NUEVA VENTA REALIZADA" que rota solo):
- clave 'ventas', no repetible, contenido. Props: titulo, items[] (mensajes que rotan),
  emoji, color, colorTexto, size, posicion (4 esquinas/centro), delayInicial (def 10),
  intervalo (def 15), duracion (def 3).
- Componente NotifVentas ('use client'): primer aviso a delayInicial seg; luego setInterval
  cada intervalo seg; cada aparición dura duracion seg (fade) y rota por items.
- En la página pública saca el bloque del flujo normal (return null) y renderízalo flotante.
- Editor: título, lista editable de mensajes (agregar/quitar), emoji, ubicación, tamaño,
  colores y 3 sliders de tiempos.
Verifica con tsc y despliega.
```

---

## 15) BLOQUE Checkout / Checkout PRO + edición del checkout

```
Agrega los bloques de checkout embebido y hazlo editable:
- clave 'checkout' (formulario clásico) y 'checkout_pro' (cierre alto por pasos: modelo,
  género, talla, cantidad; el botón se enciende al completar). Ambos con id="checkout"
  para que los botones "COMPRAR" bajen hasta ahí.
- Ajustes editables guardados en layout.checkout (jsonb, sin columna nueva). CHECKOUT_DEFAULT:
  titulo, subtitulo, tituloDatos, textoBoton, colorBoton (vacío=acento), sellos[{emoji,texto}],
  mostrarSellos. Aplícalos a los componentes de checkout (título, sellos, botón) con fallbacks.
- En el editor, al entrar a la pestaña Checkout muestra un panel "🛒 Editar checkout" con
  esos campos, reflejado en vivo en la vista previa. Todo retrocompatible (no toca la lógica
  de envío del pedido).
Verifica con tsc y despliega.
```

---

## 16) BLOQUE Texto libre

```
Agrega el bloque "texto" (texto tuyo donde quieras), repetible:
- clave 'texto', repetible, contenido. Props: texto, y estilo (size, color, bg, font, align,
  anim, bold).
- Editor: textarea + mini-barra de texto (fuente/color/tamaño/emoji) encima.
Verifica con tsc y despliega.
```

---

## 17) BLOQUE Imagen / Video extra

```
Agrega el bloque "imagen" (foto o video extra en cualquier parte), repetible:
- clave 'imagen', repetible, contenido. Props: url (media propia POR BLOQUE, para que al
  duplicar cada uno sea independiente), h (alto), modo (individual/collage).
- Editor: recuadro para subir/arrastrar (Foto/GIF o Video), toggle individual/collage, alto.
Verifica con tsc y despliega.
```

---

## 18) BLOQUE Espacio en blanco

```
Agrega el bloque "espacio" (separador), repetible:
- clave 'espacio', repetible, contenido. Props: alto (px, def 24). Solo renderiza un div
  con esa altura.
Verifica con tsc y despliega.
```

---

## EXTRAS transversales (aplican a varios bloques)

```
1) MINI-BARRA DE TEXTO: componente MiniBarraTexto ('use client') con chips pequeños
   🔤 Fuente · ● Color · 🅰 Tamaño · 😊 Emoji (cada uno abre un pop). Ponla ENCIMA de cada
   campo de texto (título, texto libre, etiqueta de botón) editando las props de estilo
   correspondientes; el público aplica fontFamily/color/fontSize.

2) BOTÓN "+" POR BLOQUE: en el teléfono, al final del bloque SELECCIONADO (selectedId===b.id)
   muestra un "+" que abre la paleta e inserta un bloque en idx+1 (función agregarEn).

3) ESPACIOS: sliders Espacio arriba/abajo (mt/mb) que aceptan valores NEGATIVOS (min -40)
   para juntar bloques. Aplica marginTop/marginBottom (negativos también) al contenedor.

4) FLOTANTES: los bloques flotantes (boton flotante, stock flotante, mas_vendido, ventas)
   se sacan del flujo (return null) y se renderizan fijos aparte.

Verifica con tsc --noEmit y despliega.
```

---

### Reglas de oro
- Todo nuevo es opcional y con default: los embudos viejos no cambian.
- Público y vista previa leen los MISMOS props para verse igual.
- Verifica con `tsc --noEmit` antes de desplegar.
- Deploy en PowerShell: `cd "...\quinchat"; vercel --prod` (usa `;`, no `&&`).
