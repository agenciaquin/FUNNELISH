# PLAN-CONSUMO · Reactivar el bot y los embudos sin sobreconsumo, y cumplir la LEY de imágenes

**Fecha:** 30-09-2026 · **Rama de trabajo:** `bloqueantes-consumo` (sin publicar) · **Apps:** `quinchat/` y `quin-comercial/`
**Autor:** agente planeador. Este documento no contiene código; las tareas están en `TASKS-CONSUMO.md`.

> `PLAN.md` y `TASKS.md` de la raíz son de ConfirmaYa (HTML puro) y **no se tocan**.

---

## 0 · Fuentes consolidadas y huecos de lectura

| Fuente | Leída | Nota |
| --- | --- | --- |
| `CLAUDE.md` (observaciones 1-5 + LEY de imágenes) | Sí | La LEY manda sobre cualquier decisión anterior de "no comprimir" |
| `BLOQUEANTES-CONSUMO.md` | Sí | 5 arreglos hechos y probados en local, sin publicar |
| `arreglos-supabase/README.md`, `REPORTE-2026-08-29.md`, `PENDIENTE-quin-comercial.md`, `HALLAZGO-*.md` (3), `auditoria-supabase-agencia-quin43.md` | Sí | |
| Código actual de las dos apps (puntos de subida, intervalos, Realtime, `next.config.ts`) | Sí, por búsqueda | Inventario en la sección 3 |
| `AUDITORIA-CONSUMO-2026-09-30.md` y `NOTA-PC-AGENCIAQUIN.md` (rama `origin/auditoria-consumo`) | **NO** | El planeador no tiene consola (`git show`) y la rama no está descargada en este equipo (no aparece en `.git/refs` ni en `packed-refs`). |

**Hueco abierto (no se rebaja):** las fases 0 y 3 se han planificado con lo que `BLOQUEANTES-CONSUMO.md`
cita de la auditoría (intervalos 6 s / 12 s, ISR en landings, seguimiento agrupado, carrito cada 1,5 s, M5,
compresión en quin-comercial) y con lo que se ve en el código. La numeración ALTO/MEDIO/BAJO de la auditoría y
el procedimiento exacto para unir v174 **no están comprobados contra el original**. La tarea **T0.1** lo cierra:
el desarrollador lee los dos documentos y ajusta `TASKS-CONSUMO.md` (añade lo que falte y anota el ID de la
auditoría en cada tarea) **antes** de empezar cualquier otra.

---

## 1 · Situación de partida (30-09-2026)

- **Producción de quinchat corre v174 (`bff4e19`)**, que solo existe en el PC de agenciaquin. `master` tiene el
  compresor de servidor (`lib/optimizar-imagen-servidor.ts`) que producción **no** tiene. Resultado: desde el
  31-08 han entrado **109 imágenes sin comprimir (134 MB)**.
- **Cualquier envío a `master` publica automáticamente** `pedido.klixmant.shop` **y** las dos tiendas
  (`quinchat-comercial` también construye desde `master`). Por eso **nada se fusiona hasta unir v174**: un envío
  a `master` hoy borraría v174 de producción. Esto bloquea también los cambios que solo tocan `quin-comercial/`.
- **Supabase `quinchat`:** 2,5 GB de storage, de los que ~1 GB es `_originales/` (respaldo del backfill del
  29-08). Los 38 vídeos de `embudos/` pesan 515 MB. **Realtime es la consulta nº 1 de la base.**
- **quin-comercial:** no comprime nada, no tiene `sharp`, su `next.config.ts` no incluye `@img/**`, y **no tiene
  `CRON_SECRET` en Vercel** (con los bloqueantes publicados sus crons se pararían).
- **Seguridad:** los bloqueantes cierran `/api/` (middleware), pero la base sigue con 14 tablas abiertas a `anon`,
  0 usuarios en `auth.users` y la clave `service_role` se considera comprometida.

---

## 2 · Arquitectura de la solución (decisiones técnicas)

