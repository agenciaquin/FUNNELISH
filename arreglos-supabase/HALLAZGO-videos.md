# Hallazgo · Los vídeos: 227 MB que nadie sirve y 23 MB que se descargan de más

**Fecha:** 31 de agosto de 2026 · **corregido el 01-09-2026**
**Proyecto:** `quinchat` · bucket `chat-media`
**Estado:** medido · **el arreglo de código está aplicado** · el backfill queda pendiente de aprobación

---

## CORRECCIÓN DEL 01-09-2026 — leer antes de borrar nada

> [!CAUTION]
> **La cifra de 449 MB huérfanos era falsa. La mitad son chats de clientes.**
>
> La consulta original cruzaba el bucket **solo contra la tabla `funnels`**. Pero
> `embudos/` no guarda solo vídeos de embudos: existe `embudos/chat/`, con vídeos
> de conversaciones reales de WhatsApp que viven en la tabla **`messages`**. Como
> ningún embudo los nombra, salían marcados como huérfanos.
>
> **Borrar los 28 habría dejado 10 conversaciones con el vídeo roto en el panel.**
>
> La cifra correcta de huérfanos es **18 archivos, 226,8 MB**. La consulta buena
> —la que cruza contra las dos tablas— está al final de este documento.

> [!IMPORTANT]
> **La regla que deja esto:** un bucket puede recibir archivos de más de un
> sistema. Antes de declarar algo huérfano, cruzarlo contra **todas** las tablas
> que puedan nombrarlo, no solo contra la obvia.

## Resumen para decidir

Tras la pasada de imágenes, **el vídeo es lo que más pesa** de `embudos/`: 486 MB
frente a 84 MB de fotos. Pero al mirarlo de cerca el problema no era el que
parecía, y buena parte de ese peso **no se debe comprimir, se debe decidir si
se borra**.

| | Vídeos | Peso | Qué hacer |
| --- | ---: | ---: | --- |
| Referenciados por algún embudo | **4** | 36,8 MB | Comprimir — aunque solo uno mejora, ver abajo |
| **Son chats** — están en `messages` | **10** | **222,7 MB** | 🔴 **NO TOCAR.** Es historial de clientes |
| **Huérfanos de verdad** | **18** | **226,8 MB** | **No comprimir. Decidir si se borran** |
| Total en `embudos/` | 32 | 486,3 MB | |

Esos 226,8 MB no los pide ningún cliente: no generan egress, solo ocupan.
Comprimirlos serían horas de `ffmpeg` para ahorrar almacenamiento en un cupo que
está al 36 % de 250 GB. **Borrarlos recupera 226,8 MB de golpe**, bastante más de
lo que daría comprimirlos y sin tocar un solo píxel de lo que se sirve.

### Los 18 huérfanos, uno por uno

Comprobados el 01-09-2026 contra `funnels`, `messages`, `plantillas`,
`plantillas_embudo`, `catalogos_bot`, `disparadores` y `carritos_abandonados`.
Ninguna tabla los nombra.

| Carpeta | Archivo | MB | Subido |
| --- | --- | ---: | --- |
| `america-fc` | `media-1785989890192-4rk49.mp4` | 37,7 | 06-08 |
| `america tk` | `media-1785985978220-qgyzc.mp4` | 37,7 | 06-08 |
| `spiderman-tend-copia` | `media-1785899223019-vguxt.mp4` | 21,1 | 05-08 |
| `VOLKSWAGEN` | `media-1785963174256-nny7b.mp4` | 19,1 | 05-08 |
| `bts` | `media-1784683090961-fxb20.mp4` | 16,2 | 22-07 |
| `FORMULA 1` | `media-1784739357167-3aejg.mp4` | 13,5 | 22-07 |
| `Parejas` | `media-1786202622088-l19ii.mp4` | 12,9 | 08-08 |
| `formula-1` | `media-1784756449641-91tg9.mp4` | 11,1 | 22-07 |
| `FORMULA 1` | `media-1784739453910-sfvs4.mp4` | 10,9 | 22-07 |
| `MOTEROS` | `media-1785199923167-jnpw7.mp4` | 9,2 | 28-07 |
| `formula-1` | `media-1785188327947-fnnr3.mp4` | 8,9 | 27-07 |
| `MOTEROS` | `media-1785200811824-7b81g.mp4` | 8,9 | 28-07 |
| `america tk` | `media-1785985936137-isa01.mp4` | 4,5 | 06-08 |
| `america tk` | `media-1785985949467-jnyo4.mp4` | 4,5 | 06-08 |
| `MOTEROS` | `media-1785200000041-ncmoy.mp4` | 3,7 | 28-07 |
| `Parejas` | `media-1786201990033-xoym5.mp4` | 2,6 | 08-08 |
| `formula-1` | `media-1786741108680-tifxn.mp4` | 2,3 | 14-08 |
| `Parejas` | `media-1786202838265-jqlon.mp4` | 1,9 | 08-08 |

