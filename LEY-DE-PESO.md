# LEY DE PESO · Todo archivo que entre llega ligero, sin perder calidad visible

**Decidido por dirección el 30-09-2026.** Aplica a `quinchat/`, `quin-comercial/` y a cualquier app o script
futuro. Amplía la LEY de imágenes de `CLAUDE.md` (toda imagen pasa por el compresor del servidor) y la lleva a
**todos los formatos** y a **un tope máximo por archivo**.

**Todo agente lee esto antes de planear, escribir, revisar o probar cualquier cosa que suba, guarde, genere o
sirva un archivo.** Planeador, desarrollador, implementador, pruebas y auditor por igual.

---

## 1 · La regla

1. **Ningún archivo llega al almacenamiento (Supabase Storage o R2) por encima de su tope.** Se aplica a
   fotos, vídeos, GIF, SVG, collages, marcas de agua, capturas y cualquier archivo nuevo, entre por donde entre:
   panel, embudos, catálogo, plantillas, chat saliente, lo que entra por WhatsApp, URLs firmadas, crons o scripts.
2. **Bajar el peso nunca puede estropear lo que se ve.** Lo que vende es la textura de la prenda. El criterio no
   es "lo más pequeño posible", es "lo más pequeño **que no se note**": similitud con el original **SSIM ≥ 0,95**
   medida sobre el archivo real, y una revisión a ojo en móvil de las fotos de producto.
3. **El tope se cumple bajando por escalones, no de golpe:** primero formato y calidad; después dimensiones; y
   nunca por debajo de un mínimo de dimensiones. Si con el último escalón sigue sin caber, se aplica el punto 4.
4. **Si no cabe, la prioridad es ACEPTARLO, no rechazarlo** (decisión de dirección, 30-09-2026). No es un sí o
   un no: el archivo baja por niveles hasta que se acepta. Vale igual para el panel, los collages, las fotos de
   clientes y cualquier otra entrada.

   | Nivel | Qué se hace | Resultado |
   | --- | --- | --- |
   | **1 · Cabe** | Escalones normales de §2, sin pérdida visible | Se acepta, sin más |
   | **2 · Casi cabe** | La mejor versión de los escalones normales pesa hasta un **50 % por encima** del tope | Se acepta tal cual: la calidad manda sobre unos kB. Se registra `[ley-peso] tolerancia` |
   | **3 · Rescate** | Escalones extra solo para lo que sigue grande: fotos q70 y luego 1280 px; gráficos q85 con croma 4:4:4; vídeo CRF +2 | Si con eso cabe en tope + 50 %, se acepta y se registra `[ley-peso] rescate` |
   | **4 · Aceptado con aviso** | Nada de lo anterior basta | **Se guarda la mejor versión conseguida** y queda marcada para revisar. En el panel, aviso **visible pero no bloqueante** ("Subida. Pesa X, lo recomendado es Y; si puedes, usa una versión más ligera"). Sale en la vigilancia semanal |

   **Solo se rechaza lo que técnicamente no puede funcionar:** un archivo que no es lo que dice ser o está
   corrupto, un formato que el destino no admite y no se puede convertir, o algo que supera un límite externo que
   no controlamos: Meta no acepta más de 5 MB por imagen ni 16 MB por vídeo, y Vercel no admite más de ~4,5 MB por
   petición, que se resuelve subiendo por URL firmada, no rechazando. Incluso entonces, el mensaje dice **qué hacer**
   para que entre.

   Un cliente o un asesor **nunca** se queda sin enviar su contenido por una regla de peso.
5. **La compresión nunca se desactiva "para que funcione".** Si falla (formato raro, `sharp` no carga), se
   registra el error y se avisa; no se sube en silencio el original sin límite.
6. **Cada escritura se puede comprobar después:** `cacheControl` de 1 año (la marca de la LEY) y el peso
   visible en `storage.objects`. `arreglos-supabase/sql/` tendrá la consulta que liste lo que supere su tope.

---

## 2 · Topes por tipo (DEFINITIVOS · 30-09-2026)

Fijados con la medición del desarrollador sobre 29 archivos reales del almacenamiento
(`arreglos-supabase/MEDICION-TOPES.md`, script relanzable `quinchat/pruebas/medir-topes.ts`). Dirección delegó la
cifra en esa medición. Con estos topes y escalones, **28 de 29 archivos (97 %) cumplen con SSIM ≥ 0,95**.
El que falla es un banner con texto, y por eso los gráficos tienen su propia fila.

