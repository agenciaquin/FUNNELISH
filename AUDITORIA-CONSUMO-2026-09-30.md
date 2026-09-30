# Auditoría de consumo — antes de reactivar el bot y los embudos

**Fecha:** 30-09-2026 · **Rama:** `master` @ `5a2f455` · **Alcance:** `quinchat/` y `quin-comercial/`
**Método:** lectura de código (sin tocar archivos, sin llamar a ninguna ruta `/api`) + datos reales de Vercel y Supabase.

---

## Veredicto

**No reactivar tal cual.** El gasto “normal” del bot es bajo (céntimos por conversación). El riesgo real
está en tres sitios, que pueden disparar el gasto sin que nadie del equipo haga nada:

1. **Puertas abiertas**: cualquiera en internet puede mandar plantillas de WhatsApp de pago, llamar a la IA y
   lanzar los crons, sin iniciar sesión.
2. **Sin freno**: no hay interruptor global del bot, ni tope diario de IA, ni tope por conversación.
3. **El panel consulta sin parar**: cada pestaña abierta genera cientos de llamadas por hora.

---

## Lo que dicen los datos reales (hoy)

| Plataforma | Dato | Lectura |
| --- | --- | --- |
| Vercel (equipo AGENCIA QUIN) | 25–29 sep: **~3,18 USD de uso**, de los que 2,67 son la licencia. Uso real ≈ 0,13 USD/día | Está casi dormido. Hoy no hay problema; el problema llega con tráfico |
| Vercel `quin-comercial` | **No tiene `CRON_SECRET`** | Sus crons están abiertos a cualquiera (fallan “abiertos”) |
| Vercel (ambos) | **No existe `WHATSAPP_APP_SECRET`** | No se puede verificar que los avisos vengan de Meta |
| Supabase `quinchat` | Storage **2,5 GB**; de ellos **1.010 MB** son `_originales/` (respaldo del backfill del 30-08) | 40% del almacenamiento es un respaldo que ya se puede borrar |
| Supabase `quinchat` | Consulta nº 1 de la base: **Realtime, 5,1 M llamadas, 7,3 h de CPU** desde el 15-07 | El panel escucha `conversations` y `messages` en vivo y además consulta cada 6 s |
| Supabase `quinchat` | 2.556 mensajes y 5.221 eventos de embudo en 7 días | Volumen moderado |
| Supabase | `pg_cron` no está instalado | Los crons los dispara **cron-job.org** (fuera del repo) |

---

## 🔴 ALTO — arreglar antes de reactivar

### A1 · La API entera está abierta en los dominios de tienda
`quinchat/middleware.ts:32` y `quin-comercial/middleware.ts:34` dejan pasar todo `/api/` sin sesión.
En quin-comercial, **cualquier dominio que no sea `*.vercel.app`** cuenta como tienda.

Rutas con las que se puede quemar dinero hoy:

| Ruta | Qué hace sin sesión |
| --- | --- |
| `POST /api/remarketing` (quinchat) | Manda una plantilla de marketing **de pago** a hasta **5.000** conversaciones |
| `/api/plantillas-wa/enviar` | Manda una plantilla a cualquier número, sin límite |
| `/api/quinchat` (ambas) | Proxy abierto a Claude |
| `/api/whatsapp/webhook` (ambas) | Sin firma de Meta: un mensaje falso hace que el bot llame a Claude y responda |
| `/api/funnelish/webhook` (ambas) | Sin secreto: crea pedidos falsos y envía plantilla de confirmación a cualquier número |
| `/api/cron/*` en quin-comercial | Abiertos (falta `CRON_SECRET`). `ventas-seguimiento` no tiene guarda en ninguna app |
| `/api/pedidos/*` | `'/api/pedidos'` está en la lista pública con `startsWith`: abre también `lista`, `accion`, `detalle` (datos personales) |

**Arreglo mínimo**
- Rama tienda: lista cerrada (`/api/pedidos` exacto, `/api/funnels/evento`, `/api/funnels/carrito`, los dos webhooks).
- `/api/pedidos` como coincidencia exacta en la lista pública.
- Crons: `if (!secret) return false` y añadir guarda a `ventas-seguimiento`. Crear `CRON_SECRET` en `quinchat-comercial`.
- Webhook de Meta: verificar `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`. Funnelish: token compartido.
- `getServerSession` en `remarketing`, `plantillas-wa/enviar`, `quinchat`, `push/test`.

### A2 · El bot no tiene freno
- No hay interruptor global (`BOT_IA=off`) ni tope diario ni tope por conversación.
- Si al otro lado hay un bot o una respuesta automática, se crea un bucle: hasta ~300 llamadas/hora por chat
  (~1,5 USD/h con Haiku, ~5 USD/h con Sonnet).
- En quin-comercial, cuando fallan las llaves gratuitas del cliente, **paga la llave de Claude de la agencia sin
  límite** (`ia-rotacion.ts:93`, `COBRO_ACTIVO=false`).

