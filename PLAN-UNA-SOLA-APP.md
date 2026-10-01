# PLAN · Una sola app (frente V, pedido de dirección del 30-09-2026)

**Autor:** planeador · **Fecha:** 30-09-2026 · **Estado:** **destino A y camino "núcleo + API, por pasos" aprobados
por dirección el 30-09-2026.** Esta versión sustituye el "portar en bloque" de la antigua F2 por pasos de
estrangulamiento (§4–§7) y renumera las tareas (§10). **Manda sobre el orden:** `TABLERO-AGENTES.md`. Nada se publica
antes de **Z7** (regla 1 del tablero: enviar a `master` publica las dos apps). Datos de partida: tablero §2.

> **Lectura:** `PLAN-PLATAFORMA.md` y `TASKS-PLATAFORMA.md` están en el worktree `scratchpad\wt-integracion` (D5 =
> acceso a la base de quin-comercial, línea 335; A16 = borrar `quinchat-sepia`, línea 120). No se han cruzado enteros
> con este plan: lo hace el auditor al revisar U20.

---

## 1 · Cómo interfiere hoy una app con la otra

| # | Mecanismo | Estado | Efecto |
| --- | --- | --- | --- |
| I1 | **Despliegue acoplado:** tres proyectos de Vercel construyen desde `master` sin filtro por carpeta | Medido | Un `.md` publica las dos apps; en `quinchat-agencia-quin` **borraría v174** |
| I2 | **Gemelos que divergen:** 56 idénticos, **128 misma ruta y distinto contenido**, 47 solo en quinchat, 98 solo en quin-comercial | Medido | Un arreglo en una no llega a la otra; copiar un gemelo rompe (importan `tenant`/`supabase-tenant` en uno, `r2`/`prendas` en otro) |
| I3 | Mismo `name` en los dos `package.json` | Medido | Se confunden las apps (31-08) |
| I4 | Proyecto de más `quinchat` (`quinchat-sepia`) | Medido | Construye en cada envío. **Hueco:** si algo le apunta |
| I5 | KLIXMANT se sirve desde las dos (`pedido.*` y `www.*`) | Medido | Funciones distintas según el panel; promos, remarketing y metas solo en `pedido.*` |
| I6 | Base de datos | **Sin comprobar** | Dos bases: datos repartidos. Una: quinchat escribe sin `tenant_id` y lee sin filtro |
| I7 | Número de WhatsApp, app de Meta, Funnelish, cron-job.org | **Sin comprobar** | Doble respuesta del bot, doble plantilla, crons dobles |

Lo demostrado es I1 + I2 + I3. I6 e I7 son hipótesis hasta **U1**, que va primero.

---

## 2 · Alivio inmediato (no toca la venta ni la base)

1. **Filtro por carpeta (= Z4):** Root Directory e "Ignored Build Step" contra `VERCEL_GIT_PREVIOUS_SHA`. Probar con un
   envío a una rama que solo toque `docs/`. No hace seguro enviar a `master` antes de Z7.
2. **`name` distinto** (`quinchat-klixmant` / `quin-comercial`, también en el lock). En quinchat, dentro de Z6.
3. **Borrar `quinchat-sepia`** tras U1: desconectar Git, 7 días mirando registros, borrar (admin de Vercel, V4/A16).
4. **Comprobador de gemelos** en Actions (solo PR): falla si cambia `quinchat/X` sin `quin-comercial/X` salvo línea
   `gemelo: X — motivo`; hashes iguales en la lista cerrada (`lib/ley-peso.ts`, `lib/firma-meta.ts`,
   `lib/rate-limit.ts`). **Novedad:** falla también si reaparece en `quinchat/` algo que ya se movió al núcleo (§4).
5. **Regla:** seguridad y LEY DE PESO van en las dos apps en el mismo PR, mientras existan las dos.

---

## 3 · Destino (decidido): opción A

Todo en `quin-comercial`, KLIXMANT como tenant; `quinchat/` se retira. Se descartaron B (rehacer el multi-cliente en
quinchat: 35–50 días, riesgo alto), C (paquete `compartido/`: siguen dos apps) y D (dos repos: institucionaliza la
divergencia). **Esfuerzo revisado con el camino por API: 25–35 días-persona** (la API añade ~5 días frente al
porte en bloque, a cambio de que cada paso se publique solo y deje de duplicar desde el primer día).

---

