# Auditoría · rama `integracion` (`99ec3dc`)

**Fecha:** 30-09-2026 · **Auditor:** Claude (agente auditor) · **Alcance:** `git diff 4fb9872 99ec3dc` (quinchat frente
a v174) y `git diff origin/master 99ec3dc -- quin-comercial`, contrastado con `INTEGRACION.md`, `TABLERO-AGENTES.md`
(§3, §6, §7), `RECUPERACION-V174.md`, `AUDIT-BLOQUEANTES.md` y `CLAUDE.md` (obs. 1–5).
Nada se ejecutó contra producción: sin `.env`, Supabase falso (`pruebas/_postgrest-falso.ts`) y servidor en `localhost`.
No se modificó código ni se hizo ningún commit.

## Veredicto: primera revisión (99ec3dc) REQUIERE CORRECCIONES; segunda revisión (e64793e) **APROBADO CON CONDICIONES** (ver al final)

Un bloqueante (el fallo 12 sigue abierto por otra puerta) y dos importantes. Los tres son arreglos de pocas
líneas. Corregido el bloqueante y añadidas a `INTEGRACION.md` §6 las notas de abajo, la rama quedaría en
**APROBADO CON CONDICIONES**: lo que queda solo se puede comprobar en Vercel/Meta.

---

## ❌ Fallos

### 1 · BLOQUEANTE · `/promos?v=__principal__` manda al navegador el token del principal (el fallo 12 sigue abierto)

- `quinchat/app/p/promos/page.tsx:33-44` busca el vendedor del `?v=` en `vendedores_promo` **sin excluir
  `__principal__`**. Si esa fila tiene `activo = true` y un `celular` de 10 dígitos, la página entra en «modo
  vendedor» con `sellerToken = <token del principal>`, y `components/publico/PromosLista.tsx:247`
  (`if (sellerToken) qs.set('k', sellerToken)`) lo pone en el enlace de **cada** producto que se sirve al navegador.
- **Escenario:** cualquiera abre `https://pedido.klixmant.shop/promos?v=__principal__` (el código sale en este
  repo y en los documentos), copia el `k=` de cualquier enlace y llama a `/api/promociones/vender` con
  `codigo: "__principal__"` y la cabecera `Cookie: promo_principal=<token>` (o abre `/promos?k=<token>` y el
  middleware le pone la cookie). Descuenta stock sin límite: es exactamente el fallo 12.
- **Comprobado** con la página real y el mismo arnés de `pruebas/promos-token.ts` (fila principal como la modela
  esa prueba: `activo: true`, `celular: '3167648391'`): `token del principal en las props de /promos?v=__principal__: true`.
  Script: `scratchpad\audit-int\principal-por-v.ts`. La prueba de la rama no cubre este caso (solo `?v=ana` y sin `?v=`).
- **No sé** si la fila real cumple las dos condiciones (no se consulta la base). Aunque no las cumpla hoy, basta
  con que alguien le ponga celular o la active para reabrir el agujero, y **la rotación del token de §6 A.3 sería
  inútil**: el token nuevo saldría por la misma puerta.
- **Arreglo:** `.neq('codigo', '__principal__')` en la búsqueda del vendedor de `app/p/promos/page.tsx` y en
  `getSeller` de `app/p/promos/[id]/page.tsx:16-25` (hoy allí no se filtra porque el botón exige `?k=` igual al token,
  pero por coherencia), y un caso `?v=__principal__` en `pruebas/promos-token.ts`. **Antes** de rotar el token.

### 2 · IMPORTANTE · El anti-duplicados deja filas vacías que hacen callar al bot (choque bloqueantes × v174)

- `quinchat/app/api/whatsapp/webhook/route.ts:722-732` inserta **para cualquier mensaje** una fila
  `{ id: wamid, role: 'user', type: 'text', content: msg.text?.body ?? '' }`. Para los tipos que el webhook no trata
  (`reaction`, `location`, `contacts`, `unsupported`…) esa fila **nunca se completa**: el bucle sale en `:978`
  (`continue; // otros tipos`) y queda un mensaje de cliente **vacío** para siempre. En v174 esos mensajes no se
  guardaban.
