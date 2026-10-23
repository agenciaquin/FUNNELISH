# Medición de egress · 30 de agosto de 2026

Comparativa contra `LINEA-BASE-egress-2026-08-29.md`, con **8 h 37 min de
tráfico limpio** (30-ago 05:00 → 13:37 UTC), ya sin el backfill corriendo.

---

## El veredicto

| | Línea base 29-ago | Hoy 30-ago | |
| --- | ---: | ---: | --- |
| **Peso medio servido a navegadores** | 616 KiB | **185,87 KiB** | **−69,8%** |
| Mediana por petición | — | 163 KiB | |
| Errores 4xx/5xx | — | **0 de 402** | |
| Caché CDN (HIT) | 93% | 88% | |

El umbral que se fijó ayer era **«por debajo de 300 KiB confirma que
funciona»**. Se cumple con holgura, y dentro del rango previsto de 150-250 KiB.

---

## La evidencia más limpia: el corte intradía

El peso medio por petición de navegador, hora a hora. El escalón cae justo
donde terminó el último lote del backfill:

| Franja (UTC) | Peso medio por petición |
| --- | ---: |
| 29-ago 14:00 → 23:00 | 363 – 651 KiB |
| 30-ago 00:00 → 02:00 | 923 / 370 / 458 KiB *(backfill de `packs/` en marcha)* |
| **30-ago 03:00 → 13:37** | **162 – 235 KiB, sin una sola excepción** |

Mismo tráfico, mismos embudos, mismos clientes. Lo único que cambió fueron los
archivos.

---

## Reparto por carpeta (navegadores, ventana limpia)

| Carpeta | Peticiones | Egress | Peso medio |
| --- | ---: | ---: | ---: |
| `embudos/` | 252 | 44,92 MiB | 182,51 KiB |
| `catalogo/` | 10 | 2,64 MiB | 270,56 KiB |

---

## Comprobación independiente

`pesar-landing.ts colombia` — no depende del tráfico, así que sirve para
descartar que alguien haya revertido o resubido archivos pesados:

```
Se descargaba ANTES  : 20.98 MB
Se descarga AHORA    : 2.14 MB
Ahorro por visita    : 18.84 MB  (90.0%)
```

Idéntico a ayer. Los 723 archivos siguen íntegros.

---

## Almacenamiento a día de hoy

| | Archivos | Peso | Medio |
| --- | ---: | ---: | ---: |
| `_originales/` (respaldo, borrable) | 723 | 1.010 MB | 1.431 kB |
| **Vídeos, sin comprimir** | **38** | **515 MB** | **14 MB** |
| Imágenes comprimidas | 773 | 171 MB | 227 kB |
| Resto (`ventas/`, `entrantes/`, chats) | 1.434 | 407 MB | 291 kB |

Bucket sin el respaldo: **1.093 MB**. Con él: 2.103 MB.

**El dato que cambia la siguiente prioridad:** de esos 1.093 MB, **515 MB —el
47%— son 38 vídeos**. Las 773 imágenes que costaron toda la jornada de ayer
pesan hoy 171 MB, el 16%.

En egress pasa lo mismo a menor escala: en 24 h, **30 peticiones de vídeo se
llevaron 153,68 MiB** (5,1 MiB cada una) frente a 1,10 GiB en 2.675 peticiones
de imagen. El 1% de las peticiones, el 12% del egress.

---

## Lo que esta medición NO demuestra

La ventana limpia cae de madrugada en Colombia (00:00 – 08:37), la franja de
menos tráfico del día.

- **Sí es válido** el peso medio por petición: es una media por petición, no por
  hora, y no depende de cuánta gente entre.
- **No es válido** comparar volumen de peticiones ni proyectar el egress diario
  todavía. Para eso hace falta un día natural completo sin backfill.

Proyección prudente, a confirmar: si el peso por petición se mantiene un 70% más
bajo y el volumen no cambia, los ~91 GB/mes estimados caerían a **~27-30 GB**.

**La cifra que manda sigue siendo Settings → Usage** del panel. Todo lo anterior
sale de sumar `content_length` sobre registros: es una estimación, no la factura.
