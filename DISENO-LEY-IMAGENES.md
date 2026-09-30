# Diseño · Cómo cumplir la LEY de imágenes en las dos apps

**Fecha:** 30-09-2026
**Rama donde se escribe:** `bloqueantes-consumo` (solo este documento; no se ha tocado código).
**Ley:** final de `CLAUDE.md` — «Toda imagen que se suba se comprime. Sin excepciones.»
**Base revisada:** el código de esta rama (= `master` + arreglos bloqueantes). **No es v174**: producción de
`quinchat` corre `bff4e19`, que no está en GitHub. Todo lo de `quinchat/` hay que volver a revisarlo sobre la
rama unida (ver §5).

---

## 1 · Inventario: todos los sitios donde se escribe un archivo

Leyenda. **Comprime**: pasa por `optimizarImagen()` (sharp 1920/q85). **Caché 1 año**: `cacheControl:
CACHE_UN_ANO`. Riesgo: **A** = entran imágenes pesadas cada día; **M** = entra poco o ya viene algo
comprimido; **B** = no son imágenes o es fuera de las apps.

Se excluye `quin-comercial/_to_delete/` (copias viejas, no se compilan).

### 1.1 · `quinchat/` (pedido.klixmant.shop)

| Archivo:línea | Qué sube | Origen | ¿Comprime? | ¿Caché 1 año? | Riesgo |
| --- | --- | --- | --- | --- | --- |
| `app/api/funnels/imagen/route.ts:30` | foto de embudo → `chat-media/embudos/{slug}/` | panel Embudos y Remarketing (≤4 MB) | **Sí** (y antes el navegador) | Sí | — |
| `app/api/plantillas-wa/imagen/route.ts:52` | foto fija de plantilla WA → `plantillas/` | panel Plantillas WA (base64 en JSON) | **Sí** | Sí | M: el base64 infla un 33 %, el tope real es ~3,3 MB, no los 5 MB que dice |
| `app/api/catalogos/upload-imagen/route.ts:35` y `:40` | foto de catálogo → bucket `catalogo-imagenes` | panel Catálogos | **Sí** | Sí | — |
| `app/api/funnels/video/route.ts:41` | vídeo de portada → `chat-media/embudos/` | panel Embudos | no aplica (vídeo) | Sí | B |
| `app/api/funnels/video/route.ts:29` → `lib/r2.ts:82` (`r2Subir`) | mismo vídeo, a **R2** si está configurado | panel Embudos | no aplica | **No** (PUT sin `Cache-Control`) | B |
| `app/api/funnels/audio/route.ts:27` | canción de embudo | panel Embudos | no aplica (audio) | No | B |
| `app/api/funnels/upload-url/route.ts:33` (`createSignedUploadUrl`) y `:24` (`r2PresignPut`) | **firma** subidas directas navegador → almacenamiento, sin mirar el tipo | ChatArea y EmbudosPanel cuando el archivo pasa de 4 MB | **No** | No | **A**: es el agujero de la regla 2 de la ley |
| `components/panel/EmbudosPanel.tsx:67` (`uploadToSignedUrl`) y `:57` (PUT a R2) | foto o vídeo de embudo > 4 MB tras comprimir en navegador | panel | solo navegador | No | M: tras comprimir en el navegador casi ninguna foto pasa de 4 MB |
| `components/panel/ChatArea.tsx:565` (`uploadToSignedUrl`) y `:558` (PUT a R2) | foto/vídeo/audio del chat > 4 MB | asesor | **No** (ChatArea no usa `comprimirImagen`) | No | **A**: una foto de móvil de 5 MB entra entera |
| `app/api/whatsapp/send-media/route.ts:64` | foto/audio/vídeo del chat ≤ 4 MB → `chat-media/{conversación}/` | asesor | **No** | No | **A**: hallazgo nº 7, 389 fotos, 289 MB, 761 kB de media |
| `app/api/whatsapp/webhook/route.ts:784` | media **entrante** del cliente (foto, sticker, audio, vídeo, documento) → `entrantes/{tel}/` | Meta | **No** | No | M: WhatsApp ya las manda comprimidas (~100–300 kB); los stickers son WebP |
| `lib/quinchat/ventas.ts:1118` | media entrante de la línea de ventas → `ventas/{tel}/` | Meta | **No** | No | M: igual que la anterior |
| `lib/collage.ts:44` / `:47` | collage PACK X2 (Jimp) → `packs/…__v2.jpg`, `upsert` | bot de ventas | Jimp q85, **no sharp** | No | M: ~440 kB por combo, se reutiliza |
| `app/api/funnelish/webhook/route.ts:299` / `:302` | **copia en línea** del mismo collage | pedido de Funnelish | Jimp q85 | No | M |
| `lib/watermark.ts:93` / `:99` | foto de catálogo con el nombre estampado → `catalogo/marcas/`, `upsert` | rutas `catalogos/[id]/colores`, `catalogos/colores/[id]`, `catalogos/re-estampar` | **Jimp a calidad 100** (por defecto) | No | **A** en peso por archivo: JPEG q100 a tamaño original |
| `app/api/funnels/optimizar-fotos/route.ts:32` / `:38` | copias 1080/q72 → `embudos-opt/{slug}/` y **reescribe `funnels`** | botón «⚡ Optimizar fotos» | Jimp 1080/q72 | No | M: segunda pasada con pérdida (ver `arreglos-supabase/HALLAZGO-dos-compresores.md`); no se ha usado nunca |
| `components/panel/PlantillasPanel.tsx:108` | imagen de plantilla → bucket **`plantillas-images`**, **desde el navegador con la clave anónima** | panel Plantillas | **No** | No | **A**: se salta el servidor por completo, y además implica que ese bucket acepta escrituras anónimas |
| `lib/whatsapp.ts:240` (`getBufferAsync`) | recompresión para **subir a Meta** tras un error 131053 | envío de plantillas/fotos | Jimp | — | fuera de la ley: no escribe en el almacenamiento |