- **Consecuencia 1 (el bot no contesta):** la espera de 12 s (`:1066-1074`) descarta el turno si «llegó otro
  mensaje del cliente» (`role = 'user'`, `created_at > horaMensaje`). La fila vacía cuenta.
  **Escenario:** el cliente escribe «Calle 10 # 5-20, Garzón» y a los 3 s manda el pin de ubicación (o reacciona
  con 👍 a un mensaje del bot). El turno del texto ve «otro mensaje» y se calla; el turno de la ubicación sale en
  `:978`. **Nadie responde.** En v174 el bot respondía al texto.
- **Consecuencia 2:** un globo vacío del cliente en el panel por cada reacción o ubicación (el «en vivo» lo pinta por
  el `INSERT`), y otro en las notas de voz transcritas con el bot apagado (`:868-874`, ya citado en
  `AUDIT-BLOQUEANTES.md` riesgo 4).
- **Arreglo mínimo:** marcar el duplicado solo para los tipos que se procesan (texto, botón, interactivo, media), o
  borrar la marca antes de cada `continue` que no guarda nada; alternativa: que la espera ignore filas con
  `content = ''`. Añadir el caso «ubicación tras texto» a `pruebas/freno-bot.ts` o a una prueba nueva.
- Solo afecta a la línea de **confirmación**; la de ventas sale antes (`:706-709`) y tiene su propio anti-duplicados.
  En quin-comercial el patrón ya está en producción; no es regresión allí.

### 3 · IMPORTANTE · `INTEGRACION.md` §6 tiene huecos que cortan algo en silencio o dejan la base distinta de lo que se cree

1. **Rotar el token (A.3) sin el arreglo del fallo 1 no protege nada.** Añadir el arreglo como requisito de A.3.
2. **`WHATSAPP_APP_SECRET` en `quinchat-comercial` (tabla B):** se da por hecho que es «la misma clave de la app de
   Meta de la agencia». No está comprobado: el callback de esa app es `quinchat-agencia-quin.vercel.app/api/whatsapp/webhook`
   (`quin-comercial/components/panel/AjustesPanel.tsx:25` lo muestra así). Si `/api/whatsapp/webhook` de comercial
   recibe avisos de **otra** app, con esa clave **se rechazan todos sus mensajes** (401). Pedir: comprobar en Meta qué
   app apunta a la URL de comercial antes de crear la variable; si no se sabe, **no crearla** (sin ella funciona como hoy).
3. **Cambiar una variable en Vercel no surte efecto hasta volver a publicar.** La marcha atrás de «clave de Meta
   equivocada» (E.3) es borrar la variable **y redesplegar**; igual con `BOT_IA=off` «para la primera hora». §6 no lo
   dice, y mientras tanto Meta reintenta y los clientes no reciben respuesta.
4. **E.4 (pedido de prueba en /promos)** escribe en producción (pedido, plantilla real, chat con bot apagado) y
   **descuenta stock real**; anular el pedido no lo devuelve (ninguna ruta de `app/api/pedidos/` toca `promociones`).
   Añadir «devolver la unidad en el panel de Promociones» y avisar de que es una escritura.
5. Lo que sí está bien explicado y se corta en silencio: sin `CRON_SECRET` no corre ningún cron (401 en
   cron-job.org, nada en el panel); sin `rate_limits` no hay límite (`lib/rate-limit.ts` falla abierto: `count` nulo
   → deja pasar); `WHATSAPP_APP_SECRET=""` desactiva la firma sin aviso (fallo 9); sin `R2_PUBLIC_URL` la foto de R2
   se sustituye por la del catálogo (fallo 5). Correcto y completo en la tabla B.

---

## ⚠️ Menores / ya anotados (no bloquean)

- **Fallo 16** (foto y precio de `/promos` los manda el navegador: `app/api/promociones/pedido/route.ts:34-37,72`)
  y **fallo 17** (token de vendedor en sus enlaces) siguen abiertos, como dice el documento. Además, si `promoId` no
  existe, la ruta crea el pedido igual con el precio del navegador (mismo fallo 16).
- El límite de `/promos` gasta un intento aunque luego el pedido se rechace por falta de stock. Con 5/h no molesta.
- Descuento de stock en `/promociones/pedido` es leer-modificar-escribir (`:80-163`): dos compras simultáneas pueden
  vender la última unidad dos veces. Ya era así en v174.
- Doble pasada de compresión (navegador 1920/q0,85 + `sharp` 1920/q85) en embudos y promociones: el servidor
  devuelve el original si no ahorra lo bastante (`lib/optimizar-imagen-servidor.ts:117-118`). Aceptable.
