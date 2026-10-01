# VERIFICACIÓN · Simulacro de limpieza A1–A5

**Fecha:** 30-09-2026 · **Quién:** agente de pruebas · **Para:** dirección y agente desarrollador
**Qué se revisó:** `PLAN-LIMPIEZA.md`, los 7 scripts, `cruce-solo-lectura.sql`, los CSV y las copias bajadas.

**Lo que no se tocó:** Supabase real. No se lanzó ningún script contra producción, ni en simulacro: escriben sus CSV
en esta carpeta del repo. Todo lo que tiene `--ejecutar` se probó contra un **Supabase FALSO** en `127.0.0.1`.

## Veredicto por paso

| # | Paso | Veredicto | Qué falta |
| --- | --- | --- | --- |
| 1 | **A2**: mover los 18 a `_borrar/` | **LISTO PARA EJECUTAR**, con una condición | Las consultas 1–3 de `cruce-solo-lectura.sql` tienen que dar 0 filas **ese mismo día**. Tapan los dos huecos del cruce por API (F6) |
| 8 | A2: purgar `_borrar/` | **NO LISTO** | Si se purga, no hay forma de deshacerlo (F3) |
| 2 | Prueba con `plantillas` (1 archivo) | **NO LISTO** | F4: si las copias se mueven como pide el PLAN §8, ya no se puede restaurar. Se arregla rehaciendo el simulacro directamente con `--copias <disco definitivo>` o guardando rutas relativas |
| 3 | **A5 sin D5** | **NO LISTO** | F2: relanzar el simulacro borra la marcha atrás. También F4 y F8 |
| 4 | **A3** (chat saliente) | **NO LISTO** | F1: segunda compresión con pérdida en 58 archivos. También F4 |
| 5 | **A4** (por zonas) | **NO LISTO** | F1 (8 de `catalogo-imagenes`) y F4 |
| 6 | **Caché** en dos fases | **NO LISTO** | El mecanismo funciona (probado), pero F1 y F2 hacen que la fase 2 se salte sin avisar |
| 9 | **A1** | **NO LISTO** | F3: `restaurar --tarea a1` no recupera nada. F5: no se niega a borrar aunque falten tablas por revisar |

---

## 1 · Qué se probó (comandos y resultado)

