# Arreglos Supabase

Trabajo sobre los 3 proyectos Supabase de la organización `confirma-ya`
(cuenta agenciaquin43).

Vive aquí, junto a `quinchat/`, porque esa es la aplicación que consume estas
bases. La carpeta en sí es autónoma: la auditoría, el SQL y un servicio propio.

**Sí se tocó `quinchat/`**, en 8 archivos, para que las fotos entren
comprimidas. Está todo en la rama `optimizacion-imagenes` y listado —con cómo
revertirlo— en `CAMBIOS-EN-QUINCHAT.md`. **`quin-comercial/` no se tocó**; ver
`PENDIENTE-quin-comercial.md`.

> La carpeta se llama `arreglos-supabase` con guion y no "arreglos supabase" con
> espacio: los espacios en las rutas rompen los `working-directory` de GitHub
> Actions, los scripts de npm y los `COPY` de Docker.

---

## Qué hay aquí

| | |
| --- | --- |
| `auditoria-supabase-agencia-quin43.md` | Auditoría de seguridad de los 3 proyectos, 2026-08-28 |
| `REPORTE-2026-08-29.md` | **Empieza por aquí.** Todo lo hecho, los 6 defectos encontrados y lo que queda |
| `CAMBIOS-EN-QUINCHAT.md` | Qué se tocó fuera de esta carpeta, y cómo revertirlo |
| `TEXTO-DEL-PR.md` | Lo que se comunicó al equipo al abrir el PR #1, incluido el aviso a agenciaquin |
| `PENDIENTE-quin-comercial.md` | ⏳ La app gemela no comprime nada y escribe en el mismo bucket. Medido y sin aplicar |
| `HALLAZGO-dos-compresores.md` | Otro compresor en `master` a 1080/q72. Medido: SSIM 0,896, degradada. Sin tocar |
| `HALLAZGO-rutas-api-abiertas.md` | ⚠️ **Las 82 rutas de la API responden sin sesión en el dominio público. Sin corregir, pendiente de aprobación.** |
| `sql/salidas/MEDICION-egress-2026-08-30.md` | **Resultado medido:** el peso servido a navegadores baja de 616 a 186 KiB (−69,8%) |
| `informe-supabase.html` | Informe consolidado para compartir |
| `sql/` | Scripts de la fase 1: cerrar las tablas expuestas de `quinchat` |
| `media-api/` | Servicio de compresión y herramientas de validación (Node + TypeScript) |

Son **dos trabajos distintos** que conviene no mezclar:

- **Seguridad** (`sql/`) — cierra tablas abiertas. No ahorra ni un byte.
- **Consumo** (`media-api/`) — reduce storage y egress. No cambia la seguridad.

---

## Retomar esto en otro equipo

### 1 · Traerse el trabajo

```bash
git clone https://github.com/agenciaquin/FUNNELISH.git
cd FUNNELISH
git checkout optimizacion-imagenes     # aquí está todo; master no se tocó
```

### 2 · Instalar

```bash
cd quinchat            && npm install
cd ../arreglos-supabase/media-api && npm install
```

### 3 · Las credenciales, que NO están en el repo

Los `.env` están en `.gitignore` a propósito. Hay que recrearlos a mano; los
valores salen del panel de Supabase, en **Settings → API**.

**`arreglos-supabase/media-api/.env`**

```
SUPABASE_URL=              # Project URL
SUPABASE_SERVICE_ROLE_KEY= # clave service_role (secreta)
BUCKET=chat-media
PORT=8080
```

Las demás (`IMAGEN_*`, `VIDEO_*`, `CACHE_CONTROL`) son opcionales: si faltan se
usan los valores por defecto de `src/config.ts`, que ya son los correctos.

**`quinchat/.env.local`** — solo si se va a levantar la app en local

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_SECRET=           # cualquier cadena larga sirve en local
```

> 🔑 **Pendiente: rotar la clave `service_role`.** Se pegó en una conversación,
> así que conviene darla por comprometida y generar otra.

### 4 · Comprobar que todo sigue bien

Ninguno de estos escribe nada. Se pueden lanzar cuantas veces haga falta.

```bash
cd quinchat
npx tsx pruebas/optimizar-imagen.ts     # 18 pruebas del compresor
npm run build                            # compila y pasa TypeScript