- El freno cuenta mensajes, no llamadas a IA (B7, ya en el tablero).

---

## ✅ Lo que pasa

### 1 · No se pierde nada de v174
- `git diff --diff-filter=D` y `-M --diff-filter=R`: **ningún archivo borrado ni renombrado** en `quinchat/`.
- Todas las líneas **quitadas** frente a v174 (`--numstat`) están en: compresor (`catalogos/upload-imagen`,
  `funnels/imagen`, `plantillas-wa/imagen`, `imagen-comprimir`, `collage`, `next.config`), `if (!secret) return true`
  de los 13 crons, el `req.json()` del webhook de WhatsApp (sustituido por `leerAvisoDeMeta`), el `adminToken` de
  promociones y el `image:` de `/api/pedidos`. Todo intencionado.
- Siguen: `NO ENVIAR RECORDATORIO` (`seguimiento-ia`, `ventas-seguimiento`), handoff silencioso (`webhook:1858,2606,2659`,
  `ventas.ts:1411`), `botonUrl` en plantillas, PAREJA/marca en Funnelish, 👍 como «sí», el bot no pisa el valor.
  El webhook de Funnelish solo cambia en el token y la calidad del collage.

### 2 · Seguridad tras la unión
- **Middleware quinchat:** recorridas las 88 rutas de `app/api`. Las únicas que llama la tienda pública
  (`components/publico/*`) son `pedidos`, `funnels/evento`, `funnels/carrito`, `promociones/pedido`,
  `promociones/pedido-multi` y `promociones/vender`: las seis abiertas **solo con POST**. Ninguna ruta usada por
  la tienda queda cerrada. `/api/pedidos/lista|accion|detalle`, que en v174 abría el prefijo `/api/pedidos` en el
  panel, quedan cerradas. ConfirmaYa (`/api/whatsapp/confirmar`), webhooks y crons van por prefijo.
- **Middleware quin-comercial:** la tienda llama a `pedidos`, `funnels/evento`, `funnels/carrito` y `registro`; las
  cuatro abiertas solo con POST. `recargas/webhook` por prefijo; `recargas/retorno` pide sesión (ya la exigía la ruta).
- **Crons:** 13/14 fallan cerrados sin `CRON_SECRET`; `aprendizaje` y `objeciones` aceptan además sesión (los botones
  de `MemoriaPanel` y `ObjecionesPanel` siguen funcionando). `promo-cierre` no hace nada.
- **Firma de Meta:** el cuerpo se lee una vez; ninguna ruta lo vuelve a leer (`grep req.json|text|clone`).
- **Freno del bot** en los dos caminos: `webhook/route.ts:1057` y `ventas.ts:1200`. Añade `HUMANO` sin borrar
  etiquetas (`lib/freno-bot.ts:44-53`).

### 3 · Promociones
- Sin `?v=`, ni `/promos` ni `/promos/<id>` pasan el token del principal a los componentes de cliente (salvo el fallo 1).
- `/api/promociones` y `/api/vendedores-promo` piden sesión en el middleware **y** en la ruta; sin sesión: 307.
- Comprar en `/promos` no pide sesión; el stock se descuenta en el servidor; el límite (5/teléfono, 20/IP, mismas
  claves que `/api/pedidos`) va antes de tocar el stock.
- La cookie: `GET /promos?k=abc&color=Negro` (host `pedido.klixmant.shop`) → 307 a `/promos?color=Negro` con
  `Set-Cookie: promo_principal=abc; HttpOnly; SameSite=lax; Max-Age=31536000`. Los enlaces de vendedor
  (`?v=…&k=…`) no se tocan.

### 4 · «Lo que no se puede romper» (tablero §6)
| Punto | Resultado |
| --- | --- |
| Pedido de la landing → `/api/pedidos` → plantilla con foto | Código intacto; límite e `imagenPropia` añadidos. Camino feliz **no probado** (enviaría una plantilla real). Foto sustituida si falta `R2_PUBLIC_URL` (fallo 5) |
| Webhook responde 200 a Meta en < 20 s | Sin cambio de fondo: añade 1 HMAC y 2-3 consultas. La espera de 12 s + IA ya existía |
| El bot no responde dos veces | Mejora con el anti-duplicados, pero ver **fallo 2** (ahora puede no responder **ninguna** vez) |
| Etiquetas del chat no se pierden | ✅ (`freno-etiquetas.ts` 16/16) |
| Subidas por `sharp`, `libvips` en `outputFileTracingIncludes` | ✅ en las 3 rutas; `'/api/**': ['./fonts/**/*', './node_modules/@img/**/*']`; `sharp ^0.35.4` |
| Crons con `CRON_SECRET` y sin ella no | ✅ (`crons.ts`) |
| Panel «en vivo» | ✅ `WhatsAppPanel.tsx:246-259` escucha `INSERT` y `UPDATE` de `messages`; el upsert completa la fila del anti-duplicados |
| Tienda sin sesión; `/api/pedidos/lista` con sesión | ✅ `/nacional`, `/nacional/gracias`, `/tienda`, `/promos` con host de tienda no van a `/login`; `/api/pedidos/lista` → 307 |

