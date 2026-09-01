# Hallazgo · Los vídeos: 449 MB que nadie sirve y 23 MB que se descargan de más

**Fecha:** 31 de agosto de 2026
**Proyecto:** `quinchat` · bucket `chat-media`
**Estado:** medido · **el arreglo de código está aplicado** · el backfill queda pendiente de aprobación

---

## Resumen para decidir

Tras la pasada de imágenes, **el vídeo es lo que más pesa** de `embudos/`: 486 MB
frente a 84 MB de fotos. Pero al mirarlo de cerca el problema no era el que
parecía, y la mayor parte de ese peso **no se debe comprimir, se debe decidir si
se borra**.

| | Vídeos | Peso | Qué hacer |
| --- | ---: | ---: | --- |
| Referenciados por algún embudo | **4** | 36,9 MB | Comprimir — aunque solo uno mejora, ver abajo |
| **Huérfanos** (ningún embudo los nombra) | **28** | **449 MB** | **No comprimir. Decidir si se borran** |
| Total en `embudos/` | 32 | 486 MB | |

El 92 % del peso en vídeo no lo pide ningún cliente: no genera egress, solo
ocupa. Comprimirlo serían horas de `ffmpeg` para ahorrar almacenamiento en un
cupo que está al 36 % de 250 GB. **Borrarlo recupera 449 MB de golpe**, cuatro
veces más de lo que daría comprimirlo (~330 MB) y sin tocar un solo píxel de lo
que se sirve.

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

⚠️ **Ojo con `--prefijo`: es coincidencia de texto, no de carpeta.**
`embudos/spiderman-tend` también alcanza `embudos/spiderman-tend-copia`. Mirar
siempre la lista del `--simular` antes de lanzar el `--aplicar`.

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

```sql
with vids as (
  select name, regexp_replace(name,'^.*/','') as base,
         (metadata->>'size')::bigint as bytes
  from storage.objects
  where bucket_id='chat-media'
    and metadata->>'mimetype' like 'video/%'
    and name like 'embudos/%'
),
f as (select to_jsonb(funnels)::text as t from funnels)
select count(*) filter (where not exists (select 1 from f where f.t like '%'||v.base||'%')) as huerfanos,
       pg_size_pretty(sum(bytes) filter (where not exists (select 1 from f where f.t like '%'||v.base||'%'))) as peso
from vids v;
```

Sirve igual para fotos cambiando el `mimetype`. **No está comprobada contra
fotos todavía** — es probable que haya huérfanas también, y ese es el siguiente
sitio donde mirar.

---

## Qué queda pendiente

| | |
| --- | --- |
| Comprimir el vídeo de 23 MB de `pareja` | ⏳ pendiente de aprobación · −17,9 MB · los otros tres no mejoran |
| Borrar los 28 vídeos huérfanos | ⏳ **decisión del equipo** · recupera 449 MB · irreversible |
| Publicar el arreglo de `Medio.tsx` | ⏳ **sin subir a `master`**: subirlo publica `pedido.klixmant.shop` |
| Revisar `MiniaturaFlotante` y `Galeria` | ⏳ mismo criterio de `preload` |
| Buscar fotos huérfanas | ⏳ con la consulta de arriba |
