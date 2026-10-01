# ESTRATEGIA DE PESO · Cómo se cumple la LEY DE PESO, tarea por tarea

**Fecha:** 30-09-2026 · **Autor:** planeador · **Para:** implementador, desarrollador, pruebas, auditor y dirección.
**Manda:** `LEY-DE-PESO.md` (la regla) y `TABLERO-AGENTES.md` (el orden). Esto es el **cómo**.
**Construye sobre** `DISENO-LEY-IMAGENES.md` (rama `bloqueantes-consumo`): su inventario, `subirAlStorage()`, la vía
`_pendientes/` y la prueba estática **siguen valiendo**. Aquí se amplían a todos los tipos y a los topes.

> ⚖️ **Cambio de dirección (30-09-2026): nada se rechaza por peso; se acepta por niveles (LEY §1.4). Solo se rechaza lo técnicamente imposible (archivo corrupto, formato que el destino no admite y no se puede convertir, más de 5 MB para Meta tras comprimir).**
>
> ✅ **Actualizado el 30-09-2026 tras la medición (P1 hecha):** los topes y escalones definitivos están en **`LEY-DE-PESO.md` §2**
> y **mandan sobre cualquier cifra de este documento**. Cambios clave: se baja **calidad antes que tamaño** (q85 → q80 → q75),
> el suelo es **1440 px** (no 1280) y los gráficos con texto tienen tope propio de 400 kB (q90, croma 4:4:4). D1 y D2 quedan cerradas.
>
> **Huecos abiertos al escribir esto**
> - ~~`MEDICION-TOPES.md` no existe todavía~~ → ya existe (`arreglos-supabase/MEDICION-TOPES.md`).
> - `pruebas/ley-imagenes.ts` **no está en esta copia** (`optimizacion-videos`); según el diseño está en
>   `bloqueantes-consumo` y quizá sin guardar. P15 lo comprueba antes de ampliarlo.
> - El código revisado es `optimizacion-videos`/`master`, **no v174**. Lo de `quinchat/` se vuelve a inventariar en Z6
>   (la prueba estática de P15 da esa lista sola).
> - No se sabe si `R2_*` está configurado en producción, ni a qué proyecto de Supabase escribe `quin-comercial`.

---

## 1 · Inventario de entradas (corrige y amplía el §1 del diseño)

Líneas de **esta copia**. Las del diseño son de `bloqueantes-consumo`; difieren solo en el webhook (+25), `ventas.ts`
(+1) y `funnelish/webhook` (+1). Leyenda: **Sí** = pasa por `optimizarImagen()` · **Nav** = solo en el navegador.

### 1.1 · Imágenes

| Entrada | quinchat | quin-comercial | ¿Comprime hoy? | Uso (§2) |
| --- | --- | --- | --- | --- |
| Foto de embudo | `app/api/funnels/imagen/route.ts:30` | `…:24` | QC **Sí** (+Nav) · QCOM **No** | foto-web |
| Foto de remarketing | `components/panel/RemarketingPanel.tsx:53` → misma ruta | — | QC Nav + Sí | foto-whatsapp |
| Foto de plantilla WA | `app/api/plantillas-wa/imagen/route.ts:52` | `…:53` | QC **Sí** · QCOM **No** | foto-whatsapp |
| Foto de catálogo | `app/api/catalogos/upload-imagen/route.ts:35,40` | `…:25,32` | QC **Sí** · QCOM **No** | foto-web |
| Marca de agua | `lib/watermark.ts:93,99` | `lib/watermark.ts:93,99` | **No** (Jimp q100) | foto-whatsapp |
| Collage PACK | `lib/collage.ts:44,47` | `lib/collage.ts:38,41` | QC Jimp q85 · QCOM **q100** | foto-whatsapp |
| Collage (copia en línea) | `app/api/funnelish/webhook/route.ts:298,301` | `…:271,274` | QC Jimp q85 · QCOM **q100** | foto-whatsapp |
| Chat saliente ≤ 4 MB | `app/api/whatsapp/send-media/route.ts:64` | `…:72` | **No** | foto-whatsapp |
| Chat saliente > 4 MB (firma) | `components/panel/ChatArea.tsx:558` (R2), `:565` | `ChatArea.tsx:629` | **No** | foto-whatsapp |
| Embudo > 4 MB (firma) | `EmbudosPanel.tsx:57` (R2), `:67` | `EmbudosPanel.tsx:46` | QC Nav · QCOM **No** | foto-web |
| Firma de subida directa | `app/api/funnels/upload-url/route.ts:24` (R2), `:33` | `…:17` | **No mira el tipo** | — |
| Plantillas desde el navegador (clave anónima) | `components/panel/PlantillasPanel.tsx:108` | `…:108` | **No** | foto-whatsapp |
| Entrantes del cliente | `app/api/whatsapp/webhook/route.ts:759` | `…:767` | **No** | foto-entrante |
| Entrantes línea ventas | `lib/quinchat/ventas.ts:1117` | `…:682` | **No** | foto-entrante |
| «Optimizar fotos» 1080/q72 | `app/api/funnels/optimizar-fotos/route.ts:32,38` | — | Jimp 1080/q72 (degrada) | foto-web |
| Recompresión para Meta | `lib/whatsapp.ts:240` | `lib/whatsapp.ts:297` | Jimp; **no escribe en Storage** | fuera |
| Backfill | `arreglos-supabase/media-api/src/storage.ts:70,106` | — | sharp **0.34** (apps: 0.35) | charco |

