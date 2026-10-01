# Medición · ¿Se cumplen los topes de la LEY DE PESO sin perder calidad?

**Fecha:** 30-09-2026 · **Quién:** agente desarrollador · **Para:** planeador (`ESTRATEGIA-PESO.md`) y dirección
**Qué es:** medición sobre archivos reales del bucket `chat-media`, **solo lectura** (descarga pública; nada
escrito en Storage, R2 ni en la base).
**Script relanzable:** `quinchat/pruebas/medir-topes.ts` (importa el compresor real
`lib/optimizar-imagen-servidor.ts`; sin dependencias nuevas en `package.json`).

> ⚠️ **Windows no decide sobre Linux.** Todo esto se midió en el PC de desarrollo (Windows, 12 hilos,
> `sharp` 0.35.4, `ffmpeg` 6.1.1 de `ffmpeg-static` instalado en el scratchpad). Dice **cuánto comprime**, no
> que funcione en Vercel. Allí `ffmpeg` no existe y `sharp` necesita `libvips` en `outputFileTracingIncludes`.

---

## 0 · Resumen

| Tipo | Tope propuesto | Cumple con SSIM ≥ 0,95 | Comentario |
| --- | ---: | ---: | --- |
| Foto (JPG/PNG/WebP) | 250 kB | **21 de 22 (95 %)** | Falla 1 gráfico con texto (banner de promoción) |
| Foto entrante (cliente) | 400 kB | 2 de 2 | |
| Vídeo de chat | 10 MB | **4 de 4 (100 %)** | CRF 26 ya da 1,6–5,3 MB |
| Vídeo de landing | 4 MB | 2 de 3 a CRF 26 fijo · **3 de 3** bajando CRF | 1 vídeo con mucho movimiento pide CRF 24 (4,01 MB, raspando) |
| SVG / GIF | 50 kB / → vídeo | **no medible** | No hay ninguno en el bucket ni en el repo |

**El compresor de hoy (1920/q85) deja 5 de 22 fotos por encima de 250 kB** (77 % cumple). Con los escalones
bien ordenados cumple el 95 %.

---

## 1 · Imágenes (22 de la muestra)

Calidad: SSIM en escala de grises a **1290 px** (pantalla de un móvil medio), como en
`HALLAZGO-dos-compresores.md`, para que las cifras se puedan comparar. «Escalón» = primer escalón de la LEY
que queda bajo el tope. «Hoy» = lo que guarda el compresor actual.

| Zona · archivo | Original | Px | Alfa | Hoy | Escalón | Final | SSIM | ¿Cumple? |
| --- | ---: | ---: | --- | ---: | --- | ---: | ---: | --- |
| catalogo · vpflx3.jpg | 1 637 kB | 1600² | no | **291 kB** | 1920/q80 | 240 kB | 0,971 | sí |
| catalogo · 9y5df6.jpg | 215 kB | 1280² | no | 215 kB | — | 215 kB | — | ya cabía |
| catalogo · 3m65nw.jpg | 182 kB | 1280² | no | 182 kB | — | 182 kB | — | ya cabía |
| catalogo · 4ajrys.jpg | 149 kB | 1280² | no | 149 kB | — | 149 kB | — | ya cabía |
| chat-saliente · wx3qb.jpg | 511 kB | 1230×1600 | no | **288 kB** | 1920/q80 | 241 kB | 0,966 | sí |
| chat-saliente · wn5j9.png | 3 866 kB | 1920² | no | **286 kB** | 1920/q80 | 239 kB | 0,984 | sí |
| chat-saliente · mjmlu.png | 840 kB | 1032×533 | canal opaco | 59 kB | 1920/q85 | 59 kB | 0,966 | sí |
| chat-saliente · o5x62.png | 285 kB | 863×432 | canal opaco | 28 kB | 1920/q85 | 28 kB | 0,990 | sí |
| chat-saliente · vopjj.png | 165 kB | 400² | no | 165 kB | — | 165 kB | — | ya cabía |
| embudos · dcoko.jpg | 243 kB | 1280² | no | 243 kB | — | 243 kB | — | ya cabía |
| embudos · 2a6ej.jpg | 174 kB | 1280² | no | 174 kB | — | 174 kB | — | ya cabía |
| embudos · 5h0z2.jpg | 155 kB | 1600×522 | no | 155 kB | — | 155 kB | — | ya cabía |
| embudos · **iebwh.png** (promo) | 2 657 kB | 1254² | no | 214 kB | 1920/q85 | 214 kB | **0,943** | **NO (SSIM)** |
| embudos · 5orgx.png (remarketing) | 2 399 kB | 1254² | no | **316 kB** | 1080/q80 · *mejor 1920/q75* | 216 · *235* kB | 0,954 · *0,961* | sí |
| entrantes · 24mxx.jpg | 123 kB | 738×1600 | no | 123 kB | — | 123 kB | — | ya cabía |
| entrantes · 0dato.webp | 472 kB | 512² | **real** | 350 kB (PNG) | 1920/q85 | 24 kB | 0,989 | sí |
| packs · ghmvix.jpg | 1 623 kB | 2700×900 | no | 133 kB | 1920/q85 | 133 kB | 0,971 | sí |
| packs · PACK-X2…v2.jpg | 211 kB | 1800×900 | no | 211 kB | — | 211 kB | — | ya cabía |
| packs · 1q9kx9.jpg | 201 kB | 1800×900 | no | 201 kB | — | 201 kB | — | ya cabía |
| ventas · 4mk60.jpg | 749 kB | 1280×1267 | no | 152 kB | 1920/q85 | 152 kB | 0,983 | sí |
| ventas · 2x76m.jpg | 291 kB | 1600² | no | **291 kB** | 1920/q80 | 248 kB | 0,988 | sí |
| ventas · sk9j7.webp | 88 kB | 512² | **real** | 39 kB (PNG) | — | 88 kB | — | ya cabía |