Todo desde `…\scratchpad\pruebas-limpieza\`, con `TSX=…\scratchpad\medicion\node_modules\.bin\tsx`.

| Prueba | Comando | Resultado |
| --- | --- | --- |
| Ejecutar → restaurar contra el Supabase falso (pruebas 1, 2, 3 y 6) | `node simulacro-falso.mjs` | **94/105 ok** |
| Simulacro relanzado después de la fase 1 de A3/A4 | `node segunda-pasada.mjs` | **10/14 ok** |
| Simulacro relanzado después de la fase 1 de A5 | `node a5-relanzar.mjs` | **9/12 ok** |
| SSIM de la doble compresión frente al original | `$TSX ssim-2p.ts` | **0,9171 (FALLA, por debajo de 0,95)** |
| 38 imágenes recomprimidas con el compresor real (`wt-peso`, `b772e9d`) | `$TSX recomprimir-muestra.ts` | **254/255 ok** |
| Transparencia y Content-Type de las 746 candidatas | `$TSX transparencia.ts` | **166/166 ok** |
| JPEG con nombre `.png` en un navegador real | `node navegador.mjs <salida>.png` | Chrome **1/1 ok** · Edge sin cabeza no devuelve nada (problema del entorno) |

**Cómo es el Supabase falso.** Un servidor `http` que imita PostgREST (esquema OpenAPI, tablas paginadas y
`catalogo_variables` con 403), la RPC `listar_objetos_storage` y Storage (GET autenticado, PUT, `move` y DELETE).
Guarda bytes, `Content-Type` y `cacheControl` de cada objeto.

Los scripts que se lanzan son **los del repo, copiados byte a byte** a `repo-falso/`. La prueba comprueba los 7
sha256 antes de empezar. Hace falta copiarlos por dos razones:

1. Los scripts escriben sus CSV junto a sí mismos, y en el repo no se puede escribir.
2. En `repo-falso/` no existe `media-api/.env`, así que los scripts no pueden leer la clave real aunque fallara la
   variable de entorno.

Además, cada proceso hijo carga `guardia.mjs`, que corta cualquier `fetch` que no vaya a `127.0.0.1`. Las imágenes
del almacenamiento falso son copias reales ya bajadas y no salen de este PC. Al terminar se borraron las copias que
generó la prueba.

---

## 2 · Fallos

### F1 · CRÍTICO · A3/A4: relanzar el simulacro después de la fase 1 recomprime lo ya comprimido

El PLAN §8 pide un «simulacro del día» antes de cada paso. Pero las imágenes que, ya recomprimidas, siguen por encima
de su tope vuelven a ser candidatas, y pasa esto:

- se miden **otra vez, partiendo de la versión ya comprimida**;
- su `salida/` se sobrescribe;
- una nueva `--ejecutar` sube esa **segunda** compresión.

**Reproducido** (`segunda-pasada.mjs`, con la foto real de 3,7 MB repetida 6 veces):

| | Peso | SSIM frente al original |
| --- | ---: | ---: |
| Foto original | 3 812 129 B | — |
| Fase 1 | 343 987 B | 0,956 |
| Simulacro relanzado + nueva fase 1 | 227 907 B | **0,917** (medido con `ssimImagen` de `comun.ts`) |

Además, `--fijar-cache` deja de subir esa imagen sin avisar: compara con la `salida/` sobrescrita, no con lo que hay
en Storage.

- `a34-recomprimir-imagenes.ts:161-166`: elige las candidatas solo por peso, sin excluir las que ya sustituyó.
- `:75`: la única fuente «original» que reconoce es `_originales/`; la copia previa que hay en `COPIAS` no cuenta.
- `:144`: `salida/<ruta>` se pisa.
- `:268`: la fase 1 acepta el `sha256_hoy` de la medida nueva.

**Alcance real:** 89 de las 724 imágenes quedan por encima del tope después de la fase 1. De ellas, **66 no tienen
`_originales/`** (58 del chat saliente y 8 de `catalogo-imagenes`): esas recibirían la segunda compresión. Las 23 de
`embudos/` se volverían a comprimir desde `_originales/` y saldrían con los mismos bytes.

`restaurar` sí devuelve el original aunque haya dos medidas (probado).

### F2 · CRÍTICO · A5: relanzar el simulacro borra la marcha atrás

`a5-recomprimir-videos.ts:151` **sobrescribe** `resultados/a5.json` y solo guarda lo que **hoy** pasa del tope. Un
vídeo ya sustituido cumple el tope, así que sale de la lista. Tanto `--fijar-cache` (`:163-165`) como
`restaurar --tarea a5` (`restaurar.ts:210`) leen esa lista.

**Reproducido** (`a5-relanzar.mjs`): fase 1, luego el simulacro relanzado, y `a5.json` queda con 0 vídeos. La fase 2
no sube nada y `restaurar --tarea a5 --ejecutar` hace **0 escrituras**: el vídeo comprimido se queda.

### F3 · CRÍTICO · `restaurar --tarea a1` no recupera nada; la purga de A2 no tiene marcha atrás

- `restaurar.ts:213-214` saca la lista de lo que **sigue en Storage** bajo `_originales/`. Lo que A1 borró ya no
  está, así que no aparece. **Reproducido:** A1 borró un original y `restaurar --tarea a1 --ejecutar` dijo
  «0 archivos candidatos».
- `restaurar.ts:200` (A2 después de purgar) es solo un comentario: no hay código.
- Aunque se listaran, se subirían con `PUT` (`comun.ts:313-317`), que en Storage significa **actualizar** un objeto.
  Para recrear uno borrado hace falta `POST`. En el falso, `PUT` sobre un objeto que no existe da 404. **En el
  Supabase real no está comprobado.**

### F4 · ALTO · Rutas absolutas: mover las copias, como pide el PLAN §8, rompe la restauración

`bajar()` guarda en `.meta.json` la ruta **absoluta** de la copia (`comun.ts:263-267`) y la reutiliza tal cual
(`:243-245`). `a34.jsonl` y `a5.json` también guardan `salida` con ruta absoluta (`a34:144`, `a5:104`).

**Reproducido** (con las copias movidas de `copias-A` a otra carpeta y `--copias <nueva>`):

- `restaurar --tarea a34 --ejecutar` revienta: `ENOENT …\copias-A\chat-media\plantillas\promo-prueba.jpg`
  (`restaurar.ts:227`).
- `a34 --ejecutar` sube **0 archivos sin avisar** (`a34:260`, el filtro `existsSync(r.salida)`).
- Si la carpeta vieja sigue existiendo es peor: los scripts siguen leyendo las copias del scratchpad temporal y no
  las del disco definitivo.

**Arreglo:** guardar rutas relativas a `COPIAS`, o rehacer el simulacro directamente con `--copias <disco
definitivo>` en vez de mover la carpeta.

### F5 · ALTO · A1 no se niega a borrar sin la revisión de las tablas ilegibles

El PLAN §1 y §5 dicen que A1 se niega mientras falte esa revisión. `a1-originales.ts:283-286` solo comprueba
`--a34-hecho`, la búsqueda de `_originales/` por la API y las copias. No mira `refs.ilegibles`, no pide
`--tablas-revisadas` y no exige la consulta 4.

**Reproducido:** con `catalogo_variables` devolviendo 403, `a1 --ejecutar --a34-hecho` borró.

### F6 · MEDIO · El cruce por API tiene dos huecos (la consulta 3 del SQL los tapa)

- **Un `%` suelto anula la decodificación de toda la celda** (`comun.ts:187-188`). Si la misma celda contiene, por
  ejemplo, «50% OFF», una referencia escrita con `%2F` no cuenta y el vídeo sale como **falso huérfano**.
  Reproducido: `media-3-ccccc.mp4` se propuso y se movió.
- **Paginación sin `order`** (`comun.ts:172`). En `messages` (51 538 filas, 52 páginas), las filas que se actualizan
  mientras se lee pueden saltarse. No se reproduce en el falso, que siempre devuelve el mismo orden.

**Hoy no afecta a los 18 vídeos:**

- todos los nombres de archivo encajan en la expresión del cruce;
- no hay dos archivos con el mismo nombre en rutas distintas;
- ningún archivo del código cita los 18;
- la lista coincide exactamente con la de la consulta 3 y con `HALLAZGO-videos.md`.

La consulta 3 busca el nombre como subcadena (`ilike`), en todos los esquemas y sin paginar, así que tapa los dos
huecos.

**Ojo:** la condición `--tablas-revisadas` (`a2:71-73`) es solo un texto en la línea de comandos. No demuestra que
alguien ejecutó el SQL.

### F7 · MEDIO · `restaurar` no devuelve el `cacheControl` original

`restaurar.ts:230` pone siempre `max-age=86400`. Los originales tenían `public, max-age=3600` (o un año).

- Es **deliberado y está documentado** en el propio script. No hace daño, pero no cumple el criterio pedido («bytes
  y `cacheControl` originales»).
- **Bytes y `Content-Type` sí vuelven exactos** en A2, A3/A4 y A5 (probado).
- Además, el `Content-Type` se deduce de los bytes (`:177-184`) en vez de usar el que guarda `.meta.json`. Hoy
  coincide, porque solo hay `image/jpeg`, `image/png` y `video/mp4`.

### F8 · BAJO · A5 revienta en una carpeta de copias nueva

`a5-recomprimir-videos.ts:151` no crea `resultados/`. Lanzado antes que A3/A4 en una carpeta vacía, da `ENOENT`
(reproducido).

### F9 · BAJO · Los comentarios dicen cosas que el código no hace

- `comun.ts:302-304`: dice que `escribirStorage` vuelve a bajar el archivo y compara antes de escribir. No lo hace;
  lo hacen quienes la llaman en A3/A4 y A5, pero no en el `move` de A2 ni en el borrado de A1.
- `a2:14`: anuncia una «segunda comprobación por ruta» que no está implementada.
- `a5:10`: dice que «en cada ejecución se vuelve a cruzar», pero con `--ejecutar` no se cruza (`:84`).
- La purga no comprueba en el código que hayan pasado 14 días, y vuelve a bajar los 226 MB.
- Cuando se niega, en Windows el proceso sale con el código 3221226505 en vez de 1.

---

## 3 · Lo que funciona (con evidencia)

**1 · El simulacro no escribe.**

- **13 invocaciones** de simulacro, incluidas combinaciones con trampa como `--purgar`, `--fijar-cache`, `--d5` y
  `--bajar-copia --a34-hecho` sin `--ejecutar`: **0 peticiones de escritura** y los 15 objetos intactos.
- En el código, la única escritura es `escribirStorage` (`comun.ts:305-332`), y su primera línea (`:306`) lanza un
  error si falta `--ejecutar`.
- La RPC `listar_objetos_storage` es `stable` y solo hace `SELECT` (`media-api/sql/002`). Que la versión publicada
  coincida con ese archivo no está comprobado.

**Lo que hace `--ejecutar`, script por script:**

| Script | ¿Copia local antes de escribir? | ¿Vuelve a cruzar referencias? |
| --- | --- | --- |
| A2 | Sí (probado) | Sí |
| A1 | Sí | Sí |
| A3/A4 | Usa la copia del simulacro y comprueba su sha256 | No (cambia el contenido, no el nombre: no hace falta) |
| A5 | Usa la copia del simulacro y comprueba su sha256 | No (cambia el contenido, no el nombre: no hace falta) |

**2 · Ejecutar → restaurar, en el falso.**

- **A2:** sin `--tablas-revisadas` se niega y no escribe. Con él, mueve **solo** los que debe. `restaurar a2` los
  devuelve con bytes, `Content-Type` y `cacheControl` idénticos, y `_borrar/` queda vacío.
- **A3/A4, zona `plantillas`:**
  - fase 1: los bytes de `salida/`, `image/jpeg` y `max-age=86400`;
  - fase 2: los mismos bytes, con `max-age=31536000`;
  - restaurar: los bytes originales, y relanzarlo no vuelve a escribir.
- **A5:** sustituye el vídeo (1 día de caché) y `restaurar` devuelve los bytes originales.

**3 · El cruce de A2, en el falso.** Sí detecta:

- el vídeo citado en JSON anidado de `funnels`;
- el citado en la segunda página de `messages`;
- el citado con otra caja de letras y `%20`.

Y no propone nunca `embudos/chat/`. El único hueco es F6.

**4 · Cifras de A3/A4: se sostienen, con la métrica de la LEY.**

- **38 imágenes** de 22 estratos: todas las zonas, PNG→JPEG, rescates, desde `_originales/` y gráficos 4:4:4.
- La copia local coincide (sha256) con lo medido.
- El peso de `salida/` coincide con el CSV.
- El compresor real **reproduce byte a byte** las 26 que no son rescate.
- El SSIM de `comun.ts` sale **idéntico** al del CSV en las 38.
- Una segunda implementación (ffmpeg, a 1290 px) da lo mismo con ±0,003. Solo una queda en 0,9495, frente al 0,9504
  de `comun.ts`.
- **Margen fino:** de las 724, 68 tienen SSIM por debajo de 0,955 y 23 por debajo de 0,952.
- **Informativo:** medidas a la resolución de salida (lo que se ve al ampliar la foto), **17 de 38 bajan de 0,95**
  (mínimo 0,915, en rescates de 3 264 px). La LEY mide a 1290 px, así que no es un fallo, pero dirección debería
  saberlo antes de la revisión a ojo.

**PNG que pasan a JPEG (166):**

- Los bytes son JPEG y se subirían con `Content-Type: image/jpeg`.
- Al enviar, la app usa el `Content-Type` de la respuesta y sube `foto.jpg` (`quinchat/lib/whatsapp.ts:297-302`):
  es coherente.
- Chrome la muestra.
- Ya hay 18 JPEG con nombre `.png` en uso desde agosto (`embudos/chat/` y `embudos/`).

**Transparencia:**

- 45 fuentes tienen canal alfa, pero solo **3 lo usan de verdad**: tres stickers animados, que quedan excluidos.
- Las 166 que pasan a JPEG son opacas, comprobado píxel a píxel sin usar la lógica del compresor.
- En el falso, un PNG con transparencia real sale **PNG con alfa**. Pesa 482 kB, por encima del tope.

**5 · Caché en dos fases.** El mecanismo es correcto: 1 día y luego 1 año con los mismos bytes. La fase 2 se niega
si en Storage no están los bytes de la fase 1. Se rompe por F1 y F2.

**6 · Duplicados.**

- En la base real, la foto de 3,7 MB está en **6 rutas** y tiene **6 entradas, 6 `salida/` y 6 copias**, con los
  mismos 336 kB.
- En el falso, 3 duplicados se recomprimen por separado, conservan su ruta (las referencias siguen valiendo) y se
  restauran uno a uno.

---

## 4 · Huecos abiertos (no se pudo probar)

- **Supabase real:**
  - qué hace `PUT` sobre un objeto que no existe (F3);
  - si la CDN se invalida al sobrescribir (se ve en el paso 2);
  - si el bucket tiene `allowed_mime_types` que rechacen `image/jpeg` en un `.png`.
- **WhatsApp:** no se ha probado una cabecera de plantilla enviada por enlace (`lib/whatsapp.ts:590`,
  `lib/whatsapp-templates.ts:216`) con un JPEG llamado `.png`. **Prueba más barata:** mandar una plantilla de prueba
  a un número interno con uno de los 18 de agosto.
- **El SQL de `cruce-solo-lectura.sql` no lo ejecuté.** Es la única comprobación que tapa F6 y las dos tablas
  ilegibles.
- **No volví a cruzar contra la base real**, para no sobrescribir los CSV del repo. Las cifras de referencias son
  las del desarrollador (01:33 UTC).
- **quin-comercial** clonó el esquema de quinchat y apunta a mano a su bucket
  (`quin-comercial/app/api/whatsapp/webhook/route.ts:1113-1114`). Además, su `.env.local` apuntaba a producción
  (`CONTINUACION-PROYECTO.md:14`). Su base no se puede ver: un enlace desde ahí a un vídeo de A2 solo se detectaría
  como un 404 durante los 14 días.
- **Revisión a ojo en móvil** y **Edge**: pendientes.

## 5 · Archivos

- Pruebas: `C:\Users\Tati\AppData\Local\Temp\claude\D--PROYECTO-IA-FUNNELISH\729bd79f-ccde-4f87-9305-376527c1bb11\scratchpad\pruebas-limpieza\`
  (`simulacro-falso.mjs`, `segunda-pasada.mjs`, `a5-relanzar.mjs`, `recomprimir-muestra.ts`, `transparencia.ts`,
  `navegador.mjs`, `ssim-2p.ts`, `guardia.mjs`).
- Salidas: `salida-*.txt` en esa misma carpeta.
