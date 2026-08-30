# Pendiente · `quin-comercial` no comprime nada

**Anotado:** 30 de agosto de 2026
**Decisión:** esperar a que pase el PR #1. Revisar mañana y, si el cambio sigue
siendo pequeño, aplicarlo.
**Motivo de la espera:** ahí trabajó agenciaquin ayer (v170–v173) y esa app **sí
se publica sola al fusionar**. Merece su propio PR y su propio momento.

---

## El problema en una línea

`quinchat` y `quin-comercial` son **dos aplicaciones casi gemelas** que escriben
en **el mismo bucket `chat-media`**. El PR #1 arregla una. La otra sigue
subiendo todo a tamaño completo.

| | `quinchat` | `quin-comercial` |
| --- | --- | --- |
| Rutas de subida | 7 | las mismas 7 |
| Bucket | `chat-media` | el mismo |
| Collages de pack | 2 sitios | 2 sitios |
| Comprime | sí, con el PR #1 | **nada** |
| Se publica al fusionar | no (va a mano) | **sí, automático** |

**Está vivo y atiende dos tiendas reales:** `www.klixmant.shop` y
`tienda.skioo.shop`.

---

## Lo que hay que cambiar

### 1 · Los collages — dos líneas, efecto medido

Jimp codifica JPEG a calidad 100 si no se le dice otra cosa. Es exactamente el
defecto nº 6 del reporte, sin corregir en esta app.

```
quin-comercial/lib/collage.ts:38
quin-comercial/app/api/funnelish/webhook/route.ts:271

  - const buffer = await canvas.getBufferAsync(Jimp.MIME_JPEG);
  + const buffer = await canvas.quality(85).getBufferAsync(Jimp.MIME_JPEG);
```

Medido sobre un collage real de 2700×900: **1.634 kB → 442 kB (−73%)**.

Es el cambio de mejor relación esfuerzo/resultado que queda en todo el proyecto.

### 2 · Las rutas de subida — copiar lo del PR #1

Mismas cuatro que en `quinchat`, más `sharp` en `package.json`:

```
quin-comercial/app/api/funnels/imagen/route.ts
quin-comercial/app/api/plantillas-wa/imagen/route.ts
quin-comercial/app/api/catalogos/upload-imagen/route.ts
quin-comercial/app/api/funnels/video/route.ts        (solo caché)
```

Se copia `lib/optimizar-imagen-servidor.ts` tal cual y se llama igual. El
trabajo de diseño ya está hecho y probado; aquí es aplicarlo.

> **No unificar las dos apps.** Se parecen tanto que probablemente deberían ser
> una sola con dos configuraciones, pero eso es una reforma grande y arriesgada
> que nadie ha pedido. Copiar es lo correcto hoy.

---

## La cifra que hay que vigilar

Lo que entra nuevo al bucket cada día. Si sube, el grifo sigue abierto.

| Día | Archivos | Entró | Peso medio | Pasan de 300 kB |
| --- | ---: | ---: | ---: | ---: |
| **2026-08-30** *(parcial, limpio)* | 2 | 1.715 kB | **858 kB** | 1 |
| 2026-08-29 | 9 | 9.527 kB | 1.059 kB | 6 |
| 2026-08-28 | 57 | 13 MB | 236 kB | 7 |
| 2026-08-27 | 34 | 16 MB | 487 kB | 12 |
| 2026-08-26 | 36 | 25 MB | 699 kB | 15 |

> ⚠️ **Los días 23 al 28 están contaminados.** El backfill recomprimió esos
> archivos *en su sitio*, así que el peso que se ve ahora no es el que entró:
> es el que dejamos nosotros. Sirven para el orden de magnitud, no para comparar.
>
> **Solo el 30 en adelante es limpio.**

### La consulta, para repetirla igual

```sql
select to_char(created_at at time zone 'America/Bogota','YYYY-MM-DD') dia,
       count(*) archivos,
       pg_size_pretty(sum((metadata->>'size')::bigint)) entra,
       pg_size_pretty((avg((metadata->>'size')::bigint))::bigint) medio,
       count(*) filter (where (metadata->>'size')::bigint > 307200) pesados
from storage.objects
where bucket_id='chat-media' and name not like '_originales/%'
  and coalesce(metadata->>'mimetype','') like 'image/%'
  and created_at > (now() at time zone 'America/Bogota') - interval '7 days'
group by 1 order by 1 desc
```

---

## Cómo decidir mañana

**Con el PR #1 publicado**, el peso medio de lo que entra debería bajar de 858 kB
a menos de 200 kB.

- **Si baja** → `quinchat` era el origen principal. `quin-comercial` puede
  esperar a su turno con calma.
- **Si NO baja** → lo que entra viene de `quin-comercial`, y entonces esto deja
  de ser un pendiente ordenado y pasa a ser lo siguiente que se hace.

En cualquiera de los dos casos, **los dos cambios de los collages valen la pena
igual**: son dos líneas y un 73% menos por archivo.

---

## Qué NO se tocó, y por qué

- **Nada de `quin-comercial`.** Ni un archivo. Lo de arriba está medido y
  escrito, pero no aplicado.
- **`lib/collage.ts` descarga las fotos en paralelo sin límite** en las dos
  apps — es el defecto nº 5 del reporte, y sigue sin corregir. Son unas diez
  líneas. Cuando se toque `collage.ts` para lo de la calidad, conviene decidir
  si se arreglan las dos cosas de una vez o por separado.
