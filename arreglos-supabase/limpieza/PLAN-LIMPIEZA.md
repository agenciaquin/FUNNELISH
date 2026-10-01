# PLAN DE LIMPIEZA · Aligerar lo que ya está guardado (A1–A5)

**Fecha:** 30-09-2026 · **Quién:** agente desarrollador · **Para:** dirección (aprueba cada paso por separado) y
agente de pruebas (verifica).
**Estado: SIMULACRO.** No se ha escrito, borrado ni sobrescrito **nada** en Supabase: ni Storage ni base. Todo lo que
sigue sale de bajar los archivos reales, comprimirlos en este PC y medirlos.
**Manda:** `TABLERO-AGENTES.md` (orden), `LEY-DE-PESO.md` §2 (topes) y `ESTRATEGIA-PESO.md` §4.2 (P20–P27).
**Revisado tras `VERIFICACION-PRUEBAS.md`** (30-09-2026): corregidos F1–F9, ver §13. Las cifras no cambian.

> ⚠️ **Windows no decide sobre Linux.** Todo se midió aquí (Windows, `sharp` 0.35 de la app, `ffmpeg` 6.1.1 de
> `ffmpeg-static`). Los scripts corren en el PC, no en Vercel, así que esta vez Windows **sí** es el destino de la
> compresión; lo que no prueba es cómo lo verá el cliente: eso es la revisión a ojo del §8.

---

## 0 · Resumen

| Tarea | Qué | Archivos | Antes → después | Recupera | SSIM mín. · medio | Necesita |
| --- | --- | ---: | ---: | ---: | --- | --- |
| **A2** | Vídeos huérfanos de `embudos/` | 18 | 226,8 MB → 0 | **−226,8 MB** | — (se borran) | Visto bueno + SQL del §1 el mismo día |
| **A3** | Chat saliente, en su sitio | 289 | 352,2 → 54,0 MB | **−298,2 MB** | 0,950 · 0,973 | Visto bueno + revisión a ojo |
| **A4** | Resto de imágenes, en su sitio | 435 | 335,1 → 92,1 MB | **−242,9 MB** | 0,950 · 0,968 | Visto bueno por zona |
| **A5** | Vídeos en uso por encima del tope | 3 (+9 de chat) | 42,7 → 9,5 MB (+213,9 → 29,9) | **−33,2 MB** (+184,0 con D5) | 0,951 · 0,971 (0,965 · 0,975) | Visto bueno; los 9 de chat, **D5** |
| **A1** | `_originales/` | 715 de 723 | 999,8 MB → 0 | **−999,8 MB** | — | Al final, tras A3/A4 verificados |

**Almacenamiento de quinchat: 2 502,4 MB hoy → 517,5 MB tras A1–A5** (701,5 MB si D5 no se aprueba). Detalle en el §9.

En MB de 1 048 576 bytes, como el resto de documentos. Medido el 30-09-2026 entre las 20:20 y las 21:00 (hora de
Colombia) sobre los **3 651 objetos** de los tres buckets (`chat-media` 2 286,3 MB, `catalogo-imagenes` 203,7 MB,
`plantillas-images` 12,3 MB).

---

## 1 · El cruce de referencias (se rehace en CADA ejecución)

Cada script, al arrancar, lee **todas las columnas de texto o JSON de todas las tablas** que expone la base (la lista
sale del esquema del propio servidor, no de una lista escrita a mano) y apunta cada nombre de archivo que aparezca.
Es la regla de la consulta de `HALLAZGO-videos.md` (el nombre base aparece en cualquier parte del texto), aplicada a
**30 de las 32 tablas** a la vez. Ignora mayúsculas y decodifica `%20`: ante la duda, un archivo cuenta como «en uso».

**Columnas que hoy nombran archivos de Storage** (`columnas-con-storage.csv`): `messages.content` (12 405 filas) y
`messages.reply_to`, `clientes_funnelish.foto_producto`, `carritos_abandonados.datos`, `catalogo_colores.url_imagen` y
`url_original`, siete columnas de `funnels`, `promociones.foto` y `fotos`, `configuracion.valor` y
`plantillas.imagen_url`. `media_optimizaciones` también, pero es el registro de la pasada de agosto y **no cuenta**
como uso. Ninguna columna, fuera de ese registro, contiene `_originales/`.