## 4 · Camino: núcleo + API (estrangulamiento)

**Principios.**
- **P-1 · El núcleo es `quin-comercial`.** Cada funcionalidad se escribe **una vez**, allí. Sus propias rutas la usan
  en proceso; quinchat la pide por `/api/interna/v1/...`.
- **P-2 · Lo movido deja de existir en quinchat en el mismo PR** que lo conecta al núcleo: se borra el código local y,
  si era la única que la usaba, la dependencia. El comprobador de gemelos (§2.4) impide que vuelva.
- **P-3 · Hasta el paso 4 el núcleo no lee ni escribe la base ni el Storage de KLIXMANT.** Los pasos 1–3 son
  funciones "sin datos": quinchat le manda lo que necesita y guarda él el resultado. Así no hace falta resolver
  "una base o dos" (U8, F3) para empezar, y la clave de servicio de `bjbj` no sale de quinchat.
- **P-4 · Marcha atrás sin copia local** (si no, P-2 no se cumple). Dos niveles:
  1. **Variable `NUCLEO_PAUSA_<FUNCION>=1` en quinchat:** no vuelve al código local (ya no existe); pone la función
     en su **modo de fallo** (§5.3). Se aplica con un redespliegue sin construir.
  2. **"Instant Rollback" de Vercel** al despliegue anterior al paso (se guardan 20), en quinchat y si hace falta en
     el núcleo; después, revertir el PR en `master` para que el siguiente envío no lo deshaga.
  Para que el nivel 2 no arrastre otro paso: **un paso por semana como mucho**, y ninguno se publica con otro.
- **P-5 · Cada paso es un PR por app** (primero el núcleo, después quinchat), publicable solo.

| Paso | El núcleo ofrece | quinchat deja de tener | Necesita | Modo de fallo en quinchat |
| --- | --- | --- | --- | --- |
| **0** | `/api/interna/v1/salud`, autenticación, registro | — | Z7 | — |
| **1 · Medios** (§6) | `media/comprimir`, `media/verificar-video` | `sharp`, `optimizar-imagen-servidor.ts`, la codificación JPEG de `collage.ts`/`watermark.ts` | Paso 0, P3 | Panel: cerrado. Automático: abierto |
| **2 · Pedidos** | `pedidos/interpretar`: de la entrada de Funnelish o de la landing + los datos del embudo que manda quinchat, devuelve el pedido normalizado (dirección por partes, foto por palabra distintiva y PAREJA, valor que no se pisa, `NO ENVIAR RECORDATORIO`) | la lógica de `procesarPedidoFunnelish` y de `/api/pedidos` (quinchat sigue recibiendo el webhook y guardando la fila) | Paso 1; los cambios de v174 escritos en el núcleo | **Cerrado** con 503 a Funnelish (reintenta, **hueco: confirmar que Funnelish reintenta**); la landing muestra "inténtalo en un minuto" |
| **3 · WhatsApp saliente** | `whatsapp/enviar` (texto, medio, plantilla) con el token del tenant KLIXMANT guardado en el núcleo | `lib/whatsapp.ts` (envío y recompresión para Meta) y el envío de plantillas | Paso 2; tenant KLIXMANT en el núcleo (U10, que necesita U8) | Panel: cerrado con el error visible. Automático (plantilla de confirmación): el pedido queda marcado "plantilla sin enviar" + alerta y el asesor la reenvía (**hueco:** ver si ese estado ya existe) |
| **4 · Datos (F3)** | Acceso a los datos de KLIXMANT: una sola base, o copia idempotente bjbj → núcleo (§8 R3) | — | U8, U16 | — |
| **5 · Bot y webhooks** (§7) | `atenderVenta`, webhook de Meta y de Funnelish por tenant | el bot, `whatsapp/webhook`, `funnelish/webhook` | Paso 4 | Relé (§7): Meta y Funnelish reintentan si el núcleo no da 200 |
| **6 · Solo-quinchat** | promociones y vendedores (fallos 12–14, 16, 17 cerrados), remarketing, metas, ventas por campaña, rescate, seguimiento, sus crons | todo eso | Paso 4 | Se mueve con el panel: el equipo pasa a usarlo en el núcleo |
| **7 · Tienda y dominio** | `/p/[slug]`, `/[slug]`, `/gracias`, `/promos`, componentes que U9 mantiene; `pedido.klixmant.shop` | — (quinchat se apaga, F5) | Pasos 1–6 | Marcha atrás de F4 |

