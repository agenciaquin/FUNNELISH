# Rama `integracion` (tarea Z6) · qué es, cómo se comprobó y qué hacer antes de publicar

**Fecha:** 30-09-2026 · **Quién:** Claude (agente desarrollador) · **Estado:** solo local, **sin subir y sin publicar**.
Worktree: `C:\Users\Tati\AppData\Local\Temp\claude\D--PROYECTO-IA-FUNNELISH\729bd79f-ccde-4f87-9305-376527c1bb11\scratchpad\wt-integracion`.

`integracion` = **v174** (lo que corre hoy en `pedido.klixmant.shop`) + **`master`** (compresor con `sharp`) +
**`bloqueantes-consumo`** (arreglos de seguridad y consumo), con los fallos 12, 13 y 14 del tablero cerrados.

> ⚠️ **Publicar esta rama publica las DOS apps.** Fusionarla en `master` publica `quinchat-agencia-quin`
> (`pedido.klixmant.shop`) **y** `quinchat-comercial` (`www.klixmant.shop`, `tienda.skioo.shop`), porque
> `bloqueantes-consumo` cambia las dos. La lista de la sección 6 es para los dos proyectos.

---

## 1 · Commits

| Commit | Qué |
| --- | --- |
| `4fb9872` | (base) `v174-recuperada`: el `quinchat/` de producción, recuperado de Vercel (ver `RECUPERACION-V174.md` en la copia principal) |
| `c4e724a` | Merge `origin/master` (`5a2f455`): compresor con `sharp` y `libvips` |
| `71e7df5` | Merge `origin/bloqueantes-consumo` (`ffc34b5`): 5 arreglos de seguridad + correcciones de la auditoría |
| `124c505` | `fix(promos)`: abrir solo la compra de /promos y cerrar su administración (**fallo 13**, y parte del 12) |
| `34896a0` | `fix(promos)`: el token del vendedor principal ya no sale en /promos (**fallo 12**) |
| `802c3de` | `fix(promos)`: límite de envíos en los pedidos de /promos (**fallo 14**) |
| `99ec3dc` | `docs`: este documento |
| `c006b73` | `fix(promos)`: `?v=__principal__` no puede sacar el token del principal (auditoría, fallo 1, **bloqueante**) |
| `4bfdd59` | `fix(bot)`: el anti-duplicados ya no deja filas vacías que callan al bot (auditoría, fallo 2) |
| (este) | `docs`: §6 completado según la auditoría (fallo 3) |

Auditoría: `AUDIT-INTEGRACION.md` (copia principal), **REQUIERE CORRECCIONES**; los tres puntos están corregidos
en los tres últimos commits.

Las dos uniones entraron **sin conflictos de texto**. Las reglas de Z6 se cumplen solas: en bot, embudos y
webhooks no hubo que elegir (git unió los cambios de v174 con los de las otras ramas), y en compresión ganan los
archivos de `master` (`next.config.ts` con `./node_modules/@img/**/*` en `outputFileTracingIncludes`,
`package.json`/`package-lock.json` con `sharp ^0.35.4`).

## 2 · Qué entró de cada rama

**De v174 (solo `quinchat/`):** promociones (`/promos`, panel de Promociones y de Links de vendedores, 4 rutas
nuevas), bot (handoff silencioso, 👍 como «sí», el bot ya no pisa el valor del pedido…), webhook de Funnelish
(foto por marca, PAREJA = 2 prendas con collage), remarketing con fechas, plantillas con botón URL, etiqueta
`NO ENVIAR RECORDATORIO` en dos crons, 450 fotos en `public/promo-fotos/`. Detalle en `RECUPERACION-V174.md` §3.

**De `master`:** compresor del servidor (`lib/optimizar-imagen-servidor.ts`) en `catalogos/upload-imagen`,
`funnels/imagen` y `plantillas-wa/imagen`; collage a calidad 85; `libvips` en el paquete de Vercel.

**De `bloqueantes-consumo` (las dos apps):** `/api/` pide sesión salvo una lista cerrada; crons cerrados sin
`CRON_SECRET`; firma de Meta en el webhook de WhatsApp; token en el webhook de Funnelish (por cliente en
quin-comercial); freno del bot (`BOT_IA`, `BOT_TOPE_DIARIO`, sin respuestas dobles); límite y fotos propias en
`/api/pedidos`; crons de IA de quin-comercial limitados a la empresa de la sesión. Detalle en
`BLOQUEANTES-CONSUMO.md` y `AUDIT-BLOQUEANTES.md` (en esta rama).

## 3 · Fallos 12, 13 y 14