**Qué son.** Restos de edición: se subió un vídeo al embudo, luego se cambió por
otro, y el primero se quedó en el bucket. Se nota en los nombres de carpeta
—`MOTEROS`, `FORMULA 1`, `america tk`, con mayúsculas y espacios— que salen del
**nombre visible** del embudo y no del slug; el panel ya no las escribe así. Los
embudos correspondientes siguen vivos (`moteros`, `formula-1`, `america-tk`): lo
muerto es el archivo, no el embudo.

---

## Dónde estaban los vídeos que sí se usan

Ninguno está en la galería ni como vídeo de portada: los cuatro viven en
`imagen_clientes` e `imagen_detalle`, que son secciones **de más abajo** en la
página de venta.

| Vídeo | Peso | Lo usan |
| --- | ---: | --- |
| `embudos/america-fc-copia/…njgwa.mp4` | 23,0 MB | `pareja`, `pareja-tk` |
| `embudos/spiderman-tend/…vecu4.mp4` | 9,3 MB | `spiderman-tend` |
| `embudos/formula-1/…pzdjz.mp4` | 2,7 MB | **14 embudos activos** |
| `embudos/america-fc-copia/…1dy1k.mp4` | 1,9 MB | `pareja`, `pareja-tk` |

El de 2,7 MB es el que más se sirve con diferencia. El de 23 MB es el que más
duele por visita.

---

## El defecto de verdad: se descargaban sin que nadie los viera

`components/publico/Medio.tsx` llamaba a `play()` en cuanto el componente se
montaba. En un `<video autoPlay>` eso **dispara la descarga completa del
archivo**, esté donde esté en la página.

Como estos vídeos van en secciones de más abajo, el resultado era que **cada
visita a `pareja` se traía 23 MB aunque el cliente no bajara nunca hasta ahí**.
Y había una segunda vía: los escuchadores de audio se registraban al montar, así
que un toque en cualquier parte de la página llamaba a `play()` y arrancaba la
descarga igual.

### Lo aplicado

`Medio.tsx` ahora:

- lleva `preload="none"` y **ya no lleva `autoPlay`**;
- arranca con un `IntersectionObserver` cuando el vídeo se acerca a la pantalla
  (300 px de margen, para que no se vea el recuadro en negro al llegar);
- registra los escuchadores de audio **en ese momento**, no antes;
- conserva intacto todo lo demás: bucle, silencio inicial, el botón 🔊, el toque
  para el sonido y el reinicio automático si el navegador lo pausa.

Un navegador sin `IntersectionObserver` se comporta como antes.

**Esto no ahorra almacenamiento: ahorra egress, que es la factura que importa.**
Y es gratis, no toca ni un archivo del bucket.

---

## Cuánto daría comprimir, medido de verdad

Con `--simular`, que comprime pero **no escribe nada**:

```
3 huérfanos grandes   126,9 MB ->  33,9 MB   (-73,3%)
huérfano spiderman     21,1 MB ->   7,8 MB   (-62,9%)
huérfano formula-1     11,1 MB ->   9,3 MB   (-15,8%)
```

Y sobre los cuatro **que sí se usan**, que es lo que de verdad importa:

| Vídeo en uso | Antes | Después | Ahorro |
| --- | ---: | ---: | ---: |
| el de `pareja` | 23,0 MB | 5,1 MB | **−77,9 %** |
| el otro de `pareja` | 1,9 MB | 1,3 MB | −27,6 % |
| el de `spiderman-tend` | 9,3 MB | — | **0** |
| el de los 14 embudos | 2,7 MB | — | **0** |

> **Conclusión incómoda pero útil: todo el trabajo de comprimir vídeo en uso se
> reduce a un archivo.** Los otros tres ya están bien codificados y `ffmpeg` no
> los mejora; la herramienta conserva el original cuando no gana nada. El ahorro
> total es de ~18,5 MB y **el beneficiario es `pareja` / `pareja-tk`**, nadie más.
> El vídeo que más se sirve —el que comparten 14 embudos— no admite mejora.

El ahorro no es parejo: va del 78 % al 0 % según cómo estuviera codificado el
original. Por eso no se estima: se simula.

### El comando, cuando se apruebe

```bash
cd arreglos-supabase/media-api
npm run backfill -- --prefijo "embudos/america-fc-copia" --solo video --simular   # comprobar
npm run backfill -- --prefijo "embudos/america-fc-copia" --solo video --aplicar   # sustituir
```

Igual para `embudos/spiderman-tend` y `embudos/formula-1`. Cada archivo
sustituido deja su original en `_originales/`, así que se puede deshacer.

> [!CAUTION]
> **Ojo con `--prefijo`: es coincidencia de texto, no de carpeta.**
> `embudos/spiderman-tend` también alcanza `embudos/spiderman-tend-copia`. Mirar
> siempre la lista del `--simular` antes de lanzar el `--aplicar`.