### 5 · Compresión
Un solo compresor de servidor (`lib/optimizar-imagen-servidor.ts`, único `import sharp`) en las tres rutas; nada lo
duplica en la misma ruta. `next.config.ts` y `package.json` son los de `master`.

---

## Pruebas ejecutadas por el auditor (worktree, Windows, sin `.env`)

| Comando | quinchat | quin-comercial |
| --- | --- | --- |
| `npx tsc --noEmit -p .` | **0 errores** | **0 errores** |
| `npx next build` (rehecho por el auditor) | **verde** | **verde** |
| `middleware-api.ts` contra `next start -p 3125` | **384/384** | **584/584** |
| `crons.ts` sin clave · con clave | **56/56 · 84/84** | **52/52 · 78/78** |
| `promos-token` · `promociones-sesion` · `promociones-limite` | 17/17 · 28/28 · 16/16 | — |
| `carrito-sesion` · `cron-alcance` | 17/17 · — | — · 21/21 |
| `firma-meta` · `firma-meta-ruta` | 6/6 · 4/4 | 15/15 |
| `freno-bot` · `freno-etiquetas` | 26/26 · 16/16 | 26/26 · 16/16 |
| `imagen-propia` · `imagen-propia-suplantacion` | 17/17 · 35/35 | 17/17 · 35/35 |
| `pedidos-limite` · `rate-limit` · `token-funnelish` | 7/7 · 13/13 · 20/20 | 7/7 · 13/13 · 33/33 |
| `token-cliente-aislado` · `optimizar-imagen` | — · 18/18 | 17/17 · — |
| Prueba propia `?v=__principal__` | **filtra el token** (fallo 1) | — |
| `curl` a `next start` con `Host: pedido.klixmant.shop` | cookie y páginas públicas, arriba | — |

`tsx` desde `scratchpad\medicion`. No se corrió `ley-imagenes.ts` (A6, conocido), `medir-chat-saliente.ts` (lee el
bucket real) ni `token-por-cliente.ts` (no es una prueba).

## Lo que no se pudo comprobar
- **Linux/Vercel:** el rastreo en este PC solo trae `@img/sharp-win32-x64` (visto en `route.js.nft.json` de
  `funnels/imagen`). Que la regla `@img/**` arrastre la variante Linux y `libvips` solo se ve publicando (obs. 1).
  Prueba barata: subir una foto por embudos y mirar los registros de ejecución.
- **Meta, Funnelish y cron-job.org reales**, la fila real de `__principal__` (fallo 1), si `rate_limits` existe en la base
  de quinchat, el camino feliz de los pedidos y la cookie en el navegador interno de WhatsApp en iPhone.
- **Handoff silencioso + freno + anti-duplicados juntos** con mensajes reales (B5).

## Correcciones, por prioridad
1. **Fallo 1** (bloqueante): excluir `__principal__` del modo vendedor en las dos páginas de `/promos` + caso de prueba.
   Antes de rotar el token.
2. **Fallo 2:** que la marca anti-duplicados no deje filas vacías para tipos no procesados (o que la espera las ignore).
3. **Fallo 3:** completar `INTEGRACION.md` §6 (requisito de A.3, comprobar la app de Meta de comercial antes de crear
   `WHATSAPP_APP_SECRET`, redesplegar tras cambiar variables, E.4 escribe y descuenta stock).
4. Después de publicar: fallos 16 y 17, B7.

**Veredicto de la primera revisión: REQUIERE CORRECCIONES** (superado: ver la segunda revisión).


---

# Segunda revisión · `e64793e`

