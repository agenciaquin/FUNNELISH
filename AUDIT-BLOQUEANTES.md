# Auditoría · rama `bloqueantes-consumo`

**Fecha:** 30-09-2026 · **Base:** `master` · **Alcance:** `git diff master..HEAD -- quinchat quin-comercial ':!*/pruebas/*'`
(42 archivos, +389/−42) contrastado con `BLOQUEANTES-CONSUMO.md` y `CLAUDE.md`.
Revisión de código; no se ejecutó nada contra producción. La LEY de imágenes no se evalúa como fallo de esta rama.

**Veredicto: REQUIERE CORRECCIONES** (5 fallos; el nº 1 es una fuga de datos personales en quinchat).

---

## ✅ Lo que pasa

- **Middleware (las dos apps):** todo `/api/` pasa por `esApiPublica` antes de la lógica de tienda, así que la
  tienda ya no abre la API entera. La lista exacta no abre subrutas (`/api/pedidos` ≠ `/api/pedidos/lista`).
  Mayúsculas (`/API/...`), `%2e%2e` y barra final están cubiertos por la prueba. No hay server actions
  (`"use server"` no aparece en ningún archivo). Las páginas del panel son `/`, `/panel` y `/quinchat`; en la tienda
  se reescriben a `/p/...`, y ninguna ruta dinámica del panel admite un `.` que la saque de la reescritura.
  `/p/`, `/[slug]`, `/pedido`, `/gracias`, `/tienda` y `/registro` siguen igual que antes.
- **Crons:** los 13/14 que usan `CRON_SECRET` fallan cerrados. `promo-cierre` de quinchat no usa clave, pero no
  hace nada (no-op), así que da igual. `ventas-seguimiento` pide ya la clave en las dos apps.
- **Firma de Meta:** HMAC sobre el texto crudo, `timingSafeEqual` con comprobación de longitud y cuerpo leído
  una sola vez. Ninguna ruta vuelve a leer `req` después de `leerAvisoDeMeta` (grep de `req.json/text/clone`
  en los dos webhooks). Cuerpo vacío o no JSON → `body: null` → 200 sin procesar; con clave y sin firma → 401.
- **Token de Funnelish:** comparación en tiempo constante; el checkout propio llama a `procesarPedidoFunnelish`
  sin pasar por el token (quinchat `app/api/pedidos/route.ts:2`).
- **Freno del bot:** los mensajes que se escriben desde el panel (`send`, `send-media`, `send-media-url`,
  `plantillas-wa/enviar`) se guardan con `role: 'agent'`, así que **no** cuentan para el tope. En quin-comercial el
  cliente `supabaseTenant` filtra también el `select(..., {count, head})`, así que el conteo va por cliente.
- **Anti-duplicados quinchat:** la línea de ventas sale antes (`webhook/route.ts:704`), pero `atenderVenta` ya
  tiene su propio anti-duplicados (`lib/quinchat/ventas.ts:1082-1086`). Queda cubierta.
- **Recargas (Mercado Pago):** la ruta abierta consulta el pago en la API de MP y acredita de forma idempotente
  (`lib/recargas.ts:78-85`).
- **Calidad:** los cambios son pequeños y localizados, los comentarios están en español y los finales de línea son
  LF, igual que en el resto del repo. `git diff --check` no marca nada.

---

## ❌ Fallos

### 1 · quinchat: `/api/funnels/carrito` deja ver, cambiar y borrar los carritos sin sesión (datos personales)
- `quinchat/middleware.ts:28` abre la ruta **para todos los métodos**. La ruta solo tendría que ser pública
  para el `POST`, pero `quinchat/app/api/funnels/carrito/route.ts` no pide sesión en ninguno:
  `GET` (l. 59) devuelve hasta 500 carritos con `nombre, telefono, producto, talla, valor, datos, nota`;
  `PATCH` (l. 122) los modifica; `DELETE` (l. 149, `?ids=a,b,c`) los borra.
- **Escenario:** `curl https://pedido.klixmant.shop/api/funnels/carrito` da la lista de clientes. Antes solo
  estaba abierta en la tienda; **ahora está abierta también en el panel**. El documento dice que se cierran los
  "pedidos con datos personales", y este hueco sigue ahí. La prueba del middleware lo daba por bueno porque
  solo mira que las rutas públicas "lleguen a su código".
- **Arreglo:** hacer lo mismo que quin-comercial (`getServerSession` en `GET/PATCH/DELETE`), o que el
  middleware solo deje pasar `POST` en `API_PUBLICA_EXACTA`. El `GET` de diagnóstico de `/api/funnels/evento`
  (quinchat l. 34, inserta una fila `_diag` y devuelve el total) también debería pedir sesión.

### 2 · `/api/pedidos` hace sin token lo mismo que el token de Funnelish quería impedir
- `lib/token-funnelish.ts` justifica el token así: *"cualquiera crea pedidos falsos y hace que se mande una
  plantilla de confirmación (de pago) al número que quiera"*. Pero `/api/pedidos`, que sigue siendo público,
  llega al mismo `procesarPedidoFunnelish` sin token ni límite (quinchat `app/api/pedidos/route.ts:16-82`,
  igual en quin-comercial).