### D1 · Un único punto de escritura de archivos por app
Hoy hay ~15 llamadas `.upload(` / `createSignedUploadUrl` repartidas por rutas, `lib/` y componentes. La LEY
falló precisamente por eso: se conectaron 3 rutas y se olvidaron las demás (defectos nº 6 y nº 7).
**Decisión:** crear en cada app un módulo `lib/subir-archivo.ts` (idéntico en las dos) que sea la única función
que escribe en Storage/R2. Si el tipo es `image/*`: pasa por `optimizarImagen()`, usa el `contentType` y la
extensión que devuelve el compresor y pone `cacheControl: CACHE_UN_ANO`. Si el compresor falla: log con
prefijo fijo (`[LEY-IMAGEN] sin comprimir`) y sube el original (LEY punto 5). Todo lo demás (vídeo, audio,
documentos) pasa sin tocar, con su caché actual.
**Por qué:** convierte la LEY en algo comprobable de forma estática: la prueba `pruebas/ley-imagenes.ts` falla
si aparece un `.upload(`, `createSignedUploadUrl`, `r2Subir` o `r2PresignPut` fuera de ese módulo (lista cerrada
de excepciones justificadas, p. ej. vídeo).

### D2 · Subidas directas desde el navegador
Tres componentes suben directo desde el navegador: `EmbudosPanel` y `ChatArea` (por URL firmada si >4 MB) y
`PlantillasPanel` (**con la clave anónima**, sin pasar por ningún servidor).
**Decisión:**
1. `PlantillasPanel` pasa a usar la ruta de servidor que ya existe (`/api/plantillas-wa/imagen`).
2. `/api/funnels/upload-url` **rechaza `image/*`** con un error claro, salvo en modo "entrada temporal".
3. Para imágenes que tras la compresión del navegador siguen por encima de ~4 MB (raro, pero posible): se suben
   por URL firmada a una carpeta temporal `_entrada/`, y una ruta nueva (`/api/media/procesar`) la descarga,
   la comprime con `subir-archivo`, la escribe en su ruta final y borra la temporal.
**Por qué:** la LEY punto 2 exige que toda imagen pase por el servidor. El paso temporal mantiene el soporte de
archivos grandes sin chocar con el tope de ~4,5 MB de las funciones de Vercel.

### D3 · Formato y perfil
Se mantiene **1920 px, JPEG q85, PNG con transparencia real en PNG** (decidido el 30-08, SSIM 0,972). Nunca WebP
(Meta acepta y no entrega). Collages y marcas de agua de Jimp se generan y se pasan por el compresor (una sola
codificación con pérdida: Jimp debe entregar el buffer sin pérdida o a calidad alta, y `sharp` hace la única
pasada q85).

### D4 · Las dos apps se copian, no se unifican
`lib/subir-archivo.ts`, `lib/optimizar-imagen-servidor.ts` y `pruebas/ley-imagenes.ts` se copian idénticos en
las dos apps, y cada commit dice si toca una, otra o las dos (observación 3).

### D5 · Medir antes de recortar consumo
La fase 3 empieza con una línea base (Supabase Usage: egress, mensajes Realtime, top de `pg_stat_statements`;
Vercel: invocaciones de funciones). Sin línea base no se puede demostrar que un cambio ahorra.

### D6 · Realtime y seguridad están acoplados
El panel escucha `postgres_changes` sobre `conversations` y `messages` **con la clave anónima**. Revocar a `anon`
esas tablas (fase 4) **rompe el chat en vivo**. Por eso la fase 3 decide el nuevo modelo de "en vivo" (canal
filtrado, Broadcast desde el servidor, o sondeo a una ruta con sesión) y la fase 4 cierra las tablas después.

---

## 3 · Inventario de escrituras de imágenes (base de la LEY)

| Punto de escritura | quinchat (master) | quin-comercial |
| --- | --- | --- |
| `app/api/funnels/imagen` | Comprime | **No** |
| `app/api/plantillas-wa/imagen` | Comprime | **No** |
| `app/api/catalogos/upload-imagen` | Comprime | **No** |
| `app/api/whatsapp/send-media` (chat saliente) | **No** (hallazgo nº 7) | **No** |
| `app/api/whatsapp/webhook` (fotos que entran por WhatsApp) | **No** | **No** |
| `lib/quinchat/ventas.ts` (media entrante en ventas) | **No** | **No** |
| `lib/collage.ts` (packs) | Jimp q85, sin compresor ni caché 1 año | **Jimp q100** |
| `app/api/funnelish/webhook` (collage) | Jimp q85, sin compresor | **Jimp q100** |
| `lib/watermark.ts` (estampado de catálogo, 3 rutas) | **No** | **No** |
| `app/api/funnels/upload-url` (URL firmada, Supabase o R2) | **No pasa por servidor** | **No pasa por servidor** |
| `components/panel/ChatArea.tsx` (>4 MB, directo) | **No pasa por servidor** | **No pasa por servidor** |
| `components/panel/PlantillasPanel.tsx` (clave anónima) | **No pasa por servidor** | **No pasa por servidor** |
| `app/api/funnels/optimizar-fotos` (botón de agenciaquin, 1080/q72) | **Fuera de la LEY** (decisión humana H6) | n/a |
| `app/api/funnels/video`, `audio` | No son imágenes: deben rechazar `image/*` | Igual |
| `sharp` + `./node_modules/@img/**/*` en `next.config.ts` | Sí | **No** |