**Arreglo mínimo:** variable `BOT_IA` comprobada antes de cada llamada; tope de ~40 respuestas/conversación/día y
luego pasar a humano; tope diario por empresa en quin-comercial.

### A3 · Mensajes repetidos → doble IA y doble envío (quinchat)
- El webhook espera **12 s** dentro de la función antes de responder a Meta (`webhook/route.ts:1035`,
  `ventas.ts:1206`). Meta reintenta cuando tardamos.
- La línea funnel guarda con `upsert` (`route.ts:1005`), así que el reintento no se detecta: se repite la IA y
  el cliente recibe la respuesta dos veces. En ventas, fotos y audios tampoco se deduplican.
- quin-comercial **sí** lo tiene resuelto (`webhook:702-712`): copiarlo.
- A medio plazo: responder 200 al momento y procesar con `after()`.

### A4 · El panel de WhatsApp consulta sin parar
- `WhatsAppPanel.tsx:231`: cada **6 s** descarga **todas** las conversaciones (`select('*')` sin límite) y los
  mensajes del chat abierto. Además, cada cambio en vivo vuelve a descargar la lista completa.
- `MonederoFlotante.tsx:93`: `/api/metas` cada 12 s = **~300 invocaciones de Vercel/hora por pestaña**, cada una
  con 2 consultas de hasta 5.000 filas.
- `RemarketingPanel` (6 s), `VendedoresPanel` (60 s) e `IntegrarIaPanel` (30 s) **no se pausan** con la pestaña oculta.

Con 2 personas y el panel abierto 8 h, es la fuente de consumo recurrente más grande del proyecto.

**Arreglo mínimo:** quitar la consulta de 6 s (ya existe Realtime) o subirla a 60 s; aplicar el evento en vez de
recargar; `.limit(200)` y columnas concretas; `/api/metas` a 60–120 s; pausa por `visibilityState` en todos.

### A5 · quin-comercial sirve imágenes sin comprimir
Medido hoy: `tienda.skioo.shop/prueba-32` = **~6,1 MB** en imágenes (1–1,8 MB cada una), frente a 2,2 MB de
`/colombia` en quinchat. Sin `sharp`, sin `cacheControl` (Supabase pone 1 h), collages a JPEG calidad 100.
Con 1.000 visitas/día ≈ 180 GB/mes de egress solo por esta app.

**Arreglo mínimo:** `.quality(85)` en `lib/collage.ts:38` y `funnelish/webhook/route.ts:271` (2 líneas, −73%);
copiar la compresión de quinchat (ver `arreglos-supabase/PENDIENTE-quin-comercial.md`), **incluyendo
`./node_modules/@img/**/*` en `outputFileTracingIncludes`** (lección del 31-08).

---

## 🟡 MEDIO

| # | Qué | Dónde | Arreglo |
| --- | --- | --- | --- |
| M1 | Landings `force-dynamic`: cada visita (y cada bot de FB/WhatsApp) = 1 función + 2 lecturas del embudo | `app/p/[slug]/page.tsx` (ambas) | Leer UTM en el cliente, `revalidate = 300`, `revalidatePath` al guardar, `cache()` en `obtenerFunnel` |
| M2 | Seguimiento: 1 invocación + 1 INSERT por paso (2–5 por visita). `GET /api/funnels/evento` inserta una fila `_diag` por visita, y es público | `FunnelTracker.tsx:26` | Agrupar y enviar con `sendBeacon` al salir; quitar el `GET` de diagnóstico |
| M3 | Carrito abandonado se guarda cada 1,5 s al escribir (5–15 llamadas por comprador) | `FormularioPedido.tsx:238` | Guardar al salir del campo o en `pagehide` |
| M4 | Crons que envían plantillas marcan “enviado” **después** de enviar → duplicados si se solapan | `cron/remarketing:100`, seguimiento | `UPDATE … WHERE x IS NULL RETURNING` antes de enviar |
| M5 | Clasificación de fotos con Claude aunque el bot esté apagado | `webhook/route.ts:873` | Solo si `botActivo` |
| M6 | Vídeos del carrusel montados a la vez y descargados enteros | `Galeria.tsx:48` | Montar solo el activo, `preload="metadata"` + `poster` |
| M7 | Raíz de skioo: 3 redirecciones/funciones antes de la landing | `tienda.skioo.shop/` | Redirección fija |
| M8 | Reintentos apilados: hasta 12 peticiones por turno de IA | `claude.ts:98`, `ventas.ts:1330` | Dejar solo los del SDK |

## 🟢 BAJO

- Caché de prompt en la línea funnel no sirve (el prompt empieza con datos del cliente). Mover esos datos al final.
- `claude.ts:108` descarta `usage`: registrar tokens para poder medir el gasto real.
- `_originales/` en Storage (1 GB): borrar cuando se confirme que no hace falta volver atrás.
- `promo-cierre` está desactivado pero cron-job.org lo sigue llamando: quitarlo. Revisar que no haya crons programados en las dos apps a la vez.
- Supabase: índice duplicado en `carritos_abandonados`; 9 índices sin uso.
- `/api/push/test` sin sesión.

