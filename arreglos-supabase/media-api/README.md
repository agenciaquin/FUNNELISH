# media-api

Servicio de compresión de imágenes y vídeo para el storage de **quinchat**
(`bjbjqmbuzpyjvcugbusx`, bucket `chat-media`).

Existe por una razón concreta: el proyecto sirve unos **3,0 GB de egress al día**
(~90 GB/mes sobre los 250 GB que incluye el plan Pro), y el 88% de ese tráfico
sale de `chat-media/embudos/` — las imágenes de las landing pages de los funnels.
No es que haya mucho tráfico: es que cada archivo pesa unas diez veces lo que
debería. Un PNG típico de esa carpeta ocupa 2,4 MB.

Todo se queda en Supabase. Esto no mueve nada fuera.

---

## Lo que hace

| | |
| --- | --- |
| **Imágenes** | JPEG/PNG → WebP, ancho máximo 1920 px, calidad 85 |
| **Vídeos** | H.264 CRF 23, ancho máximo 1080 px, 30 fps, `+faststart` |
| **Poster** | Primer fotograma del vídeo como WebP (opcional) |
| **Resto** | Audio, PDF y demás pasan sin tocarse |
| **Caché** | `max-age` de un año (Supabase pone una hora por defecto) |

## La calidad no se toca

**El perfil por defecto preserva la resolución original.** No es una concesión:
es que recortarla no aporta casi nada.

El ahorro de este servicio **no viene de bajar calidad, viene del formato**. Las
imágenes del bucket están guardadas como PNG —compresión sin pérdida, pésima
para fotografía— y como JPEG sobrecodificado. Los vídeos son exports crudos de
móvil a 18 Mbps. Solo convertirlas a WebP y H.264 **a resolución y calidad
plenas** ya elimina el 83-91% del peso.

Medido sobre archivos reales del bucket:

| Perfil | PNG 1920² · 5,53 MB | JPEG 3264² · 3,64 MB |
| --- | --- | --- |
| **1920 px q85 — por defecto** | **495 kB (−91,3%)** | **630 kB (−83,1%)** |
| 1440 px q82 | 212 kB (−96,3%) | 238 kB (−93,6%) |
| 1080 px q72 | 98 kB (−98,3%) | 79 kB (−97,9%) |

| Perfil | Vídeo 1080×1920 · 37,7 MB a 18.163 kb/s |
| --- | --- |
| **1080 px CRF 23 — por defecto** | **6,5 MB (−82,8%)** |
| 720 px CRF 30 | 1,5 MB (−95,9%) |

Bajar de ahí gana unos puntos porcentuales sobre un egress que ya queda muy por
debajo del cupo del plan, a cambio de degradar las fotos de producto que son el
escaparate del negocio. **No merece la pena.** Si aun así hace falta, se ajusta
por `.env` sin tocar código.

### Verificación visual

Comparadas al 100% de píxeles, con calidad 85 los logos, el texto pequeño y las
costuras se leen igual de nítidos que en el original. La textura de tela sale
mínimamente más suave y nada más.

Reproducible con `npx tsx src/prueba-real.ts <ruta>`.

---

## Dos decisiones de diseño que conviene entender

### 1. Las URL no cambian

Un WebP se guarda **bajo el nombre original**, incluida su extensión `.png`.
Supabase sirve el `Content-Type` que se le guarda y el navegador le hace caso por
encima de la extensión, así que el archivo se muestra como WebP aunque se siga
llamando `.png`.

Esto importa porque las rutas están repartidas por la base de datos en 131
referencias, y siete de ellas viven dentro de columnas `jsonb`:

```
funnels.imagenes (jsonb)    31      funnels.layout (jsonb)      11
funnels.variantes (jsonb)   29      funnels.imagen_banner       10
funnels.imagen_detalle      27      funnels.miniatura_url        4
funnels.imagen_clientes     19
```

Conservando el nombre, **no hay que tocar ninguna**. Los vídeos salen como mp4
otra vez, así que tampoco cambian.

### 2. La clasificación mira el contenido, no el nombre

`funnels.video_url` está vacío: los mp4 están guardados en `imagen_clientes`
(13), `miniatura_url` (3) e `imagen_detalle` (2). Fiarse del nombre de la columna
o de la extensión llevaría a pasar vídeos por el compresor de imágenes. Por eso
`clasificar()` lee los primeros bytes del archivo.

---

## Puesta en marcha

```bash
cd media-api
npm install
cp .env.example .env    # rellenar SUPABASE_SERVICE_ROLE_KEY y API_TOKEN
```

Crear la tabla de registro (una sola vez):

```bash
psql "$DATABASE_URL" -f sql/001_media_optimizaciones.sql
```

Arrancar la API:

```bash
npm run dev     # desarrollo
npm run build && npm start   # producción
```

---

## API

### `POST /optimizar`

Sustituye a la subida directa a Supabase: se le manda el archivo tal cual llega
del usuario y devuelve la URL pública ya optimizada.

```bash
curl -X POST http://localhost:8080/optimizar \
  -H "x-api-token: $API_TOKEN" \
  -F "archivo=@banner.png" \
  -F "ruta=embudos/mi-funnel/banner.png" \
  -F "poster=1"
```