---

## Apuntes recomendados para trabajar mejor

**1 · Antes de comprimir algo, preguntar si alguien lo sirve.**
Aquí se iban a comprimir 486 MB y resultó que 449 MB no los pide nadie. La
consulta que lo resuelve, cruzando el bucket contra la tabla, está abajo. Es un
minuto y cambia por completo qué trabajo merece la pena.

**2 · En vídeo, el ahorro está en la página antes que en el archivo.**
Comprimir el de 23 MB lo deja en 5,1 MB. No descargarlo hasta que se ve lo deja
en 0 para quien no baja. Lo segundo es gratis, reversible y da más.

**3 · `ffmpeg` no existe en el runtime de Vercel, y no hay que intentarlo.**
Es exactamente la misma trampa que `libvips` el 31-08: un binario nativo que en
el equipo de desarrollo está y en el servidor no. La ruta `funnels/video` ya lo
dice en un comentario. El vídeo se comprime fuera, con `media-api`.

**4 · Un `<video autoPlay>` es una descarga, no una decoración.**
Cualquier `<video>` nuevo en `components/publico/` nace con `preload="none"` y
arranca por visibilidad. Quedan por revisar con este criterio
`MiniaturaFlotante.tsx` —que monta el vídeo y lo reproduce a los 2 segundos, en
un recuadro de 112 px, a resolución completa— y `Galeria.tsx`, donde **todos**
los elementos del carrusel se montan a la vez con `autoPlay`: hoy no hay ningún
vídeo en galerías, pero el día que alguien suba tres, la visita se los baja los
tres.

**5 · El límite de subida son 50 MB y es demasiado alto.**
`funnels/video` acepta hasta 50 MB sin recodificar nada. Conviene bajarlo y
avisar en el panel, o esos archivos vuelven a entrar enteros.

**6 · Medir siempre con `--simular` primero.** No escribe nada y da la cifra
real. Estimar el ahorro de un vídeo «a ojo» falla: aquí fue del 78 % en uno y
del 0 % en otro del mismo embudo.

---

## La consulta de huérfanos

> [!CAUTION]
> **Esta es la versión corregida del 01-09-2026.** La primera solo cruzaba
> contra `funnels` y marcaba como huérfanos 10 vídeos de chat que sí están en
> uso. Si encuentras por ahí una versión sin el `messages`, está mal.

```sql
with vids as (
  select name, regexp_replace(name,'^.*/','') as base,
         (metadata->>'size')::bigint as bytes
  from storage.objects
  where bucket_id='chat-media'
    and metadata->>'mimetype' like 'video/%'
    and name like 'embudos/%'
)
select
  case
    when exists (select 1 from funnels f  where to_jsonb(f)::text like '%'||v.base||'%')
      then '1 · EN USO en un embudo'
    when exists (select 1 from messages m where m.content       like '%'||v.base||'%')
      then '2 · ES UN CHAT — no tocar'
    else '3 · huerfano de verdad'
  end as clase,
  count(*) as archivos,
  round(sum(bytes)/1048576.0,1) as mb
from vids v
group by 1 order by 1;
```

Quitando el `group by` y poniendo `v.name, v.bytes` en el `select` sale la lista
archivo por archivo.

**Sirve igual para fotos** cambiando el `mimetype` a `image/%`. **No está
comprobada contra fotos todavía** — es probable que haya huérfanas también, y ese
es el siguiente sitio donde mirar. Ojo: ahí el cruce necesita además
`catalogo_colores` y `catalogo_variables`, que también guardan URLs de imagen.

---

## Qué queda pendiente

| | |
| --- | --- |
| Comprimir el vídeo de 23 MB de `pareja` | ⏳ pendiente de aprobación · −17,9 MB · los otros tres no mejoran |
| Borrar los **18** vídeos huérfanos | ⏳ **decisión del equipo** · recupera **226,8 MB** · irreversible · lista arriba |
| 🔴 **NO borrar los 10 de `embudos/chat/`** | Son historial de clientes, están en `messages`. 222,7 MB que se quedan |
| Publicar el arreglo de `Medio.tsx` | ⏳ **sin subir a `master`**: subirlo publica `pedido.klixmant.shop` |
| Revisar `MiniaturaFlotante` y `Galeria` | ⏳ mismo criterio de `preload` |
| Buscar fotos huérfanas | ⏳ con la consulta de arriba |

> [!CAUTION]
> **Los 10 vídeos de `embudos/chat/` no se borran nunca.** Son historial de
> conversaciones de clientes y están referenciados en `messages`. Son 222,7 MB
> que se quedan donde están.

> [!IMPORTANT]
> **Antes de borrar los 18, arreglar el grifo.** Nada en el código borra del
> bucket, así que los huérfanos se vuelven a acumular solos: ~2 GB al año. Ver
> `HALLAZGO-nadie-borra-del-bucket.md`.