## Lo que está bien

- Modelo por defecto `claude-haiku-4-5` (barato). Audios con Groq Whisper (gratis).
- Los avisos de estado de Meta se filtran antes de cualquier IA.
- `bot_enabled` se comprueba antes de la llamada principal.
- La espera agrupa mensajes seguidos en una sola respuesta.
- Remarketing programado acotado (2 por pedido, 60 por corrida) y los recordatorios dentro de 24 h van como texto (gratis).
- Las landings no usan `next/image`: no hay coste de optimización de imágenes de Vercel.

## Coste esperado del bot (Haiku 4.5)

| Caso | Coste |
| --- | --- |
| Turno del bot vendedor con caché aprovechada | ~0,005 USD |
| Turno con escritura de caché (tráfico escaso) | ~0,04 USD |
| Conversación de ~10 turnos | 0,05–0,40 USD |
| Con Sonnet (`QUINCHAT_MODEL`) | ×3 |

Estimado a partir del tamaño de los prompts en el código; no se midió con tráfico real.

---

## Orden recomendado

**Antes de reactivar (bloqueante):**
1. Cerrar `/api/` en el middleware de las dos apps + `/api/pedidos` exacto. *(A1)*
2. `CRON_SECRET` en `quinchat-comercial` y crons que fallen cerrados. *(A1)*
3. Firma de Meta y token de Funnelish. *(A1)*
4. `BOT_IA` + tope por conversación y por día. *(A2)*
5. Deduplicar por id de mensaje en quinchat. *(A3)*

**Primera semana:**
6. Panel: quitar consultas de 6 s / 12 s. *(A4)*
7. quin-comercial: collage a q85 + compresión. *(A5)*
8. ISR en landings. *(M1)*

**Después:** el resto de MEDIO y BAJO.

**Antes de encender:** poner alertas de gasto — límite mensual en la consola de Anthropic, *Spend Management*
en Vercel y *Spend Cap* en Supabase.

## Compresión de imágenes: ¿está funcionando?

**No en producción.** El trabajo del 29–31 de agosto funcionó una vez y después quedó fuera sin que nadie lo notara.

| Pieza | Estado |
| --- | --- |
| Backfill (`media-api`, 29–30 ago) | ✅ Funcionó: 723 imágenes, **1.010 MB → 160 MB (−84%)**. `/colombia` pasó de 21 MB a 2,1 MB |
| Compresor en el servidor (`sharp`, 1920/q85, caché de 1 año) | ❌ **No está en producción.** El despliegue actual de `pedido.klixmant.shop` (`dpl_Ef4y12…`, commit `bff4e19` “v174”) se hizo desde la copia local de agenciaquin. Ese commit **no existe en GitHub** y su `package.json` **no incluye `sharp`** |
| Compresor en el navegador (`imagen-comprimir.ts`) | ⚠️ Activo en su versión antigua (1600/q82). Funciona con los JPEG, pero los PNG se quedan como PNG |
| Collages a calidad 85 | ❌ No está en producción: los `packs/` nuevos pesan 1,1 MB de media (18 de 19 superan 500 kB) |

**Prueba:** las 723 imágenes del backfill llevan `cacheControl = max-age=31536000`, la marca del compresor.
Las **316 imágenes subidas desde el 31-08 llevan todas `max-age=3600`**: ninguna pasó por el compresor del servidor.

**Lo que se ha acumulado desde entonces:** 316 imágenes, 168 MB. **109 superan 300 kB y suman 134 MB.**
Los peores casos son los PNG de `embudos/promociones` y `remarketing` (~2,3 MB cada uno), `catalogo/` (842 kB de media) y `packs/`.

**Riesgo añadido:** producción corre código (v174) que no está en GitHub, y `master` tiene código (compresor) que
no está en producción. `quinchat-agencia-quin` publica solo al hacer push a `master`, así que el próximo push
**borraría v174 de producción**. Y el próximo `vercel --prod` desde la copia local vuelve a dejar fuera el compresor.

**Para recuperarlo:**
1. agenciaquin sube su rama (con `bff4e19`) a GitHub.
2. Se fusiona con `master`, que ya incluye el compresor, el arreglo de `libvips` y los collages a q85.
3. Se publica **solo** desde GitHub; nada de `vercel --prod` en local.
4. Se comprueba subiendo una foto: debe quedar con `max-age=31536000`.
5. Se pasa `media-api` sobre las 109 imágenes pesadas (~134 MB → ~25 MB estimado, con el mismo −84%).

## Huecos abiertos (no verificado)

- Frecuencia real de cada cron: solo se ve en la cuenta de cron-job.org.
- Plan de Supabase y consumo de egress del mes: se ve en *Settings → Usage* del panel, no por API.
- Gasto real en Anthropic: no hay registro de tokens en el código; mirar la consola de Anthropic.
- Recuerda que **un push a `master` publica `pedido.klixmant.shop` automáticamente** (y quin-comercial también):
  cada arreglo de la lista publica al fusionar.