### Fallo 13 · el middleware cerraba la compra de /promos → **cerrado**
- Se abren **solo con POST** las tres rutas que llama la página pública (comprobado en `PromosLista.tsx` y
  `PromoProducto.tsx`, no en la lista del informe): `/api/promociones/pedido`, `/api/promociones/pedido-multi` y
  `/api/promociones/vender`. GET/PATCH/DELETE de esas tres piden sesión.
- `/api/promociones` (GET, POST, DELETE) y `/api/vendedores-promo` (GET, POST, DELETE) piden sesión **en el
  middleware y en la propia ruta**, igual que `funnels/carrito`. Solo las usa el panel.
- La página `/promos` y las fichas `/promos/<id>` leen la base en el servidor y siguen abiertas.

### Fallo 12 · token de `__principal__` servido a todos → **cerrado en código; falta rotar el token**
**Cómo funcionaba:** `/promos` mandaba el token de `__principal__` a cada visitante. Iba en el enlace de cada
producto (`?k=`), y ese enlace viaja dentro del mensaje de WhatsApp que el **cliente** manda al número principal.
Quien lo abría (el dueño) veía «PRODUCTO VENDIDO (descontar 1)»… y cualquier cliente también.

**Qué se hizo (mínimo, sin cambiar lo que ven los clientes):**
- Los clientes **no necesitaban** el token: `/pedido` y `/pedido-multi` ya descuentan el stock en el servidor.
- `/promos` ya no lee el token del principal, y el enlace de los productos ya no lleva `?k=` (salvo en modo
  vendedor).
- El dueño activa **una vez en cada teléfono** `https://pedido.klixmant.shop/promos?k=<token>`. El middleware
  guarda el token en una cookie `promo_principal` (httpOnly, SameSite=Lax, 1 año, Secure en https) y lo quita de
  la dirección. Desde ese teléfono, **cualquier** ficha de producto muestra el botón (también los enlaces que
  mandan los clientes), y `/api/promociones/vender` lee el token de la cookie, no del cuerpo. La página nunca lo
  conoce ni lo pinta.
- **Vendedores (`?v=<código>`):** igual que antes. Su link sigue llevando su propio token (decisión de dirección).
- **`?v=__principal__` no entra en modo vendedor** (`c006b73`): las dos páginas de `/promos` descartan ese
  código antes de consultar y en la consulta. Sin esto, el token del principal salía en el `?k=` de cada
  producto. Son las únicas consultas a `vendedores_promo` desde páginas públicas.

### Anti-duplicados del webhook (auditoría, fallo 2) → **cerrado**
El anti-duplicados de `bloqueantes` insertaba una fila de cliente vacía para cualquier mensaje. Con ubicación,
reacción o contacto no se rellenaba nunca, y la espera de 12 s la tomaba por un mensaje nuevo: **el bot no
respondía al texto anterior**. Ahora el duplicado se detecta al guardar el mensaje de verdad, con INSERT
(`23505` = reintento de Meta). En archivos, la fila se pone **antes de descargar**, para que un reintento no suba
otra copia a Storage. La nota de voz usa `-audio`, la transcripción el id normal, el texto adjunto `-caption`.
Efecto menor que queda: en un reintento de texto el contador de no leídos del chat sube 1 de más (se actualiza
antes de guardar el mensaje, que va detrás de crear la conversación por si hay clave ajena).

**Qué cambia para cada uno:**

| Quién | Antes | Ahora |
| --- | --- | --- |
| Cliente | Recibía el token sin saberlo | Nada visible; el enlace que manda por WhatsApp es más corto |
| Dueño (número principal) | Veía el botón en cualquier enlace | Tiene que activar cada teléfono una vez con el enlace `?k=` |
| Vendedor | Botón en los enlaces de su catálogo | Igual |

### Fallo 14 · pedidos de promociones sin límite → **cerrado en código; falta la tabla `rate_limits`**
`/api/promociones/pedido` y `/pedido-multi` usan `lib/rate-limit.ts` con los mismos números que `/api/pedidos`
(**5 por teléfono y 20 por IP cada hora**) y **las mismas claves** (`pedido-tel:`, `pedido-ip:`): un celular no
recibe el doble entrando por las landings y por /promos. Un carrito cuenta como un pedido. El límite va antes de
tocar el stock. **Sin la tabla `rate_limits` en la base de quinchat el límite falla abierto: no limita.**

### quin-comercial
**No tiene `/promos` ni ninguna de estas rutas** (`app/api/` no tiene `promociones` ni `vendedores-promo`; el
cron `promo-cierre` es otra cosa y no hace nada). No se tocó, y no se le copió código de v174.