### 1.2 · `quin-comercial/` (www.klixmant.shop, tienda.skioo.shop)

No tiene `optimizar-imagen-servidor.ts`, ni `imagen-comprimir.ts`, ni `r2.ts`, ni `sharp` en su
`package.json` (en `node_modules` hay `sharp 0.34.5`, pero solo como dependencia opcional de Next: no es
fiable y no está en `outputFileTracingIncludes`).

| Archivo:línea | Qué sube | Origen | ¿Comprime? | ¿Caché 1 año? | Riesgo |
| --- | --- | --- | --- | --- | --- |
| `app/api/funnels/imagen/route.ts:24` | foto de embudo | panel Embudos (sin compresión en navegador) | **No** | No | **A** |
| `app/api/plantillas-wa/imagen/route.ts:53` | foto de plantilla WA | panel | **No** | No | M |
| `app/api/catalogos/upload-imagen/route.ts:25` y `:32` | foto de catálogo → `catalogo-imagenes` | panel Catálogos | **No** | No | **A** |
| `app/api/funnels/video/route.ts:27` | vídeo de embudo | panel | no aplica | No | B |
| `app/api/funnels/audio/route.ts:27` | audio de embudo | panel | no aplica | No | B |
| `app/api/funnels/upload-url/route.ts:17` (`createSignedUploadUrl`) | firma subida directa, sin mirar el tipo | ChatArea y EmbudosPanel > 4 MB | **No** | No | **A** |
| `components/panel/EmbudosPanel.tsx:46` (`uploadToSignedUrl`) | foto/vídeo de embudo > 4 MB | panel | **No** (ni en navegador) | No | **A** |
| `components/panel/ChatArea.tsx:629` (`uploadToSignedUrl`) | foto/vídeo/audio del chat > 4 MB | asesor | **No** | No | **A** |
| `app/api/whatsapp/send-media/route.ts:72` | chat saliente ≤ 4 MB (cliente `supabaseTenant`) | asesor | **No** | No | **A** |
| `app/api/whatsapp/webhook/route.ts:777` (y `webhook/[tenant]` que reutiliza `procesarEntrada`) | media entrante → `entrantes/` | Meta, por empresa | **No** | No | M |
| `lib/quinchat/ventas.ts:683` | media entrante de ventas → `ventas/` | Meta | **No** | No | M |
| `lib/collage.ts:38` / `:41` | collage PACK X2 | bot de ventas | **Jimp a calidad 100** | No | **A** por archivo (~1,6 MB, medido) |
| `app/api/funnelish/webhook/route.ts:272` / `:275` (y `funnelish/webhook/[tenant]`) | copia en línea del collage | Funnelish | **Jimp a calidad 100** | No | **A** por archivo |
| `lib/watermark.ts:93` / `:99` | foto estampada con nombre | rutas de catálogos | **Jimp a calidad 100** | No | **A** por archivo |
| `components/panel/PlantillasPanel.tsx:108` | imagen de plantilla → `plantillas-images` desde el navegador | panel | **No** | No | **A** |
| `lib/whatsapp.ts:297` (`getBufferAsync`) | recompresión para Meta | envío | Jimp | — | fuera de la ley |

### 1.3 · Fuera de las apps

| Archivo:línea | Qué sube | ¿Comprime? | ¿Caché 1 año? | Nota |
| --- | --- | --- | --- | --- |
| `arreglos-supabase/media-api/src/storage.ts:70` | versión optimizada (backfill) | Sí (sharp) | Sí (`config.ts:23`) | cumple |
| `arreglos-supabase/media-api/src/storage.ts:106` | **respaldo del original** en `_originales/` | **No, a propósito** | Sí | es la única excepción razonable: es la copia de seguridad. **Que la dirección la confirme por escrito** en la ley, o la vigilancia SQL la marcará siempre |

