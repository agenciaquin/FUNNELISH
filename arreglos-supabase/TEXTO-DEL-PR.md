# Registro · Texto publicado en el PR #1

Lo que se comunicó al equipo al abrir la propuesta de cambio, guardado aquí
porque incluye el aviso a **@agenciaquin** sobre los dos compresores y sobre el
botón «⚡ Optimizar fotos». Si esa conversación sigue más adelante, conviene
saber qué se dijo exactamente y con qué números.

**PR:** https://github.com/agenciaquin/FUNNELISH/pull/1
**Rama:** `optimizacion-imagenes` · **Commit al abrirlo:** `54b0f9f`
**Título:** Comprimir las fotos al subirlas, para que el consumo deje de crecer

---

## Qué hace

Las fotos que sube el equipo entran al servidor y se guardan comprimidas: **1920 px, calidad 85**. Una foto de 5,6 MB queda en 446 kB y **no se distingue de la original**.

No cambia ninguna URL, ni cómo se usa el panel. Solo pesa menos lo que se guarda.

## Por qué

Las imágenes de `embudos/` pesaban **2,4 MB de media**. Ayer se recomprimieron las 723 que ya estaban subidas y se recuperaron **850 MB**. Medido esta mañana con tráfico real:

| | Antes | Ahora |
| --- | ---: | ---: |
| Peso medio servido a un navegador | 616 KB | **186 KB** |
| Una visita a `/colombia` | 20,98 MB | **2,14 MB** |
| Una visita a `/polo-textura` | 9,47 MB | **0,82 MB** |

Pero eso solo vacía el balde. **Este PR cierra el grifo**: en agosto entraron 1.260 MB de material nuevo a 884 kB de media. Sin esto, en unos meses volvemos al punto de partida.

## Qué toca

- `lib/optimizar-imagen-servidor.ts` — nuevo, comprime con `sharp`
- 4 rutas de subida: `funnels/imagen`, `plantillas-wa/imagen`, `catalogos/upload-imagen`, `funnels/video` (esta solo caché)
- `lib/imagen-comprimir.ts` — ver nota abajo
- `package.json` — añade `sharp`

Verificado: typecheck limpio, build correcto, y la ruta de subida probada contra un `next dev` real.

⚠️ **JPEG, nunca WebP.** Meta acepta el envío de un WebP y luego **no entrega el mensaje**. Se descubrió ayer con 6 campañas de remarketing que llevaban dos días fallando en silencio. Está comentado en el código para que no se repita.

---

## @agenciaquin — dos cosas que te tocan

Al fusionar con `master` me encontré con que **trabajamos en lo mismo el mismo día sin saberlo**. Tu `optimizar-fotos` (v170) es de las 17:50 y esto es de las 22:11. Lo cuento porque hay que decidir algo, no para deshacer nada tuyo.

**1. Hubo un conflicto en `lib/imagen-comprimir.ts`.** Los dos quitamos el salto de los PNG, con la misma idea. Lo resolví **combinando ambas versiones**, porque cada una acertaba en algo distinto:

- **Tuya:** el PNG transparente se redimensiona y se re-guarda como PNG. Mejor que la mía, que lo devolvía intacto — un logo de 5 MB se me escapaba entero.
- **Mía:** el PNG *sin* transparencia va a JPG. Ahí está el ahorro grande, porque la mayoría son fotos guardadas como PNG por error.

Ahora hace las dos. Échale un ojo por si no te cuadra.

**2. El botón «⚡ Optimizar fotos» no lo toqué**, pero conviene que sepas esto. Comparé tu configuración (1080/q72) con la de este PR (1920/q85) sobre 30 fotos reales, midiendo calidad contra el original a 1290 px, que es lo que ve un celular de verdad:

| | Peso medio | Calidad (SSIM) | |
| --- | ---: | ---: | --- |
| 1920/q85 | 245 kB | 0,9722 | no se distingue del original |
| 1080/q72 | 84 kB | 0,8963 | se nota a simple vista |

**La tuya ahorra 3 veces más, y eso es real.** El problema es que por debajo de ~0,95 los artefactos se ven sin comparar, y en fotos de ropa la textura es lo que vende. A cambio se ganan ~9 MB en un cupo de 250 GB que está al 36%: no hay factura que bajar.

El riesgo concreto: si alguien pulsa el botón en un embudo ya recomprimido, es una **segunda pasada con pérdida**. Son 98 fotos las que superan tu umbral de 300 kB. Revisé el bucket y `embudos-opt/` está vacío, así que no ha pasado nada.

Si te parece, subir su perfil a 1920/q85 son dos líneas y ambos caminos quedarían iguales. Pero es tu código y la decisión es tuya.

Todo el detalle y el script de medición están en `arreglos-supabase/HALLAZGO-dos-compresores.md` y `media-api/comparar-perfiles.ts`.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_011mMdTQE1hL5fwDxHr2cGwB