## 4 · Compilación y pruebas (Windows, sin `.env`, sin variables de producción)

`npm ci --prefer-offline` en las dos apps **dentro del worktree**. `tsx` usado desde `scratchpad\medicion`.

| | quinchat | quin-comercial |
| --- | --- | --- |
| `npx tsc --noEmit -p .` | **0 errores** | **0 errores** |
| `npx next build` (sin `.env`) | **verde** | **verde** |

| Prueba (`<app>/pruebas/`) | quinchat | quin-comercial |
| --- | --- | --- |
| `middleware-api.ts` (con `next start`) | **384/384** | **584/584** |
| `crons.ts` sin clave · con clave (con `next start`) | **56/56 · 84/84** | **52/52 · 78/78** |
| `promos-token.ts` (nueva, fallo 12 + `?v=__principal__`) | **23/23** (con las páginas de v174: 14/17; sin `c006b73`: 17/23) | — |
| `webhook-duplicados.ts` (nueva, ruta real del webhook) | **16/16** (con el webhook anterior: 13/16, el bot se calla) | — |
| `promociones-sesion.ts` (nueva, fallo 13) | **28/28** | — |
| `promociones-limite.ts` (nueva, fallo 14) | **16/16** | — |
| `carrito-sesion.ts` | 17/17 | — |
| `cron-alcance.ts` | — | 21/21 |
| `firma-meta.ts` · `firma-meta-ruta.ts` | 6/6 · 4/4 | 15/15 |
| `freno-bot.ts` · `freno-etiquetas.ts` | 26/26 · 16/16 | 26/26 · 16/16 |
| `imagen-propia.ts` · `imagen-propia-suplantacion.ts` | 17/17 · 35/35 | 17/17 · 35/35 |
| `pedidos-limite.ts` · `rate-limit.ts` | 7/7 · 13/13 | 7/7 · 13/13 |
| `token-funnelish.ts` | 20/20 | 33/33 |
| `token-cliente-aislado.ts` | — | 17/17 |
| `optimizar-imagen.ts` | 18/18 | — |
| `ley-imagenes.ts` | **10/24** | **2/18** |

- **`ley-imagenes.ts` falla, y es lo esperado:** es la prueba de la tarea A6 (que todas las subidas pasen por el
  compresor), que aún no está hecha. Se corrió también sobre `origin/bloqueantes-consumo`: **los mismos fallos,
  uno a uno**. La unión no añade ninguna subida nueva sin comprimir.
- **No se corrieron:** `medir-chat-saliente.ts` (es una medición, descarga fotos reales del bucket de producción)
  y `token-por-cliente.ts` (genera las URLs de Funnelish; no es una prueba).
- En Windows algunas pruebas imprimen al salir `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`: es de
  Node/libuv en Windows al cerrar, después del resultado. Entorno, no código.
- En local, `/p/promos` responde 500 porque no hay Supabase configurado; el middleware ya ha decidido antes
  (reescritura y cookie comprobadas).

## 5 · Lo que no se pudo probar

- **Linux / Vercel.** Todo se compiló y probó en Windows (observación 1 de `CLAUDE.md`). En este PC el rastreo
  solo ve `@img/sharp-win32-x64`; en Vercel la máquina instala la variante Linux y la regla
  `./node_modules/@img/**/*` la incluye. Es la misma regla que ya funciona en `master` desde el 31-08.
  Prueba barata tras publicar: subir una foto por `funnels/imagen` y mirar los registros de ejecución.
- **Meta real** (firma del webhook con la clave de verdad, las dos líneas con la misma app), **Funnelish real**
  (token en la URL) y **cron-job.org** (que todas las tareas manden la clave).
- **El camino feliz de las rutas de pedido** (mandaría una plantilla real de WhatsApp). Solo se probaron los
  429 y los rechazos.
- **El límite contando de verdad en `rate_limits`** (necesita la base real).
- **La cookie del dueño dentro del navegador de WhatsApp en iPhone.** En Android, WhatsApp abre los enlaces en
  Chrome y comparte sus cookies. En iPhone el navegador interno puede no compartirlas con Safari: si el botón no
  aparece al abrir un enlace desde WhatsApp, abrir el enlace de activación **desde el propio WhatsApp** (por
  ejemplo, mandándoselo a uno mismo) para activar ese navegador.
- **Handoff silencioso de v174 junto al freno del bot** de `bloqueantes`: cada uno tiene su prueba en verde,
  pero juntos solo se ven con mensajes reales (prueba B5 del tablero).