cd ../arreglos-supabase/media-api
npx tsx validar-todo.ts                  # 723 archivos + embudos + Meta (lento)
npx tsx validar-landings.ts              # las 31 landings, como las ve un cliente
npx tsx validar-whatsapp.ts              # lo que se envía por WhatsApp
npx tsx pesar-landing.ts colombia        # cuánto pesa una landing hoy
npx tsx comparar-perfiles.ts 30          # peso vs calidad (SSIM) de cada perfil
npx tsx auditar-rutas-api.ts             # qué rutas responden sin sesión
```

Referencia de lo que deben dar hoy: **723/723 · 341/341 · 0 WebP · 0 mal
etiquetados**, **31/31 landings**, `/colombia` en **2,14 MB**.

### 5 · Trampas ya pisadas, para no repetirlas

| Síntoma | Qué pasa |
| --- | --- |
| `ERR_DLOPEN_FAILED` al usar `sharp` | Dos versiones de `sharp` en el mismo proceso (una de `media-api` y otra de `quinchat`) chocan en Windows. Por eso las pruebas del compresor viven en `quinchat/pruebas/` |
| `next dev` arranca en el 8080 | Hereda `PORT` si se exportó el `.env` de `media-api` en esa terminal |
| La ruta de subida responde 400 en local | Falta `NEXTAUTH_SECRET`, o falta la cabecera `Host` |
| `POST /api/...` redirige al login en local | El middleware trata `localhost` como panel. Para probar la tienda: `curl -H "Host: pedido.klixmant.shop" ...` |
| Un archivo del bucket dice `Cache-Control: no-cache` | Artefacto de las peticiones `HEAD`. Con un `GET` real devuelve `public, max-age=31536000` |
| Consultas de logs que fallan | El endpoint de logs por API de Supabase **se retira el 23-09-2026**. Desde el Logs Explorer del panel sigue funcionando |

---

## Estado · al 30 de agosto de 2026

| | |
| --- | --- |
| **Backfill de imágenes** | ✅ **HECHO sobre producción.** 723 archivos, 850 MB recuperados |
| **Compresión al subir** | 📦 escrita y probada, **en el PR #1, sin publicar** |
| **Corrección de seguridad** | ⛔ documentada, **sin aplicar** — espera a dirección |
| **Fase 1 (cerrar tablas)** | ⛔ scripts listos, **sin ejecutar** |

**PR #1:** https://github.com/agenciaquin/FUNNELISH/pull/1 · rama
`optimizacion-imagenes`. `master` sin tocar.

### El efecto, medido

| | Antes | Ahora |
| --- | ---: | ---: |
| Peso medio servido a navegadores | 616 KiB | **186 KiB** (−69,8%) |
| Una visita a `/colombia` | 20,98 MB | **2,14 MB** |
| Bucket sin el respaldo | 1.943 MB | 1.093 MB |

### Los tres proyectos Supabase

| Proyecto | Ref | Estado |
| --- | --- | --- |
| `quinchat` | `bjbjqmbuzpyjvcugbusx` | 🔴 16 tablas con permisos para `anon`; 12 sin uso real |
| `confirma-ya` | `glmnuqfnxwaibckufgtr` | 🟢 Cerrado por grants |
| `master-quin` | `oejbsibpjiwakpsgkyvq` | 🟢 RLS en las 16 tablas |

### Dónde vive cada app (importa para desplegar)

| Proyecto Vercel | Atiende | ¿Se publica solo desde `master`? |
| --- | --- | --- |
| `quinchat-agencia-quin` | **`pedido.klixmant.shop`** — la tienda | **No.** A mano |
| `quinchat-comercial` | `www.klixmant.shop`, `tienda.skioo.shop` | **Sí** |
| `quinchat` | `quinchat-sepia.vercel.app` | Sí. Creado por error, solo compila los PR |

> ⚠️ **Producción va por detrás de `master`.** La tienda corre `78d4cac`, tres
> commits atrás, y los despliegues llevan marca `gitDirty`: se hicieron con
> cambios sin guardar en git. **Publicar la rama arrastraría v171–v173 y
> descartaría eso.** Por eso debe publicar agenciaquin, no un tercero.
>
> Marcha atrás: Vercel guarda 20 despliegues de producción. Se vuelve a
> cualquiera desde el panel, sin reconstruir.

---

## Consumo real medido (2026-08-29)

| Recurso | Uso | Incluido en Pro | % |
| --- | --- | --- | --- |
| Base de datos | 87 MB (59 + 17 + 11) | 8 GB por proyecto | ~1% |
| Storage | 2,5 GB | 100 GB | 2,5% |
| **Egress** | **~90 GB/mes** (3,0 GB/día en `quinchat`) | 250 GB | **36%** |

**El almacenamiento no es el problema.** El único indicador que se mueve es el
egress, y el 88% sale de `chat-media/embudos/` — las imágenes de las landing
pages. No por volumen de tráfico, sino porque cada imagen pesa 2.421 kB de media.

> Estas cifras salen de sumar `content_length` sobre 24 h de logs. Son una
> estimación de un día, no la cifra de facturación. La buena está en
> **Settings → Usage** del dashboard.

### Desglose verificado del bucket `chat-media` (2026-08-29)

Medido por SQL sobre `storage.objects` y por logs, sin descargar ningún archivo.

| Carpeta | Archivos | Peso | Optimizables | Egress 24 h | % egress |
| --- | ---: | ---: | ---: | ---: | ---: |
| `embudos/` | 429 | 1.014 MB | 390 | **2,53 GiB** | **88%** |
| `catalogo/` | 298 | 374 MB | 293 | 301 MiB | 10% |
| *(carpetas con teléfono)* | 477 | 302 MB | 220 | ~7 MiB | <1% |
| `packs/` | 77 | 118 MB | 77 | 22 MiB | <1% |
| `ventas/` | 570 | 73 MB | 160 | 2 MiB | <1% |
| `entrantes/` | 381 | 54 MB | 95 | 19 MiB | <1% |
| **Total** | **2.237** | **1.938 MB** | **1.237** | **~2,88 GiB** | 100% |

Confirmado: `embudos/` es el 88% del egress, exactamente como decía la
estimación. Pero aparece algo que el plan no contemplaba — **`catalogo/` es el
segundo en las dos métricas**: 374 MB de almacenamiento y 301 MiB de egress
diario (10%). Con 293 imágenes optimizables de 1.284 kB de media, merece entrar
en el backfill justo después de `embudos/`.

Ahorro proyectado sobre los 1.237 archivos optimizables: **~1.679 MB, un 87%**.

> El backfill **descarga cada archivo para recomprimirlo**, así que consume
> egress: ~1 GB una sola vez para `embudos/`. Es el 0,4% del cupo mensual, a
> cambio de recortar unos 79 GB/mes de forma permanente.

---

## Vigilancia — enterarse a tiempo

Son dos capas distintas y conviene no confundirlas.

### Capa 1 — Spend Cap (la red de seguridad de Supabase)

En **Organization → Billing → Cost Control**:

- **Spend Cap activado** → al superar el cupo, Supabase **avisa al correo de
  facturación** y abre un periodo de gracia. No hay cargos sorpresa. A cambio,
  si el periodo de gracia se agota, el proyecto queda restringido.
- **Spend Cap desactivado** → se cobra el exceso en silencio, sin aviso previo.

Para este negocio, con el proyecto sirviendo landings de venta, la decisión no
es obvia: el aviso es valioso, pero una restricción tumbaría los embudos. Lo que
sí conviene siempre es **confirmar a qué correo llegan esos avisos**.

Complemento útil: **Observability → New custom report**, que permite dejar un
gráfico fijo del egress por servicio.

### Capa 2 — `sql/004_chequeo_consumo.sql` (el aviso temprano)

El egress es el síntoma y llega tarde, ya facturado. La causa —que entren
archivos pesados— se ve semanas antes. Eso es lo que mira este chequeo.

Se ejecuta en el editor SQL del dashboard, una vez al mes. Es **SQL puro sobre
`storage.objects`**, así que no depende de la API de logs que Supabase retira el
23 de septiembre.

Devuelve un veredicto de una línea. Lo que hay que vigilar es el **peso medio**:

| Fecha | Archivos 30 d | Subido | Peso medio | Fugas | Veredicto |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-08-29 *(antes de desplegar)* | 1.548 | 1.290 MB | 853 kB | 573 | 🔴 REVISAR |

Con la compresión desplegada, el peso medio debería caer de 853 kB a menos de
150 kB y las fugas a cero. **Si dentro de un mes sigue alto, algo sube por un
camino que no pasa por `optimizarImagen()`** — y el bloque 2 del script dice
exactamente qué archivo y de qué carpeta.

> **Crecimiento medido:** julio 667 MB → agosto 1.227 MB de material nuevo
> (+84% en un mes), con el peso medio plano en ~860 kB. A ese ritmo el cupo de
> egress se agota en pocos meses. Es el argumento real para haber integrado la
> compresión: no es el ahorro de hoy, es la pendiente.

---

## Orden de ejecución

### Fase 1 — Cerrar las tablas sin uso (`sql/`)

No toca código y `service_role` no se entera, porque ignora grants y RLS.

```
000_verificacion_previa.sql     ejecutar y GUARDAR la salida
001_revocar_tablas_sin_uso.sql  el cambio
003_verificacion.sql            comprobar: deben quedar 4 filas
002_rollback_revocar.sql        solo si algo se rompe
```

Después, vigilar los 401/403 un par de días desde el **Logs Explorer** del
dashboard (esto es ClickHouse sobre los logs, no SQL sobre Postgres).

> **Aviso de Supabase (visto el 2026-08-29).** El endpoint de la Management API
> `GET /v1/projects/{ref}/analytics/endpoints/logs.all` **deja de funcionar el 23
> de septiembre de 2026**. Los logs del dashboard NO se ven afectados, así que
> esta verificación se puede seguir haciendo igual desde el Logs Explorer.
>
> Nada de este repositorio llama a esa API — comprobado por búsqueda en
> `quinchat/`, `quin-comercial/` y `media-api/`. Solo afecta a las consultas de
> logs hechas con herramientas externas (el MCP de Supabase, por ejemplo), que a
> partir de esa fecha habrá que hacer desde el dashboard.

```sql
select log_attributes['request.path'] as ruta,
       log_attributes['response.status_code'] as estado,
       count(*) as n