**Hueco: dos tablas que la clave `service_role` no puede leer** (permiso denegado): `catalogo_categorias` y
`catalogo_variables`. Son del módulo de catálogos de quin-comercial y el código de quinchat no las usa, pero el
tablero pide cruzar `catalogo_variables`. **Se cierra con `cruce-solo-lectura.sql`** (solo `SELECT`; lo ejecuta quien
tenga el editor SQL de Supabase): consulta 2 para esas dos tablas, consulta 1 para `information_schema` entero (otros
esquemas), consulta 3 para los 18 vídeos contra todas las columnas de todos los esquemas y consulta 4 para
`_originales/`. **A2 y A1 se niegan a ejecutar** mientras esas tablas no se den por revisadas con
`--tablas-revisadas <fichero>`: el **fichero con los resultados** de ese SQL, que tiene que tener menos de 24 h y
nombrar las dos tablas. Su sha256 y su fecha quedan en el registro de ejecuciones.

El cruce decodifica `%XX` trozo a trozo (un «50% OFF» en la misma celda ya no esconde una ruta escrita con `%2F`),
pagina cada tabla ordenada por su clave primaria y, en A2, comprueba además la **ruta completa** de cada vídeo.

---

## 2 · A2 · Vídeos huérfanos

Cruce de hoy: **exactamente los 18 de `HALLAZGO-videos.md`, 226,8 MB.** Lista con peso en `a2-videos.csv`.

| | Archivos | MB | Qué se hace |
| --- | ---: | ---: | --- |
| Huérfanos de `embudos/` (ninguna tabla los nombra) | **18** | **226,8** | Se **mueven** a `_borrar/` y, 14 días después, se purgan |
| `embudos/chat/` (en `messages`) | 10 | 222,7 | **No se tocan** (historial de clientes) |
| En uso por un embudo | 4 | 36,8 | A5 |
| Vídeos de chat en `57…/`, `entrantes/`, `ventas/` | 6 | 28,9 | Todos en uso por `messages`. No se tocan |

Los tres más grandes: `america tk/…qgyzc.mp4` y `america-fc/…4rk49.mp4` (37,7 MB cada uno) y
`spiderman-tend-copia/…vguxt.mp4` (21,1 MB).

**Por qué mover y no borrar:** un anuncio de Meta, un mensaje ya enviado o un enlace pegado a mano pueden apuntar a
la URL sin dejar rastro en la base (`HALLAZGO-nadie-borra-del-bucket.md`, suposición B). En `_borrar/` el archivo
deja de servirse (si alguien lo echa de menos, aparece como 404 en los registros) y volver es un `move` de vuelta.
El ahorro llega al purgar.

**Riesgos.** Un enlace externo deja de funcionar (mitigado por los 14 días). El cruce es por nombre de archivo, no por
ruta: es conservador (si el nombre aparece en cualquier sitio, el vídeo se queda).

---

## 3 · A3 y A4 · Imágenes recomprimidas en su sitio

**Mismo nombre y mismo bucket: ninguna URL de ninguna tabla cambia.** Simulacro completo: se bajaron **las 746
candidatas** (todas las que pasan de su tope), se comprimieron con el compresor real por escalones
(`lib/optimizar-imagen-servidor.ts` de la rama `agente/P2-P4-ley-peso`, `b772e9d`, **importado, no copiado**) y se
midió el SSIM de cada una contra su fuente (escala de grises a 1290 px, la misma fórmula que `MEDICION-TOPES.md`).

- **Si existe `_originales/<ruta>`, se comprime desde el original** y el SSIM se mide contra él (142 casos). Así no hay
  segunda pasada con pérdida.
- **Tipo por zona** (LEY §2): chat saliente, `packs/`, `catalogo/` (marcas de agua), plantillas,
  `catalogo-imagenes` y `embudos/chat/` → foto de WhatsApp, 250 kB · `embudos/` → foto web, 250 kB ·
  `entrantes/` y `ventas/` (lo que manda el cliente, también en la línea de ventas) → foto entrante, 400 kB.
- **Rescate (hallazgo 1, §10):** el compresor no mide el SSIM. Con fotos grandes y muy detalladas, el escalón que
  cabe en 250 kB ya baja de 0,95 (medido: 3 264 px, 1600/q75 → 233 kB y **0,93**). Cuando pasa eso, el script prueba
  los mismos escalones de `lib/ley-peso.ts` (incluidos los de gráfico con texto, q90 y croma 4:4:4) y se queda con el
  **más ligero que conserve SSIM ≥ 0,95**, aunque pase del tope. La LEY manda calidad antes que tope (§1, puntos 2 y 4).
  Afecta a 90 de las 724.