**Por qué este orden.** Lo que más duplica con menos riesgo y sin datos va primero: el compresor está **tres veces**
(quinchat, quin-comercial sin escalones, media-api) y falla de forma visible y acotada. Pedidos e interpretación son
lógica pura con mucha divergencia v174/quin-comercial. WhatsApp saliente necesita el token en el núcleo (U8). Bot y
webhooks son lo más crítico y lo único que exige que el núcleo vea los datos: van después de F3. Promos, remarketing
y metas **no están duplicados** (solo existen en quinchat): moverlos no quita duplicado, es portarlos, y van
detrás. El número de KLIXMANT y el dominio van al final.

---

## 5 · Contrato de la API interna (común a todos los pasos)

**5.1 · Autenticación y versión**
- Rutas `/api/interna/v1/<funcion>`. Cambio incompatible → `v2` conviviendo con `v1` hasta que el registro diga que
  nadie llama a `v1` en 14 días.
- Cabecera `Authorization: Bearer <clave>`. quinchat guarda `NUCLEO_URL` y `NUCLEO_CLAVE` (variables de servidor;
  **nunca** `NEXT_PUBLIC_`). El núcleo guarda `CLAVES_INTERNAS` = lista `llamante:sha256(clave)`, **dos por llamante**
  para rotar sin corte. Compara `sha256(recibida)` con `crypto.timingSafeEqual` (mismo largo siempre). El llamante
  sale de la clave, **nunca del cuerpo ni del host**.
- El middleware de quin-comercial deja `/api/interna/**` fuera de la sesión y del tenant por host; la ruta exige la
  clave y responde 401 sin detalle. `/api/interna/**` nunca se llama desde el navegador: prueba estática (§9).
- Clave nueva por paso solo si el alcance cambia (p. ej. la del charco, §6.5).

**5.2 · Límites y archivos**
- El núcleo está en Vercel: **cuerpo ≤ ~4,5 MB en petición y respuesta**. Regla: el archivo **no viaja** si pasa de
  4 MB. quinchat lo sube con URL firmada a `_pendientes/` en **su** Storage y manda al núcleo una **URL firmada de
  lectura** (5 min, un solo objeto). El núcleo la descarga, procesa y responde. Hasta 4 MB se admite el archivo en
  el cuerpo (`application/octet-stream`): ahorra un viaje en el webhook, que tiene prisa.
- Respuestas ≤ 1 MB (las imágenes salen ≤ 400 kB). Si una salida pasara de 1 MB, el núcleo responde 500 en vez de
  cortar.
- `X-Peticion-Id` (uuid) en cada llamada; el núcleo la repite. Las funciones son **idempotentes** con ese id.

**5.3 · Si el núcleo no responde** (timeout de quinchat: 8 s en panel, 4 s en webhook; un reintento solo en panel)

| Función | Modo | Qué pasa |
| --- | --- | --- |
| Subida desde el panel | **Cerrado** | 503 "El compresor no está disponible, inténtalo en un minuto". **Nunca** se sube el original (LEY regla 5) |
| Foto entrante, collage, marca de agua | **Abierto** | Se guarda el original + `[ley-peso]` alerta (LEY punto 4: un cliente nunca queda sin atender) |
| Pedido (paso 2) | **Cerrado** | 503 a Funnelish / mensaje en la landing. Un pedido mal interpretado es peor que uno reintentado |
| Envío de WhatsApp (paso 3) | Panel cerrado; automático con marca + alerta | §4 |
| Webhooks (paso 5) | Relé: el núcleo responde a Meta lo que responda quien procesa | Meta reintenta |

**5.4 · Registro y medición**
- Núcleo: `console.log('[interna]', JSON.stringify({ fn, llamante, peticionId, ms, bytesEntrada, bytesSalida, estado }))`.
- quinchat: `console.log('[nucleo]', JSON.stringify({ fn, peticionId, msTotal, msNucleo, estado, modoFallo? }))`.
  `msTotal − msNucleo` = red + descarga: es el tiempo que añade el camino.
- Presupuesto (p95): **+1,5 s** en subidas del panel, **+1 s** en el webhook. Se mide con 50 llamadas la primera hora
  tras publicar cada paso, y se anota en el registro del tablero (los registros de Vercel caducan: medir el mismo día).

---

## 6 · Paso 1 en detalle: compresión como servicio