**Correcciones al diseño:** (1) `RemarketingPanel` no estaba; entra por `funnels/imagen`, ya cubierto. (2) Los vídeos
de chat de más de 4 MB van a `embudos/chat/` porque `ChatArea` pide la firma con `slug: 'chat'`
(`quinchat/components/panel/ChatArea.tsx:553`). Por eso el chat se mezcla con los embudos (observación 6 bis). (3)
`media-api` es un **tercer compresor** con otra versión de sharp y otra regla para la transparencia (`hasAlpha` sin
`isOpaque`, `src/optimizar.ts:114`). El charco lo tiene que usar alineado (P20).

### 1.2 · Vídeo, audio, documentos, SVG y GIF

| Entrada | quinchat | quin-comercial | Hoy |
| --- | --- | --- | --- |
| Vídeo de embudo ≤ 4 MB | `app/api/funnels/video/route.ts:29` (R2), `:41` | `…:27` | Sin tocar. El tope de 50 MB (`:19`) es inalcanzable: Vercel corta en 4,5 MB |
| Vídeo de embudo o chat > 4 MB | firma de `upload-url` (arriba) | ídem | Sin tocar y **sin tope**; WhatsApp falla por encima de 16 MB |
| Vídeo, audio y documento de chat ≤ 4 MB | `send-media/route.ts:64` | `:72` | Sin tocar (los documentos no se guardan, solo van a Meta) |
| Audio de embudo | `app/api/funnels/audio/route.ts:27` | `…:27` | Sin tocar, sin tope |
| Entrantes (vídeo, audio, documento, sticker) | `webhook/route.ts:759`, `ventas.ts:1117` | `:767`, `:682` | Sin tocar |
| SVG | cualquier ruta de imagen | ídem | `optimizarImagen` lo deja pasar **sin sanear** |
| GIF | cualquier ruta de imagen | ídem | Pasa tal cual |

**Total:** 17 puntos en quinchat y 15 en quin-comercial. Cumplen la ley de imágenes: 3. **Ninguno cumple la de peso**:
el compresor actual no tiene tope. Solo se salta lo que pesa menos de 200 kB y lo que no ahorra un 10 %.

---

## 2 · Decisión por tipo

**Restricciones que mandan:** una petición a Vercel admite como mucho ~4,5 MB · WhatsApp solo acepta JPEG y PNG en
imagen (máx. 5 MB), MP4 H.264+AAC en vídeo (máx. 16 MB), y WebP solo en stickers · sharp necesita
`@img/sharp-libvips-linux-x64` en la función (observación 1) · no hay ffmpeg en las funciones.

| Uso | Tope | Dónde se comprime | Herramienta y perfil | Si no cabe |
| --- | ---: | --- | --- | --- |
| **foto-web** (embudo, catálogo) | 250 kB | Navegador (ayuda) + **servidor (garantía)** | sharp mozjpeg. Escalones: 1920/q85 → q80 → q75 → 1600/q75 → 1440/q75 (LEY §2) | Panel: **rechazo** |
| **foto-whatsapp** (plantilla, chat, remarketing, collage, marca) | 250 kB | Ídem | Ídem; **solo JPEG o PNG**, nunca WebP | Panel: rechazo. Collage y marca (automáticos): alerta |
| **foto-entrante** | 400 kB | Servidor, en el webhook | Ídem. A la IA y al clasificador se les sigue pasando el buffer original (diseño §2.8) | Se guarda la mejor versión + **alerta** |
| **PNG con transparencia real** | 250 kB | Servidor | PNG sin pérdida → paleta q90 → bajar lado (mismos escalones) | Rechazo en el panel, alerta si es automático |
| **sticker-entrante** (WebP) | 500 kB (el de Meta) | No se toca | Se conserva la animación (`pages > 1`) | Alerta |
| **HEIC** | — | Navegador (Safari lo convierte al elegir la foto) | sharp **no lee HEIC** | Panel: rechazo con «expórtala a JPG». Entrantes: WhatsApp ya las manda en JPEG |
| **svg** | 50 kB | Servidor | **SVGO** (JS puro, sin binario) + saneado: fuera `<script>`, `on*=`, `javascript:`, `href` externos y `<foreignObject>` | Rechazo. Si el SVG va a WhatsApp, se rasteriza a PNG con sharp |
| **animada-web** (GIF de landing) | **1,5 MB (propuesta)** | Servidor | sharp `animated: true` → **WebP animado**. Suele pesar 3–6 veces menos. No hace falta ffmpeg | Rechazo |
| GIF hacia WhatsApp | — | — | Meta no manda GIF como imagen | Rechazo: «súbelo como vídeo» |
| **video-web** | 4 MB | **Navegador** (WebCodecs) + **verificación en el servidor** | H.264 720p, ~3,5 Mb/s o menos, sin audio si va en silencio, `faststart` | Rechazo |
| **video-whatsapp** (chat) | 10 MB | Ídem | H.264 720p + AAC | Rechazo con el motivo |
| **video-entrante** | 16 MB (Meta) | No se comprime en el webhook | Se guarda tal cual | **Alerta** por encima de 10 MB; lo recoge el charco (P24) |
| **audio** (embudo) | **3 MB (propuesta)** | — | Solo tope | Rechazo. Entrante: alerta |
| **documento** | 5 MB | — | Solo tope | Rechazo. Entrante: alerta |