### 3.1 · A3 · Chat saliente (`57…/`)

| Archivos | Antes | Después | Recupera | SSIM mín. · medio | No caben en 250 kB | PNG → JPEG | Huérfanas |
| ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| **289** | 352,2 MB | 54,0 MB | **−298,2 MB (−85 %)** | 0,950 · 0,973 | 47 (se quedan en 251–453 kB) | 153 | 8 (8,6 MB) |

Cumple la cifra del tablero (≈ −250 MB) con margen. **Hay archivos repetidos:** la misma foto de 3,7 MB se envió 6
veces a clientes distintos, cada una con su copia (anotado en el §10).

### 3.2 · A4 · El resto, por zona (`a34-resumen.csv`)

| Zona | Archivos | Antes → después | Recupera | SSIM mín. · medio | Desde `_originales/` | No caben | Huérfanas (MB que recuperan) | Excluidas |
| --- | ---: | ---: | ---: | --- | ---: | ---: | --- | --- |
| `catalogo-imagenes` (bucket) | 199 | 202,5 → 38,8 | **−163,7** | 0,950 · 0,969 | 0 | 3 | 25 (24,1) | — |
| `embudos/` | 111 | 52,4 → 25,6 | −26,8 | 0,950 · 0,964 | 84 | 22 | 59 (16,2) | 17 (4,9 MB): no ahorran |
| `catalogo/` (marcas de agua) | 56 | 30,0 → 11,7 | −18,3 | 0,950 · 0,966 | 43 | 0 | 8 (4,0) | — |
| `packs/` (collages, V3) | 20 | 21,9 → 3,7 | −18,2 | 0,966 · 0,974 | 0 | 0 | 0 | — |
| `plantillas-images` (bucket) | 13 | 12,3 → 2,8 | −9,6 | 0,953 · 0,967 | 0 | 0 | 12 (9,0) | — |
| `ventas/` | 20 | 9,2 → 6,2 | −3,0 | 0,956 · 0,984 | 0 | 0 | 4 (0,5) | 1: sticker animado |
| `embudos/chat/` (imágenes) | 15 | 5,7 → 3,1 | −2,5 | 0,961 · 0,967 | 15 | 0 | 0 | — |
| `plantillas/` | 1 | 1,1 → 0,2 | −0,9 | 0,973 | 0 | 0 | 0 | — |
| `entrantes/` | 0 | — | 0 | — | 0 | — | — | 4: stickers animados |
| **Total A4** | **435** | **335,1 → 92,1** | **−242,9 MB** | **0,950 · 0,968** | 142 | 25 | 108 (53,9) | 22 |

**`catalogo-imagenes`, qué lo usa** (lo pedía el tablero antes de tocarlo): lo escribe `app/api/catalogos/upload-imagen`
(igual en `master`, v174 e `integracion`) y lo leen `catalogo_colores.url_imagen` / `url_original` (191 filas) y
`promociones`: son las fotos que el bot manda por WhatsApp. 189 de 214 están en uso. Con 975 kB de media era el peor
bucket; el bucket entero queda en unos 190 kB de media. **Ojo:** puede que quin-comercial enlace también a este bucket desde su propia
base, a la que no tenemos acceso. Recomprimir en su sitio no rompe esos enlaces; borrar sí (por eso aquí no se borra).

**Las huérfanas también se recomprimen** (116 en total, −62,5 MB). Recomprimir con el mismo nombre no rompe ni los
enlaces de fuera de la base; borrarlas es otra decisión, con su cruce (A7). Muchas son banners de `remarketing/` y
`promociones/`, que van a campañas de WhatsApp y **pueden estar enlazadas desde fuera de la base**.

---

## 4 · A5 · Vídeos en uso

Solo vídeos que nombra alguna tabla (20); 12 pasan del tope. H.264 a 720 px de lado corto, `+faststart`, AAC 96 kb/s
si hay audio (la landing tiene botón de sonido y WhatsApp exige AAC). SSIM con `ffmpeg -lavfi ssim` a la resolución de
salida, como `MEDICION-TOPES.md` §2.