**6.1 · Dónde vive: ruta interna del núcleo (`quin-comercial`), no `media-api`.**

| | Núcleo (`/api/interna/v1/media/*`) | `media-api` |
| --- | --- | --- |
| ¿Corre hoy? | Sí, en Vercel (`quinchat-comercial`) | **No está desplegado**: el README dice que se resolvió "sin desplegar `media-api`" y la carpeta no tiene Dockerfile ni configuración de despliegue (**hueco:** no se ha comprobado fuera del repo) |
| Cumple la LEY | Con P3 + P4: escalones, JPEG/PNG, tope | **No:** convierte a **WebP** (prohibido hacia WhatsApp), regla del 10 %, `hasAlpha` sin `isOpaque`, sharp **0.34** frente a 0.35 |
| Seguridad | Clave del §5.1 | Token comparado con `!==` (no en tiempo constante), multipart de hasta 200 MB, ata la clave de servicio de `bjbj` a otro servidor (D9 de `ESTRATEGIA-PESO.md`) |
| Coste | Ninguno nuevo | Un servidor más que operar (Fly/Cloud Run) |
| Destino | Es la app que queda | Un sistema más que apagar |

Precio de la decisión: **llevar `sharp` al núcleo (P3)** con `@img/**` (incluido `libvips`) en
`outputFileTracingIncludes`, comprobado **en Linux** (P5). **Un solo compresor al final:** `sharp` solo se importa en
`quin-comercial/lib/optimizar-imagen-servidor.ts`. quinchat lo pierde en este paso; `media-api` pierde `servidor.ts`
y `sharp` (U26) y su backfill de imágenes pasa a llamar a la API. `media-api` queda **solo** como script de `ffmpeg`
para el charco de vídeos ya guardados (P25, P27): no es un compresor de subidas, porque el vídeo nuevo se codifica
en el navegador (WebCodecs) y el servidor solo lo verifica (`ESTRATEGIA-PESO.md` §2.1).

**6.2 · Contrato exacto**

```
POST /api/interna/v1/media/comprimir
Authorization: Bearer <clave>      X-Peticion-Id: <uuid>
JSON: { "fuente": { "url": "<URL firmada de lectura de _pendientes/…>", "bytes": 5234123 },
        "tipo": "foto-web",            // TipoArchivo de lib/ley-peso.ts (foto-web, foto-whatsapp, grafico-texto,
                                       //   png-alfa, foto-entrante, svg, gif)
        "origen": "panel" | "automatico",
        "rutaBase": "embudos/mi-slug/1727700000-ab12" }       // sin extensión
  o bien octet-stream ≤ 4 MB con X-Tipo, X-Origen, X-Ruta-Base
200 { "veredicto": "cumple" | "SUPERA_TOPE",       // SUPERA_TOPE con 200 solo si origen = automatico
      "rutaFinal": "embudos/mi-slug/1727700000-ab12-<hash8>.jpg", "contentType": "image/jpeg",
      "bytesAntes": 5234123, "bytesDespues": 231004, "tope": 256000, "escalon": "1920q80",
      "compresor": "<sha256 corto de optimizar-imagen-servidor.ts + ley-peso.ts>", "ms": 640,
      "datos": "<base64 del archivo final>" }
413 { "veredicto": "SUPERA_TOPE", "mensaje": "La foto pesa 612 kB y el tope es 250 kB…", "bytes", "tope" }  // panel
415 FORMATO · 422 SVG_INSEGURO · 400 contrato · 401 · 502 FUENTE_INACCESIBLE · 500 COMPRESOR_FALLO

POST /api/interna/v1/media/verificar-video
JSON: { "fuente": {…}, "tipo": "video-landing" | "video-chat", "origen" }
200 { "veredicto": "cumple" | "SUPERA_TOPE", "codec", "audio", "lado", "faststart", "bytes", "tope", "compresor" }
```

**Quién escribe:** el núcleo **devuelve** el archivo y la `rutaFinal`; **quinchat** lo guarda con `cacheControl`
31536000 en esa ruta y borra el pendiente, con su propia clave (P-3). La ruta lleva hash del contenido, así que un
reintento escribe lo mismo. Cuando el núcleo tenga los datos (paso 4) se puede añadir `destino` para que escriba él:
es `v2`, no un cambio de `v1`.