**Criterios comunes:**
- **El tope se mide sobre lo que se guarda.** Si el original ya cabe y su formato vale, se guarda sin recomprimir
  (no hay segunda pasada con pérdida). Si no cabe, los escalones se aplican aunque el ahorro no llegue al 10 %.
- **Suelo de calidad:** nunca por debajo de q75 ni de **1440 px** (medido: a 1280 y 1080 px el SSIM cae a 0,88–0,92;
  con los escalones de la LEY cumplen 21 de 22 fotos, `MEDICION-TOPES.md`).
- **SSIM no se calcula en producción** (cuesta CPU en cada subida). Se garantiza con el suelo de escalones y se
  **mide en las pruebas** con archivos reales, a 1290 px, con la función de `media-api/comparar-perfiles.ts:92`.
- **Formato de salida:** JPEG, o PNG si hay transparencia real. WebP solo para lo animado de landing, que nunca va a
  WhatsApp. En el bucket se mezclan landing y WhatsApp bajo `embudos/`, así que no se usa WebP para fotos.

### 2.1 · Vídeo: por qué WebCodecs en el navegador

| Opción | A favor | En contra | Coste |
| --- | --- | --- | --- |
| **ffmpeg.wasm** | Mismo control que ffmpeg (CRF); gratis | ~30 MB de descarga por sesión; en un solo hilo va 10–20 veces más lento que el nativo (minutos por clip). Varios hilos exigen COOP/COEP, que rompe las imágenes de otros orígenes en el panel. Se cae en móviles | 0 USD; CPU del asesor |
| **WebCodecs** (`VideoEncoder` + una librería de JS puro para empaquetar el MP4, p. ej. Mediabunny) | Usa el hardware y va a tiempo real o más rápido. Pesa unos 100 kB. No cambia los encabezados del panel | Se controla por bitrate, no por CRF. El soporte varía: Chrome y Edge sí; Safari, parcial. **La codificación AAC depende de la plataforma** (sin ella no hay vídeo para WhatsApp) | 0 USD |
| **Trabajo externo** (`media-api` con ffmpeg, en GitHub Actions por cron o en Cloud Run/Fly) | CRF y SSIM reales; es el mismo código que el backfill | Llega tarde (de 5 a 15 min: no sirve para el chat). Hay que operarlo, y la clave de servicio sale a otro sistema (avisar al humano) | Actions: dentro de los 2 000 min/mes gratis; Fly/Cloud Run ~0–5 USD/mes |
| **Terceros** (Cloudinary, Mux, Cloudflare Stream, AWS MediaConvert) | Cero mantenimiento | Sirven desde **su** dominio o en HLS: WhatsApp necesita un MP4 por URL, y `/api/pedidos` sustituye las URLs ajenas (fallo 5 del tablero). Un proveedor y una clave más. Cobran por minuto | Del orden de 0,01–0,03 USD/min más almacenamiento; Cloudinary de pago desde unos 90 USD/mes (**precios orientativos, sin verificar hoy**) |

**Decisión:** **WebCodecs comprime en el panel.** El servidor **verifica** sin ffmpeg: lee la cabecera MP4 con un
lector de JS puro y comprueba el códec H.264 (y AAC si va a WhatsApp), que el lado no pase de 1280, `faststart` y el
tope. Si no cumple, borra el pendiente y rechaza. **El trabajo externo** (media-api) queda para el charco y los
vídeos entrantes. **Terceros: descartado.** ffmpeg.wasm solo entra si falla la prueba previa P12.
**Red de seguridad sin código:** poner `file_size_limit` = 16 MB en los buckets (P17), para que ni una URL firmada
pase del máximo de Meta.

---

## 3 · Módulo único (archivos idénticos en las dos apps)

Amplía el §2 del diseño. Cada commit lo dice: «archivo idéntico en quinchat y quin-comercial».