| Vídeo | Uso | Hoy | Nuevo | SSIM | Escalón | Mb/s |
| --- | --- | ---: | ---: | --- | --- | --- |
| `america-fc-copia/…njgwa` (`pareja`, `pareja-tk`) | landing | 23,0 MB | **1,6 MB** | 0,980 | CRF 26 ≤ 1,8M | 11,1 → 0,76 |
| `spiderman-tend/…vecu4` | landing | 9,3 MB | **3,3 MB** | **0,951** | 2 pasadas 1,9M | 5,5 → 1,97 |
| `ventas/57…/…xxxvb` | chat | 10,4 MB | 4,6 MB | 0,981 | CRF 26 | 1,5 → 0,65 |
| **Subtotal (sin D5)** | | **42,7 MB** | **9,5 MB** | **0,951 · 0,971** | | |
| 9 vídeos de `embudos/chat/` (45,1 · 44,1 · 36,6 · 30,6 · 16,3 · 10,9 · 3 × 10,1 MB) | chat (historial) | **213,9 MB** | **29,9 MB** | 0,965 · 0,975 | CRF 26 | |

**`vecu4` va raspando:** con el techo de 2 Mb/s el CRF no llega (CRF 26/24/22 → 0,939/0,945/0,946); solo con dos
pasadas a 1,9 Mb/s pasa, con 0,9505. Alternativa para dirección: dejarlo fuera del techo de 2 Mb/s (CRF 24 sin
techo: 4,0 MB, 0,962, `MEDICION-TOPES.md`). **Hay que verlo en un móvil** antes de dar la fase 2.
Los otros dos vídeos de landing (`pzdjz`, que comparten 14 embudos, y `1dy1k`) ya cumplen: no se tocan.

**D5 (`ESTRATEGIA-PESO.md` §7):** los 9 de `embudos/chat/` son conversaciones de clientes. El script los mide pero
`--ejecutar` **los salta sin `--d5`**. Es el 85 % del ahorro de A5.

---

## 5 · A1 · `_originales/` (solo la lista y la condición)

| Condición | Archivos | MB | Cuándo se borra |
| --- | ---: | ---: | --- |
| El vivo no se recomprime desde aquí | 573 | 657,0 | Al final. Antes de borrar cada uno, el script mide el SSIM del vivo frente al original y **se queda si baja de 0,95** |
| Fuente de A3/A4 (142 de `embudos/`, `catalogo/` y `embudos/chat/`) | 142 | 342,9 | Después de que A3/A4 los sustituya y pase la revisión (el script comprueba que el vivo ya cambió) |
| **CONSERVAR:** el vivo ya está bajo SSIM 0,95 (hallazgo 2, §10) | 8 | 10,3 | No se borra hasta que dirección decida si se recuperan |
| El vivo ya no existe | 0 | 0 | — |
| **Total** | **723** | **1 010,1** | Recuperables: **715 · 999,8 MB** |

Por zona: `embudos/` 338 (443,3 MB) · `catalogo/` 293 (373,0 MB) · `packs/` 77 (118,5 MB, las copias de collages
`__v2`/`__v3` de V3) · `embudos/chat/` 15 (75,4 MB). Lista en `a1-originales.csv`.

**Antes de borrar:** `--bajar-copia` baja el giga a disco (lectura) y comprueba el peso de cada copia;
`cruce-solo-lectura.sql` consulta 4 da 0 filas; `--ejecutar --a34-hecho` se niega si falta cualquiera de las dos cosas.

---

## 6 · Excluidos y por qué

| Qué | Archivos | MB | Motivo |
| --- | ---: | ---: | --- |
| `embudos/` que no ahorran | 17 | 4,9 | Desde su original, lo más ligero con SSIM ≥ 0,95 pesa **igual o más** que lo que hay (9 de ellos ya están en el límite, 0,952–0,958; los otros 8 están por debajo: hallazgo 2) |
| Stickers animados (`entrantes/`, `ventas/`) | 5 | 2,4 | WebP de 71–88 fotogramas: el compresor los aplanaría |
| Vídeos de `embudos/chat/` en A2 | 10 | 222,7 | Historial de clientes: nunca se borran |
| Vídeos de landing que ya cumplen | 2 | 4,6 | `pzdjz` (14 embudos) y `1dy1k` |
| Imágenes con SSIM < 0,95 o que fallan | 0 | 0 | El rescate encontró un escalón válido para todas las demás |

---