**Supabase:** ambas apps escriben en `chat-media` según `PENDIENTE-quin-comercial.md`, pero el proyecto de
`quin-comercial` no está confirmado desde el código (`CONTINUACION-PROYECTO.md` menciona
`glmnuqfnxwaibckufgtr`; `quinchat` usa `bjbjqmbuzpyjvcugbusx`). La vigilancia SQL del §4 hay que correrla en
**cada** proyecto que usen las apps.

**R2:** solo existe en `quinchat`. No se sabe si las variables `R2_*` están puestas en producción. Se
comprueba en Vercel mirando **solo los nombres** de las variables, o con
`select count(*) from funnels where imagenes::text like '%r2.%' or imagenes::text like '%r2.dev%'`.

**Resumen del inventario:** 17 puntos de escritura en `quinchat`, 15 en `quin-comercial`. Cumplen la ley hoy:
**3** (los de `quinchat` que ya se conectaron). Los cuatro agujeros gordos: chat saliente, URL firmadas,
`PlantillasPanel` desde el navegador y todo `quin-comercial`.

---

## 2 · Un único punto de paso

### 2.1 · Tres archivos, idénticos en las dos apps

| Archivo | Lado | Para qué |
| --- | --- | --- |
| `lib/optimizar-imagen-servidor.ts` | servidor | el compresor que ya existe. Se copia tal cual a `quin-comercial` |
| `lib/subir-archivo.ts` **(nuevo)** | servidor | `subirAlStorage()`, `firmarSubidaDirecta()`, `procesarSubidaPendiente()`. **Único sitio con `.upload(`, `createSignedUploadUrl` y `r2Subir`** |
| `lib/subir-desde-navegador.ts` **(nuevo, `'use client'`)** | navegador | `subirDesdeNavegador(file, destino)`. **Único sitio con `uploadToSignedUrl` y PUT a R2** |

`lib/r2.ts` y `lib/imagen-comprimir.ts` se copian también a `quin-comercial` para que los tres archivos sean
**idénticos** en las dos apps (sin las variables `R2_*`, `r2Configurado()` da `false` y no hace nada).
Cada commit que los toque lo dice: «archivo idéntico en quinchat y quin-comercial».

### 2.2 · `subirAlStorage()` — contrato

```ts
// lib/subir-archivo.ts (diseño, no código final)
export interface Subida {
  bucket: 'chat-media' | 'catalogo-imagenes' | 'plantillas-images';
  /** Ruta sin extensión, o función que la recibe: la extensión la decide el compresor (png -> jpg). */
  ruta: string | ((ext: string) => string);
  datos: Buffer;
  contentType: string;            // el declarado; se contrasta con los bytes
  upsert?: boolean;               // solo con rutas que cambian cuando cambia el contenido (ver 2.6)
  destino?: 'supabase' | 'r2';    // por defecto supabase; r2 solo si r2Configurado()
}
export interface Subido {
  ruta: string; url: string; contentType: string;
  bytesAntes: number; bytesDespues: number;
  optimizada: boolean; motivo?: string;   // por qué no se comprimió, si no se comprimió
}
export async function subirAlStorage(supabase: SupabaseLike, s: Subida): Promise<{ data: Subido | null; error: string | null }>;
```

Qué hace, en orden:

1. **Tipo real por los bytes, no por lo que dice el navegador.** `ChatArea` manda
   `file.type || 'application/octet-stream'`: una foto sin tipo se saltaría el compresor. Se miran los
   primeros bytes (`FFD8FF` JPEG, `89504E47` PNG, `RIFF….WEBP`, `GIF8`, `ftypheic/heix/mif1` HEIC). Si los
   bytes dicen imagen, es imagen.
2. **Imagen → `optimizarImagen()`.** Se usa su `contentType` y su `ext`.
3. **Si no se comprimió por un motivo anómalo** (error de sharp, HEIC, GIF grande): `console.warn('[ley-imagenes] sin comprimir', { ruta, motivo, bytes })` y se sube el original. Regla 5 de la ley. Los motivos normales («pesa menos de 200 kB», «no ahorra un 10 %») no se registran para no ensuciar el log.
4. **`cacheControl: CACHE_UN_ANO` siempre** para imágenes. Para vídeo, audio y documentos también por
   defecto (las rutas llevan marca de tiempo), salvo que el llamador pase otra cosa.
5. **Vídeo, audio, documentos:** pasan sin tocar. No hay ffmpeg en Vercel; su compresión sigue en
   `media-api`.
6. **R2:** si `destino: 'r2'`, `r2Subir()` con cabecera `Cache-Control: public, max-age=31536000, immutable`.
   ⚠️ No verificado que R2 acepte esa cabecera sin firmarla (hoy `r2PresignPut` solo firma `host` y
   `Content-Type` funciona así). Si R2 la rechaza, se añade a `SignedHeaders`. Probarlo con un PUT real.
7. Devuelve la URL pública y los bytes antes/después, que el llamador puede registrar.

Cambio pequeño en `optimizarImagen()` para esto: añadir `motivo` a `ImagenOptimizada` y **dejar intacto el
WebP/GIF animado** (`meta.pages > 1`), que hoy se aplanaría al primer fotograma (ver §6). Con su prueba en
`pruebas/optimizar-imagen.ts`.