| Archivo | Lado | Nuevo o existente | Único sitio con… |
| --- | --- | --- | --- |
| `lib/ley-peso.ts` | los dos (sin dependencias) | nuevo | la tabla de perfiles, la detección por bytes, los mensajes |
| `lib/optimizar-imagen-servidor.ts` | servidor | existe (se amplía con los escalones) | `sharp` |
| `lib/sanear-svg.ts` | servidor | nuevo | `svgo` |
| `lib/verificar-video.ts` | servidor | nuevo | el lector MP4 |
| `lib/subir-archivo.ts` | servidor | nuevo (diseño §2.2) | `.upload(`, `.move(`, `.remove(` de pendientes, `createSignedUploadUrl`, `r2Subir`, `r2PresignPut` |
| `lib/subir-desde-navegador.ts` | navegador | nuevo (diseño §2.3) | `uploadToSignedUrl`, PUT a R2 |
| `lib/video-navegador.ts` | navegador | nuevo | `VideoEncoder` y la librería de empaquetado MP4 |
| `app/api/media/procesar/route.ts` | servidor | nuevo | mover de `_pendientes/` a la ruta final |

Nombres: **`_pendientes/`** (diseño) y **`/api/media/procesar`** (`TASKS-CONSUMO.md` T2.7). Se unifican así y
sustituyen a `_entrada/` y a `procesar-subida`.

```ts
// lib/ley-peso.ts — contrato (diseño, no código final)
export type Uso = 'foto-web' | 'foto-whatsapp' | 'foto-entrante' | 'sticker-entrante' | 'svg' | 'animada-web'
  | 'video-web' | 'video-whatsapp' | 'video-entrante' | 'audio' | 'documento';
export type Origen = 'panel' | 'automatico';
export interface Perfil { tope: number; formatos: string[]; escalones?: { lado: number; calidad: number }[]; ladoMinimo?: number }
export const PERFILES: Record<Uso, Perfil>;                     // las cifras del §2, en un solo sitio
export function detectarTipo(b: Uint8Array): 'jpeg'|'png'|'webp'|'gif'|'heic'|'svg'|'mp4'|'webm'|'pdf'|'otro';
export function mensajeRechazo(uso: Uso, bytes: number): string; // «La foto pesa 612 kB y el tope es 250 kB. …»

// lib/subir-archivo.ts — nunca lanza
export interface Subida { bucket: string; ruta: (ext: string) => string; datos: Buffer; tipoDeclarado: string;
  uso: Uso; origen: Origen; upsert?: boolean; destino?: 'supabase' | 'r2' }
export type Resultado =
  | { estado: 'guardado' | 'guardado-con-alerta'; url: string; ruta: string; contentType: string;
      bytesAntes: number; bytesDespues: number; escalon: string; alerta?: string }
  | { estado: 'rechazado'; codigo: 'SUPERA_TOPE' | 'FORMATO' | 'SVG_INSEGURO' | 'COMPRESOR_FALLO';
      mensaje: string; bytes: number; tope: number };
export function subirAlStorage(cliente: SupabaseLike, s: Subida): Promise<Resultado>;
export function firmarSubidaDirecta(cliente, p: { uso: Uso; ext: string; bytes: number }): Promise<{ ruta: string; token: string } | Resultado>;
export function procesarPendiente(cliente, p: { pendiente: string; uso: Uso; origen: Origen; ruta: (ext: string) => string }): Promise<Resultado>;
```

**Comportamiento (punto 4 de la LEY):**

| Caso | `origen: 'panel'` | `origen: 'automatico'` |
| --- | --- | --- |
| No cabe tras el último escalón | **Se acepta por niveles** (LEY §1.4): tolerancia +50 %, rescate y, si nada basta, nivel 4: se guarda la mejor versión de calidad, la ruta responde **200** con `nivel` y `aviso`, y el panel muestra el aviso sin bloquear | Igual, sin aviso en pantalla: solo el registro |
| Formato no admitido (HEIC, GIF hacia WhatsApp) | **415** | Se guarda el original + alerta |
| SVG con código | **422** | No aplica (no entran SVG automáticos) |
| sharp no carga o falla | **500** `COMPRESOR_FALLO`: **nunca se sube el original en silencio** (regla 5) | Original + alerta |
| Firma de subida directa | El servidor pide `bytes` y los compara con el tope **antes de firmar**. La firma siempre apunta a `_pendientes/`, nunca a la ruta final | — |

- **Alerta** = una línea `console.warn('[ley-peso]', JSON.stringify({ estado, uso, ruta, bytes, tope, motivo }))`
  que se busca en los registros de ejecución de Vercel. **No se crea ninguna tabla nueva.** Las alertas no se
  pierden cuando caducan los registros: el archivo sigue apareciendo en la vigilancia SQL (P16).
- `cacheControl: '31536000'` en todo. Si hay `upsert`, la ruta lleva un hash del contenido (diseño §2.6).
- El navegador comprueba el tope **antes** de subir, para no gastar datos. El servidor vuelve a comprobarlo siempre.

---

## 4 · Tareas