**Importante:** esta tabla describe `master`. Producción (v174) puede diferir; T0.4 la vuelve a levantar sobre la
rama unida.

---

## 4 · Fases

Orden y dependencias:

```
Fase 0 (unir v174) ──► Fase 1 (publicar bloqueantes) ──► Fase 2 (LEY publicada)
        │                                                   │
        └── desarrollo de Fases 2, 3 y 4 en ramas, SIN fusionar ──┘
Fase 3 (consumo) ──► Fase 4b (cerrar messages/conversations)
Fase 4a (quick wins de Supabase, confirma-ya, master-quin, Spend Cap) ── independiente, solo aprobación
```

---

### FASE 0 · Unir v174 con `master` — **bloqueante externo**

**Objetivo:** que `master` contenga exactamente lo que corre en producción (v174) más lo que ya está en `master`
(compresor, `@img` en `next.config.ts`), para que publicar deje de ser destructivo.

**Depende de:** una persona en el PC de agenciaquin (subir `bff4e19` a GitHub en una rama propia). Nadie más
puede hacerlo.

**Qué se puede hacer YA desde este PC, sin v174:**
- Leer la auditoría y la nota (T0.1) y preparar la lista de comprobación de la unión (T0.2).
- Nada más en esta fase. **No** reconstruir v174 a partir del despliegue de Vercel ni "adivinar" su contenido.

**Qué NO se puede hacer sin v174:** fusionar nada a `master` (ninguna app), publicar, rebasar
`bloqueantes-consumo`.

**Decisión humana posible (H1):** activar en Vercel "saltar despliegue si no cambia el directorio raíz" en los dos
proyectos, para que un cambio que solo toca `quin-comercial/` no republique `pedido.klixmant.shop`. Reduce el
acoplamiento, pero **no** sustituye la unión de v174 (el primer cambio en `quinchat/` seguiría borrando v174).

**Riesgos:**
- Conflictos entre v174 y el compresor en `lib/imagen-comprimir.ts` y `next.config.ts` (ya pasó en la fusión del
  29-08). Si la unión pierde `./node_modules/@img/**/*`, vuelve el `ERR_DLOPEN_FAILED` (observación 1).
- v174 se desplegó quizá con cambios sin guardar (`gitDirty`, como ocurrió con `78d4cac`): comparar el commit con
  el despliegue.
- La unión publica de golpe todo lo que `master` tiene por delante de producción: hacerlo con alguien mirando, no
  de madrugada.

**Verificación en producción:** tras publicar la rama unida, el despliegue de Vercel muestra el commit unido;
registro de construcción sin errores; subir **una** imagen por `funnels/imagen` desde el panel y comprobar en
`storage.objects` que tiene `cacheControl = max-age=31536000` y `mimetype image/jpeg`; registros de ejecución
sin `DLOPEN`/`ENOENT`. Marcha atrás: volver al despliegue de v174 desde el panel de Vercel.

---

### FASE 1 · Publicar los bloqueantes con su configuración

**Objetivo:** cerrar la API, los crons, los webhooks y poner freno al bot, **sin cortar** crons, ventas de
Funnelish ni mensajes de Meta. Es la condición para reactivar el bot.

**Depende de:** Fase 0 (rebasar `bloqueantes-consumo` sobre la rama unida) y de la configuración humana en
Vercel, cron-job.org, Meta y Funnelish.

**Qué se puede hacer YA:** cerrar las observaciones abiertas de la revisión de pruebas (tope con valor no
numérico, `?token=` vacío con cabecera correcta), confirmar leyendo código que la versión actual ignora
`?token=` (para poder cambiar la URL de Funnelish **antes** de publicar), y preparar la lista de configuración
por proyecto. Todo en la rama, sin fusionar.

**Orden de configuración recomendado (minimiza cortes):**
1. Antes de publicar: `CRON_SECRET` en `quinchat-comercial`; en cron-job.org, **todas** las tareas de los dos
   proyectos mandan la clave (sobre todo `ventas-seguimiento`, `objeciones`, `carrito-recuperacion`).