- **Escenario, con los datos que manda el atacante:** en `variante` pone un producto que no existe, así que
  `imageUrl` pasa a ser su `imagen` (quinchat `funnelish/webhook/route.ts:351,440,684-690`). El resultado es
  una plantilla **desde el número verificado de KLIXMANT, con la imagen y los textos (nombre, dirección) del
  atacante**, enviada a cualquier celular 3xxxxxxxxx. El único anti-duplicados junta el mismo teléfono con el
  mismo producto (l. 531) y se salta cambiando cualquiera de los dos. Además, cada pedido falso manda una
  **compra falsa a Meta por CAPI**, y `imagenes[]` hace que el servidor descargue URLs ajenas y guarde collages
  nuevos por cada combinación.
- **Coste:** la plantilla utility en Colombia cuesta unos US$0,001 cada una, así que el dinero directo es poco
  (10 000 envíos ≈ US$10). Lo grave está en otro sitio: la calidad del número baja o Meta lo bloquea
  (phishing con la marca), las compras falsas desordenan la optimización de las campañas (se pierde inversión
  real en anuncios) y cada petición ocupa una función de hasta 60 s.
- **Arreglo mínimo:** límite por IP y por teléfono (quin-comercial ya tiene `lib/rate-limit.ts`, por ejemplo 3
  por teléfono y hora y 20 por IP y hora), aceptar `imagen/imagenes` solo del almacenamiento propio, y no mandar
  CAPI si el pedido sale `duplicado`. Si no se hace en esta rama, el documento no debe decir que el abuso quedó
  cerrado.

### 3 · El freno borra las etiquetas de estado de la conversación
- `quinchat/lib/freno-bot.ts:43-44` (y la misma línea en quin-comercial) hace
  `update({ bot_enabled: false, label: 'HUMANO' })`. `label` es una lista de etiquetas unidas con `|`
  (ver `cron/remarketing/route.ts:122-124`), así que se pierden `VENTA REALIZADA`, `PEDIDO PROGRAMADO`,
  `ABONO POR VERIFICAR`, etc.
- **Escenario:** un cliente que ya compró sigue escribiendo y llega al tope. Su chat sale de `ventas/lista`,
  `metas`, `cron/capi` y `apagar-vendidos`, que filtran por esas etiquetas.
- **Arreglo:** añadir la etiqueta en vez de reemplazar la lista: leer `label`, sumar `HUMANO` y guardar la unión
  (lo mismo que hace `agregarTagConv`, `webhook/route.ts:356`).

### 4 · quin-comercial: cualquier cuenta nueva lanza la IA de todos los clientes
- `quin-comercial/app/api/cron/aprendizaje/route.ts:28-31` y `objeciones/route.ts:29-32` aceptan **cualquier
  sesión**, y los dos recorren `porCadaTenant` con una llamada a Claude por cliente (hasta unos 32 000
  caracteres ≈ 10 000 tokens). En quin-comercial cualquiera saca una sesión: `/api/registro` es público y crea
  un cliente activo con `rol: 'cliente'`. Y como `CRON_SECRET` **aún no existe** en `quinchat-comercial`, al
  publicar la sesión será la única forma de lanzarlos.
- **Coste:** unos US$0,03 por cliente y llamada. Con 20 clientes y un bucle de 1 petición por segundo son
  unos US$2 000 por hora, sin más freno que la concurrencia de Vercel.
- **Arreglo:** que la sesión solo valga con rol de administrador de la agencia, o que con sesión se procese
  solo `session.tenantId`.

### 5 · quin-comercial: un único `FUNNELISH_WEBHOOK_TOKEN` para todos los clientes
- `app/api/funnelish/webhook/[tenant]/route.ts:78` usa el token global. **Al crear la variable se cortan las
  ventas de Funnelish de todos los clientes** hasta que cada uno cambie su URL, y el punto 3 de
  `BLOQUEANTES-CONSUMO.md` no lo dice (solo habla de "la URL" de la agencia). Además, cada cliente conoce el
  token y puede usarlo contra `/api/funnelish/webhook/<otro-cliente>`.
- **Arreglo:** un token por cliente (columna en `tenants`) para la ruta `[tenant]` y el global solo para la
  ruta de la agencia. Como mínimo, avisarlo en el documento antes de crear la variable en `quinchat-comercial`.

---

## ⚠️ Riesgos no bloqueantes

1. **Webhooks de WhatsApp por cliente sin firma** (quin-comercial `procesarEntrada`, `leerAvisoDeMeta(req, '')`).
   Cualquiera que conozca un slug (salen del nombre de la empresa) puede inventarse mensajes. El tope es por
   conversación y se salta cambiando `from`, así que cada mensaje falso cuesta 1 o más llamadas a IA
   (≈US$0,01–0,05) más ≥12 s de función, sin límite total. Las respuestas a números sin ventana abierta las
   rechaza Meta y no se cobran. **Mitigación barata:** comprobar que `value.metadata.phone_number_id`
   coincida con el `wa_phone_number_id(_ventas)` del cliente; no es secreto, pero corta los ataques a ciegas.
   Añadir también un tope global por hora.