| Tipo | Tope | Escalones, en este orden | Nunca por debajo de | Notas |
| --- | ---: | --- | --- | --- |
| Foto de producto, landing o catálogo | **250 kB** | 1920 q85 → q80 → q75 → 1600 q75 → 1440 q75 | **1440 px** de lado mayor | Se baja **calidad antes que tamaño**: a 1280 y 1080 px el SSIM cae a 0,88–0,92. 18 de 22 fotos ya miden ≤ 1600 px |
| Foto que va por WhatsApp (plantillas, chat saliente) | **250 kB** | Igual | 1440 px | **Solo JPEG o PNG** (WhatsApp no acepta WebP ni AVIF) |
| Gráfico con texto (banner, promo, remarketing) | **400 kB** | q90 con croma 4:4:4 | 1440 px | El texto se ensucia con el croma normal |
| PNG con transparencia real | **250 kB** | Igual que las fotos, en PNG | 1440 px | Sin transparencia real → JPG |
| Foto que manda el cliente (entrantes) | **400 kB** | Igual | 1440 px | Con transparencia → JPG sobre blanco. Siempre se acepta (punto 4) |
| Vídeo de landing | **4 MB y como mucho 2 Mb/s** | H.264 720p CRF 26 → 24 si el SSIM no llega a 0,95; `faststart`; sin audio si se reproduce en silencio | 720p | Un CRF fijo no basta. Ejemplo medido: 23 MB → 1,6 MB con SSIM 0,981 |
| Vídeo de chat o WhatsApp | **10 MB** | H.264 720p CRF 26 | 480p | Meta rechaza más de 16 MB |
| SVG | **50 kB** | Optimizar (SVGO) y **limpiar scripts y enlaces externos** | — | **Sin medir**: hoy no hay ningún SVG ni GIF en los buckets ni en el repo |
| GIF animado | 1,5 MB | GIF → WebP animado (landing); hacia WhatsApp se convierte a vídeo MP4, que sí admite | — | Sin medir, por la misma razón |
| Documento o PDF | **5 MB** | — | — | Fuera del compresor; solo tope |

**Hay que corregir el compresor actual:** su regla de "solo guardar si ahorra al menos un 10 %" deja fotos por
encima del tope. Con el perfil de hoy solo cumplen 17 de 22 fotos. **Con tope, el tope manda.**

**Ahorro estimado aplicando los topes a lo que ya existe:** unos 770–830 MB (fotos ~580 MB, vídeos ~220 MB). Sumando
A1 (`_originales/`) y A2 (vídeos huérfanos), el almacenamiento de quinchat pasa de **2 502 MB a unos 450–500 MB**.

**Lo que queda sin comprobar:**
- **SVG y GIF:** sin muestras.
- **Los 10 vídeos de `embudos/chat/`:** su ahorro está estimado, no medido.
- **La revisión a ojo en móvil:** pendiente.
- **Vercel/Linux:** todo se midió en Windows. Estas cifras dicen cuánto comprime, no que funcione en Vercel.

---

## 3 · Restricciones técnicas que la estrategia tiene que resolver

- **Vercel no acepta cuerpos de más de ~4,5 MB** en una función. Por eso el panel se salta el servidor por
  encima de 4 MB (observación 5 de `CLAUDE.md`), y por eso los vídeos **no** pueden comprimirse en una función
  normal. Hay que decidir dónde se comprimen: en el navegador (ffmpeg.wasm, WebCodecs), en un trabajo aparte, o
  con un servicio.
- **`sharp` necesita todas sus piezas** en `outputFileTracingIncludes`, incluido `libvips` (observación 1).
- **"Windows no decide sobre Linux":** que comprima en este PC no prueba que comprima en Vercel.
- **Los dos compresores que ya existen deben quedar en uno** (`HALLAZGO-dos-compresores.md`), idéntico en las
  dos apps.
- **La compresión del navegador ayuda, pero la garantía es el servidor** (LEY de imágenes, punto 2).

---

## 4 · Cómo se hace cumplir

- **Prueba obligatoria** (`pruebas/ley-imagenes.ts`, y la que la amplíe a todos los tipos): cada ruta que
  escribe archivos pasa un archivo pesado de cada tipo y comprueba que lo guardado cumple su tope y su SSIM.
- **Vigilancia:** una consulta de solo lectura sobre `storage.objects` que liste lo que supera su tope. Se
  revisa cada semana y va al panel de Control cuando exista.
- **El auditor rechaza** cualquier rama que añada o cambie una escritura de archivos sin pasar por el módulo
  único y sin la prueba.

---

## 5 · Documentos relacionados

`TABLERO-AGENTES.md` (frente A) · `DISENO-LEY-IMAGENES.md` (rama `bloqueantes-consumo`) ·
`arreglos-supabase/HALLAZGO-*.md` · `ESTRATEGIA-PESO.md` (la escribe el planeador) ·
`arreglos-supabase/MEDICION-TOPES.md` (la escribe el desarrollador).