### 2.3 · Las URL firmadas (el agujero de la regla 2)

Hoy: si el archivo pasa de 4 MB, el navegador pide una firma a `funnels/upload-url` y sube directo. El
servidor no ve los bytes.

Diseño, en `subirDesdeNavegador(file, destino)`:

```
1. Si es imagen → comprimirImagen(file)  (ayuda, no garantía; hoy ChatArea no lo hace)
2. ¿Pesa ≤ 4 MB?  → POST a la ruta de servidor de siempre (funnels/imagen, send-media…) → subirAlStorage
3. ¿Pesa > 4 MB y NO es imagen (vídeo/audio)? → firma y subida directa, como hoy, a su ruta final
4. ¿Pesa > 4 MB y ES imagen? →
     a. POST /api/funnels/upload-url { tipo: file.type, ext, slug, version: 2 }
        el servidor ve `tipo` image/* y firma una ruta en  chat-media/_pendientes/<aleatorio>.<ext>
     b. el navegador sube ahí (Supabase, nunca R2)
     c. POST /api/funnels/procesar-subida { pendiente, slug, destino }
        el servidor DESCARGA el pendiente desde Storage (servidor↔Storage no tiene el tope de 4,5 MB,
        que es solo para el cuerpo de la petición), llama a subirAlStorage hacia la ruta final
        (Supabase o R2), borra el pendiente y devuelve la URL final
     d. el chat usa esa URL final en send-media-url, como hoy
```

- **Los vídeos grandes no cambian de camino**: solo la rama «imagen y > 4 MB» pasa por el servidor.
- **El servidor decide, no el navegador.** `upload-url` mira `tipo` **y** la extensión: si cualquiera de los
  dos dice imagen, la ruta es `_pendientes/`. Una imagen nunca recibe una firma a su ruta final.
- **Pestañas del panel abiertas con el código viejo** (piden firma sin `version: 2`): si la extensión es de
  imagen, `upload-url` responde **409 «Recarga el panel»**. Corta ese caso a propósito (§ «Antes de
  publicar»). Vídeo y audio siguen funcionando sin recargar.
- **Pendientes huérfanos** (el navegador se cerró entre b y c): los detecta la consulta 3 del §4 y se
  borran a mano. No se añade un cron: sería un gasto fijo para un caso raro.
- `procesar-subida` necesita `maxDuration = 60` y queda cerrada por el middleware de `bloqueantes-consumo`
  (pide sesión), que es lo correcto: solo la usa el panel.

### 2.4 · R2

- **Las imágenes no suben nunca directo a R2 desde el navegador.** Si R2 está configurado, llegan a R2
  únicamente a través de `subirAlStorage(…, destino: 'r2')`, ya comprimidas.
- R2 **no aparece en `storage.objects`**: la vigilancia SQL no lo cubre. Para R2, la marca es la cabecera
  `Cache-Control`; se comprueba con un `HEAD` sobre la URL pública (un script en `media-api`, cuando haga
  falta). Si R2 no está configurado en producción (por confirmar), este punto no aplica.

### 2.5 · `optimizar-fotos` (1080/q72) y la doble compresión

**`optimizar-fotos`** (solo en `quinchat`, código de agenciaquin):

- Incumple la ley tal como está (`.upload(` sin caché y fuera del punto único). La prueba estática la marcará.
- Propuesta: que `optimizarUna()` llame a `subirAlStorage()` y solo reescriba la URL **si
  `optimizada === true`**. Con 1920/q85, una foto ya procesada no ahorra el 10 % y se queda como está: el
  botón deja de degradar y pasa a ser útil para embudos viejos. Dos constantes y cuatro líneas.
- **Decisión del 30-08** (`HALLAZGO-dos-compresores.md`): «no tocar sin avisarle». La ley es posterior y lo
  obliga, pero **el aviso a agenciaquin va antes del commit**, y conviene hacerlo en su PC al unir v174 (v174
  puede haber cambiado esa ruta).

**Doble compresión navegador + servidor** (1920/q85 las dos):

- El servidor no toca lo que pesa menos de 200 kB ni lo que no ahorra un 10 %. Una foto que el navegador ya
  dejó en 1920/q85 casi siempre cae en uno de los dos casos.
- Cuando no (el JPEG del navegador no es mozjpeg y a veces ahorra > 10 %), es una segunda pasada **a la
  misma calidad y sin reescalar**: pérdida despreciable, no la de 1080/q72.
- Se acepta. La compresión del navegador se queda: reduce el tiempo de subida desde el móvil y es lo que
  mete casi todo por debajo de 4 MB.

### 2.6 · Rutas fijas con `upsert` y caché de un año

Un año de caché sobre una ruta que se **sobrescribe** hace que el navegador siga viendo la versión vieja.