**6.3 · Qué cambia en quinchat** (sobre `integracion`; `lib/subir-archivo.ts` queda como cliente fino: firmar
`_pendientes/`, llamar al núcleo, guardar, borrar el pendiente)

| Orden | Rutas | Por qué en ese orden |
| --- | --- | --- |
| 1a | `funnels/imagen`, `plantillas-wa/imagen`, `catalogos/upload-imagen` | Ya comprimen hoy: se cambia un compresor por otro con una persona delante que ve el error. Riesgo mínimo |
| 1b | `whatsapp/send-media` (chat saliente) | La fuga mayor (+92 MB/mes). A Meta va el archivo devuelto |
| 1c | `funnels/upload-url` (> 4 MB, solo firma `_pendientes/`), `funnels/video`, `funnels/audio` + `media/verificar-video` | Cierra las URL firmadas sin tope |
| 1d | Entrantes: `whatsapp/webhook`, `lib/quinchat/ventas.ts` | Webhook con prisa: modo abierto y cuerpo directo ≤ 4 MB; mide el +1 s |
| 1e | `lib/collage.ts`, `lib/watermark.ts`, collage en línea de `funnelish/webhook` | Jimp compone; el núcleo codifica. Cierra el fallo 15 y une `__v2`/`__v3` (V3) |

Al cerrar 1e: `sharp` fuera de `quinchat/package.json` y `@img/**` fuera de su `next.config.ts`.
`optimizar-fotos` (1080/q72) no se conecta: se retira o queda como excepción declarada (T2.10).
**Impacto en `ESTRATEGIA-PESO.md`:** P4 (copia), P6–P11 y P13 se escriben **en el núcleo**; en quinchat solo el
cliente. P20 cambia: `media-api` no se alinea, se queda sin `sharp` (U26). Actualizar ese documento es U37.

**6.4 · Prueba de que las dos apps usan el mismo servicio**
1. **Estática (CI, P5):** `sharp` no aparece en `quinchat/package.json` ni en `arreglos-supabase/media-api/package.json`;
   ningún archivo de `quinchat/` importa `sharp` ni `optimizar-imagen-servidor`; en `quin-comercial/` solo lo importa
   ese archivo; toda ruta de quinchat que escribe archivos pasa por `lib/subir-archivo.ts`.
2. **Contrato (CI):** `quin-comercial/pruebas/contrato-media.ts` llama a la ruta con las entradas de
   `ESTRATEGIA-PESO.md` §5 y almacenamiento falso; `quinchat/pruebas/cliente-nucleo.ts`, con un núcleo falso, cubre
   timeout, 401, 413 y los dos modos de fallo.
3. **Tras publicar (escribe en producción: visto bueno y carpeta `prueba-ley/` que se borra después):** la misma foto
   de 5 MB subida desde el panel de `www.klixmant.shop` y desde el de `pedido.klixmant.shop`. Pasa si los dos
   archivos guardados tienen **el mismo SHA-256** y en los registros **del proyecto del núcleo** aparecen dos líneas
   `[interna] media/comprimir`, una por llamante, con el mismo `compresor`.

**6.5 · El charco por la misma API.** El backfill (P22–P24) copia en `bjbj` el objeto a `_pendientes/`, llama a
`media/comprimir` con una clave propia `charco` (se crea para la campaña y se revoca al terminar, avisando al humano
porque vive en el PC) y escribe el resultado **con el mismo nombre** (A3: no se rompe ninguna referencia).

---

## 7 · Webhooks de Meta y Funnelish (solo apuntan a una app)

Se mueven en el **paso 5**, después de F3, y en dos tiempos para no perder mensajes:
1. **Sombra:** quinchat reenvía a `/api/interna/v1/bot/sombra` una copia de cada mensaje de KLIXMANT ya respondido; el
   núcleo calcula su respuesta **sin enviarla** y registra la diferencia. Pasa con 7 días y ≥ 95 % de respuestas
   equivalentes (revisadas a mano las distintas).
2. **Relé:** la URL externa se cambia **antes** que la lógica. Meta (callback de la app, o el *override* por cuenta de
   WhatsApp si nuestra configuración lo admite: **hueco**, B6) y Funnelish apuntan al webhook por tenant del núcleo
   (`/api/whatsapp/webhook/[tenant]`, `/api/funnelish/webhook/[tenant]`, ya existen), que **reenvía el cuerpo
   intacto** con su firma a quinchat y devuelve a Meta el código que dé quinchat (sin 200 propio: si quinchat falla,
   Meta reintenta). Se vigila 48 h.