```json
{
  "url": "https://bjbjqmbuzpyjvcugbusx.supabase.co/storage/v1/object/public/chat-media/embudos/mi-funnel/banner.png",
  "ruta": "embudos/mi-funnel/banner.png",
  "clase": "imagen",
  "optimizado": true,
  "motivo": "ahorro del 96.8%",
  "bytesOriginal": 2370048,
  "bytesFinal": 75776
}
```

`poster=1` solo aplica a vídeos y añade `urlPoster` a la respuesta.

### `GET /salud`

Sin autenticación. Devuelve `{ "ok": true, "bucket": "chat-media" }`.

---

## Reprocesar lo que ya está subido

Tres modos, de menos a más invasivo. **El modo por defecto no descarga nada**,
precisamente para no gastar egress mientras se decide:

```bash
# 1. Estimación a partir de los metadatos. Gratis, instantáneo.
npm run backfill -- --prefijo embudos

# 2. Descarga y comprime de verdad, pero no sube nada.
npm run backfill -- --prefijo embudos --simular --limite 20

# 3. Respalda el original en _originales/ y lo sustituye.
npm run backfill -- --prefijo embudos --aplicar
```

Otras opciones: `--solo imagen`, `--solo video`, `--limite N`.

El proceso es **idempotente**: cada archivo tratado queda anotado en
`media_optimizaciones`, así que se puede cortar y relanzar sin repetir trabajo.

### Deshacer

Cada archivo sustituido deja su original en `_originales/<ruta>`. Para volver
atrás está `restaurar()` en `src/storage.ts`. Cuando esté todo verificado, se
borra el prefijo `_originales/` y ahí se materializa el ahorro de almacenamiento.

---

## Guardarraíles

- **Si el ahorro es menor del 10%, no se sustituye.** No compensa perder calidad
  a cambio de nada. Es lo que salvó al mp4 de `formula-1`, que ya estaba bien
  codificado.
- Imágenes por debajo de 200 KB y vídeos por debajo de 500 KB se saltan.
- `cacheControl` se sube a un año (por defecto Supabase pone una hora). En
  assets que nunca cambian eso reduce las peticiones que llegan al origen.
- La API exige `x-api-token` y se niega a arrancar peticiones si no hay token
  configurado.
- La tabla `media_optimizaciones` va con RLS activado y sin policies: solo
  accesible desde `service_role`.

---

## Validación

Tres scripts que no modifican nada y se pueden relanzar cuando se quiera:

```bash
npx tsx validar-todo.ts        # el completo: archivos, embudos, Meta y etiquetado
npx tsx validar-embudos.ts     # solo las URL que referencian los embudos
npx tsx validar-whatsapp.ts    # replica la logica de lib/whatsapp.ts sobre embudos/chat/
npx tsx reparar-tipos.ts <pfx> # arregla objetos con content-type incorrecto
```

`validar-todo.ts` comprueba cuatro cosas:

1. **Archivos sustituidos** — sirven por HTTP, decodifican, están por debajo del
   límite de 5 MB de WhatsApp, y su respaldo en `_originales/` sigue intacto y
   del tamaño exacto del original.
2. **Embudos** — cada URL de media referenciada en la tabla `funnels` carga y
   decodifica. Si el backfill rompiera una landing, sale aquí.
3. **WebP en carpetas de envío** — `embudos/` y `plantillas/` no pueden contener
   WebP. En `entrantes/` y `ventas/` sí es normal: es media que *entra* de
   WhatsApp y no se reenvía.
4. **Etiquetado** — ningún objeto con un `content-type` que no sea de medios.

Última ejecución (2026-08-29):

```
1. Archivos sustituidos     64/64 correctos · ahorro 155.3 MB
2. Referencias de embudos   341/341 cargan
3. WebP en envio            0
4. Objetos mal etiquetados  0
```

### Dos fallos que estos scripts encontraron

**`restaurar()` dejaba los archivos peor de lo que estaban.** Subía sin
`contentType`, y supabase-js etiqueta entonces el objeto como
`text/plain;charset=UTF-8`. Un archivo así no se renderiza como imagen,
`lib/whatsapp.ts` lo trata como si no fuera imagen, y este mismo backfill lo
ignora porque filtra por el tipo declarado antes de descargar. Corregido: ahora
deduce el tipo de los bytes de cabecera.

**Seis imágenes WebP en `embudos/remarketing/`**, subidas el 27-08-2026, en
campañas que se envían por WhatsApp — es decir, sin entregar. No las puso el
backfill: llegaron porque `quinchat/lib/imagen-comprimir.ts` devuelve el original
cuando el JPEG le sale más grande, que es lo normal partiendo de un WebP. Como
pesaban entre 95 y 167 kB, por debajo del mínimo, el compresor las habría dejado
pasar. Ahora **el WebP se convierte siempre**, pese lo que pese y aunque el JPEG
salga mayor: un archivo que no se entrega no sirve de nada por liviano que sea.

## Límites conocidos

- **`sharp` y `ffmpeg-static` descargan binarios nativos al instalar.** En CI no
  se puede usar `--ignore-scripts`, y en Docker hay que instalar dentro de la
  imagen final, no copiar `node_modules` de otra plataforma.
- **El vídeo se procesa en memoria y con archivos temporales.** Un mp4 de 45 MB
  tarda unos segundos y consume RAM. No es apto para una Edge Function de
  Supabase (256 MB de memoria y límite de CPU): necesita un servidor normal.
- **El backfill es secuencial.** Sobre 429 archivos es cuestión de minutos; no
  se ha paralelizado a propósito, para no saturar la API de storage.