- `lib/collage.ts` (`packs/<combo>__v2.jpg`): no se sobrescribe nunca (se reutiliza si existe). Sin riesgo.
- `lib/watermark.ts` (`catalogo/marcas/<key>-<estilo>-<hash del texto>.jpg`): **sí puede sobrescribirse** con
  otra foto de origen y el mismo texto (`catalogos/colores/[id]` usa `key = id`). Hay que meter en la ruta un
  hash corto **del contenido resultante**. Los llamadores ya guardan la URL devuelta, así que no se rompe nada.
- `subirAlStorage` deja un comentario explícito: *con `upsert`, la ruta debe cambiar cuando cambia el
  contenido*.

### 2.7 · Collages y marca de agua: Jimp compone, sharp codifica

Jimp sigue componiendo (fuentes incluidas; no se cambia). Pero en vez de codificar él con pérdida, entrega el
JPEG a calidad 100 a `subirAlStorage`, que hace **la única pasada con pérdida**, con mozjpeg q85 (más
pequeño que el q85 de Jimp). Resultado: una sola pérdida y el mismo perfil en todo el proyecto.

La copia en línea de `generarCollagePack` dentro de `funnelish/webhook/route.ts` (las dos apps) se sustituye
por `import { generarCollagePack } from '@/lib/collage'`: un punto menos que vigilar.

### 2.8 · Entrantes de WhatsApp y chat saliente

- **Entrantes** (`webhook` y `ventas.ts`): se guarda la versión de `subirAlStorage`; a la IA y al
  clasificador de comprobantes se les sigue pasando `media.buffer` original (no cambiar comportamiento).
  Casi todas pesan < 200 kB y salen sin tocar, así que el coste en el webhook es leer 12 bytes.
- **Chat saliente** (`send-media`): se comprime **antes** de subir a Meta y se manda a Meta el buffer
  comprimido (sale JPEG o PNG, que WhatsApp entrega). Solo `image/*`; `document` y `audio` intactos. Pendiente
  de comprobar con los ojos una captura con texto pequeño (hallazgo nº 7).

### 2.9 · `PlantillasPanel` desde el navegador

Pasa a hacer `POST` a una ruta de servidor (`/api/plantillas/imagen`, nueva, con sesión) que usa
`subirAlStorage({ bucket: 'plantillas-images' })`. Después, **con aprobación**, se puede quitar la política
que permite escribir en `plantillas-images` con la clave anónima (SQL de escritura en producción: no se hace
sin visto bueno).

---

## 3 · Llevarlo a `quin-comercial`

`quin-comercial/next.config.ts` hoy tiene `'/api/**': ['./fonts/**/*']` y nada de sharp.

1. **`package.json`**: `"sharp": "^0.35.4"` en `dependencies` (la misma que `quinchat`; la prueba de alfa con
   paleta está comprobada sobre 0.35.4). Regenerar `package-lock.json` con `npm install`. El lock de npm ya
   incluye las variantes de todas las plataformas (`@img/sharp-linux-x64` y `@img/sharp-libvips-linux-x64`
   aparecen hoy en los dos locks), así que `npm ci` en Vercel instala las de Linux.
2. **`next.config.ts`**, con el mismo comentario que en `quinchat`:
   ```ts
   '/api/**': ['./fonts/**/*', './node_modules/@img/**/*'],
   ```
   **Todas las piezas** (observación 1):
   | Pieza | Qué es | Cómo llega |
   | --- | --- | --- |
   | `sharp/` (JS) | la librería | rastreo normal de Next (sharp está en su lista de paquetes externos) |
   | `@img/sharp-linux-x64/` | el `.node` | **`@img/**/*`** (el rastreo no lo sigue: se carga por ruta) |
   | `@img/sharp-libvips-linux-x64/` | `libvips-cpp.so.*` | **`@img/**/*`** — la que reventó el 31-08 |
   | `@img/colour`, `detect-libc`, `semver` | dependencias JS | rastreo normal |
   | `fonts/` | fuentes de Jimp | ya estaba |
3. **Efecto colateral**: al subir sharp de 0.34.5 a 0.35.4, `next/image` de las tiendas usará también la
   nueva. Riesgo bajo, pero es un cambio en las tiendas: mirar las landings tras publicar.
4. **Multi-cliente**: `send-media`, `webhook` y `ventas.ts` usan `supabaseTenant(tid)`. `subirAlStorage` recibe
   el cliente como parámetro (no crea uno propio), y el proxy deja pasar `.storage` sin cambios.
5. **Las pruebas**: copiar `pruebas/optimizar-imagen.ts` a `quin-comercial/pruebas/` (importa el módulo real).

---

## 4 · Cómo se hace cumplir

### 4.1 · `pruebas/ley-imagenes.ts` (una por app) — criterio acordado para el agente de pruebas

La escribe en paralelo el agente de pruebas. El criterio que propongo, para que diseño y prueba digan lo mismo:

**Estática** (recorre `app/`, `lib/`, `components/`; excluye `node_modules/`, `_to_delete/`, `pruebas/`, `.bak`):

