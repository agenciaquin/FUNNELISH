# Cambios aplicados a `quinchat/`

Registro exacto de lo que este trabajo modificó **fuera** de `arreglos-supabase/`,
para poder revisarlo o revertirlo sin tener que adivinar.

**Rama:** `optimizacion-imagenes` · **Fecha:** 2026-08-29
**Estado:** commiteado en local, **sin desplegar**.

---

## Por qué existe este cambio

El backfill comprimió los 646 archivos que ya estaban en el bucket. Eso arregla
el pasado. Pero en agosto entraron **1.260 MB de material nuevo** con un peso
medio de 884 kB, así que sin tocar las rutas de subida el problema vuelve a
crecer y en dos meses estamos igual.

Esto cierra el grifo: cada foto nueva entra ya comprimida, venga del panel, de
una integración o de una llamada suelta a la API.

---

## Archivos

| Archivo | Cambio |
| --- | --- |
| `lib/optimizar-imagen-servidor.ts` | **Nuevo.** El compresor de servidor |
| `lib/imagen-comprimir.ts` | Ahora comprime PNG (antes se los saltaba todos) |
| `app/api/funnels/imagen/route.ts` | Comprime + caché de un año |
| `app/api/plantillas-wa/imagen/route.ts` | Comprime + caché de un año |
| `app/api/catalogos/upload-imagen/route.ts` | Comprime + caché de un año |
| `app/api/funnels/video/route.ts` | Solo caché de un año |
| `lib/collage.ts` | Los collages de pack se guardaban a calidad 100. Ahora a 85 |
| `app/api/funnelish/webhook/route.ts` | Lo mismo: el collage del webhook, a calidad 85 |
| `package.json` · `package-lock.json` | Añade `sharp` |

**Efecto visible para el usuario: ninguno.** Misma interfaz, mismas URL, misma
resolución. Solo cambia el peso de lo que se guarda.

---

## Las tres decisiones que conviene entender

### 1. JPEG, nunca WebP

WebP comprime alrededor de un punto y medio mejor, pero **Meta acepta el envío y
luego no entrega el mensaje**. La lección ya estaba escrita en
`lib/imagen-comprimir.ts` por quien la sufrió antes.

Y no se puede separar por carpetas, porque `embudos/` mezcla las dos cosas:

- `embudos/chat/` — media de conversaciones, la sube `ChatArea` y va a WhatsApp
- `embudos/remarketing/` — imágenes de campaña, también van por WhatsApp
- `embudos/<slug>/` — imágenes de landing, solo navegador

Medido sobre archivos reales: JPEG q85 llega al −92,1% frente al −93,7% de WebP.
Ese punto y medio no vale romper los envíos.

### 2. Resolución original, calidad 85

El ahorro **no viene de recortar calidad, viene del formato**. Las fotos estaban
guardadas como PNG sin pérdida y como JPEG sobrecodificado. Convertirlas a
resolución y calidad plenas ya quita el 83-91%.

Comparadas píxel a píxel, los logos, el texto pequeño y las costuras se leen
igual que en el original.

### 3. El WebP se convierte siempre, pese lo que pese

Aquí no es cuestión de tamaño sino de compatibilidad, así que se salta el mínimo
de 200 kB y el de ahorro del 10%. Un archivo que no se entrega no sirve de nada
por liviano que sea.

No es hipotético: había **6 imágenes WebP en `embudos/remarketing/`** de 95 a
167 kB, y esas campañas se envían por WhatsApp. Llevaban sin entregarse desde el
27 de agosto.

---

## Qué NO cubre

- **Vídeo.** No se puede recodificar en Vercel: no hay ffmpeg y un mp4 de 45 MB
  no cabe en el límite de tiempo. Sigue dependiendo del backfill de `media-api`.
- **Subidas por enlace firmado.** Si tras comprimir en el navegador el archivo
  sigue pasando de 4 MB, `EmbudosPanel` y `ChatArea` lo suben directo a Storage
  sin pasar por el servidor. Con los PNG ya comprimidos debería ser raro.

---

## Riesgo conocido al desplegar

**`sharp` trae binarios nativos.** En Vercel se instalan para Linux y debería
funcionar solo, pero **no se ha verificado allí**. Si falla, falla en el build y
no llega a producción.

Por eso esto va en una rama: Vercel genera una URL de preview donde se puede
subir una foto real y comprobar que llega comprimida, antes de tocar `master`.

