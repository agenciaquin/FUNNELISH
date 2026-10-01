# Hallazgo · Nadie borra del bucket: 264 MB muertos y subiendo

**Fecha:** 1 de septiembre de 2026
**Proyecto:** `quinchat` · bucket `chat-media`, prefijo `embudos/`
**Estado:** medido · **sin arreglo aplicado** · pendiente de decisión

---

## Resumen para decidir

**Tres de cada cuatro megas que se han subido a `embudos/` están muertos.** No los
nombra ninguna tabla, no los pide ningún navegador, y no hay nada en el código
que los vaya a borrar nunca.

| | Archivos | Peso |
| --- | ---: | ---: |
| Subido a `embudos/` desde julio | 404 | 350,7 MB |
| **De eso, muerto** | **155** | **264,0 MB (75 %)** |

Esto salió al preparar el borrado de los 18 vídeos huérfanos
(`HALLAZGO-videos.md`). Los 18 son la parte visible: el resto son 137 imágenes.
Y sobre todo, **son el resultado de un proceso que sigue funcionando igual hoy**.

> [!IMPORTANT]
> Borrar los 264 MB limpia el charco. **El grifo sigue abierto**, y en seis meses
> habrá otro charco parecido.

---

## Las cifras

Cruzado el 01-09-2026 contra **nueve tablas**: `funnels`, `messages`,
`plantillas`, `plantillas_embudo`, `catalogo_colores`, `catalogo_variables`,
`catalogos_bot`, `disparadores` y `carritos_abandonados`.

### Por mes

| Mes | Subido | Quedó muerto | % del peso |
| --- | ---: | ---: | ---: |
| Julio 2026 | 111,6 MB · 121 archivos | **96,4 MB · 61** | 86 % |
| Agosto 2026 | 239,1 MB · 283 archivos | **167,6 MB · 94** | 70 % |
| **Total** | **350,7 MB · 404** | **264,0 MB · 155** | **75 %** |

### Por tipo

| | Subidos | En uso | Muertos | Peso muerto |
| --- | ---: | ---: | ---: | ---: |
| Vídeo | 22 | **4** | **18** | 226,8 MB |
| Imagen | 382 | 245 | 137 | 37,2 MB |

En vídeo el desperdicio es casi total: de 22 subidos se sirven 4. En imagen la
proporción es más sana, pero 137 archivos siguen siendo 137 archivos.

**El ritmo va en aumento:** julio dejó 96 MB muertos, agosto 168. Crece con la
actividad —más embudos, más restos—, no con el calendario. Al ritmo de agosto son
unos **2 GB al año** de basura.

---

## La causa: no existe el borrado

Buscado en `quinchat/` y en `quin-comercial/`: **no hay ni una sola llamada que
borre un archivo de Supabase Storage.** Todos los `.remove()` que aparecen en el
código son del navegador (`elemento.remove()`), no del bucket.

No es que esté mal escrito. **Es que nunca se escribió.**

### Los tres sitios donde se pierde

| Cuándo | Qué pasa | Dónde está |
| --- | --- | --- |
| **Se sustituye una foto o un vídeo** de un embudo | El `POST` reescribe la fila entera con las URL nuevas. La URL vieja desaparece de la tabla y **el archivo se queda en el bucket, ya sin dueño** | `quinchat/app/api/funnels/route.ts` → `POST` (línea 33) |
| **Se borra un embudo de verdad** | Se borra la fila y nada más. Sus fotos y vídeos se quedan para siempre | mismo archivo → `DELETE` (línea 148) |
| **Se suben tres versiones hasta acertar** | Las dos primeras se quedan | igual que el primero |

La papelera (`PATCH` con `accion: 'eliminar'`) marca `eliminado = true` sin tocar
la fila ni el bucket. **Eso está bien y no hay que cambiarlo**: es reversible, y
un embudo en la papelera sigue apareciendo como dueño de sus archivos en la
consulta de huérfanos.

---

## Qué tan grave es (sin exagerar)

**Como factura, no lo es.** El almacenamiento total del proyecto son 2,3 GB
repartidos así:

| | |
| --- | ---: |
| `chat-media` | 2.111,3 MB |
| `catalogo-imagenes` | 200,5 MB |
| `plantillas-images` | 12,3 MB |
| **Total** | **2.324,1 MB** |

No hay ningún límite cerca. Estos 264 MB son el 11 % de todo lo guardado, y
`_originales/` —las copias de la pasada de imágenes— pesa cuatro veces más él
solo (1.010 MB).

**Tampoco cuesta tráfico.** Un archivo que nadie referencia no genera ni una
petición: no aparece en la factura de egress, que es la que importaba.

**Lo que sí cuesta es trabajo, y es acumulativo.** Cada auditoría futura tendrá
que volver a separar lo vivo de lo muerto, y esa separación **es delicada**: al
preparar el borrado de los vídeos, la primera consulta marcó como huérfanos 10
vídeos de conversaciones de clientes. Por poco se borran. Cuanta más basura,
más veces hay que hacer esa criba y más ocasiones de equivocarse.

Y hay un riesgo que sí puede ser abrupto: `funnels/video` acepta hasta **50 MB
sin recodificar**. Un mes con varios vídeos pesados multiplica la cifra de golpe.

---

## El arreglo propuesto

Pequeño, pero **es código en producción**: `pedido.klixmant.shop` publica solo
con cada envío a `master`. Va por el camino normal — plan, revisión y una sola
publicación.

**1 · Al sustituir media, borrar la anterior.**
En el `POST` de `funnels`, comparar las URL de la fila que ya existe contra las
que llegan. Las que desaparezcan y apunten a `embudos/<slug>/`, borrarlas del
bucket. Campos a mirar: `imagenes`, `imagen_banner`, `imagen_clientes`,
`imagen_detalle`, `video_url`, `miniatura_url` y lo que viva en los bloques.