from logs
where source = 'edge_logs'
  and log_attributes['response.status_code'] in ('401','403')
group by ruta, estado order by n desc;
```

Si aparece algo, el rollback de esa tabla concreta es una línea.

### Fase 2 — `messages` y `conversations`

Requiere tocar código: mover al servidor las 3 llamadas anónimas que quedan
(`conversations` GET y PATCH, `messages` GET). No tiene sentido escribir policies
porque `auth.users` está a 0: sin autenticación, cualquier policy para `anon`
sigue siendo acceso público. Cuando estén movidas, revocar también esas dos
tablas y el proyecto queda cerrado del todo.

### Fase 3 — Compresión (`media-api/`)

```bash
cd media-api
npm install
npm run backfill -- --prefijo embudos              # estima, no descarga nada
npm run backfill -- --prefijo embudos --simular --limite 20
npm run backfill -- --prefijo embudos --aplicar
```

**Perfil por defecto: conservador — preserva la resolución original.** El ahorro
viene del cambio de formato, no de recortar calidad, así que no hace falta
degradar nada. Medido sobre archivos reales: **imágenes −83 a −94%, vídeos −83%**.

### Estado del backfill — TERMINADO el 2026-08-29

| Prefijo | Estado |
| --- | --- |
| `embudos/` — imágenes | ✅ **completo** (quedan 11 que no compensa tocar) |
| `catalogo/` — imágenes | ✅ **completo** |
| `packs/` — imágenes | ✅ **completo** |
| `embudos/` — 38 vídeos | ⏸ pendiente de decisión de fondo |
| `ventas/` · `entrantes/` — 551 imágenes | ⏹ **no se tocan** a propósito: ya pesan 166-226 kB |

**723 archivos · 850 MB recuperados · reducción media del 84,2%.**
El bucket pasó de **1.943 a 1.092 MB**.

Verificado en producción tras cada lote: la URL no cambia, sirve
`Content-Type: image/jpeg`, decodifica **a resolución original**, y el original
queda íntegro en `_originales/`. La caché pasó de `max-age=3600` a
`max-age=31536000`.

Medido sobre tráfico real de clientes: `/colombia` bajó de **20,98 a 2,14 MB
por visita** (−90%) y `/polo-textura` de 9,47 a 0,82 MB (−91,6%).

> **`_originales/` ocupa 1.010 MB.** El bucket total pesa hoy *más* que antes de
> empezar: es el precio de que todo sea reversible. **El ahorro no se
> materializa hasta borrarlo**, y conviene esperar una semana sin incidencias.

> **Ojo con `pg_default_acl`:** en este proyecto las tablas creadas por
> `postgres` dan solo `Dxtm` a *todos* los roles, `service_role` incluido. Toda
> tabla nueva necesita su `GRANT` explícito o la API falla con
> `permission denied`. Ya está corregido en `media-api/sql/001`.
Ver `media-api/README.md`.

### Fase 4 — Partir `chat-media`

El bucket mezcla assets públicos de campaña con media privada de clientes
(carpetas nombradas con el teléfono). **Cerrarlo entero rompería las landing
pages.** Hay que partirlo en un bucket público y otro privado con URLs firmadas.

---

## Dónde se sube a Storage (para integrar `POST /optimizar`)

El servidor que hace las 13.300 peticiones diarias con `service_role` es
`quinchat/`, la app Next.js de este mismo repositorio. Los puntos que escriben
en el bucket `chat-media` son:

| Ruta | Qué sube |
| --- | --- |
| `app/api/funnels/imagen/route.ts` | Imágenes de las landing pages ← **el que más importa** |
| `app/api/funnels/video/route.ts` | Vídeos de las landing pages |
| `app/api/funnels/upload-url/route.ts` | URL firmada; el navegador sube directo |
| `app/api/funnels/audio/route.ts` | Audio |
| `app/api/plantillas-wa/imagen/route.ts` | Imágenes de plantillas de WhatsApp |
| `app/api/catalogos/upload-imagen/route.ts` | Imágenes de catálogo |
| `app/api/whatsapp/webhook/route.ts` | Media entrante de clientes |
| `app/api/whatsapp/send-media/route.ts` | Media saliente |
| `lib/collage.ts` | Collages de packs |
| `components/panel/ChatArea.tsx` | Subida desde el panel |
| `components/panel/EmbudosPanel.tsx` | Subida por URL firmada |

**El de mayor impacto es `app/api/funnels/imagen/route.ts`**: de ahí salen los
archivos de `embudos/`, que son el 88% del egress del proyecto.

Ojo con `funnels/upload-url` y `EmbudosPanel.tsx`: usan `createSignedUploadUrl`,
así que el archivo **no pasa por el servidor** y no se puede comprimir en ruta.
O se cambia ese flujo para que suba a través de la API, o esos archivos solo se
arreglan por backfill.

## Integración en `quinchat` — HECHO (2026-08-29)

La compresión ya no depende de lanzar el backfill a mano: las rutas de subida de
`quinchat` comprimen en el servidor, así que **cada foto nueva entra liviana**.

Se resolvió **sin desplegar `media-api`**: se comprime en proceso con `sharp`
dentro de las rutas de Next. Un servicio aparte habría añadido un despliegue, un
salto de red con el archivo entero y un punto de fallo más, para el mismo
resultado.

| Archivo | Qué se hizo |
| --- | --- |
| `quinchat/lib/optimizar-imagen-servidor.ts` | **Nuevo.** Compresor de servidor con `sharp` |
| `quinchat/lib/imagen-comprimir.ts` | Ahora también comprime PNG (antes se los saltaba todos) |
| `app/api/funnels/imagen/route.ts` | Comprime + caché de un año ← **el del 88% del egress** |
| `app/api/plantillas-wa/imagen/route.ts` | Comprime + caché de un año |
| `app/api/catalogos/upload-imagen/route.ts` | Comprime + caché de un año |
| `app/api/funnels/video/route.ts` | Solo caché de un año (ffmpeg no existe en Vercel) |
| `quinchat/package.json` | `sharp` añadido |

### JPEG, no WebP

WebP comprime un punto y medio mejor, pero **Meta acepta el envío y luego no
entrega el mensaje** — lección ya aprendida y documentada en
`lib/imagen-comprimir.ts` por quien lo sufrió antes. Medido sobre archivos
reales, JPEG q85 llega al −92,1% frente al −93,7% de WebP. Ese punto y medio no
vale romper los envíos de WhatsApp.

Los PNG **con transparencia real** se quedan en PNG y se comprimen sin pérdida:
convertirlos a JPEG les pondría fondo negro. La detección mira el canal alfa
píxel a píxel, sin muestrear — un logo puede ser transparente solo en una
esquina.

### El agujero que lo explicaba todo

`EmbudosPanel` manda los archivos de más de 4 MB por **enlace firmado**, directo
del navegador a Storage, porque no caben en las funciones de Vercel. Y el
compresor del navegador **se saltaba todos los PNG**. Resultado: un PNG de 5,5 MB
no se comprimía, superaba el umbral, y llegaba al bucket intacto sin pasar por
ningún compresor. Ese es el camino exacto por el que entraron los archivos de
2.502 kB de media que encontró la auditoría.

Cerrado por los dos lados: el navegador ahora sí comprime PNG (así bajan del
umbral y van por la ruta del servidor), y el servidor comprime lo que le llegue
venga de donde venga.

### Lo que sigue sin cubrirse

- **Vídeo**: no se puede recodificar en Vercel (no hay ffmpeg y un mp4 de 45 MB
  no cabe en el límite de tiempo). Sigue dependiendo del backfill de `media-api`.
- **`funnels/upload-url`**: si tras comprimir el archivo sigue pasando de 4 MB,
  va por enlace firmado y no pasa por el servidor. Con los PNG ya comprimidos
  esto debería ser raro, pero no es imposible.
- **R2**: `lib/r2.ts` ya existe y da ancho de banda gratis, pero solo se usa para
  vídeo y para el enlace firmado. Las imágenes van siempre a Supabase. Mover las
  imágenes a R2 sería otra mejora grande, y es independiente de todo esto.

---

## Qué queda por hacer, por orden

| # | Pendiente | Necesita | Dónde está el detalle |
| --- | --- | --- | --- |
| 1 | **Publicar el PR #1** — sin esto el consumo vuelve a crecer | Que lo publique **agenciaquin**, con sus v171–v173 | `TEXTO-DEL-PR.md` |
| 2 | **Corregir las 82 rutas abiertas** | Aprobación de dirección | `HALLAZGO-rutas-api-abiertas.md` |
| 3 | **`quin-comercial` no comprime nada** | Que pase antes el PR #1 | `PENDIENTE-quin-comercial.md` |
| 4 | **El chat saliente no se comprime** — 289 MB, 761 kB de media, −83% medido | Que pase antes el PR #1 | `HALLAZGO-chat-saliente-sin-comprimir.md` |
| 5 | Collages en paralelo sin límite → 429 | Decisión. Son ~10 líneas | Defecto nº 5 del reporte |
| 6 | **Borrar `_originales/`** (1.010 MB) | Esperar una semana **y** cerrar el perfil de calidad | `HALLAZGO-dos-compresores.md` |
| 7 | Los 38 vídeos — **515 MB, el 47% del bucket** | Decisión de fondo: servicio aparte, R2, o backfill | Reporte, sección 7 |
| 8 | Fase 1 de seguridad — cerrar 12 tablas | Aprobación. Scripts listos | `sql/` |
| 9 | Rotar la clave `service_role` | — | arriba, apartado 3 |
| 10 | Confirmar el Spend Cap y a qué correo avisa | — | «Vigilancia», capa 1 |

> **El orden importa en dos sitios.** El punto 6 no se hace antes de decidir el
> perfil de calidad: mientras existan los originales, cualquier recompresión
> futura sale limpia; sin ellos sería pérdida sobre pérdida. Y los puntos 3 y 4
> esperan al 1 para no mover el PR debajo de quien lo está revisando.

---

## Cómo saber si sigue funcionando, dentro de un mes

La señal es **el peso medio de lo que entra**, no el egress: el egress llega
tarde y ya facturado.

```sql
select to_char(created_at at time zone 'America/Bogota','YYYY-MM-DD') dia,
       count(*) archivos,
       pg_size_pretty(sum((metadata->>'size')::bigint)) entra,
       pg_size_pretty((avg((metadata->>'size')::bigint))::bigint) medio,
       count(*) filter (where (metadata->>'size')::bigint > 307200) pesados
from storage.objects
where bucket_id='chat-media' and name not like '_originales/%'
  and coalesce(metadata->>'mimetype','') like 'image/%'
  and created_at > (now() at time zone 'America/Bogota') - interval '7 days'
group by 1 order by 1 desc
```

Con el PR publicado, el peso medio debe bajar de **858 kB a menos de 200 kB**.
Si no baja, lo que entra viene de `quin-comercial` — y entonces toca el punto 3.

Más completo, con veredicto de una línea: `sql/004_chequeo_consumo.sql`.