3. **Interruptor en el núcleo:** bandera del tenant KLIXMANT `bot=nucleo`. Desde ese momento el núcleo procesa y el
   bot de quinchat queda apagado para esas líneas. Marcha atrás: la bandera vuelve a `relé` (segundos, sin tocar Meta).
   Los anti-duplicados por `wamid` evitan doble respuesta porque ya hay **una sola base** (paso 4).
4. +1 h y +24 h: entrantes por hora frente a la misma franja de la semana anterior; si bajan, relé.
El número de KLIXMANT pasa al núcleo en el paso 5, pero el **dominio** no se mueve hasta el paso 7: el relé ya cubre
lo que Meta y Funnelish envían, y `pedido.*` solo sirve tienda y panel.

---

## 8 · Riesgos de este camino

| # | Riesgo | Qué se hace |
| --- | --- | --- |
| R1 | **El núcleo como punto único de fallo.** Durante la transición KLIXMANT depende de **dos** apps; una publicación de quin-comercial para otro tenant puede romper a KLIXMANT | Modos de fallo del §5.3; `contrato-*.ts` en cada PR de quin-comercial; `v1` congelado; "Instant Rollback"; un paso por semana |
| R2 | **Latencia** (un salto más, arranque en frío de `sharp`) | Presupuesto y medición del §5.4. **Hueco:** región de los dos proyectos de Vercel y de `bjbj`; si difieren, alinear (U29). Cuerpo directo ≤ 4 MB en el webhook |
| R3 | **Dos bases durante la transición.** El núcleo atendiendo a KLIXMANT necesita sus datos | P-3: pasos 1–3 sin datos. El paso 4 es F3 y exige U1 (¿una base o dos?) y U8 (acceso a la del núcleo). Si son dos: copia idempotente ensayada en un Supabase temporal y corte con delta; los archivos siguen en `bjbj`. Mientras el bot no se mueva, nadie escribe datos de KLIXMANT en dos sitios |
| R4 | **Claves.** Una clave interna filtrada da acceso al compresor y, desde el paso 3, a enviar WhatsApp como KLIXMANT | Solo variables de servidor; hash y `timingSafeEqual`; dos por llamante para rotar; prueba estática contra `NEXT_PUBLIC_`; en el núcleo **nunca** la clave de servicio de `bjbj` hasta el paso 4; rotar al apagar quinchat |
| R5 | URL firmadas de lectura que se registran o se filtran | 5 min, un objeto; no se escriben en el registro (solo la ruta) |
| R6 | **Plan de Vercel del núcleo.** Un comentario de `api/quinchat/route.ts` habla de "hobby plan" | **Hueco:** confirmar plan y `maxDuration` antes del paso 1 (U29) |
| R7 | Más invocaciones (cada subida cuenta en las dos apps) | Bajo; se mira en el informe de uso al mes del paso 1 |
| R8 | Fuga entre tenants al portar los pasos 5–6 | `pruebas/aislamiento-tenant.ts` (§9) |

---

## 9 · Pruebas que lo demuestran

- `pruebas/*` y `tsc` en verde en las dos apps en cada PR, en Linux (P5).
- **Estáticas nuevas:** `/api/interna` y `NUCLEO_` no aparecen en componentes de cliente ni en variables
  `NEXT_PUBLIC_`; lo movido no reaparece en `quinchat/` (§2.4, §6.4).
- **Contrato** por función (`contrato-<fn>.ts` en el núcleo, `cliente-nucleo.ts` en quinchat).
- **`aislamiento-tenant.ts`:** dos tenants de prueba; ninguna ruta portada cruza datos; falla si una tabla con
  `tenant_id` no está en `TABLAS_TENANT`.
- **Paridad** (pasos 2 y 7): mismo precio, foto, campos y texto de plantilla en las dos apps para cada embudo activo.
  Abrir una landing escribe eventos: parámetro de prueba o aviso previo.
- **Recuentos** por tabla y tenant en F3; **humo B5** tras los pasos 2, 3, 5 y 7; `ley-peso.ts` verde antes del paso 1.

---

## 10 · Tareas

"Prod" = escribe en producción o cambia configuración real (visto bueno del humano antes). **Ya** = se puede empezar
hoy en rama. Las ramas de quinchat salen de `integracion`; las del núcleo, de `agente/P2-P4-ley-peso`.