## 7 · Caché: cómo sobrescribir sin que un cliente vea algo roto

**Lo que hay hoy** (cabecera real de cada archivo bajado):

| | Imágenes de A3/A4 (724) | Vídeos de A5 |
| --- | --- | --- |
| `max-age=3600` (1 hora) | 581: todo el chat saliente, `catalogo-imagenes`, `packs`, `ventas`, `plantillas*`, parte de `embudos` | Los 12 |
| `max-age=31536000` (1 año) | 143 de A4: lo que tocó la pasada de agosto (`embudos/`, `catalogo/`, `embudos/chat/`) | — |

**La CDN de Supabase no es el problema.** Sirve con `Age` mayor que `max-age` (medido: `Age: 6615` con
`max-age=3600`), que es el comportamiento de su CDN «inteligente»: guarda el archivo hasta que cambia y lo invalida al
sobrescribirlo. **No verificado con una escritura** (esto es un simulacro); se comprueba con el primer archivo de la
fase 1 (§8, paso 2).

**Un navegador nunca ve una imagen rota por esto.** O tiene la versión vieja en caché (que es una imagen válida, solo
más pesada) o pide la nueva (válida). Lo mismo WhatsApp: lo ya enviado está en los servidores de Meta.

**El riesgo real es el contrario:** si una versión recomprimida saliera mal y se subiera con **1 año** de caché, el
móvil del cliente se la quedaría un año **aunque se restaurara el original**. Por eso los scripts suben en dos fases:

1. **Fase 1** (`--ejecutar`): versión nueva con **1 día** de caché.
2. Revisión a ojo en un móvil (§8) y 7 días mirando los registros.
3. **Fase 2** (`--ejecutar --fijar-cache`): los **mismos bytes** otra vez con el año de la LEY.

La fase 1 solo sube si en Storage sigue el original medido; la fase 2, solo si está la versión de la fase 1. Lo que ya
está en fase 1 no vuelve a entrar en fase 1, y relanzar el simulacro no vuelve a medir lo ya medido (nunca hay una
segunda compresión). `restaurar.ts` devuelve los bytes, el `Content-Type` y el `cacheControl` **originales**; con
`--cache-corta` pone 1 día.

Si algo sale mal entre las dos, `restaurar.ts` lo deshace y como mucho un día después ningún cliente lo ve. Los 143
archivos que hoy tienen 1 año siguen enseñando la versión vieja a quien ya la tenía: es lo que queremos.

**Vídeos:** el navegador los pide por trozos (`Range`). Si el archivo cambia entre dos trozos, un vídeo a medio ver se
corta. Se sustituyen **de madrugada** (2:00–5:00, hora de Colombia).

---

## 8 · Orden de ejecución propuesto y marcha atrás

Cada paso necesita el **visto bueno de dirección, por escrito, para ese paso**. Antes de cualquiera: el SQL del §1 (lo
ejecuta quien tenga el editor SQL y guarda sus resultados en un fichero, p. ej. `resultados-sql.txt`) y **mover la
carpeta de copias a un disco que no sea temporal** y usarla con `--copias <nueva carpeta>` (el scratchpad de esta
sesión se puede borrar solo). Las copias, `resultados/` y `salida/` guardan rutas **relativas** a `--copias`, así que
la carpeta se puede mover entera. Los scripts vuelven a cruzar al arrancar, comprueban el sha256 de cada archivo
justo antes de escribirlo (si cambió desde el simulacro, lo saltan y lo dicen) y, después de escribir, vuelven a
leerlo para confirmar que quedó lo esperado. Cada escritura queda en `<copias>/resultados/ejecuciones.jsonl`, que
solo crece: es lo que permite deshacer lo borrado.

El tablero pide **primero el grifo (A6/P19, tras Z7)**. Si Z7 tarda, esto se puede hacer igual y repetir después una
pasada corta (los scripts son relanzables: solo miden lo que pasa del tope).