**Fecha:** 30-09-2026 · **Commits nuevos sobre `99ec3dc`:** `c006b73` (promociones), `4bfdd59` (webhook) y `e64793e` (documentación).
Mismas reglas que en la primera revisión: sin `.env`, con Supabase falso, nada contra producción y sin tocar código.

## Veredicto: **APROBADO CON CONDICIONES**

Los tres fallos de la primera revisión están cerrados, y no he encontrado otra forma de reproducirlos.
Las condiciones son las de `INTEGRACION.md` §6, que ya está completa. Las principales:
1. Crear la tabla `rate_limits` en la base de quinchat. Sin ella no hay límite de pedidos.
2. No crear `WHATSAPP_APP_SECRET` en `quinchat-comercial` hasta saber qué app de Meta apunta a su webhook.
3. Rotar el token de `__principal__` solo cuando `c006b73` ya esté publicado.
4. Volver a publicar después de cada cambio de variable.
5. Publicar con alguien mirando y probar allí lo que solo se ve en Vercel: `libvips` en Linux, la firma de Meta en
   las dos líneas y el ciclo de venta B5.

## 1 · Fallo 1 (`?v=__principal__`): cerrado
- `app/p/promos/page.tsx:35` y `app/p/promos/[id]/page.tsx:19` descartan ese código antes de consultar la base, y la
  consulta añade además `.neq('codigo','__principal__')`.
  - Como `v` se recorta con `.trim()`, `' __principal__ '` también queda fuera.
  - En mayúsculas no encuentra la fila, porque `eq` distingue mayúsculas de minúsculas.
- Fuera de esas dos páginas, `vendedores_promo` solo se lee desde dos rutas:
  - `/api/vendedores-promo`: pide sesión y excluye al principal;
  - `/api/promociones/vender`: no devuelve ningún token.
- `?v=__principal__` junto con la cookie del dueño sigue mostrando el botón, que es lo correcto: el dueño se identifica
  por la cookie.
- Mi script `principal-por-v.ts` ahora da `false`, y `promos-token.ts` pasa **23/23**. La prueba nueva revisa el árbol
  entero de la página, no solo las props de la lista.

## 2 · Fallo 2 (fila marcadora vacía): cerrado, sin romper v174
`guardarEntrante` (`webhook/route.ts:481-487`) hace un INSERT:
- si la base responde `23505`, el mensaje ya existía (reintento de Meta) y se salta;
- cualquier otro error se registra y el mensaje sigue su camino normal.

Ya no queda ninguna fila sin completar:

| Caso | Comportamiento |
| --- | --- |
| Texto, botón, interactivo | INSERT con el contenido real (`:1051`), después de crear la conversación, como en v174 (por si hay clave ajena). La espera de 12 s, la comprobación de «ya respondí» (`:1084`), el freno y el paso a humano silencioso van detrás y no cambian |
| Ubicación, reacción, contacto | No se guarda ninguna fila, igual que en v174. La espera ya no los toma por un mensaje nuevo |
| Foto, vídeo, documento, sticker | La fila se crea antes de descargar, con la etiqueta como contenido, y el upsert de `:825` le pone la URL. En un reintento no se vuelve a descargar ni a subir. Si la descarga falla, queda la etiqueta, como antes |
| Nota de voz | El archivo se guarda siempre con el id `-audio`. Antes solo se hacía cuando había transcripción; sin ella el id pasa de `wamid` a `wamid-audio`, y no he encontrado nada que dependa de ese id. La transcripción usa el id normal, por el camino del texto, y no se toma por duplicada. Un reintento no vuelve a transcribir ni abre otro turno |
| Foto con texto | `-caption` se sigue guardando con upsert, igual que antes |

- **En un reintento de texto, el contador de no leídos sube 1 de más** (`:1011-1018`, antes del INSERT). Lo considero
  **aceptable**:
  - con v174, un reintento sumaba lo mismo y además el bot respondía dos veces;
  - el chat queda bien y no se pierde ninguna etiqueta (`last_message` repite el mismo texto).

  Es menor y está anotado en `INTEGRACION.md`.
- **Clave ajena:**
  - Texto: la conversación se crea antes del INSERT, así que el primer mensaje de un cliente nuevo no tiene problema.
  - Archivos: la marca va antes de crear la conversación, como el upsert de v174. Si la clave ajena existe, falla con
    `23503`, no se toma por duplicado y el mensaje sigue como en v174.
