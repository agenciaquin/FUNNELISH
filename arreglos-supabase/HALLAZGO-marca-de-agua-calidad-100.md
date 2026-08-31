# Hallazgo nº 8 · La marca de agua del catálogo se guarda a calidad 100
### y, de paso, aparecieron dos buckets que nunca se inventariaron

**Detectado:** 31 de agosto de 2026, 02:57, al comprobar la primera subida real
con la compresión ya publicada.
**Estado:** medido, **sin corregir**. No se ha tocado código.

---

## 1 · El defecto

`lib/watermark.ts`, línea 93:

```js
const buffer = await img.getBufferAsync(Jimp.MIME_JPEG);
```

Sin `.quality(n)`. **Jimp codifica JPEG a calidad 100 cuando nadie se lo dice.**
Y la subida de la línea 99 tampoco pasa `cacheControl`, así que hereda la hora
por defecto de Supabase.

Es **el mismo defecto nº 6**, el de los collages de pack. Tercer sitio con la
misma causa.

### Cómo apareció

Al subir una foto de prueba al catálogo entraron **dos** archivos, no uno:

| Qué | Dónde | Peso | Caché |
| --- | --- | ---: | --- |
| El original, comprimido por nuestra ruta | `catalogo-imagenes/` | **274 kB** | 1 año ✅ |
| La versión con marca de agua | `chat-media/catalogo/marcas/` | **1.072 kB** | 1 hora ❌ |

La segunda es **la que ve el cliente**: `catalogo_colores.url_imagen` apunta a
`chat-media` en 186 de 187 filas.

---

## 2 · Cuánto pesa de verdad (rectificación)

En caliente se dijo que esto era «de las gordas». **Medido, no lo es tanto**, y
conviene dejarlo escrito con precisión:

| Estado de `catalogo/marcas/` | Archivos | Total | Medio |
| --- | ---: | ---: | ---: |
| Ya comprimidas por el backfill | 293 | 62 MB | 215 kB |
| Sin comprimir | **6** | 1.857 kB | 310 kB |

El backfill del 29 de agosto ya recogió 293 de ellas, porque el prefijo
`catalogo/` entraba en el barrido. **El atraso real son 6 archivos.**

Lo que importa no es el atraso, es **el flujo**: cada foto nueva de catálogo
genera una marca de agua de ~1 MB en vez de ~250 kB. Con el equipo trabajando en
catálogos, eso se acumula rápido.

---

## 3 · Hay TRES buckets, no uno

Todo el trabajo de estas dos jornadas se hizo sobre `chat-media`. Al buscar la
foto de prueba apareció que no está solo:

| Bucket | Archivos | Total | Medio | ¿Público? |
| --- | ---: | ---: | ---: | --- |
| `chat-media` | 2.975 | 2.107 MB | 725 kB | Sí |
| `catalogo-imagenes` | 205 | **200 MB** | 1.001 kB | Sí |
| `plantillas-images` | 13 | 12 MB | 971 kB | Sí |

**212 MB que nunca se auditaron.** Los tres son públicos, sin límite de tamaño
ni de tipo de archivo.

En `catalogo-imagenes`: **185 de 205 archivos pasan de 500 kB**, el mayor son
3.591 kB, y solo uno tiene caché anual — el que subimos esta noche.

### Pero antes de alarmarse: no es egress

`catalogo-imagenes` guarda `catalogo_colores.url_original` —182 de 187 filas—,
que es **el archivo de origen, no el que se sirve**. Al cliente se le manda
siempre la versión con marca de agua, que vive en `chat-media`.

Así que esos 200 MB son **coste de almacenamiento, no de tráfico**. Menos
urgente de lo que parece a primera vista, pero conviene decidir si hace falta
conservar los originales ahora que existen los respaldos de `_originales/`.

`plantillas-images` está **muerto**: última escritura el 16/07/2026. La ruta
`plantillas-wa/imagen` escribe hoy en `chat-media`. Son 12 MB de restos.

---

## 4 · Qué haría falta

Dos líneas, las mismas que ya se aplicaron en los collages:

```js
const buffer = await img.quality(85).getBufferAsync(Jimp.MIME_JPEG);
// y en el upload:  cacheControl: CACHE_UN_ANO
```

**Antes de darlo por bueno hay que mirarlo con los ojos.** Una marca de agua
lleva texto fino sobre la foto, y el texto fino es lo primero que se ensucia al
bajar la calidad. Con los collages daba igual; aquí no. Puede que 85 sea
demasiado y convenga 90.

Y aparte, dos decisiones que este informe no toma:

1. Si `catalogo-imagenes` (200 MB de originales) debe conservarse.
2. Si `plantillas-images` (12 MB, muerto desde julio) se borra.

---

## 5 · Por qué no se hizo ya

Se detectó a las 3 de la mañana, veinte minutos después de que un despliegue
rompiera las subidas en producción. Encadenar otro despliegue esa misma noche,
sobre una imagen que ve el cliente y que exige revisión visual, no compensaba.

**Decisión del auditor: dejarlo arrancar y observar.**