2. **El tope cuenta globos, no llamadas a IA.** Suman las partes separadas por `---` (`ventas.ts:612-625`), cada
   foto (`type: 'image'`), la confirmación de Funnelish (hasta 3 filas), `/api/whatsapp/confirmar` y los crons
   (`remarketing`, `seguimiento-ia`, `ventas-seguimiento`, `mantener-chat`, `oficina-rescate`). 40 filas son
   unos 10–15 turnos reales, y un comprador que pide ver colores puede pasar a HUMANO en una conversación normal.
   Corta el bucle, que era el objetivo, pero conviene contar solo lo que responde la IA o subir el tope por
   defecto.
3. **quin-comercial, línea propia (sin tenant):** `tenantActualId()` vale `null` → cliente sin filtro. El freno
   cuenta los mensajes de ese teléfono en **todos** los clientes, y el `update ... eq('id', from)` apaga el bot de
   ese teléfono en todos (la PK es `(tenant_id, id)`, `sql/mt-03-conversations-pk.sql`). Es coherente con el resto
   de ese camino, pero ahora lo toca también el freno.
4. **Anti-duplicados y FK:** `mt-03` borra `messages_conversation_id_fkey`, así que el esquema base **sí** tenía
   ese FK. En quinchat, probablemente, sigue existiendo. En el primer mensaje de un cliente nuevo, el `INSERT`
   de `webhook/route.ts:717` falla con `23503` (aún no hay conversación, se crea en la l. 1001). No es
   duplicado → sigue, y el `upsert` de la l. 1030 lo guarda. Funciona, pero en ese primer mensaje el
   anti-duplicados no protege: si llega un reintento de Meta antes de la l. 1030, se procesa dos veces. Los
   reintentos llegan después, así que el riesgo es bajo. En la foto o el audio queda la fila `type:'text'`
   vacía hasta que el `upsert` la pisa, y en la nota de voz transcrita queda el globo vacío que ya menciona el
   documento.
5. **La firma supone una sola app de Meta en quinchat.** Si el número de ventas
   (`WHATSAPP_PHONE_NUMBER_ID_VENTAS`) está suscrito desde otra app, sus avisos se rechazarán con la clave de la
   primera. Comprobarlo tras publicar con un mensaje a cada línea (observación 2 de `CLAUDE.md`).
6. **`/api/funnels/evento` y `/api/funnels/carrito` (POST)** escriben sin límite. El coste es solo de base de
   datos, pero se ensucian las métricas del embudo, y en quinchat cada carrito falso manda un aviso a Lilibeth
   (`cron/carrito-recuperacion`, hasta 50 por pasada).
7. **`/api/whatsapp/confirmar`** compara `CONFIRMA_YA_API_KEY` con `!==`, que no es de tiempo constante. Si
   ConfirmaYa (GitHub Pages, sin backend) mete la clave en su JS, esa clave es pública y la ruta permite mandar
   texto libre a cualquier número. No se encontró la clave en `app.js` de ConfirmaYa; hay que confirmarlo.
8. **Token en la query:** `?token=` queda en los registros de Vercel. Es aceptable, pero conviene saberlo al
   compartir registros.
9. **Next 16** da `middleware.ts` por obsoleto (el nuevo nombre es `proxy.ts`). Hoy funciona, porque las pruebas
   pasan con `next start`; hay que tenerlo en cuenta en la próxima actualización.
10. **LEY de imágenes:** la rama no añade ninguna subida. Pero, por el fallo 2, cualquiera puede hacer que el
    servidor escriba collages en el almacenamiento, y ese camino todavía no pasa por el compresor. No contradice
    la rama, pero es otro motivo para limitar `/api/pedidos`.

---

## Correcciones recomendadas, por prioridad

1. **Fallo 1** (fuga de datos personales en quinchat): sesión en `GET/PATCH/DELETE` de `funnels/carrito` y en
   el `GET` de `funnels/evento`. Es un cambio de pocas líneas.
2. **Fallo 3:** que el freno añada `HUMANO` sin borrar las demás etiquetas, en las dos apps.
3. **Fallo 4:** crons de IA de quin-comercial restringidos a administradores o al cliente de la sesión, y crear
   `CRON_SECRET` en `quinchat-comercial` antes de publicar.
4. **Fallo 2:** límite en `/api/pedidos` y lista cerrada de dominios para las imágenes. Si se deja para otra
   rama, corregir lo que dicen `BLOQUEANTES-CONSUMO.md` y `lib/token-funnelish.ts`.
5. **Fallo 5:** token por cliente, o como mínimo el aviso en el documento.
6. Riesgos 1 y 2 en la siguiente rama del plan de consumo.

**Veredicto final: REQUIERE CORRECCIONES.**