Las 11 que necesitaban trabajo: **15 327 kB → 1 812 kB (−88 %)**, 165 kB de media. El compresor de hoy las deja
en 2 407 kB (−84 %) y con 5 por encima del tope (en negrita en «Hoy»).

### Lo que enseña la tabla

1. **Los escalones de tamaño casi nunca hacen nada.** 18 de 22 originales miden ≤ 1600 px, así que «1600» y
   «1440» no cambian el archivo (`withoutEnlargement`). Lo que baja el peso es la **calidad**: q85 → q80 → q75.
   Medido sobre los 6 casos difíciles, 1920/q75 da 186–235 kB con SSIM **0,959–0,980**.
2. **1280 y 1080 px rompen el SSIM.** En fotos grandes caen a **0,88–0,92** (ver 1280/q80 en el detalle del
   script). El suelo de 1080 px no es compatible con SSIM ≥ 0,95; el suelo útil es **1440 px**
   (1440/q75: 0,951–0,967).
3. **Regla del 10 % del compresor actual.** `AHORRO_MINIMO = 0.1` conserva el original si no baja un 10 %:
   `2x76m.jpg` se queda en 291 kB, por encima del tope. Con la LEY esa regla solo puede valer **bajo el tope**.
4. **Gráficos con texto (banners) no caben en 250 kB sin perder.** `iebwh.png` ya sale hoy a SSIM 0,943 (el
   compresor en producción ya lo degrada un poco). Para pasar de 0,95 necesita q90 con croma 4:4:4 → **370 kB**
   (0,965). PNG con paleta: 815 kB (0,991). Es el único fallo de la muestra.
5. **Transparencia.** Ningún PNG de la muestra tiene transparencia real: 2 tienen canal alfa **opaco**
   (el compresor ya los pasa a JPG, bien) y 3 no tienen canal. La transparencia real solo aparece en **2 WebP
   de 512 px que mandan clientes** (stickers). Hoy uno sale como PNG sin pérdida de **350 kB**; pasado a JPG
   sobre blanco pesa **24 kB (SSIM 0,989)** y con paleta PNG 95 kB (0,979). `comprimirConAlfa` solo prueba la
   paleta si el PNG sin pérdida engorda respecto al original, por eso no la usó.

### WebP y AVIF (solo referencia para la landing; WhatsApp no los acepta)

Suma de las 22 a 1920 px: **JPEG q85 3 736 kB (SSIM medio 0,987) · WebP q80 2 387 kB (0,966) · AVIF q50
1 329 kB (0,962)**. WebP ahorra un 36 % y AVIF un 64 %, pero con esa calidad 2 WebP y 4 AVIF bajan de 0,95. En la
landing AVIF daría la mitad de peso **si se sube su calidad** (no medido a q60+).

---

## 2 · Vídeos

H.264 `libx264` preset `medium`, **720p = lado corto 720** (sin agrandar), `yuv420p`, AAC 96 kb/s,
`+faststart`. Calidad: SSIM (luma) y VMAF de `ffmpeg`, **a la resolución de salida** (el original se reduce a
720p para comparar: mide lo que añade la compresión, no lo que se pierde al bajar de 1080 a 720).
Tiempo = codificación en este PC (12 hilos).

### 2.a · Los 4 de la muestra (chat, tope 10 MB)