Ramas: `agente/Pn-<descripcion>`, apiladas sobre `agente/ley-peso`, que nace de `bloqueantes-consumo`. **Todo el
«cerrar el grifo» se escribe ya.** Publicar depende del frente 0 (Z7), porque enviar a `master` publica las dos
apps. Antes de cerrar cualquier tarea: `tsc --noEmit` y `pruebas/*` en verde en las dos apps (tablero §6.5).
«SSIM» = SSIM ≥ 0,95 a 1290 px contra el original, sobre el juego de muestras de P1.

### 4.1 · Cerrar el grifo (código nuevo)

| ID | Tarea | Dueño | Archivos | Frente 0 | ¿Escribe en prod? | Hecho cuando |
| --- | --- | --- | --- | --- | --- | --- |
| **P1** ✅ HECHA | Terminar `MEDICION-TOPES.md`. Para cada escalón: peso y SSIM sobre ≥ 30 fotos reales, 10 capturas, 5 PNG con alfa y 5 vídeos. Medir **1080/q80**. Calcular qué % de fotos no cabe en 250 kB a 1280/q80. Dejar las muestras en `pruebas/muestras/` (fuera de git) | desarrollador | `arreglos-supabase/MEDICION-TOPES.md` | No | **No** (solo lee del bucket) | Una tabla por tipo con peso, SSIM y % rechazado; dirección puede decidir con ella |
| **P2** | `lib/ley-peso.ts` + `pruebas/ley-peso-unidad.ts` | implementador | las dos apps | No, rama ya | No | Detecta los 11 tipos por la firma de bytes, aunque el tipo declarado mienta; los mensajes llevan peso y tope en kB/MB; los dos archivos son idénticos (`fc /b`) |
| **P3** | sharp en quin-comercial (T2.2): `package.json`, lock y `'/api/**': ['./fonts/**/*','./node_modules/@img/**/*']` | desarrollador | `quin-comercial/package.json`, `package-lock.json`, `next.config.ts` | No, rama ya | No | Compilado **en Linux** (P5): el `.nft.json` de una ruta `/api` lista `sharp-linux-x64` **y** `libvips-cpp.so.*` |
| **P4** | Escalones en el compresor: `ajustarATope(buffer, uso)`; `motivo`; respeta `pages > 1`; nunca por debajo de q80 ni del lado mínimo; no recomprime lo que ya cabe. Copiarlo idéntico a quin-comercial | implementador | `lib/optimizar-imagen-servidor.ts` (las dos apps), `pruebas/optimizar-imagen.ts` | No, rama ya | No | Con las muestras de P1: el 100 % de lo que sale pesa ≤ su tope o viene marcado «no cabe»; todo lo que sale cumple SSIM; ningún WebP ni HEIC de salida |
| **P5** | Integración continua en Linux: GitHub Actions en `ubuntu-latest`, en cada rama `agente/**` y **nunca en `master`**. Corre `npm ci`, `tsc`, `next build`, `pruebas/*` y la comprobación de `libvips` en el `.nft.json` | desarrollador | `.github/workflows/pruebas.yml` | No, rama ya | No (sin secretos: las pruebas usan un almacenamiento falso) | Una rama con un fallo a propósito sale en rojo; la buena, en verde. Sirve para la observación 1: se decide en Linux |
| **P6** | `lib/subir-archivo.ts` con el contrato del §3 (amplía T2.1) + `app/api/media/procesar` | implementador | las dos apps | No, rama ya | No | La prueba dinámica de P15 pasa en todos los casos del §5 |
| **P7** | `lib/sanear-svg.ts` (SVGO + saneado) | implementador | las dos apps, `package.json` | No, rama ya | No | Un SVG con `<script>`, `onload=`, `javascript:` o un `href` externo sale 422; un logo limpio queda en ≤ 50 kB y **se ve igual** (se rasteriza con sharp y se compara: SSIM ≥ 0,99) |
| **P8** | Rutas del panel por el módulo (T2.3): `funnels/imagen`, `plantillas-wa/imagen`, `catalogos/upload-imagen`, `funnels/video`, `funnels/audio`; el panel muestra el `aviso` del nivel 4 (sin bloquear) | implementador | `app/api/…` y sus paneles | Rama ya; en QC se rebasa sobre Z6 | No | una foto que no cabe se acepta en nivel 4 con aviso; una foto de móvil de 3 MB queda en ≤ 250 kB con SSIM; se quita el límite ficticio de 50 MB |
| **P9** | Chat saliente (T2.4): se comprime como `foto-whatsapp` y **a Meta va el buffer comprimido** | implementador | `app/api/whatsapp/send-media/route.ts` | Rama ya; publicar tras Z7 | No | Una captura PNG de 2,5 MB sale en ≤ 250 kB en JPEG o PNG; documento y audio salen byte a byte iguales; **revisión a ojo de 3 capturas con texto pequeño** (T2.9) |
| **P10** | Entrantes (T2.5): `foto-entrante` y `video-entrante`, siempre con `origen: 'automatico'` | implementador | `webhook/route.ts`, `lib/quinchat/ventas.ts` | Rama ya; publicar tras Z7 | No | Nunca rechaza; una foto de 1 MB se guarda en ≤ 400 kB; el webhook añade menos de 1 s por foto (medido con muestras); el sticker animado sigue animado |
| **P11** | Collage y marca de agua (T2.6): Jimp compone y el módulo codifica; ruta con hash del contenido | implementador | `lib/collage.ts`, `lib/watermark.ts`, `funnelish/webhook` (usa `lib/collage`) | Rama ya | No | Collage de QCOM: de ~1,6 MB a ≤ 250 kB; **revisión a ojo del texto de la marca de agua** (q85 frente a q90); se acabó el Jimp q100 |
| **P12** | **Prueba previa de WebCodecs**, 1 día y sin tocar las apps: página suelta que convierte 3 vídeos reales a 720p. Probarla en los navegadores que usa el equipo (Chrome Windows, Android, Safari iPhone) | desarrollador | `arreglos-supabase/prueba-webcodecs/` | No | No | Tabla navegador × (H.264 sí/no, AAC sí/no, tiempo, peso, SSIM medido con ffmpeg en el PC). Si AAC falla en un navegador que se usa → decidir con esta tabla entre ffmpeg.wasm o rechazo |
| **P13** | Vídeo por un solo camino: `video-navegador.ts` + `subir-desde-navegador.ts` + `verificar-video.ts` + `upload-url` pide `uso` y `bytes` y firma solo `_pendientes/`; `ChatArea`, `EmbudosPanel`, `PlantillasPanel` (T2.7) | implementador | los de §3 + paneles + `upload-url` | Rama ya; publicar tras Z7 | No | Un vídeo de 40 MB en 1080p acaba en ≤ 4 MB (web) o ≤ 10 MB (chat) con SSIM (medido con ffmpeg sobre la muestra); un MP4 que no es H.264 sale rechazado; ninguna firma apunta fuera de `_pendientes/`; una imagen de más de 4 MB llega comprimida |
| **P14** | GIF → WebP animado para landing; GIF hacia WhatsApp convertido a MP4 | implementador | `optimizar-imagen-servidor.ts` | Rama ya; **espera a D3** | No | Un GIF de 3 MB sale en ≤ 1,5 MB, animado, con el mismo número de fotogramas |
| **P15** | Prueba `pruebas/ley-peso.ts` (§5), que sustituye y amplía a `ley-imagenes.ts` | pruebas | `pruebas/` de las dos apps | No, rama ya | No | En rojo con la lista exacta de lo que falta mientras se migra; en verde al acabar P13 con `EXIGIR_PUNTO_UNICO = true` |
| **P16** | Vigilancia `arreglos-supabase/sql/005_vigilancia_ley_peso.sql`: de la carpeta se deduce el uso y el tope, y lista lo que se pase o no tenga la marca | desarrollador | `sql/005…`, añadir a `004_chequeo_consumo.sql` | No | **No** (solo lectura) | Sobre el bucket de hoy lista el chat saliente, los vídeos y `_originales/` (excepción declarada); da 0 falsos positivos en `embudos/` ya comprimido |
| **P17** | `file_size_limit` = 16 MB en `chat-media`, `catalogo-imagenes` y `plantillas-images`; quitar la escritura anónima en `plantillas-images` (diseño §2.9) | humano aprueba, desarrollador aplica | configuración de Supabase | **Tras Z7** (v174 sube vídeos de hasta 50 MB) | **Sí** | Una subida de 17 MB firmada a mano falla; las subidas normales siguen |
| **P18** | Revisión de la rama completa | pruebas → auditor | — | — | No | P5 en verde y el auditor aprueba contra el tablero §6 |
| **P19** | Publicar y verificar: una subida real por cada entrada del §1 en cada app; P16 da 0 a la hora, a las 24 h y a los 7 días; registros sin `DLOPEN`, `ENOENT` ni `[ley-peso] COMPRESOR_FALLO` | humano + pruebas | — | **Z7** | **Sí** | Lo dicho, anotado en el registro del tablero. Avisar a los asesores de que **recarguen el panel** |