| # | Regla | Único archivo permitido |
| --- | --- | --- |
| 1 | `.upload(` | `lib/subir-archivo.ts` |
| 2 | `createSignedUploadUrl(` | `lib/subir-archivo.ts` |
| 3 | `r2Subir(` y `r2PresignPut(` | `lib/subir-archivo.ts` (y su definición en `lib/r2.ts`) |
| 4 | `uploadToSignedUrl(` y `method: 'PUT'` hacia una URL de subida | `lib/subir-desde-navegador.ts` |
| 5 | `storage.from(…).update(` / `.copy(` / `.move(` (multilínea) | ninguno |
| 6 | `lib/subir-archivo.ts` importa `optimizarImagen` y usa `CACHE_UN_ANO` en la subida | — |
| 7 | `optimizar-imagen-servidor.ts` importa `sharp`; `package.json` lo tiene en `dependencies` | — |
| 8 | `next.config.ts` incluye `./node_modules/@img/**/*` bajo `'/api/**'` | — |
| 9 | todo archivo con `getBufferAsync(` o está en la lista de Meta (`lib/whatsapp.ts`) o no contiene escritura propia (entrega el buffer a `subirAlStorage`) | — |

La regla 1 es la importante: si mañana alguien añade una ruta con `.upload(`, la prueba falla. Mientras se
migran las rutas, la prueba **fallará a propósito** con la lista de lo que falta: esa lista es el avance.

**Ajustes necesarios en la prueba que ya existe** (`quinchat/pruebas/ley-imagenes.ts` y su copia en
`quin-comercial`, sin commitear al escribir esto; no los he tocado):

- `MODULOS_SUBIDA_PERMITIDOS` ya tiene `lib/subir-archivo.ts`: coincide. Añadir `lib/subir-desde-navegador.ts`
  **solo para `uploadToSignedUrl` y el PUT a R2**. Hoy la prueba trata toda subida directa desde el navegador
  como fallo. Este diseño la mantiene para vídeo y audio grandes, y para las imágenes solo hacia
  `_pendientes/`. Para que la excepción no se pueda usar mal, que la prueba exija que ese archivo llame a
  `comprimirImagen` y a `/api/funnels/procesar-subida`.
- `EXIGIR_PUNTO_UNICO = false` → ponerlo en `true` en el commit 16 (último de la migración).
- `EXCEPCIONES` de `funnels/audio` y `funnels/video`: sobran cuando esas rutas usen `subirAlStorage`
  (commit 9). Se pueden quitar entonces.
- `PRIMITIVAS = ['lib/r2.ts']`: coincide.
- `arreglos-supabase/sql/vigilancia-ley-imagenes.sql` (también del agente de pruebas) solo mira `chat-media`.
  Las consultas de abajo miran **todos los buckets**, porque `catalogo-imagenes` y `plantillas-images` también
  reciben imágenes.

**Dinámica** (sin red): `subirAlStorage` con un cliente falso que registra la llamada:
- PNG opaco de 1 MB → sube `image/jpeg`, `.jpg`, `cacheControl = CACHE_UN_ANO`, más pequeño.
- JPEG declarado como `application/octet-stream` → se detecta y se comprime.
- MP4 → mismos bytes, `video/mp4`, caché de un año.
- Buffer corrupto con tipo `image/jpeg` → sube el original y deja `motivo`.

### 4.2 · Vigilancia SQL sobre `storage.objects` (solo lectura)

Correr en cada proyecto de Supabase que usen las apps. Poner en `desde` la **fecha y hora de publicación**: lo
anterior no lleva la marca y no cuenta.

```sql
-- 1) Imágenes que NO pasaron por el punto único. Debe dar 0 filas.
select bucket_id, split_part(name, '/', 1) as zona, count(*) as archivos,
       pg_size_pretty(sum((metadata->>'size')::bigint)) as peso,
       min(created_at) as primera, max(created_at) as ultima
from storage.objects
where coalesce(metadata->>'mimetype', '') like 'image/%'
  and coalesce(metadata->>'cacheControl', '') <> 'max-age=31536000'
  and name not like '\_originales/%'
  and name not like '\_pendientes/%'
  and created_at > timestamptz '2026-10-01 00:00-05'   -- desde
group by 1, 2
order by archivos desc;

-- 2) Llevan la marca pero pesan mucho: el compresor no pudo (HEIC, GIF, error de sharp).
select bucket_id, name, metadata->>'mimetype' as tipo,
       (metadata->>'size')::bigint / 1024 as kb, created_at
from storage.objects
where coalesce(metadata->>'mimetype', '') like 'image/%'
  and (metadata->>'size')::bigint > 800 * 1024
  and name not like '\_originales/%'
  and created_at > timestamptz '2026-10-01 00:00-05'
order by created_at desc;

-- 3) Pendientes huérfanos de las subidas grandes (se borran a mano, con visto bueno).
select count(*) as archivos, pg_size_pretty(sum((metadata->>'size')::bigint)) as peso
from storage.objects
where bucket_id = 'chat-media' and name like '\_pendientes/%'
  and created_at < now() - interval '1 day';

-- 4) Formatos que un navegador o Meta no llevan bien, para decidir si hace falta más.
select metadata->>'mimetype' as tipo, count(*) as archivos
from storage.objects
where metadata->>'mimetype' in ('image/heic', 'image/heif', 'image/webp', 'image/gif')
  and created_at > timestamptz '2026-10-01 00:00-05'
group by 1;
```