| # | Paso | Comando (desde la raíz del repo, `tsx` del scratchpad o `npx tsx`) | Comprobación | Marcha atrás |
| --- | --- | --- | --- | --- |
| 0 | Simulacro del día (vuelve a cruzar; mide solo lo NUEVO, lo ya medido no se rehace) | `a2-…ts`, `a34-…ts`, `a5-…ts`, `a1-…ts` sin `--ejecutar` | Mismas cifras que aquí ± lo nuevo; ningún «AVISO cambio-fuera» | — |
| 1 | **A2** mover los 18 a `_borrar/` | `a2-videos-huerfanos.ts --ejecutar --tablas-revisadas resultados-sql.txt` | 404 en las 18 URLs; los 14 embudos de `pzdjz` y `pareja` siguen con vídeo | `restaurar.ts --tarea a2 --ejecutar` |
| 2 | **A3/A4 prueba:** una zona pequeña, `plantillas` (1 archivo) | `a34-…ts --ejecutar --zona plantillas` | La URL pública devuelve el nuevo `ETag` y el nuevo peso al momento (CDN invalidada) | `restaurar.ts --tarea a34 --zona plantillas --ejecutar` |
| 3 | **A5 sin D5** (3 vídeos), de madrugada | `a5-…ts --ejecutar` | Se ven y suenan en `pareja`, `pareja-tk`, `spiderman-tend` en un móvil | `restaurar.ts --tarea a5 --ejecutar` |
| 4 | **A3** chat saliente (289) | `a34-…ts --ejecutar --zona chat-saliente` | Revisión a ojo: las 21 con SSIM < 0,955 y 3 capturas con texto pequeño; abrir 5 conversaciones en el panel | `restaurar.ts --tarea a34 --zona chat-saliente --ejecutar` |
| 5 | **A4** zona a zona: `packs`, `ventas`, `embudos/chat`, `catalogo`, `plantillas-images`, `embudos`, `catalogo-imagenes` | `a34-…ts --ejecutar --zona <zona>` | `validar-landings.ts` y `validar-whatsapp.ts` (media-api) en verde; 3 fotos de producto vistas en móvil por zona | `restaurar.ts --tarea a34 --zona <zona> --ejecutar` |
| 6 | **Fase 2** de 2–5, a los 7 días sin incidencias | lo mismo con `--fijar-cache` | `cacheControl` = 31536000 en `storage.objects` (consulta 5 del SQL) | `restaurar.ts` (sube el original con su caché original; `--cache-corta` para 1 día) |
| 7 | **A5 D5** (9 vídeos de chat), solo si dirección aprueba D5 | `a5-…ts --ejecutar --d5` | Las 9 conversaciones reproducen el vídeo en el panel | `restaurar.ts --tarea a5 --ejecutar` |
| 8 | **Purga de `_borrar/`** (A2), 14 días después del paso 1 sin 404 que importen | `a2-…ts --ejecutar --purgar --tablas-revisadas resultados-sql.txt` (el script no borra nada que lleve menos de 14 días, según el registro) | `_borrar/` vacío | `restaurar.ts --tarea a2 --ejecutar` (recrea desde la copia local) |
| 9 | **A1**, al final (≥ 7 días tras la fase 2) | `a1-originales.ts --bajar-copia` y luego `--ejecutar --a34-hecho --tablas-revisadas resultados-sql.txt` | Copia verificada; consulta 4 del SQL = 0; quedan los 8 a conservar | `restaurar.ts --tarea a1 --ejecutar` (desde la copia local) |

---

## 9 · Total

| | MB |
| --- | ---: |
| Hoy (3 651 objetos) | **2 502,4** |
| A1 `_originales/` (715) | −999,8 |
| A2 vídeos huérfanos (18) | −226,8 |
| A3 chat saliente (289) | −298,2 |
| A4 resto de imágenes (435) | −242,9 |
| A5 vídeos en uso sin D5 (3) | −33,2 |
| **Tras A1–A5, sin D5** | **701,5** |
| A5 vídeos de chat con D5 (9) | −184,0 |
| **Tras A1–A5, con D5** | **517,5 MB (−79 %)** |

Coincide con la estimación de la LEY (450–500 MB) salvo por lo que se queda por calidad: las 72 imágenes que no caben
sin bajar de SSIM 0,95 (342 kB de media), los 8 originales a conservar y los 17 de `embudos/` que no ahorran.
**Coste del simulacro en egress:** unos 1,6 GB bajados (candidatas, originales y vídeos), dentro del cupo.

---

## 10 · Hallazgos para otras tareas (no se arreglan aquí)