| ID | Tarea | Dueño | Depende de | Prod | Ya | Hecho cuando |
| --- | --- | --- | --- | --- | --- | --- |
| U1 | Qué se comparte: Supabase de cada app, `phone_number_id` por app, app de Meta y callback, URL de Funnelish, cron-job.org, quién apunta a `quinchat-sepia` | desarrollador + humano | — | No | **Sí** | Tabla recurso → app(s) con fuente |
| U2 | Filtro por carpeta (= Z4) | admin Vercel | U1 | Config | — | Rama con solo `docs/` no construye |
| U3 | Desconectar y borrar `quinchat-sepia` | admin Vercel | U1 | Config | — | Borrado; nada lo nombraba |
| U4 | `name` distinto | implementador | U2 | Rama | Sí (QCOM) | Nombres distintos; build verde |
| U5 | Comprobador de gemelos + "lo movido no vuelve" + protección de rama | implementador + dueño repo | — | No | **Sí** | PR de prueba en rojo |
| U6 | Regla "seguridad y LEY en las dos" | planeador | — | No | **Sí** | Texto en tablero y `CLAUDE.md` |
| U8 | Acceso a la base de quin-comercial (= D5) | dirección + dueño de la cuenta | — | No | — | Ref y acceso de lectura |
| U9 | Inventario de uso de las 47 funciones y 14 cambios de v174 | desarrollador | Z7, U8 | No | — | Lista portar / no portar aprobada |
| U10 | F1: tenant KLIXMANT interno (sin cobro), banderas, token de WhatsApp cifrado, `tenant_id` en tablas nuevas | implementador → auditor | U8, U9 | **Sí (SQL aditivo)** | — | Aislamiento en verde |
| U20 | **Paso 0 núcleo:** `lib/interna/autenticar.ts`, middleware, `v1/salud`, registro `[interna]`, `pruebas/interna-auth.ts` | implementador → auditor | — | No | **Sí** | 401 sin clave, con clave mala y con clave de otro largo; comparación en tiempo constante; ruta fuera de sesión y de tenant |
| U21 | **Cliente quinchat:** `lib/nucleo.ts` (timeouts, reintento, `[nucleo]`, `NUCLEO_PAUSA_*`), `pruebas/cliente-nucleo.ts` | implementador | — | No | **Sí** | Con núcleo falso: timeout, 401, 413 y los dos modos de fallo dan lo del §5.3 |
| U22 | **= P3 + P4 + P7 en el núcleo:** `sharp` con `@img/**`, compresor por escalones, SVG, lector MP4 | desarrollador + implementador | — | No | **Sí** | `.nft.json` con `libvips-cpp.so.*` en Linux (P5); pruebas de P4 y P7 verdes |
| U23 | **Rutas `media/comprimir` y `media/verificar-video`** (§6.2) + `contrato-media.ts` | implementador → auditor | U20, U22 | No | **Sí** | Las 19 entradas de `ESTRATEGIA-PESO.md` §5 dan lo esperado; salida ≤ 1 MB; `compresor` presente |
| U24 | **1a en quinchat:** `subir-archivo.ts` como cliente + las 3 rutas del panel | implementador → auditor | U21, U23 | No | **Sí** | Las 3 rutas no importan `sharp`; 413 con peso y tope |
| U25 | 1b–1e (§6.3) y quitar `sharp` de quinchat | implementador → pruebas | U24 | No | **Sí** | Prueba estática 1 del §6.4 verde |
| U26 | `media-api`: borrar `servidor.ts` y `sharp`; backfill de imágenes por la API (sustituye a P20) | desarrollador | U23 | No | **Sí** | `--simular` sobre las muestras da los mismos bytes que el núcleo |
| U27 | Variables: `NUCLEO_URL`/`NUCLEO_CLAVE` en quinchat; `CLAVES_INTERNAS` en el núcleo | humano + admin Vercel | Z7 | **Config** | — | Existen en los dos proyectos (sin mostrar valores) |
| U28 | **Publicar el paso 1** (núcleo primero, quinchat una semana por subpaso) y prueba del §6.4.3 | humano + pruebas | Z7, U27, U23–U25 | **Sí** | — | Mismo SHA-256 en las dos apps; p95 dentro del §5.4; sin `DLOPEN`/`ENOENT`/`COMPRESOR_FALLO` en 24 h |
| U29 | Región y plan de Vercel de los dos proyectos y región de `bjbj` | desarrollador (lectura) | — | No | **Sí** | Anotado; si difieren, propuesta |
| U30 | **Paso 2:** `pedidos/interpretar` con los cambios de v174 + quinchat lo usa | implementador → auditor | U28 | Sí (publica) | Rama sí | Paridad del §9 en todos los embudos activos; humo B5 |
| U31 | **Paso 3:** `whatsapp/enviar` + plantillas | implementador → auditor | U30, U10 | Sí | — | Un mensaje y una plantilla reales por línea; `lib/whatsapp.ts` fuera de quinchat |
| U16 | **Paso 4 (F3):** relleno de `tenant_id` (una base) o copia idempotente ensayada (dos) | desarrollador → auditor | U8, U10 | Ensayo no; ejecución **sí** | — | Recuentos iguales; dos pasadas, mismo resultado |
| U32 | **Paso 5:** sombra 7 días → relé 48 h → bandera `bot=nucleo` (§7) | implementador + humano | U16, U31 | **Sí** | — | ≥ 95 % equivalentes; entrantes por hora sin caída; un mensaje real respondido por línea |
| U33 | **Paso 6:** promos (fallos 16, 17), remarketing, metas, campañas, rescate, seguimiento y crons | implementador → auditor | U16 | Sí, bandera apagada | — | Aislamiento verde; crons con `CRON_SECRET`; el equipo los usa en `www.*` |
| U17 | **Paso 7:** tienda en dominio temporal, paridad, humo, ensayo de corte y de marcha atrás | humano + pruebas | U32, U33 | Sí (pedido de prueba) | — | Paridad y humo verdes; tiempo de certificado medido |
| U18 | Corte de `pedido.klixmant.shop` (F4: cron-job.org, dominio, delta +1 h) | humano + desarrollador | U17, ventana | **Sí** | — | 1 h sin errores; un pedido real con foto correcta |
| U19 | 14 días → `quinchat/` fuera de `master`, `quinchat-agencia-quin` sin Git, claves internas revocadas | humano + implementador | U18 | Sí (config) | — | Un solo proyecto construye |
| U37 | Actualizar `ESTRATEGIA-PESO.md` §3–§4 al §6.3 de este plan | planeador | aprobación de este plan | No | **Sí** | P-tareas reasignadas al núcleo |

