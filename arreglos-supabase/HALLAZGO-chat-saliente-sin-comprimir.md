# Hallazgo nº 7 · Las fotos que el asesor manda por chat no se comprimen

**Detectado:** 30 de agosto de 2026, al revisar qué sigue entrando pesado al bucket.
**Estado:** medido, **sin corregir**. No se ha tocado código.

---

## En una línea

`app/api/whatsapp/send-media/route.ts` sube la foto **tal cual llega**, sin pasar
por `optimizarImagen()`. Son **389 imágenes, 289 MB, 761 kB de media**: la mayor
concentración de peso del bucket después de los vídeos.

---

## Cómo se ve en el bucket

Reparto del bucket sin contar `_originales/`:

| Zona | Archivos | Total | Medio | ¿Comprimida? |
| --- | ---: | ---: | ---: | --- |
| Vídeos de `embudos/` | 32 | **486 MB** | 15 MB | No — pendiente nº 5 |
| **Chat saliente** (`573.../`) | 389 | **289 MB** | **761 kB** | **No — esto** |
| Resto de imágenes | 907 | 176 MB | 198 kB | Sí |
| Imágenes de `embudos/` | 397 | 93 MB | 239 kB | Sí |

Las zonas que sí pasaron por el backfill quedaron en **198–239 kB de media**. La
del chat va por **761 kB**: pesa más del triple, y es el único sitio donde entran
imágenes nuevas todos los días sin filtro.

Además, **las 485 carecen de caché larga** (`cacheControl` de una hora, el valor
por defecto de Supabase). El panel vuelve a pedirlas al origen cada hora.

---

## Cuánto se ahorraría

Muestra aleatoria de 12 archivos reales del propio bucket, descargados y pasados
por el compresor de verdad —`pruebas/medir-chat-saliente.ts`, relanzable—:

```
1785031440467-39ogi.jpg     952 kB ->   198 kB   79%
1785013265781-0g0fg.jpg    2016 kB ->   480 kB   76%
1786478528098-qth4r.jpg     491 kB ->   257 kB   48%
1785766218836-7f8t6.png     734 kB ->   124 kB   83%
1784594055705-gzo47.png    1128 kB ->   119 kB   89%
1786485034515-pltsg.png     314 kB ->    32 kB   90%
1787866569969-29i9x.jpg    1532 kB ->   317 kB   79%
1786999063071-7ntj9.png    2580 kB ->   222 kB   91%
1785891777145-fnc1t.png    2383 kB ->   188 kB   92%
1788106645883-b8br1.jpg     511 kB ->   274 kB   46%
1785348052604-tnyft.png     575 kB ->    47 kB   92%
1788043487916-b7oi2.jpg     949 kB ->   193 kB   80%

TOTAL 14.164 kB -> 2.450 kB   ahorro 83%
```

Extrapolado a las 389: **289 MB → ~49 MB**. Los dos casos peores de la muestra
(48% y 46%) son JPEG que ya venían de una cámara de móvil; los PNG —capturas de
pantalla, que es lo que más manda un asesor— caen del 83 al 92%.

---

## Por qué se escapó

El README ya listaba esta ruta en la tabla de puntos de subida, con la etiqueta
«Media saliente». Se conectaron tres rutas —`funnels/imagen`,
`plantillas-wa/imagen` y `catalogos/upload-imagen`— y esta se quedó fuera.

No fue una decisión razonada, fue un olvido. Es el mismo patrón del defecto nº 6
con los collages de pack: la corrección cubrió los caminos que se estaban
mirando, no todos los que existen.

---

## Qué haría falta

Unas cuatro líneas en `send-media/route.ts`: comprimir el buffer antes del
`upload()`, usar el `contentType` y la extensión que devuelve el compresor, y
poner `cacheControl: CACHE_UN_ANO`.

Conviene mandar a Meta **el buffer ya comprimido**, no el original: sale JPEG,
que WhatsApp entrega siempre, y el envío es más rápido.

**Dos cosas a comprobar antes de darlo por bueno**, que aquí no se han probado:

1. Que el asesor no pierda nada al mandar una captura con texto pequeño. A 1920 px
   y calidad 85 no debería, pero se manda texto de tallas y precios y hay que
   verlo con los ojos, no con el SSIM.
2. Que no se rompa el envío de `document` ni de `audio`. La ruta los trata en el
   mismo bloque, y el compresor solo debe tocar `image/*`.

---

## Por qué no se ha hecho ya

El PR nº 1 está abierto y pendiente de publicar. Meterle un cambio ahora se lo
mueve del sitio a quien lo está revisando, y toca una ruta —el envío de WhatsApp
desde el número del negocio— más delicada que las tres del PR.

**Va después del nº 1**, igual que `quin-comercial`. Con una diferencia: aquí sí
hay una medida concreta del ahorro, y son 240 MB.