## 6 · ANTES DE PUBLICAR · lista para el administrador de Vercel

Hacer en este orden. Nada de esto lo ha hecho el agente. **No mostrar ni copiar los valores en chats o
documentos.**

### A · Base de datos y tokens (1 y 2 antes de fusionar; 3 y 4 se preparan antes y se ejecutan al publicar)

1. **Filtro por carpeta (Z4)** en los dos proyectos de Vercel, si se quiere que un cambio de documentación no
   publique. No bloquea esta rama, pero conviene tenerlo antes.
2. **Base de quinchat (Supabase `bjbjqmbuzpyjvcugbusx`) · tabla `rate_limits`:** ejecutar
   `quinchat/sql/rate-limits.sql`. **Es SQL que escribe en producción: necesita aprobación.** Primero comprobar
   si ya existe (si quinchat y quin-comercial compartieran base, ya estaría). Sin ella no se corta nada, pero
   **ni `/api/pedidos` ni los pedidos de /promos tienen límite**.
3. **Token nuevo para `__principal__` (rotación).** El actual está en miles de mensajes de clientes y ha estado
   a la vista. Se cambia **solo después de publicar una versión que incluya `c006b73`** (el cierre de
   `/promos?v=__principal__`, paso E.2). Antes no sirve de nada: la versión vieja lee el token de la base en
   cada visita y lo sigue repartiendo, y sin `c006b73` el token nuevo saldría por `?v=__principal__`. Con
   aprobación, en el editor SQL de Supabase:
   ```sql
   update vendedores_promo
      set token = replace(gen_random_uuid()::text, '-', '')
    where codigo = '__principal__'
   returning token;
   ```
   Guardar el valor en un sitio seguro y armar el enlace de activación:
   `https://pedido.klixmant.shop/promos?k=<token nuevo>`. Abrirlo **una vez en cada teléfono del dueño**.
4. **Tokens de los vendedores (recomendado, también justo después de publicar):** `GET /api/vendedores-promo`
   devolvía los de todos sin sesión, así que conviene cambiarlos también. Sus links (`/promos?v=<código>`) **no cambian**, porque el token no va en
   ellos. Solo dejan de funcionar los enlaces con el token viejo que ya estén en chats antiguos:
   ```sql
   update vendedores_promo
      set token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
    where codigo <> '__principal__';
   ```

### B · Variables en Vercel (antes de publicar)

> **Una variable nueva o cambiada no surte efecto hasta la siguiente publicación.** Crearla después de publicar
> no hace nada hasta volver a publicar (botón *Redeploy* del último despliegue, en el panel de Vercel). Lo mismo
> para **dar marcha atrás**: borrar `WHATSAPP_APP_SECRET` porque era la equivocada, o quitar `BOT_IA=off` tras
> la primera hora, **exige volver a publicar**. Mientras tanto Meta reintenta y los clientes no reciben
> respuesta. La otra salida es volver al despliegue anterior desde el panel, que conserva las variables con
> que se publicó.

| Variable | `quinchat-agencia-quin` | `quinchat-comercial` | Si falta o está mal |
| --- | --- | --- | --- |
| `CRON_SECRET` | Ya existe: comprobar | **NO existe: crearla** | Sin ella **no corre ningún cron** de esa app |
| `WHATSAPP_APP_SECRET` | Crear (Meta → la app → Configuración → Básica → Clave secreta) | **Antes de crearla, comprobar en Meta qué app tiene como URL de webhook la de comercial** (`www.klixmant.shop/api/whatsapp/webhook`) y poner la clave de **esa** app. No está comprobado que sea la de la agencia: su panel muestra el callback de `quinchat-agencia-quin`. **Si no se sabe, no crearla** (sin ella funciona como hoy) | Sin ella funciona como hoy, sin firma. **Con la clave de otra app se rechazan TODOS los mensajes** de esa app (401) |
| `FUNNELISH_WEBHOOK_TOKEN` | Crear una cadena larga al azar | Crear otra (puede ser distinta) | **Con la variable y sin cambiar la URL en Funnelish, se cortan las ventas de Funnelish** (ver C) |
| `BOT_IA` | Opcional: `off` para la primera hora | Igual | Vacía = bot encendido |
| `BOT_TOPE_DIARIO` | Opcional (por defecto 80) | Igual | `0` o un texto lo desactivan |
| `R2_PUBLIC_URL` | Comprobar que existe si se usa R2 | Igual | Sin ella, las fotos de R2 se sustituyen por la del catálogo en la plantilla de confirmación |