La consulta 1 es el indicador de la ley. Junto con la de `PENDIENTE-quin-comercial.md` (peso medio por día),
dice si el grifo está cerrado.

---

## 5 · Orden de implementación

### Qué se puede hacer ya, desde este PC

**Rama `ley-imagenes-comercial`**, desde `bloqueantes-consumo` (ahí están la ley, las pruebas y el middleware
que deja las rutas nuevas cerradas con sesión). PR apilado: se fusiona después de `bloqueantes-consumo`.
`quin-comercial` no depende de v174.

| # | Commit | Apps |
| --- | --- | --- |
| 1 | `feat(imagenes): el compresor dice por qué no comprime y respeta la animación` — `motivo` + `pages > 1`, con prueba | quinchat (solo archivo; no se publica hasta la unión) |
| 2 | `chore(comercial): sharp y sus piezas de Linux en la función` — `package.json`, lock, `next.config.ts` | quin-comercial |
| 3 | `feat(imagenes): copiar el compresor y su prueba a quin-comercial` — archivo idéntico | quin-comercial |
| 4 | `feat(imagenes): punto único de subida subirAlStorage` — `lib/subir-archivo.ts` + `lib/r2.ts`, idénticos, con prueba dinámica | las dos (archivos nuevos) |
| 5 | `feat(imagenes): subida desde el navegador por un solo camino` — `lib/subir-desde-navegador.ts` + `lib/imagen-comprimir.ts` | las dos |
| 6 | `fix(embudos): la foto de embudo pasa por el compresor` — `funnels/imagen` | quin-comercial |
| 7 | `fix(catalogos): …` — `catalogos/upload-imagen` | quin-comercial |
| 8 | `fix(plantillas): …` — `plantillas-wa/imagen` | quin-comercial |
| 9 | `fix(embudos): vídeo y audio con caché de un año` | quin-comercial |
| 10 | `fix(chat): el chat saliente se comprime y a Meta va la versión liviana` — `send-media` | quin-comercial |
| 11 | `fix(bot): las fotos que entran por WhatsApp se guardan comprimidas` — `webhook` + `ventas.ts` | quin-comercial |
| 12 | `fix(packs): el collage lo codifica sharp; el webhook usa lib/collage` | quin-comercial |
| 13 | `fix(catalogos): la marca de agua se codifica con sharp y su ruta cambia con el contenido` | quin-comercial |
| 14 | `fix(subidas): las imágenes grandes pasan por el servidor` — `upload-url` + `procesar-subida` + `ChatArea` + `EmbudosPanel` | quin-comercial |
| 15 | `fix(plantillas): PlantillasPanel sube por el servidor` — ruta nueva | quin-comercial |
| 16 | `test: ley-imagenes en verde en quin-comercial` (la del agente de pruebas) | quin-comercial |
| 17 | `docs: qué configurar antes de publicar la ley en quin-comercial` | — |

Cada uno con `npx tsc --noEmit -p .` y `npx next build` en `quin-comercial`.

### Qué depende de unir v174 (`quinchat`)

Producción de `quinchat` es v174 **sin sharp**. Cualquier cambio en rutas de `quinchat` hecho sobre `master`
tiene que volver a pasar por la unión, y v174 puede tener rutas de subida nuevas que este inventario no ve.

Orden, en el PC de agenciaquin o con v174 ya en GitHub:

1. Fases 0–2 de `NOTA-PC-AGENCIAQUIN.md` → rama `union-v174-compresor` (con sharp y `@img/**/*`).
2. Rebase de `bloqueantes-consumo` sobre ella (ya previsto).
3. Rama **`ley-imagenes-quinchat`** desde ahí. Primero se corre `pruebas/ley-imagenes.ts`: su lista de fallos
   es el inventario real de v174.
4. Mismos commits 6–16 en `quinchat`, más:
   - `fix(subidas): las imágenes no suben directo a R2` (parte de 14).
   - `fix(embudos): optimizar-fotos usa el compresor único` — **después de hablarlo con agenciaquin**.
5. Publicar en este orden: unión v174 → bloqueantes → ley. Cada uno se vigila un día con los registros de
   ejecución de Vercel (`DLOPEN`, `ENOENT`, `[ley-imagenes]`) antes del siguiente.

Los commits 1, 4 y 5 tocan `quinchat` solo con archivos nuevos o con el compresor, así que se pueden escribir
ya sin miedo a conflictos con v174.

---

## 6 · Riesgos