**2 · Al borrar un embudo de verdad, borrar su carpeta.**
En el `DELETE`, listar `embudos/<slug>/` y vaciarla. Solo en el borrado
permanente — **nunca en la papelera**.

**3 · Una limpieza única de los 264 MB ya acumulados.**
Después de lo anterior, no antes: si se limpia primero, se vuelve a ensuciar.

### Cuidado al implementarlo

> [!CAUTION]
> **Un archivo puede tener más de un dueño.** Los embudos `-copia` comparten
> media con el original: el vídeo de 2,7 MB lo usan **14 embudos**. Antes de
> borrar hay que comprobar que **ningún otro embudo** referencia esa URL, no solo
> el que se está guardando. **Un borrado ingenuo rompe 13 embudos vivos.**

> [!CAUTION]
> **`embudos/chat/` no es de los embudos.** Guarda vídeos de conversaciones de
> WhatsApp que viven en `messages`. Cualquier barrido por prefijo tiene que
> excluirlo, o borra historial de clientes. Ver `HALLAZGO-videos.md`.

> [!WARNING]
> **La papelera no se toca.** Un embudo con `eliminado = true` sigue siendo dueño
> de sus archivos; si se restaura, tienen que seguir ahí.

> [!WARNING]
> **Fallar borrando no debe romper el guardado.** Si el borrado del archivo viejo
> falla, el embudo tiene que guardarse igual. Basura de más es molesto; un
> guardado perdido es un problema de verdad.

---

## Lo que no está comprobado

> [!WARNING]
> Las cifras de arriba están medidas. **Esto no.** Se anota como hueco abierto, y
> la fila B en particular es la razón para **mover a `_borrar/` antes que
> eliminar**.

| # | Suposición | Cómo se cierra |
| --- | --- | --- |
| A | **Los 155 son huérfanos de verdad.** Cruzado contra 9 tablas, pero el cruce es coincidencia de texto sobre el nombre del archivo | Repetir la consulta **justo antes de borrar**, no antes. Un archivo puede haberse enlazado desde entonces |
| B | **Nada fuera de la base de datos los enlaza.** Un anuncio de Meta, un mensaje ya enviado por WhatsApp o un enlace pegado a mano apuntan a la URL pública y no dejan rastro en ninguna tabla | No se puede cerrar del todo. Es un argumento para mover a `_borrar/` antes que eliminar |
| C | **El arreglo del `POST` cubre todos los campos de media** | Repasar el editor de bloques: `EditorBloqueLateral.tsx` guarda URL dentro de `bloques` (jsonb), y ahí puede haber campos que no estén en la lista de arriba |
| D | **`quin-comercial` tiene el mismo defecto** | Muy probable —comparte el código del panel— pero **no se ha medido**. Su bucket es otro proyecto de Supabase |

---

## La consulta

```sql
with obj as (
  select name, regexp_replace(name,'^.*/','') as base,
         (metadata->>'size')::bigint as bytes,
         case when metadata->>'mimetype' like 'video/%' then 'video' else 'imagen' end as tipo,
         created_at
  from storage.objects
  where bucket_id='chat-media'
    and name like 'embudos/%'
    and name not like 'embudos/chat/%'   -- OJO: esto es media de chat, no de embudos
),
clas as (
  select o.*,
    (   exists (select 1 from funnels f             where to_jsonb(f)::text  like '%'||o.base||'%')
     or exists (select 1 from messages m            where m.content          like '%'||o.base||'%')
     or exists (select 1 from plantillas x          where to_jsonb(x)::text  like '%'||o.base||'%')
     or exists (select 1 from plantillas_embudo x   where to_jsonb(x)::text  like '%'||o.base||'%')
     or exists (select 1 from catalogo_colores x    where to_jsonb(x)::text  like '%'||o.base||'%')
     or exists (select 1 from catalogo_variables x  where to_jsonb(x)::text  like '%'||o.base||'%')
     or exists (select 1 from catalogos_bot x       where to_jsonb(x)::text  like '%'||o.base||'%')
     or exists (select 1 from disparadores x        where to_jsonb(x)::text  like '%'||o.base||'%')
     or exists (select 1 from carritos_abandonados x where to_jsonb(x)::text like '%'||o.base||'%')
    ) as usado
  from obj o
)
select to_char(date_trunc('month', created_at),'YYYY-MM') as mes, tipo,
       count(*) filter (where not usado) as muertos,
       round(sum(bytes) filter (where not usado)/1048576.0,1) as mb_muertos,
       count(*) as total,
       round(sum(bytes)/1048576.0,1) as mb_total
from clas
group by 1,2 order by 1,2;
```

Cambiando el `group by` por `select name, bytes ... where not usado` sale la
lista archivo por archivo.

---

## Qué queda pendiente

| | |
| --- | --- |
| **Arreglar el `POST`**: borrar la media sustituida | ⏳ **decisión** · con la comprobación de «ningún otro embudo la usa» |
| **Arreglar el `DELETE`**: vaciar la carpeta del embudo | ⏳ **decisión** · solo en el borrado permanente |
| Limpiar los 264 MB acumulados | ⏳ **después** de lo anterior, no antes |
| Bajar el límite de 50 MB de `funnels/video` | ⏳ ya anotado en `HALLAZGO-videos.md`, apunte 5 |
| Medir lo mismo en `quin-comercial` | ⏳ sin empezar (suposición D) |

> [!IMPORTANT]
> **Orden recomendado: primero el grifo, luego el charco.** Al revés se limpia
> dos veces.