(U7, "decisión de dirección", quedó cerrada el 30-09 con la aprobación de A y del camino. U11–U15 desaparecen:
se reparten entre U30–U33.)

---

## 11 · Qué tiene que decidir dirección

1. **Quién escribe el archivo en los pasos 1–3:** quinchat (recomendado, P-3: la clave de `bjbj` no sale) frente al
   núcleo con la clave de `bjbj` (una petición menos, pero una clave más expuesta antes de tiempo).
2. **Modos de fallo** del §5.3, sobre todo: pedido cerrado (503) y plantilla automática "sin enviar" si cae el núcleo.
3. **Marcha atrás sin copia local** (P-4) y **un paso por semana** como mucho.
4. **Retirar `media-api` como servicio** y dejarlo como script de `ffmpeg` para el charco.
5. **Relé de webhooks por el núcleo** antes de mover el bot (el núcleo entra en el camino de KLIXMANT en el paso 5).
6. Siguen abiertas: qué base es la única y quién es dueño de esa cuenta (U8); congelar funciones nuevas en quinchat
   desde Z7; KLIXMANT como tenant interno sin cobro; qué no se porta (U9); ventana de corte y si `pedido.*` sigue o
   redirige a `www.*`.

**Del administrador de Vercel:** Root Directory e Ignored Build Step; borrar `quinchat-sepia`; región y plan de los
dos proyectos (U29); variables de U27; permiso para mover `pedido.klixmant.shop` y quién tiene su DNS.

**Huecos abiertos:** I4, I6, I7 (U1); que `media-api` no corra en ningún sitio fuera del repo; región, plan y
latencia real entre proyectos; si Funnelish reintenta ante un 503; si Meta admite el *override* de callback por
cuenta en nuestra configuración; si existe ya el estado "plantilla sin enviar"; tiempo de certificado al mover el
dominio. **Nada de esto se ha probado en Vercel/Linux:** cada paso se comprueba tras publicar con los registros de
ejecución de los **dos** proyectos (observación 2).