1. **El compresor por escalones puede bajar de SSIM 0,95 sin saberlo** (para P4/P15). En fotos de 3 264 px el primer
   escalón que cabe (1600/q75, 233 kB) da 0,93; 1440/q75 da 0,916. En el charco, 90 de 724 necesitaron el rescate.
   `MEDICION-TOPES.md` no lo vio porque 18 de sus 22 fotos medían ≤ 1600 px. Propuesta: en fotos de más de 2 000 px,
   no bajar de 1920 sin una comprobación, o aceptar que pasen del tope con alerta.
2. **8 fotos de `embudos/` ya están hoy por debajo de SSIM 0,95** frente a su original (0,933–0,948: `MOTEROS`,
   `FORMULA 1`, `formula-1`), por la pasada de agosto. Recuperarlas exige subir su peso (~430–500 kB, q90 4:4:4).
   Decisión de dirección; mientras, sus originales no se borran.
3. **Fotos duplicadas en el chat saliente:** la misma foto de 3,7 MB está guardada 6 veces. Tras A3 son 6 × 336 kB.
   Un nombre por contenido (hash) en `send-media` lo evitaría (va con A6).
4. **116 imágenes huérfanas por encima del tope** (62,5 MB tras recomprimir), sobre todo `embudos/remarketing/`,
   `embudos/promociones/` y 12 de los 13 archivos de `plantillas-images`. Candidatas a A7, con el cruce de ese día.
5. **`catalogo_categorias` y `catalogo_variables` no se pueden leer con `service_role`** en la base de quinchat.
   Si quinchat no las usa, sobran ahí (U1/D5 de `PLAN-UNA-SOLA-APP.md`).

---

## 11 · Lo que no se pudo comprobar

- **Las dos tablas ilegibles** y otros esquemas: sin el SQL del §1 el cruce es de 30 de 32 tablas.
- **Enlaces de fuera de la base** (anuncios, campañas ya enviadas): no se pueden ver. Por eso A2 mueve antes de borrar
  y A3/A4 no cambian nombres.
- **La CDN invalidando al sobrescribir:** deducido de las cabeceras; se confirma en el paso 2.
- **Revisión a ojo en móvil:** pendiente para todas las zonas; el SSIM no la sustituye (LEY §1 punto 2).
- **PNG que pasan a JPEG con el nombre `.png`** (166): el `Content-Type` sí cambia, y la pasada de agosto ya lo hizo
  así en `embudos/` sin problemas conocidos, pero no se ha probado un envío por WhatsApp de uno de ellos después.
- **quin-comercial:** su base es otra cuenta; si enlaza a estos buckets, no lo vemos.
- **Recrear un objeto borrado en el Supabase real:** la marcha atrás de A1 y de la purga de A2 usa `POST` (crear,
  sin `x-upsert`), que es como sube `supabase-js`; probado solo contra el Supabase falso. Prueba más barata cuando
  toque: restaurar el primer vídeo purgado y abrir su URL.

---

## 12 · Archivos de esta carpeta

| Archivo | Qué es |
| --- | --- |
| `comun.ts` | Credenciales (las de `media-api/.env`, solo lectura por defecto), listado, cruce, descargas, SSIM, la **única** puerta de escritura (`escribirStorage`, que exige `--ejecutar` y una copia local con su sha256) |
| `inventario.ts` | Inventario por zona y columnas con URLs (nunca escribe) |
| `a2-videos-huerfanos.ts` · `a34-recomprimir-imagenes.ts` · `a5-recomprimir-videos.ts` · `a1-originales.ts` | Una tarea cada uno; simulacro por defecto |
| `restaurar.ts` | Marcha atrás de cualquiera de las cuatro |
| `cruce-solo-lectura.sql` | Lo que el cruce por la API no alcanza (solo `SELECT`) |
| `a2-videos.csv`, `a34-imagenes.csv`, `a34-resumen.csv`, `a5-videos.csv`, `a1-originales.csv`, `*-resumen.json`, `inventario-zonas.csv`, `columnas-con-storage.csv`, `tablas-ilegibles.csv` | Listas del simulacro de hoy |

**Las listas del repo llevan el teléfono del cliente enmascarado** (`57320·····03/`): las carpetas del chat se llaman
como el número. La lista completa y las copias bajadas están **fuera del repo**, junto a las copias
(`<copias>/listas/`, `<copias>/resultados/`, `<copias>/salida/` con cada versión medida). Hoy:
`…\scratchpad\limpieza\copias` (1,6 GB).

**Cómo relanzarlo:**