| Archivo | Original | CRF 26 | CRF 28 | CRF 30 | CRF 28 sin audio | Tiempo |
| --- | --- | --- | --- | --- | --- | ---: |
| chat-saliente · mjzh6 · 720×1296 · 9 s · 2,7 Mb/s · sin audio | 3,0 MB | 2,7 MB · 0,981 / 98 | 2,2 MB · 0,976 / 96 | 1,8 MB · 0,970 / 92 | 2,2 MB | 3,5 s |
| entrantes · w0qfi · 720×1280 · 29 s · 2,8 Mb/s | 9,6 MB | 5,2 MB · 0,976 / 92 | 4,2 MB · 0,969 / 89 | 3,4 MB · 0,960 / 85 | 3,9 MB | 8 s |
| ventas · xxxvb · 480×848 · 60 s · 1,5 Mb/s · sin audio | **10,4 MB** | 4,6 MB · 0,981 / 91 | 3,6 MB · 0,977 / 88 | 2,9 MB · 0,971 / 84 | 3,6 MB | 11 s |
| ventas · 4s6j2 · 576×1024 · 10 s · 1,7 Mb/s | 1,9 MB | 1,5 MB · 0,979 / 96 | 1,3 MB · 0,973 / 92 | 1,1 MB · 0,965 / 87 | 1,2 MB | 2 s |

(celda = peso · SSIM / VMAF). Los 4 ya venían a ≤ 720p: son vídeos de WhatsApp, que Meta ya recomprime.
**Cumplen el tope de 10 MB los 4 a cualquier CRF**, con SSIM ≥ 0,96. El ahorro es moderado: 25,5 MB → 14,4 MB
a CRF 26 (−44 %). Quitar el audio ahorra un 8–10 % cuando lo hay.

### 2.b · Complemento: los 3 vídeos de landing en uso (tope 4 MB)

La muestra no traía ninguno de landing, así que se midieron los que sirven los embudos (`--rutas`):

| Vídeo | Original | CRF 26 | CRF 28 | CRF 30 | Tiempo |
| --- | --- | --- | --- | --- | ---: |
| `america-fc-copia/…njgwa` (pareja) · 1080×1920 · 17 s · 11 Mb/s | **23,0 MB** | **1,6 MB · 0,981 / 93** | 1,3 MB · 0,977 / 91 | 1,1 MB · 0,974 / 88 | 6 s |
| `spiderman-tend/…vecu4` · 1080×1920 · 14 s · 5,5 Mb/s | **9,3 MB** | 2,9 MB · **0,945** / 88 | 2,2 MB · 0,929 / 84 | 1,7 MB · 0,909 / 79 | 5 s |
| `formula-1/…pzdjz` (14 embudos) · 720×204 · 42 s | 2,7 MB | 3,0 MB (engorda) | 2,8 MB | 2,5 MB · 0,978 | 3 s |

- `njgwa`: **−93 %** a CRF 26 sin perder (antes se había medido −78 % a 1080p/CRF 23).
- `vecu4` tiene mucho movimiento: CRF 26 ya baja de 0,95. Probado aparte: **CRF 24 → 4,01 MB, SSIM 0,962**;
  CRF 22 → 5,4 MB, 0,971. Cabe en 4 MB con SSIM ≥ 0,95 **solo entre CRF 24 y 26**: un CRF fijo no sirve,
  hace falta bajar el CRF si el SSIM no llega (o limitar el bitrate).
- `pzdjz` ya está bien codificado: recomprimir lo engorda. Se queda como está (ya cumple).

**Tiempo:** 720p tarda entre **0,2 y 0,45 veces la duración** del vídeo en este PC (60 s → 11 s). En una
función de Vercel no hay `ffmpeg` y el cuerpo está limitado a ~4,5 MB; en el navegador (ffmpeg.wasm) será
bastante más lento — **no medido**.

---

## 3 · SVG y GIF

Consulta de solo lectura a `storage.objects` (proyecto `bjbjqmbuzpyjvcugbusx`, los 3 buckets): **0 SVG y
0 GIF**. En el repo tampoco hay ninguno versionado. **Hueco abierto:** el tope de 50 kB para SVG y la
conversión GIF → MP4 no se han podido medir con archivos reales. Hoy no entran por ningún camino conocido.

---

## 4 · Recomendación de topes definitivos

| Tipo | Tope | Escalones recomendados | Suelo |
| --- | ---: | --- | --- |
| Foto de producto / landing / catálogo / WhatsApp | **250 kB** | 1920/q85 → **1920/q80 → 1920/q75** → 1600/q75 → 1440/q75 | **1440 px** (no 1080) |
| Gráfico con texto o banner (PNG sin foto) | **400 kB** | q85 → q90 con croma 4:4:4 | 1440 px |
| Foto entrante (cliente) | **400 kB** | igual que foto; transparencia → JPG sobre blanco | 1080 px (no se rechaza) |
| PNG con transparencia real (logos) | **250 kB** | PNG con paleta si el sin pérdida pasa del tope | 1080 px |
| Vídeo de chat | **10 MB** | 720p CRF 26 (28 si no cabe) | 480p |
| Vídeo de landing | **4 MB** *y* ≤ 2 Mb/s | 720p CRF 26; si SSIM < 0,95, bajar a 24; si no mejora, dejar el original | 720p |
| SVG / GIF | 50 kB / → MP4 | sin medir | — |