**Qué se puede empezar ya:** P1 (desarrollador, en marcha), P2 y P4 (implementador), P3, P5 y P12 (desarrollador) y
el esqueleto de P15 (pruebas). Nada de eso escribe en producción.

### 4.2 · Limpiar el charco (recomprimir lo que ya hay, A1–A5 del tablero)

Todo escribe o borra en producción: **visto bueno del humano antes de cada una** y el cruce contra todas las tablas
**el mismo día** (observación 6 bis). El orden sigue la observación 6 ter: primero el grifo (P19), luego esto. Si Z7
tarda, A3 y A4 se hacen igual y se repite una pasada corta después.

| ID | Tarea | Dueño | Depende de | Hecho cuando |
| --- | --- | --- | --- | --- |
| **P20** | Alinear `media-api` con el módulo: la misma `ley-peso.ts`, los mismos escalones y sharp 0.35; vídeo con el perfil de la LEY (720p, CRF 26–30, SSIM calculado con `ffmpeg -lavfi ssim`) | desarrollador | P4 | `--simular` sobre las muestras da los mismos bytes que el compresor de las apps (±1 %) |
| **P21** (=A2) | Borrar los 18 vídeos huérfanos | desarrollador + humano | Cruce del mismo día | `HALLAZGO-videos.md`: −226,8 MB y las 10 conversaciones de `embudos/chat/` intactas |
| **P22** (=A3) | Recomprimir en su sitio las 511 imágenes del chat saliente, con el mismo nombre | desarrollador + humano | P20 | 0 archivos por encima de 250 kB en P16; muestra de 20 con SSIM; `validar-whatsapp.ts` en verde |
| **P23** (=A4) | Lo que entró sin comprimir desde el 31-08 (`embudos/`, `catalogo/`, `packs/`, `ventas/`, `entrantes/`) | desarrollador + humano | P20 | Ídem por carpeta; `validar-landings.ts` 31/31 |
| **P24** | **Nuevo:** fotos ya comprimidas a 1920/q85 que **pasan de 250 kB** (98 en `embudos/`). Se recomprimen **desde `_originales/`**, para no hacer una segunda pasada con pérdida | desarrollador + humano | P20, D1 | 0 imágenes de `embudos/` y `catalogo/` por encima del tope; SSIM medido contra el original |
| **P25** (=A5) | Vídeos en uso por encima de 4 MB (`pareja` 23 MB y `spiderman-tend` 9,3 MB) al perfil 720p | desarrollador + humano | P20 | ≤ 4 MB, SSIM ≥ 0,95 **y visto a ojo en un móvil** |
| **P26** (=A1) | Borrar `_originales/` | humano | **Después de P24 y P25** | Copia en disco verificada; ninguna tabla apunta ahí; −1 010 MB |
| **P27** | Vídeos de chat de `embudos/chat/` (222,7 MB, historial de clientes) al tope de 10 MB, con el mismo nombre | desarrollador + humano | **D5** | Las 10 conversaciones reproducen el vídeo en el panel |

