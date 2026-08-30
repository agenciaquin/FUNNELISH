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