```bash
# tsx y ffmpeg-static viven fuera del repo (scratchpad/medicion); el compresor, en el worktree de agente/P2-P4-ley-peso
TSX=<scratchpad>/medicion/node_modules/.bin/tsx
$TSX arreglos-supabase/limpieza/a34-recomprimir-imagenes.ts --copias <carpeta fuera del repo> \
     [--compresor <worktree>/quinchat] [--zona chat-saliente] [--limite 20]
$TSX arreglos-supabase/limpieza/a5-recomprimir-videos.ts --copias <…> [--ffmpeg <ruta a ffmpeg>]
```

---

## 13 · Correcciones tras la verificación del agente de pruebas (`VERIFICACION-PRUEBAS.md`)

| Fallo | Qué pasaba | Qué hace ahora |
| --- | --- | --- |
| **F1** | Relanzar el simulacro tras la fase 1 volvía a medir desde lo ya comprimido (SSIM 0,917) y una nueva fase 1 lo subía; la fase 2 se saltaba sin avisar | `a34.jsonl` guarda **una medición por archivo, la primera, sobre su original**, y nunca se rehace ni se pisa su `salida/`. La fase 1 solo sube si en Storage está el original medido («ya en fase 1» si no); la fase 2, solo si está la versión de la fase 1. Todo lo saltado se dice |
| **F2** | Relanzar A5 reescribía `a5.json` sin los vídeos ya sustituidos: la fase 2 y la marcha atrás no hacían nada | `a5.json` es un registro que solo crece (unión de lo que había y lo nuevo) |
| **F3** | `restaurar --tarea a1` no veía lo borrado; la restauración tras purgar A2 era un comentario; `PUT` no crea | Cada escritura queda en `resultados/ejecuciones.jsonl` (solo crece) con la ruta relativa y el sha256 de su copia. `restaurar` lee de ahí (y de las copias en disco) y recrea con `POST` lo que ya no existe |
| **F4** | Las rutas de las copias eran absolutas: mover la carpeta rompía la ejecución y la marcha atrás | La ruta de cada copia se deduce de dónde está su `.meta.json`; `salida/` y el registro usan rutas relativas a `--copias` |
| **F5** | A1 borraba aunque faltaran tablas por revisar | A1 exige la misma prueba del SQL que A2 |
| **F6** | Un `%` suelto anulaba la decodificación de la celda; `messages` se paginaba sin orden; `--tablas-revisadas` era un texto | Decodificación por trozos, orden por clave primaria y segunda comprobación por ruta en A2. `--tablas-revisadas` recibe el **fichero** de resultados del SQL (< 24 h, nombra las tablas; sha256 al registro) |
| **F7** | `restaurar` ponía siempre 1 día de caché y deducía el `Content-Type` | Devuelve el `cacheControl` y el `Content-Type` originales (de la copia); `--cache-corta` es opcional |
| **F8** | A5 fallaba si no existía `resultados/` | Se crea siempre |
| **F9** | Comentarios que prometían lo que el código no hacía | Implementado: comprobación **después** de cada escritura (vuelve a leer y compara), segunda comprobación por ruta en A2, nuevo cruce en A5 con `--ejecutar` (salta lo que ya no está en uso), la purga comprueba los 14 días en el código y no vuelve a bajar los vídeos; al negarse, el proceso sale con código 1 |

**Pruebas del agente de pruebas, relanzadas contra el Supabase falso** (`…\scratchpad\pruebas-limpieza\`):

| Prueba | Antes | Ahora |
| --- | ---: | ---: |
| `segunda-pasada.mjs` (F1) | 10/14 | **14/14** |
| `a5-relanzar.mjs` (F2) | 9/12 | **12/12** |
| `simulacro-falso.mjs` (original, sin tocar) | 94/105 | **102/105**: los 3 que fallan pasan `--tablas-revisadas catalogo_variables`, que ahora se rechaza a propósito (F6) |
| `simulacro-falso-v2.mjs` (= la original con el fichero del SQL, `POST` en el falso y 16 casos nuevos: A1 borra y se restaura, purga a los 14 días y restauración tras purgar, prueba SQL caducada, código de salida) | — | **121/121** |
| `recomprimir-muestra.ts` | 254/255 | 254/255 (sin cambios: la que queda es la medida informativa con ffmpeg, 0,9495) |
| `transparencia.ts` | 166/166 | 166/166 |

La v2 se genera con `parchear-v2.cjs` a partir de la original, que no se toca.