**Cambio de orden frente al tablero:** A1 (borrar `_originales/`) pasa **al final**. Con un tope de 250 kB hay fotos
ya comprimidas que tienen que volver a comprimirse, y hacerlo desde los originales es la única forma de no perder
calidad dos veces (`HALLAZGO-dos-compresores.md`, «Dependencia»). quin-comercial: el charco espera a tener acceso a
su base (D5 de `TASKS-PLATAFORMA.md`).

---

## 5 · Prueba de aceptación · `pruebas/ley-peso.ts` (una por app, idéntica)

**Parte estática.** Son las reglas 1–9 del diseño §4.1, más estas:

| # | Regla |
| --- | --- |
| 10 | `.move(`, `.remove(` sobre `_pendientes/`, `VideoEncoder`, `svgo` y el lector MP4 aparecen solo en su archivo del §3 |
| 11 | Toda ruta de `app/api/**` que reciba un archivo pasa `uso` y `origen` a `subirAlStorage` (no hay subidas «sin uso») |
| 12 | `lib/ley-peso.ts`, `subir-archivo.ts`, `optimizar-imagen-servidor.ts`, `sanear-svg.ts`, `verificar-video.ts`, `subir-desde-navegador.ts` y `video-navegador.ts` son **byte a byte iguales** en las dos apps |
| 13 | Ningún texto de límite en las rutas contradice `PERFILES` (se acabaron los «50 MB» y los «5 MB» que no se cumplen) |

**Parte dinámica.** Sin red: importa el módulo real con un almacenamiento falso que registra cada llamada. Las
imágenes se **generan** en la prueba con sharp (ruido y degradado: lo más difícil de comprimir), así corre en P5. Las
filas marcadas con * usan `pruebas/muestras/` (P1) y solo corren en el PC. **Si falta la muestra, la prueba falla con
«muestra ausente»; nunca se da por buena en silencio.**

| Entrada | Uso / origen | Esperado |
| --- | --- | --- |
| JPEG de 12 MP y 5 MB | foto-web / panel | ≤ 250 kB, JPEG, SSIM ≥ 0,95, `cacheControl` 31536000 |
| Ruido de 12 MP que no cabe ni a 1440/q75 | foto-web / panel | **aceptado en nivel 4**: 200 con `aviso` (lleva «kB» y «250»), dimensiones ≥ 1440 |
| Lo mismo | foto-entrante / automático | `guardado-con-alerta`, la mejor versión, y la línea `[ley-peso]` |
| PNG opaco de 2,5 MB (captura) * | foto-whatsapp / panel | ≤ 250 kB, JPEG, SSIM |
| PNG con alfa real (logo) | foto-web | PNG y la transparencia se conserva |
| WebP estático | foto-whatsapp | JPEG o PNG; **nunca WebP** |
| WebP animado (sticker) | sticker-entrante | Bytes iguales al original |
| JPEG declarado como `application/octet-stream` | foto-web | Se detecta y se comprime |
| HEIC | foto-web / panel | 415 |
| GIF animado de 3 MB | animada-web | WebP animado de ≤ 1,5 MB, con los mismos fotogramas |
| GIF | foto-whatsapp | 415 |
| SVG con `<script>` / limpio | svg | 422 / ≤ 50 kB y sin cambios visibles |
| JPEG que ya cabe (180 kB) | foto-web | Bytes iguales al original (no hay segunda pasada) |
| sharp simulado como caído | panel / automático | 500 `COMPRESOR_FALLO` sin subir nada / original + alerta |
| MP4 H.264 720p de 3 MB * | video-web | Se mueve de `_pendientes/` a la ruta final |
| MP4 HEVC o 1080p de 12 MB * | video-web / panel | Rechazado y el pendiente se borra |
| Firma pedida con `bytes` = 30 MB | video-whatsapp | Rechazada **sin firmar** |
| PDF de 8 MB / audio de 4 MB | documento / audio, panel | aceptado con `aviso` (subida por URL firmada si pasa de 4 MB) |
| Buffer corrupto con tipo `image/jpeg` | panel | 415/500, nunca se sube el original |