### C · Funnelish (el mismo día que se crea `FUNNELISH_WEBHOOK_TOKEN`)

- **quinchat:** en Funnelish, la URL del webhook pasa a llevar `?token=<la cadena>` (conservar `&modo=agente` si
  lo lleva). Se puede cambiar la URL **antes** de crear la variable: mientras la variable no existe, se acepta.
- **quin-comercial (orden obligatorio):** primero generar la URL de cada cliente con
  `FUNNELISH_WEBHOOK_TOKEN='<la cadena>' npx tsx pruebas/token-por-cliente.ts <slug1> <slug2> …` (desde
  `quin-comercial/`), que **cada cliente** la cambie en su Funnelish y la agencia la suya, y **solo entonces**
  crear la variable. Si no, se cortan las ventas de Funnelish de todos los clientes.

### D · cron-job.org

- **Todas** las tareas de las dos apps tienen que mandar la clave: cabecera `Authorization: Bearer <CRON_SECRET>`
  o `?secret=<CRON_SECRET>`.
- Revisar en especial **`ventas-seguimiento`** (antes no pedía clave) y **`carrito-recuperacion`** de quinchat
  (antes iba con sesión; ahora con la clave).
- En quin-comercial, las tareas existentes **no tienen** clave todavía (la variable no existía): añadirla a
  todas.

### E · Al publicar (Z7, con alguien mirando)

1. Registros de ejecución de los dos proyectos abiertos; marcha atrás a mano desde el panel si hace falta.
2. En cuanto la versión nueva responda: pasos A.3 y A.4 (rotar los tokens) y activar los teléfonos del dueño.
3. Un WhatsApp de prueba a **cada línea** de quinchat (confirmación y ventas): si aparece
   `[Webhook] aviso rechazado`, la clave de Meta está mal o la línea es de otra app (marcha atrás: ver la nota
   de B, hay que volver a publicar). Probar también **texto y, enseguida, un pin de ubicación**: el bot tiene
   que responder al texto.
4. **Pedido de prueba en `/promos` (escribe en producción).** Crea un pedido real, manda una plantilla real,
   deja el chat con el bot apagado y **descuenta stock real**. Anular el pedido **no** devuelve el stock
   (ninguna ruta de pedidos toca `promociones`). Para no tocar el stock de verdad:
   - en el panel de Promociones, crear un producto temporal «PRUEBA – NO COMPRAR» con una talla **sin número
     de stock** (esas tallas no llevan control y no se descuenta nada), activo solo durante la prueba;
   - pedirlo desde `/promos` con un número de la agencia y comprobar que llega la plantilla;
   - borrar el producto, marcar el pedido como cancelado y volver a encender el bot en ese chat.
   Si no se quiere escribir nada en producción, **saltarse este paso**: las rutas están probadas en local
   (`promociones-limite.ts`, `middleware-api.ts`), salvo el envío real de la plantilla.
5. Desde un teléfono **sin** activar, abrir una ficha de `/promos`: **no** debe salir «PRODUCTO VENDIDO».
   Desde un teléfono activado, sí.
6. Subir una foto por el panel (embudos) y comprobar en los registros que no hay `ERR_DLOPEN_FAILED`.

## 7 · Fallos vistos y no arreglados (para la sección 7 del tablero)

- **16 ·** `/api/promociones/pedido` y `/pedido-multi` aceptan del navegador la **foto** (cualquier URL `http`)
  y el **precio** que salen en la plantilla de confirmación. Es el mismo abuso que se cerró en `/api/pedidos`
  con `lib/imagen-propia.ts`: una plantilla con la marca, pero con la imagen y el precio de quien la manda.
  Ahora tiene el límite del fallo 14, pero no el filtro de fotos ni el precio leído de la base. **Media.**
- **17 ·** Los links de vendedor siguen llevando el token del vendedor a todos los clientes de ese vendedor
  (decisión de dirección). Con él se puede descontar stock con `/api/promociones/vender`. Se podría aplicar la
  misma cookie que al principal. **Baja.**
- **18 ·** quin-comercial tiene el mismo anti-duplicados con fila marcadora al principio que se corrigió en
  quinchat (`4bfdd59`): una ubicación o una reacción durante la espera puede dejar sin respuesta al texto
  anterior. Allí ya está en producción (no lo trae esta rama). **Media.**
- Vistos por el auditor y ya conocidos: si `promoId` no existe, `/promociones/pedido` crea el pedido igual con
  el precio del navegador (parte del 16); el descuento de stock es leer-modificar-escribir (dos compras a la vez
  pueden vender la última unidad dos veces; ya era así en v174).