| Riesgo | Qué pasa | Qué se hace |
| --- | --- | --- |
| **CPU / tiempo en Vercel** | sharp con mozjpeg sobre una foto de 12 MP: del orden de 0,5–1,5 s, más una pasada de `stats()` si hay canal alfa. Memoria ~50 MB por imagen. | Lo normal (entrantes, fotos ya comprimidas en el navegador) sale antes de tocar sharp por el umbral de 200 kB. `maxDuration = 60` en las rutas nuevas y en `send-media`. `subirAlStorage` registra milisegundos; revisar a la semana. |
| **Límite de 4,5 MB del cuerpo** | Es de la petición, no de la función. `funnels/imagen` dice 8 MB pero Vercel corta antes con 413. `plantillas-wa/imagen` en base64: tope real ~3,3 MB. | Lo de más de 4 MB va por `_pendientes/` (§2.3): el servidor lo descarga de Storage, donde no hay tope. Corregir los mensajes de límite en las rutas. |
| **PNG con transparencia** | Se queda PNG (logos). Si engorda, paleta de 256 colores. | Ya cubierto por el compresor y su prueba. Una foto con alfa real perdería colores: caso raro, aceptado. |
| **GIF animado** | No se comprime (se rompería). | Pasa con marca y se registra si es grande. Consulta 2 y 4. WhatsApp no manda GIF como imagen: no es un caso de envío. |
| **WebP animado (stickers)** | Hoy `optimizarImagen` convierte todo WebP a JPEG/PNG; sharp lee solo el primer fotograma: el sticker animado se vería quieto en el panel. | Commit 1: si `pages > 1`, se deja el original y se registra. Los stickers no se reenvían a Meta, así que el WebP no molesta. |
| **HEIC de iPhone** | Los binarios de sharp **no leen HEIC** (solo AVIF). Se sube el original como `image/heic`, que Chrome no muestra. iOS suele convertir a JPEG al elegir foto, así que el caso es desde escritorio. | Regla 5: se registra y se sube. Consulta 4 mide cuántos llegan. Solo si aparecen, valorar un decodificador (sería otro `.wasm` o binario: **todas sus piezas en `outputFileTracingIncludes`**). |
| **WebP en plantillas de WhatsApp** | Meta acepta el envío y no entrega el mensaje. | El compresor ya sale siempre de WebP a JPEG/PNG. `subirAlStorage` no puede producir WebP. Ninguna ruta debe volver a pedirlo. |
| **Caché de un año sobre rutas que se sobrescriben** | Imagen vieja durante un año. | §2.6: hash del contenido en la ruta de la marca de agua. |
| **Tipo mal declarado** | Una foto sin tipo se saltaría el compresor. | Detección por bytes en `subirAlStorage`. |
| **Captura con texto pequeño en el chat** | 1920/q85 no debería afectar, pero no se ha mirado a ojo. | Probar con una captura real de tallas y precios antes de dar por bueno el commit 10. |
| **Pestañas viejas del panel** | Tras publicar, una pestaña sin recargar que suba una imagen > 4 MB recibe 409. | Avisar a los asesores (abajo). |
| **Pruebas en el destino** | Las vistas previas de Vercel piden sesión: no se puede ejercitar una ruta antes de publicar (observación 2). | Tras publicar: subir un archivo real por cada punto y mirar la consulta 1 y los registros de ejecución. Queda escrito como hueco abierto. |

---

## Antes de publicar (lo que habrá que configurar o avisar)

- `quin-comercial`: **ninguna variable nueva**. Comprobar tras publicar los registros de ejecución de
  `quinchat-comercial` (`DLOPEN`, `ENOENT`) y subir una foto por Embudos en cada tienda.
- Avisar a los asesores: **recargar el panel** después de publicar.
- `quinchat`: solo después de la unión con v174 (NOTA-PC-AGENCIAQUIN) y con el visto bueno de agenciaquin.
- Decisión de la dirección pendiente: confirmar que `_originales/` de `media-api` es la única excepción.
- Con aprobación explícita (SQL de escritura): quitar la escritura anónima en el bucket `plantillas-images`.
- Confirmar si `R2_*` está configurado en `quinchat-agencia-quin` (solo nombres de variables).

---

## Resumen

- 32 puntos de escritura en las dos apps; hoy solo 3 cumplen la ley. Los agujeros grandes son el chat
  saliente, las URL firmadas, `PlantillasPanel` subiendo desde el navegador y **todo** `quin-comercial`
  (incluidos collages y marcas de agua a calidad 100).
- Diseño: un solo archivo de servidor con `.upload(` (`lib/subir-archivo.ts`) y un solo archivo de navegador
  con subidas directas (`lib/subir-desde-navegador.ts`), idénticos en las dos apps. Las imágenes de más de 4 MB
  suben a `_pendientes/` y el servidor las comprime desde Storage; los vídeos siguen su camino directo.
- `quin-comercial` se puede hacer ya y publicarse por su cuenta; `quinchat` espera a la unión con v174 y a
  hablar con agenciaquin por `optimizar-fotos`.
- La ley se vigila con la prueba estática (ninguna `.upload(` fuera del punto único) y con una consulta
  sobre `storage.objects` por `cacheControl`.