**Manual, una vez por navegador del equipo:** un vídeo real de cada uso sube, se reproduce en la landing y llega por
WhatsApp. Se anota el peso y el SSIM (medido con ffmpeg en el PC).

---

## 6 · Riesgos

| Riesgo | Qué se hace |
| --- | --- |
| **Un tope de 250 kB con suelo de 1280 px puede rechazar fotos de producto buenas** (1920/q85 ya da 245 kB de media) | P1 mide el % rechazado **antes** de fijar nada; si pasa del 5 %, se lleva a dirección (D2) |
| **Windows no decide sobre Linux** (sharp, SVGO y el lector MP4 en Vercel) | P5 compila y prueba en Linux; tras publicar, la prueba más barata es una subida real por cada entrada (P19). Hasta entonces queda como hueco abierto |
| WebCodecs sin AAC, o sin soporte en el navegador de algún asesor | P12 antes que P13; como alternativa, ffmpeg.wasm o rechazo con «usa Chrome» |
| El webhook de Meta tiene que responder en menos de 20 s | Las fotos entrantes casi nunca pasan de 400 kB y se guardan sin recomprimir; P10 mide el tiempo |
| Pestañas del panel abiertas con el código viejo piden firmas sin `uso` | `upload-url` responde **409 «Recarga el panel»** (diseño §2.3) |
| Pendientes huérfanos en `_pendientes/` | La consulta 3 del diseño §4.2; se borran a mano con visto bueno |
| Local = producción: probar P8–P13 en `localhost` **escribe en el bucket real** | Se prueba con el almacenamiento falso (P15). Cualquier subida real necesita visto bueno y va a una carpeta `prueba-ley/` que se borra después |
| Cuarto compresor escondido en v174 | La prueba estática de P15 sobre `integracion` (Z6) lo encuentra |
| `optimizar-fotos` (1080/q72) de agenciaquin | T2.10: hablarlo con él antes de tocarlo; hasta entonces es una excepción declarada de la prueba |

---

## 7 · Qué tiene que decidir dirección

| # | Pregunta | Propuesta |
| --- | --- | --- |
| **D1** | **Topes definitivos.** «250 megabytes» ¿quería decir **250 kB** para fotos? | 250 kB en fotos, 400 kB en entrantes, 4 MB en vídeo de landing y 10 MB en vídeo de chat (LEY §2); **cerrada**: dirección delegó en la medición → LEY §2 |
| **D2** | Si una foto de producto no cabe en 250 kB sin bajar de 1280 px: ¿se **rechaza** o se sube el tope (300–350 kB)? | **Cerrada**: con suelo de 1440 px y q75 cumple el 95 %; lo que no quepa se rechaza en el panel. Gráficos con texto: 400 kB |
| **D3** | GIF: ¿vale **WebP animado** en las landings (sin ffmpeg, se hace ya) en lugar de MP4 (necesita el trabajo externo)? ¿Tope de 1,5 MB? | Sí, WebP animado |
| **D4** | Topes que la LEY no fija: **audio de embudo** (3 MB) y **sticker** (el de Meta) | Aceptar |
| **D5** | ¿Se pueden recomprimir en su sitio los **vídeos del historial de clientes** (`embudos/chat/`, 222,7 MB)? | Sí, con el mismo nombre y revisión (P27) |
| **D6** | **Retrasar el borrado de `_originales/`** (A1) hasta recomprimir desde ahí lo que pase del tope | Sí |
| **D7** | ¿Qué navegadores y móviles usan los asesores para subir vídeos? | Lo responde P12 |
| **D8** | ¿Se acepta rechazar HEIC en el panel desde el ordenador («expórtala a JPG»)? | Sí; si aparecen muchos, se valora un decodificador aparte |
| **D9** | Si un día hace falta el trabajo externo para vídeo: ¿se acepta sacar la clave de servicio de Supabase a GitHub Actions o a Cloud Run? | Solo si P12 falla |