2. Antes de publicar: URL de Funnelish con `?token=…` (inocuo con el código viejo si T1.3 lo confirma).
3. Crear `FUNNELISH_WEBHOOK_TOKEN`, `WHATSAPP_APP_SECRET` y `BOT_IA=off` en los dos proyectos.
4. Publicar. 5. Verificar (abajo). 6. Quitar `BOT_IA=off` cuando todo esté verde (decisión humana H2).

**Riesgos:** clave de Meta equivocada = se rechazan todos los mensajes; `CRON_SECRET` ausente = crons parados;
integraciones externas desconocidas que llamaban a `/api/` sin sesión dejan de funcionar; webhook de Mercado
Pago (quin-comercial) cambia de comportamiento; rutas de WhatsApp por cliente en quin-comercial siguen sin
firma (hueco conocido). Con `BOT_IA=off` se sigue gastando en M5 (clasificación de fotos con Claude).

**Verificación en producción:**
- Un WhatsApp real de prueba a cada línea: llega al panel y el registro de Vercel no muestra
  `[Webhook] aviso rechazado`.
- Historial de cron-job.org: todas las tareas en 200 durante 24 h (no 401).
- Una venta de prueba (o el reenvío de un webhook) desde Funnelish entra al panel.
- Sondeo de rutas desde fuera con un verbo no exportado (`auditar-rutas-api.ts`): solo la lista pública responde
  sin redirigir al login.
- Registros de Vercel 48 h: buscar 401/307 inesperados en `/api/`.

---

### FASE 2 · LEY de imágenes en las dos apps

**Objetivo:** que **ninguna** imagen llegue a Supabase Storage o R2 sin pasar por el compresor del servidor, en las
dos apps, demostrado por prueba antes de publicar y por SQL después.

**Depende de:** Fase 0 para publicar quinchat (y cualquier cosa, porque `master` publica las dos). El
desarrollo **no** depende: se hace ya en una rama `ley-imagenes` creada desde `bloqueantes-consumo`.

**Qué se puede hacer YA (sin v174):** todo el código y las pruebas de las dos apps (D1, D2, D3), incluido añadir
`sharp` y `@img/**` a quin-comercial, y dejar preparada la lista de backfill de las 109 imágenes. Lo que no:
publicar ni lanzar el backfill hasta que el compresor esté en producción (si no, siguen entrando imágenes
pesadas detrás).

**Riesgos:**
- `sharp` en Linux (observación 1): compila en Windows no prueba nada. En quin-comercial es la primera vez.
- Fotos que entran por WhatsApp y M5: si la clasificación usa la foto, comprobar que la versión comprimida
  clasifica igual (y es más barata en tokens).
- Chat saliente: capturas con texto pequeño (tallas, precios) deben seguir leyéndose; `document` y `audio` no
  deben tocarse.
- Tiempo de función: comprimir en el webhook de WhatsApp añade latencia; medir que no pase de lo que Meta tolera.
- La prueba estática puede dar falsos verdes si alguien sube con otro cliente (`fetch` directo a la API de
  Storage). La prueba busca también `/storage/v1/object` y `PutObject`.

**Verificación en producción:**
1. Registro de construcción de **cada** proyecto sin errores y con `sharp` presente.
2. Prueba más barata tras publicar, por app y por camino: subir una imagen PNG grande por panel (embudo,
   catálogo, plantilla, chat) y mandar una foto por WhatsApp a la línea. Mirar el objeto en `storage.objects`.
3. SQL de la LEY (en el editor de Supabase, solo lectura): imágenes creadas después de la hora de publicación,
   fuera de `_originales/` y `_entrada/`, **sin** `metadata->>'cacheControl' = 'max-age=31536000'` → debe dar
   **0**. Repetirlo a las 24 h y a los 7 días.
4. Registros de ejecución: contar `[LEY-IMAGEN] sin comprimir` (debe ser 0 o casos raros explicados).
5. `sql/004_chequeo_consumo.sql` a los 7 días: peso medio de lo que entra < 200 kB.

---

### FASE 3 · Reducir el consumo del panel y las landings

**Objetivo:** bajar la carga de Realtime/consultas, las invocaciones de funciones y el egress que no son imágenes,
**sin** empeorar la experiencia del asesor (el chat debe seguir "en vivo").

**Depende de:** línea base (T3.1). Para publicar, de Fase 0. Las decisiones M5, vídeos y R2 dependen del humano.