- **`webhook-duplicados.ts` usa la ruta real y sí distingue el arreglo.** Para comprobarlo saqué el árbol de
  `99ec3dc` con `git archive` a `scratchpad\audit-int\old` y le copié la prueba nueva y el PostgREST nuevo:
  - con el código de `99ec3dc`: **13/16**, con los mismos tres fallos que describí (fila vacía, globo vacío y turno
    descartado);
  - con `e64793e`: **16/16**.

## 3 · El PostgREST falso no da verdes falsos
- El cambio es **opcional por tabla** (`unicos`, vacío por defecto), y solo lo activa `webhook-duplicados.ts`. Para
  las demás pruebas, el falso se comporta igual que antes.
- Al activarlo, el falso es **más estricto**, no más permisivo: un id repetido responde 409 con `23505`.
- El `JSON.parse` tolerante solo cambia lo que pasa con cuerpos binarios (subidas a Storage): ahora responden 404,
  como un Storage que falla. Antes rompían el falso. Ninguna prueba anterior subía binarios, y todas dan los mismos
  totales.
- El archivo es idéntico en las dos apps.

## 4 · `INTEGRACION.md` §6: completo
Recoge bien mis cuatro puntos:
1. rotar el token después de publicar `c006b73`;
2. comprobar qué app de Meta usa comercial antes de crear `WHATSAPP_APP_SECRET`, y si hay duda, no crearla;
3. volver a publicar después de cada cambio de variable;
4. el paso E.4 escribe en producción.

También añade la prueba «texto y luego ubicación» al paso E.3.

Hay un detalle menor en E.4 que no condiciona la publicación: el producto temporal con «una talla sin número de
stock» solo evita descontar stock si **no usa colores con stock** (`variantes`). Si los usa, el pedido exige la talla
en ese color y la descuenta (`promociones/pedido/route.ts:90-99`). Conviene añadir «sin colores».

## 5 · Fallo 18 (quin-comercial): ¿entra en esta rama?
**No lo recomiendo:**
- Publicar la rama no lo empeora: el fallo ya está en producción y la rama no toca el webhook de comercial.
- Ese webhook es otro código (multicliente, con línea propia y `[tenant]`) y no tiene una prueba como
  `webhook-duplicados.ts`.
- Meterlo ahora sumaría un cambio sin probar al despliegue de más riesgo, y el tablero pide «una tarea, una rama».

Es mejor hacerlo en una rama propia justo después de Z7, portando la prueba. El PostgREST falso ya está en las dos
apps.

## Pruebas ejecutadas en esta revisión
| Comando | quinchat | quin-comercial |
| --- | --- | --- |
| `npx tsc --noEmit -p .` | **0 errores** | **0 errores** |
| `npx next build` | **verde** (rehecho) | no rehecho (solo cambia `pruebas/`) |
| `middleware-api.ts` contra `next start -p 3125` | **384/384** | sin cambios |
| `webhook-duplicados.ts` | **16/16** (13/16 con el webhook de `99ec3dc`) | — |
| `promos-token.ts` · `principal-por-v.ts` (propio) | **23/23** · `false` | — |
| `promociones-sesion` · `promociones-limite` · `carrito-sesion` | 28/28 · 16/16 · 17/17 | — |
| `firma-meta` · `firma-meta-ruta` | 6/6 · 4/4 | 15/15 |
| `freno-bot` · `freno-etiquetas` | 26/26 · 16/16 | 26/26 · 16/16 |
| `imagen-propia` · `imagen-propia-suplantacion` | 17/17 · 35/35 | 17/17 · 35/35 |
| `pedidos-limite` · `rate-limit` · `token-funnelish` | 7/7 · 13/13 · 20/20 | 7/7 · 13/13 · 33/33 |
| `optimizar-imagen` · `cron-alcance` · `token-cliente-aislado` | 18/18 · — · — | — · 21/21 · 17/17 |

`crons.ts` no se repitió, porque no cambió ningún cron ni el middleware. En la primera revisión dio 56/56 y 84/84 en
quinchat, y 52/52 y 78/78 en comercial.

**Sigue sin comprobar**, igual que en la primera revisión:
- `libvips` en Linux/Vercel;
- Meta, Funnelish y cron-job.org reales;
- la fila real de `__principal__` y si existe `rate_limits` en la base;
- el camino feliz de los pedidos;
- la cookie en iPhone;
- el ciclo de venta B5.

**Veredicto final (segunda revisión): APROBADO CON CONDICIONES.**
