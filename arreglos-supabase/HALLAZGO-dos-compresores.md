# Hallazgo · Dos compresores de imagen, escritos el mismo día sin saberlo

**Fecha:** 30 de agosto de 2026
**Proyecto:** `quinchat`
**Estado:** medido. Sin aplicar cambios sobre código ajeno.
**Severidad:** media — riesgo de degradar fotos ya optimizadas

---

## Qué pasó

El 29 de agosto, con cuatro horas de diferencia, dos personas atacaron el mismo
problema:

| | Commit | Autor | Hora |
| --- | --- | --- | --- |
| `api/funnels/optimizar-fotos` | `4be7b82` (v170) | agenciaquin | 17:50 |
| `lib/optimizar-imagen-servidor.ts` | `6d54a85` | Tatiss30 | 22:11 |

Ninguno sabía del otro. La ruta de agenciaquin entró colada dentro de un commit
titulado «webhook de Funnelish por cliente», así que no era visible por el
mensaje.

Además **ambos tocaron `lib/imagen-comprimir.ts` con la misma idea**: que los
PNG dejaran de saltarse la compresión. Eso produjo el único conflicto de la
fusión.

---

## En qué se diferencian

| | `optimizar-fotos` (agenciaquin) | Este trabajo |
| --- | --- | --- |
| Cuándo actúa | manual, botón por embudo en el panel | automático, al subir |
| Resolución | 1080 px | 1920 px |
| Calidad | 72 | 85 |
| Con el original | copia nueva en `embudos-opt/`, **no lo borra** | sustituye en su sitio, respaldo en `_originales/` |
| Efecto en el bucket | **lo hace crecer** | lo reduce |
| URLs | **reescribe la tabla `funnels`** | no cambia ninguna |

---

## El riesgo concreto

Si alguien pulsa «⚡ Optimizar fotos» sobre un embudo ya procesado, coge nuestro
JPEG de 1920/q85 y lo recodifica a 1080/q72. **Segunda pasada con pérdida**,
sobre fotos de producto en páginas de venta.

**Exposición medida:** de las 397 imágenes de `embudos/`, **98 siguen por encima
de los 300 kB** del umbral. Esas son las que el botón tocaría. Las otras 299 las
saltaría.

**No ha ocurrido:** `embudos-opt/` está vacío. El botón no se ha usado nunca.

---

## La medición

`media-api/comparar-perfiles.ts`, sobre **30 originales reales** de
`_originales/embudos/`, todos por encima de 300 kB.

La calidad se mide con **SSIM contra el original**, a **1290 px** — la
resolución real de un móvil de gama media (430 px CSS × densidad 3). Comparar a
resolución nativa favorecería al perfil de más píxeles aunque el cliente nunca
los vea; comparar a 1080 favorecería al otro. A 1290 px se pregunta lo único que
importa: *puesta en la pantalla del cliente, ¿cuál se parece más a la original?*

| Perfil | Peso medio | Ahorro | SSIM | Veredicto |
| --- | ---: | ---: | ---: | --- |
| **1920/q85** — este trabajo | 245 kB | 85,6% | **0,9722** | indistinguible |
| 1600/q82 | 191 kB | 88,8% | 0,9633 | muy buena |
| 1440/q82 | 177 kB | 89,5% | 0,9602 | muy buena |
| **1290/q80** | 153 kB | 91,0% | **0,9527** | muy buena |
| 1290/q75 | 125 kB | 92,6% | 0,9417 | se nota al comparar |
| **1080/q72** — `optimizar-fotos` | 84 kB | 95,0% | **0,8963** | **degradada** |

### Cómo leer esto

**1080/q72 sí ahorra más: 9,4 puntos más que 1920/q85.** No es un capricho, es
una elección deliberada de quien lo escribió y funciona.

El problema es el precio. SSIM 0,8963 está por debajo del umbral en el que los
artefactos se ven **sin comparar con nada al lado** — bloques en las zonas lisas,
halos en los bordes, banding en los degradados. En una tienda de ropa, donde la
textura de la prenda *es* el producto, eso se paga en ventas.

Y lo que se compra con esa pérdida son **~9 MB de almacenamiento** en un bucket
que está al 36% de un cupo de 250 GB, sin sobrecoste. No hay factura que bajar.

### El que más rinde de verdad

**1290/q80.** Ahorra 5,4 puntos más que el perfil actual y se mantiene en «muy
buena» (0,9527). Está justo en el codo de la curva: a partir de ahí, cada punto
de peso cuesta mucha más calidad.

---

## Recomendación

**Desplegar 1920/q85 tal cual está.** Ya está probado, compilado y fusionado. La
diferencia con 1290/q80 son 5 puntos de peso sobre un cupo que no estamos
agotando; el margen de calidad es el seguro más barato que hay en una página de
ventas.

**1290/q80 queda documentado como palanca disponible.** Es cambiar dos constantes
en `lib/optimizar-imagen-servidor.ts`. No hace falta decidirlo hoy.

**Sobre el botón de agenciaquin: no tocar sin avisarle.** Es código suyo, lleva
un día sin usarse y no corre prisa. Subir su perfil a 1920/q85 son dos líneas y
haría que ambos caminos coincidan, pero quien lo escribió merece enterarse por
una persona antes que por un commit.

---

## ⚠️ Dependencia con el borrado de `_originales/`

Estaba previsto **borrar `_originales/` (1.010 MB) tras una semana sin
incidencias**. Conviene retrasarlo hasta cerrar la decisión de perfil.

Motivo: si algún día se quiere recomprimir a 1290/q80, hacerlo desde los
archivos actuales sería una **segunda pasada con pérdida sobre pérdida**, y el
SSIM real quedaría por debajo del 0,9527 medido. Desde `_originales/` la pasada
es limpia y da exactamente esa cifra.

Borrar el respaldo cierra esa puerta para siempre.

---

## Decisión tomada · 30 de agosto de 2026

**Se mantiene 1920/q85.** Decidido por el auditor tras ver la comparativa.

Razón, en corto: apretar más ahorraría unos 9 MB en un cupo de 250 GB que está
al 36%. No baja ninguna factura, y a cambio las fotos de producto empiezan a
verse sucias. En una tienda de ropa la textura de la prenda es lo que vende.

`1290/q80` queda descartado por ahora, no eliminado: son dos constantes en
`lib/optimizar-imagen-servidor.ts` si algún día el consumo aprieta de verdad.

**El botón «⚡ Optimizar fotos» de agenciaquin se queda intacto.** No se toca
código ajeno. Queda pendiente que alguien del equipo se lo comente.