**Palancas (según el código y la lista de `BLOQUEANTES-CONSUMO.md`; completar con la auditoría en T0.1):**
- **Realtime (consulta nº 1):** `WhatsAppPanel` escucha **todos** los cambios de `conversations` sin filtro y
  recarga la lista entera por cada uno, en cada panel abierto; `EstadisticasPanel` hace lo mismo. Recortar:
  recarga incremental con el `payload`, filtrar eventos, y quitar de la publicación `supabase_realtime` las
  tablas que nadie escucha (cambio de base: aprobación).
- **Sondeo de seguridad cada 6 s** en `WhatsAppPanel` (además de Realtime) y **12 s** en `MonederoFlotante` y
  `MetasPanel`, 15 s en `EstadisticasPanel`, 20 s en `PedidosPanel`, 30 s en `IntegrarIaPanel`: subir los
  intervalos y sondear solo si el canal Realtime está caído.
- **Landings `force-dynamic`** (`/p/[slug]`, `/pedido`, `/gracias`, `/tienda`): ISR con `revalidate` y
  revalidación bajo demanda al guardar un embudo.
- **Carrito cada 1,5 s** (`FormularioPedido`, `CheckoutPro`): guardar solo al cambiar un campo clave y con
  espera mayor, o al salir del campo.
- **Seguimiento agrupado** (crons): agrupar consultas y envíos por lote (detalle en la auditoría).
- **Collages en paralelo sin límite** (defecto nº 5, 429 de Supabase): descargar de una en una con reintento.
- **M5 y Groq antes del freno** del bot: decisión humana H3.
- **38 vídeos (515 MB, 47% del bucket):** decisión humana H5.

**Riesgos:** el asesor deja de ver mensajes nuevos al instante si se sube el sondeo y Realtime falla en silencio
(fue el motivo del sondeo de 6 s); ISR puede mostrar precios/stock viejos si falla la revalidación al guardar; el
carrito abandonado puede perder datos si se guarda menos.

**Verificación en producción:** comparar con la línea base a los 7 días: Supabase Usage (mensajes Realtime,
egress), top de `pg_stat_statements` (la consulta de Realtime deja de ser la nº 1 o baja su número de llamadas),
invocaciones en Vercel. Prueba funcional: un WhatsApp entrante aparece en el panel en menos de 5 s; editar un
embudo y ver el cambio en la landing sin esperar al `revalidate`.

---

### FASE 4 · Seguridad de Supabase y limpieza

**Objetivo:** cerrar la base a `anon`, rotar la clave comprometida, liberar el ~1 GB de `_originales/` y dejar la
vigilancia configurada.

**4a (independiente, solo aprobación, se puede hacer YA):** fase 1 de `arreglos-supabase/sql/` (revocar 12 tablas
sin uso, scripts listos con rollback); `master-quin` (revocar `EXECUTE` de 2 funciones trigger, protección de
contraseñas filtradas); `confirma-ya` (`search_path` en `set_tenant_id_from_jwt`); Spend Cap y correo de avisos.

**4b (depende de Fase 3 y de la LEY publicada):** mover a rutas con sesión las 3 llamadas anónimas a
`messages`/`conversations` y el "en vivo" (D6); cerrar la subida anónima al bucket (`PlantillasPanel` ya no la
usa tras Fase 2); revocar `messages` y `conversations`.

**4c (decisiones humanas):** rotar `service_role` (H4), borrar `_originales/` (H7), partir `chat-media` en público y
privado (H8), qué hacer con el botón "Optimizar fotos" (H6).

**Riesgos:** revocar una tabla que el panel usa lo rompe (ya se detectaron `clientes_funnelish` y `bot_config`);
rotar la clave sin actualizar **todos** los sitios (dos proyectos Vercel, `media-api/.env`, PC de agenciaquin)
corta la app; borrar `_originales/` es irreversible y cierra la puerta a recomprimir sin doble pérdida.

**Verificación en producción:** `003_verificacion.sql` (4 filas); Logs Explorer de Supabase 48 h sin 401/403 nuevos;
panel y landings funcionando; tras rotar, la clave vieja devuelve 401 y las apps siguen escribiendo; tras borrar
`_originales/`, Storage baja ~1 GB en Usage y `validar-landings.ts` da 31/31.

---

## 5 · Decisiones que necesitan al humano