Cambios de código que salen de aquí (para quien implemente A6, no aplicados):
quitar la regla del 10 % cuando el resultado sigue por encima del tope; añadir el escalón q75 antes de reducir
dimensiones; en transparencia real, probar la paleta siempre que el PNG pase del tope.

**Cumplimiento en la muestra con SSIM ≥ 0,95:** fotos 21/22 (95 %) con 250 kB; 22/22 con la excepción de
400 kB para gráficos. Vídeos 7/7 con CRF adaptable (6/7 con CRF 26 fijo). **En total, 28 de 29 archivos
(97 %)** con los topes tal como están propuestos, y 29/29 con la excepción de gráficos.

---

## 5 · Cuánto se ahorraría en el bucket actual

Contado el 30-09-2026 en `storage.objects` (solo lectura). **Sin contar `_originales/` (A1) ni los 18 vídeos
huérfanos (A2)**, que se borran, no se comprimen.

| Qué | Hoy por encima del tope | Tras aplicar el tope | Ahorro |
| --- | --- | ---: | ---: |
| Fotos (824 archivos > 250 kB; entrantes > 400 kB) | 718 MB | ~130–150 MB (165–185 kB de media) | **≈ −570 a −590 MB** |
| · de ellas chat saliente | 289 · 352 MB | ~50 MB | ≈ −300 MB |
| · de ellas bucket `catalogo-imagenes` ⚠️ | 199 · 203 MB | ~35 MB | ≈ −170 MB |
| · resto (`embudos`, `ventas`, `catalogo`, `packs`, `plantillas`…) | 336 · 163 MB | ~60 MB | ≈ −100 MB |
| Vídeos de landing en uso | 36,8 MB | ~9 MB | ≈ −28 MB |
| Vídeos de chat (`embudos/chat/`, ventas, entrantes, saliente) | ~252 MB | ~40–80 MB (**sin medir** esos 10) | ≈ −170 a −210 MB |
| **Total** | | | **≈ −770 a −830 MB** |

Con A1 (−1 010 MB) y A2 (−227 MB), el bucket pasaría de **2 502 MB a unos 450–500 MB**.

⚠️ **Hallazgo lateral:** las cifras de 3 651 archivos y 2 502 MB de `TABLERO-AGENTES.md` incluyen **dos buckets
más** que su tabla no desglosa: `catalogo-imagenes` (214 archivos, **204 MB, 975 kB de media**, 199 por encima
del tope) y `plantillas-images` (13, 12 MB). `chat-media` solo son 3 424 archivos y 2 286 MB. Antes de tocar
`catalogo-imagenes` hay que ver qué lo usa (observación 6 bis).

---

## 6 · Lo que no se pudo medir (huecos abiertos)

- **SVG y GIF:** no hay ninguno. El tope de 50 kB y el paso GIF → MP4 quedan sin datos.
- **Los 10 vídeos de `embudos/chat/`** (222,7 MB, historial de clientes): no se descargaron; el ahorro es una
  estimación por analogía con `njgwa` (1080p crudo). Recomprimirlos en su sitio toca conversaciones reales.
- **Revisión a ojo en móvil** de fotos de producto y capturas con texto: la LEY la pide y el SSIM no la
  sustituye.
- **Vercel / Linux:** nada de esto se ejecutó allí. Tampoco la velocidad de ffmpeg.wasm en un navegador.
- **Muestra pequeña:** 22 fotos y 7 vídeos. Los porcentajes tienen margen amplio; el patrón (la calidad baja el
  peso, el tamaño casi nunca) es lo robusto.

### Cómo relanzarlo

```bash
# ffmpeg solo en una carpeta de trabajo, nunca en el repo
cd <scratchpad>/medicion && npm init -y && npm i ffmpeg-static tsx
cd quinchat
FFMPEG_PATH=<scratchpad>/medicion/node_modules/ffmpeg-static/ffmpeg.exe \
  <scratchpad>/medicion/node_modules/.bin/tsx pruebas/medir-topes.ts --json salida.json
# otras rutas del bucket:  --rutas embudos/x/a.mp4,embudos/y/b.jpg   ·   sin vídeo: --sin-video
```

Dos pasadas seguidas dieron exactamente los mismos pesos (reproducible).