---

## Cómo comprobar que funciona, ya desplegado

1. **El build pasa** en Vercel.
2. **Sube una foto desde el panel.** Una que antes pesara 2 MB debe aterrizar en
   200-400 kB.
3. **A la semana, lanza `sql/004_chequeo_consumo.sql`.** La señal es el peso
   medio: 853 kB antes de esto, debería bajar de 150 kB.

---

## Cómo revertir

Nada de esto toca datos, solo código. Volver atrás es descartar la rama:

```bash
git checkout master          # master nunca tuvo estos cambios
```

Si ya se hubiera fusionado:

```bash
git revert <hash-del-merge>
```

Los archivos ya comprimidos en Storage **no dependen de este código** y seguirían
igual. Para deshacer aquello, sus originales están en `_originales/` y
`restaurar()` en `media-api/src/storage.ts` los devuelve.

---

## Prueba de la ruta, hecha antes de desplegar (2026-08-29)

Quedaba un hueco: el compresor estaba probado por separado, pero **el cableado
de la ruta no**. Se cerró levantando `next dev` en local y subiendo un PNG real
por `POST /api/funnels/imagen`, sin desplegar nada.

```
entrada   PNG  1920x1920 · 5.662 kB
guardado  jpeg 1920x1920 ·   446 kB   (-92,1%)
          image/jpeg · public, max-age=31536000
```

Las seis comprobaciones pasan: responde 200, sirve `image/jpeg`, el archivo es
JPEG de verdad y no solo la cabecera, la URL termina en `.jpg`, **conserva la
resolución original** y trae la caché de un año. El archivo de prueba se borró
del bucket al terminar.

Se reproduce con `media-api/probar-ruta-local.ts`.

**Y el build ya está verificado en Linux:** el despliegue accidental a Vercel
compiló `sharp` sin incidencias, las 90 rutas y el TypeScript en 14 segundos.
Era el único riesgo técnico que quedaba.

---

## ¿Y que funcione en el servidor, no solo aquí?

Es la pregunta que las pruebas en local no pueden contestar. `sharp` no es
código normal: lleva dentro un programa compilado, distinto para cada sistema.
Puede compilar bien y reventar al primer uso.

**No es una duda teórica: a este proyecto ya le pasó.** En `next.config.ts` hay
un parche escrito porque las fuentes de Jimp no se copiaban al servidor y la
marca de agua del catálogo fallaba en producción con `ENOENT`.

### Lo comprobado (30 de agosto)

**1 · Compila en el servidor.** Rama de prueba `prueba-compresion-servidor`,
construida por Vercel: compiló en 51 s, pasó la revisión de tipos entera en
Linux y publicó las cuatro rutas. Sin un solo error.

**2 · El binario de `sharp` sí viaja dentro de cada ruta.** Este es el punto que
falló con Jimp. Next escribe, para cada ruta, la lista de archivos que se lleva
al servidor. Abierta esa lista tras construir:

```
funnels/imagen            29 archivos de sharp · 1 binario .node
plantillas-wa/imagen      29 archivos de sharp · 1 binario .node
catalogos/upload-imagen   29 archivos de sharp · 1 binario .node
```

La diferencia con Jimp es real y explica por qué aquello falló y esto no: las
fuentes de Jimp son archivos de datos que se abren por su ruta en disco, y el
rastreo de Next no puede adivinarlos. El binario de `sharp` entra por un
`require`, que sí se sigue.

**3 · El binario de Linux está declarado.** El rastreo de arriba se hizo en
Windows y por eso recogió `sharp-win32-x64`. En el servidor recoge el de Linux
por el mismo mecanismo, y `@img/sharp-linux-x64 0.35.4` figura en el
`package-lock.json`, así que la instalación de Vercel lo baja.

### Lo que sigue sin comprobarse

**Ejecutar la compresión dentro del servidor de Vercel.** Se preparó una ruta de
diagnóstico en una rama desechable y Vercel la construyó bien, pero los
servidores de prueba exigen inicio de sesión de Vercel y no se pudo invocar.

Queda como el único hueco. Los tres puntos de arriba lo estrechan mucho —la
forma habitual en que esto falla es justo la del punto 2—, pero no es lo mismo
que haberlo visto correr.

La forma más barata de cerrarlo: tras publicar, subir **una** foto desde el
panel y mirar cuánto pesó en el bucket. Si salió ligera, está corriendo.