| ID | Decisión | Opciones | Recomendación del plan | Bloquea |
| --- | --- | --- | --- | --- |
| H0 | Subir v174 a GitHub desde el PC de agenciaquin | — | Rama `v174-produccion`, sin tocar `master` | Todo lo publicable |
| H1 | "Saltar despliegue si no cambia el directorio raíz" en Vercel | Activar / no | Activar tras Fase 0 | Nada (mejora) |
| H2 | Cuándo quitar `BOT_IA=off` y valor de `BOT_TOPE_DIARIO` | — | Quitar tras 24-48 h con crons y webhooks verdes | Reactivar el bot |
| H3 | **M5: clasificación de fotos con el bot apagado o al tope** | (a) dejarla antes del freno; (b) moverla detrás del freno; (c) solo si la foto parece comprobante | Decidir con negocio: cambia cuándo se marca un abono | T3.x M5 |
| H4 | **Rotar `service_role`** | Rotar JWT (rompe también la anon, hay que redesplegar todo) / migrar a las claves nuevas de Supabase (secret/publishable) y desactivar la vieja | Migrar a clave nueva con ventana acordada | Fase 4c |
| H5 | **38 vídeos, 515 MB** | (a) dejarlos; (b) recomprimir fuera de Vercel con `media-api`+ffmpeg (−83% medido); (c) moverlos a R2 (egress gratis); (d) b+c | (d), empezando por (b) con respaldo | Fase 3 |
| H6 | Botón "Optimizar fotos" de agenciaquin (1080/q72, `embudos-opt/`) | Retirar / alinear a 1920/q85 por el compresor / dejar | Hablarlo con agenciaquin; hoy incumple la LEY | Fase 2 cierre |
| H7 | **Borrar `_originales/` (~1 GB)** | (a) borrar; (b) copiar a un almacenamiento frío (R2 o disco) y borrar; (c) mantener | (b), tras 7 días de Fase 2 sin incidencias y con el perfil 1920/q85 cerrado | Fase 4c |
| H8 | Partir `chat-media` en bucket público y privado | Ahora / más adelante | Más adelante, tras 4b | — |
| H9 | Cerrar tablas de Supabase (4a y 4b) | — | 4a ya; 4b tras Fase 3 | Fase 4 |
| H10 | Backfill: 109 imágenes desde el 31-08 (134 MB) y chat saliente histórico (389, 289 MB) | Sí / no | Sí, con `_originales/` como respaldo | Fase 2 cierre |
| H11 | Spend Cap activado o no, y correo de avisos | — | Confirmar el correo; decidir con dirección | — |
| H12 | Firma de Meta en webhooks por cliente de quin-comercial | Guardar la clave de app por cliente / dejar abierto | Guardarla por cliente | — |

Toda escritura en producción (variables de Vercel, SQL que escribe, backfill, borrado en el bucket, fusión a
`master`) la ejecuta o aprueba un humano. Los agentes no publican (`vercel --prod` prohibido, push a `master`
prohibido).

---

## 6 · Criterios de aceptación globales ("terminado y correcto")

1. `master` contiene v174 + compresor + bloqueantes + LEY, y producción de los dos proyectos corre ese commit.
2. Los crons de los dos proyectos corren con `CRON_SECRET` (24 h en 200 en cron-job.org) y sin clave responden 401.
3. `/api/` solo responde sin sesión en la lista pública; `auditar-rutas-api.ts` lo confirma desde fuera.
4. El webhook de Meta valida la firma y los mensajes reales llegan; Funnelish entra con token.
5. El bot está reactivado con tope diario y sin respuestas dobles.
6. **LEY:** en cada app `pruebas/ley-imagenes.ts` pasa; en producción, la consulta de la LEY devuelve **0 imágenes
   sin `max-age=31536000`** creadas después de publicar, a las 24 h y a los 7 días; peso medio de entrada < 200 kB.
7. Las 109 imágenes pendientes (y el chat saliente histórico si H10 = sí) están comprimidas; `validar-landings.ts`
   31/31 y `validar-whatsapp.ts` sin errores.
8. Consumo: frente a la línea base, bajan los mensajes Realtime y el número de llamadas de la consulta nº 1, sin
   que el chat tarde más de 5 s en mostrar un mensaje entrante.
9. Seguridad: 4a aplicada; `service_role` rotada (si H4); `003_verificacion.sql` correcto; 48 h sin 401/403 nuevos.
10. Todo lo que no se pudo probar en el destino está escrito como hueco abierto con su prueba propuesta.
11. El auditor emite **APROBADO** en `AUDIT-CONSUMO.md`.
