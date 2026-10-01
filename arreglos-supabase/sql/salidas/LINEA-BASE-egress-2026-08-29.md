# Línea base de egress · 29 de agosto de 2026

Referencia para medir el efecto real de la compresión. Tomada **el mismo día del
backfill**, así que viene contaminada — abajo se explica cómo separarlo.

**Se compara mañana**, con 6 h o más de tráfico limpio.

---

## El problema de medir hoy

El backfill descarga cada archivo para recomprimirlo, y eso también es egress.
Separando por agente sobre la ventana de 24 h:

| Origen | Peticiones | Egress | Peso medio |
| --- | ---: | ---: | ---: |
| **Navegadores reales** | 3.091 | 1,82 GiB | **616 KiB** |
| Nuestro backfill | 2.596 | 2,52 GiB | 1.016 KiB |
| Otros | 457 | 331 MiB | 742 KiB |

**La cifra que importa es el peso medio servido a navegadores: 616 KiB.**
Es la única comparable, porque no depende de cuánta gente visite ese día.

---

## Reparto por carpeta, antes de comprimir

| Carpeta | Egress / 24 h | % |
| --- | ---: | ---: |
| `embudos/` | 2,53 GiB | 88% |
| `catalogo/` | 301 MiB | 10% |
| Resto | 50 MiB | 2% |
| **Total** | **~2,88 GiB/día** | |

Caché: **93% servido desde CDN** (`HIT`), 6,3% `MISS`, 0,5% `REVALIDATED`.

---

## Qué esperar mañana

Con 723 archivos recomprimidos al 84,2% de media, el peso medio servido a
navegadores debería caer de **616 KiB a unos 150-250 KiB**.

No bajará al 16% exacto porque:

- El tráfico se reparte entre archivos comprimidos y los que no compensaba tocar
- La caché del navegador sirve versiones viejas durante un tiempo
- `ventas/` y `entrantes/` no se tocaron a propósito

**Una caída por debajo de 300 KiB ya confirma que funciona.**

---

## Las consultas, para repetirlas igual

Ejecutar en el **Logs Explorer** del panel de Supabase.

> ⚠️ El endpoint de registros por API se retira el **23 de septiembre de 2026**.
> Desde el panel seguirá funcionando.

### 1 · Peso medio servido a navegadores — la cifra clave

```sql
select toStartOfHour(timestamp) as hora,
       count(*) as peticiones,
       formatReadableSize(round(avg(toUInt64OrZero(log_attributes['response.headers.content_length'])))) as peso_medio,
       formatReadableSize(sum(toUInt64OrZero(log_attributes['response.headers.content_length']))) as egress,
       countIf(toUInt16OrZero(log_attributes['response.status_code']) >= 400) as errores
from logs
where source = 'edge_logs'
  and log_attributes['request.path'] like '/storage/v1/object/public/chat-media/%'
  and position(log_attributes['request.headers.user_agent'], 'Mozilla') > 0
group by hora order by hora desc limit 24
```

### 2 · Separar navegadores de procesos automáticos

```sql
select multiIf(
         position(log_attributes['request.headers.user_agent'], 'Mozilla') > 0, 'navegador real',
         position(log_attributes['request.headers.user_agent'], 'node') > 0, 'proceso automatico',
         'otro') as origen,
       count(*) as peticiones,
       formatReadableSize(sum(toUInt64OrZero(log_attributes['response.headers.content_length']))) as egress,
       formatReadableSize(round(avg(toUInt64OrZero(log_attributes['response.headers.content_length'])))) as peso_medio
from logs
where source = 'edge_logs'
  and log_attributes['request.path'] like '/storage/v1/object/public/chat-media/%'
group by origen order by peticiones desc
```

### 3 · Reparto por carpeta

```sql
select splitByChar('/', log_attributes['request.path'])[7] as carpeta,
       count(*) as peticiones,
       formatReadableSize(sum(toUInt64OrZero(log_attributes['response.headers.content_length']))) as egress
from logs
where source = 'edge_logs'
  and log_attributes['request.path'] like '/storage/v1/object/public/chat-media/%'
group by carpeta order by sum(toUInt64OrZero(log_attributes['response.headers.content_length'])) desc
```

### 4 · Lo mismo desde fuera de los registros

```bash
cd arreglos-supabase/media-api
npx tsx pesar-landing.ts colombia
npx tsx pesar-landing.ts polo-textura
```

Referencia de hoy: `/colombia` **20,98 → 2,14 MB** por visita, `/polo-textura`
**9,47 → 0,82 MB**. Mañana deben dar lo mismo: no dependen del tráfico.

---

## Y la cifra que manda

**Settings → Usage** del panel de Supabase. Todo lo anterior sale de sumar
`content_length` sobre registros: es una estimación, no la factura.

Hoy: **36% del cupo de 250 GB**.
