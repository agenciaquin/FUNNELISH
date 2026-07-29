# Plan — Bot de Ventas (segundo número)

## 1. Qué es y para qué
Un segundo bot, en un **número nuevo**, que atiende a la gente que llega desde las
campañas de Meta y TikTok. Su trabajo no es confirmar pedidos (eso lo sigue
haciendo el bot actual), sino **vender**: saludar, mostrar el producto, resolver
dudas, vencer objeciones y cerrar la compra tomando los datos del cliente.

Corre en el **mismo sistema** que QuinChat, así que aprovecha todo lo ya hecho.
Lo único propio del bot de ventas es su forma de conversar y su bandeja aparte.

## 2. Cómo llega el cliente
En los anuncios se pone el botón **"Enviar mensaje por WhatsApp"** apuntando al
número nuevo, con un texto pre-armado (ej. *"Hola, quiero información 😊"*). Al
tocarlo, se abre el chat y el bot de ventas arranca la conversación.

## 3. Qué debe saber el bot de ventas
- **Catálogo**: qué productos hay, con sus fotos por color.
- **Precios**: precio de hoy y precio tachado; precios de packs (x2, x3).
- **Tallas** disponibles (hombre/dama) y guía de tallas si aplica.
- **Envío**: cobertura (toda Colombia), tiempo (3 a 6 días hábiles), **pago
  contra entrega**.
- **Garantía / cambios**: qué pasa si no le queda la talla, devoluciones, etc.
- **Diferenciales**: por qué comprar (calidad de la tela, diseño exclusivo…).

## 4. Cómo vende (flujo)
1. **Saludo cálido** y pregunta por lo que busca.
2. **Muestra el producto** con foto y precio; si duda, muestra opciones/colores.
3. **Resuelve objeciones** (ver sección 5).
4. **Empuja al cierre**: "¿te lo aparto y pagas cuando lo recibes?".
5. **Toma los datos** (nombre, teléfono, dirección completa, ciudad, talla, color).
6. **Crea el pedido** en el sistema (igual que un pedido de la página).
7. **Cierra y da tranquilidad**: confirma resumen y avisa próximos pasos.

## 5. Objeciones comunes que debe manejar
- **"¿Es seguro?"** → pago **contra entrega**, solo pagas cuando lo tienes en mano.
- **"Está caro"** → precio de hoy vs. precio normal, calidad, oferta por tiempo limitado.
- **"No sé mi talla"** → guía de tallas y preguntas simples (estatura/peso o talla usual).
- **"¿Cuánto demora?"** → 3 a 6 días hábiles, envío a toda Colombia.
- **"Déjame pensarlo"** → recordar unidades limitadas y facilidad del contra entrega.

## 6. Cuándo pasa a un humano
- El cliente pide algo fuera del catálogo o negocia condiciones especiales.
- Se molesta o insiste en hablar con una persona.
- El bot no entiende tras 2 intentos.
En esos casos marca **HUMANO**, apaga el bot en ese chat y avisa al asesor
(igual que hoy).

## 7. Qué comparte con el bot actual (no se rehace nada)
Panel, base de datos, etiquetas y estados, plantillas de WhatsApp, memoria del
bot, estadísticas, manejo de fotos/audio, detección de packs y colores, lógica
de dirección, registro de ventas. Todo se reutiliza.

## 8. Qué es nuevo
- **Bandeja "Chat Ventas"** en el menú (arriba *Chat Funnel*, abajo *Chat Ventas*),
  cada una filtrada por su número.
- **Cerebro de ventas**: el bot se comporta distinto según a qué número llegó el
  mensaje (vender vs. confirmar).
- Cada conversación queda **marcada con su número de origen**.

## 9. Cómo se enlaza con el flujo actual
Cuando el bot de ventas cierra la compra, el pedido entra al **mismo sistema** y
aparece en **Pedidos** como cualquier otro. Queda por decidir un punto (sección 11).

## 10. Fases de construcción (cuando aprobemos)
1. **Conectar el segundo número** a WhatsApp Cloud API (te guío paso a paso).
2. Marcar cada conversación con el **número por el que entró**.
3. Crear la **bandeja "Chat Ventas"** (filtra por ese número).
4. Construir el **cerebro de ventas** (forma de conversar + cierre).
5. Cargar el **catálogo de ventas** (productos, precios, tallas, políticas).
6. **Pruebas** con mensajes reales antes de poner anuncios.

## 11. Decisiones
- ✅ **DECIDIDO:** la confirmación del pedido cerrado por ventas sale por el
  **mismo número de ventas**. El cliente no cambia de chat: vende, cierra y
  confirma todo en la misma conversación.
- Pendiente: ¿el bot de ventas maneja los **mismos productos** que el funnel, o
  un catálogo distinto?
- Pendiente: ¿habrá **descuentos/ofertas** que solo el bot de ventas pueda dar?

## 12. Qué necesito que consigas
- El **segundo número** (línea nueva, no usada en la app normal de WhatsApp).
- La info del **catálogo de ventas**: productos, fotos, precios, tallas, tiempos
  y políticas de envío/garantía.
