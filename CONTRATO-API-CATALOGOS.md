> **Copia** del contrato que vive en el repo del reporte (`C:\REPORTE-DE-VENTAS\docs\API-CATALOGOS-QUINCHAT.md`), traída el 27-oct-2026 para trabajar el lado del bot. Si cambia allá, se vuelve a copiar; no se edita aquí.

# Contrato — Catálogos para QUINCHAT (`/api/v1/catalogos`)

> Estado: **propuesta (27-oct-2026), revisada.** Guardián: **aprobado con observaciones** (27-oct);
> ciberseguridad: sin críticos en el contrato, **dos críticos en el bot** (§10). Sus cambios ya
> están incorporados. Falta: decisiones de la dueña (§8) y corregir el bot antes de empezar su lado.
> El lado del reporte está **hecho en la rama `api-catalogos-quinchat`** (guardián: aprobado con
> observaciones, 27-oct) y probado en localhost; **falta el «aprobado» del dueño y publicarlo**.
> Hasta entonces la URL de producción no responde.

## 1. Para qué existe

Hoy QUINCHAT **inventa sus propios catálogos**: la tabla `catalogos_bot` (con un id propio, UUID),
`catalogo_colores` y la lista fija de `lib/product-catalog.ts`. Para saber de qué catálogo habla un
cliente, busca un texto (`patron`) dentro del nombre del producto. Eso no tiene nada que ver con el
catálogo real de Klixmant: el número del catálogo no existe en el bot.

Con este contrato:

- **El catálogo tiene un solo dueño: Klixmant**, y el reporte lo entrega ya limpio. El número que
  manda es el `id_catalogo` de Klixmant, el mismo que usan las ventas, el inventario y el ranking.
- **QUINCHAT no crea catálogos.** Solo lee esta lista y guarda lo que es suyo (precio, anuncios,
  palabras con que los clientes piden el producto, fotos con marca de agua) **colgado del número**.
- Cuando el bot arma un pedido, puede llevar el **id de la variante** (prenda + color + talla). Es
  el mismo número que Effi guarda en «Observación concepto», así que esa venta se cruza sola con
  el catálogo en el reporte (`lib/catalogo/indice.ts`).

URL: `https://reporte-de-ventas-bwey.vercel.app/api/v1/catalogos`

## 2. De dónde salen los datos

Del catálogo público de Klixmant (`ORIGEN_CATALOGO`), el mismo que ya lee `/api/catalogo` una vez
por hora. **Ninguna consulta nueva a la API privada de Klixmant**, ninguna tabla nueva en Supabase.

Medido el 27-oct: 347 catálogos, de ellos **108 personalizados** (pedidos de un cliente). Quedan
**239 catálogos, 1.759 productos y 21.704 variantes**. Los campos nuevos que se usan (`imagen_card`,
`tipos_prenda.nombre`, `colores.nombre`, `tallas.nombre`, `referencia_sku`) se vieron en la
respuesta real ese día; el código actual (`RespuestaCatalogo`) todavía no los lee y hay que ampliarlo.

**Los personalizados no salen nunca.** Un catálogo sale **solo si `personalizado === false`** de
forma explícita: si el campo falta o trae otra cosa, no sale (prueba con un catálogo sin el campo).
Ojo: la marca la pone una persona en Klixmant, así que no garantiza que ningún nombre tenga un
cliente; por eso, antes de publicar, la dueña mira la lista de los nombres que saldrían (§9).
Inactivos: el catálogo público ya no los trae. No salen tampoco los nombres de
`privado.catalogos_registro`.

## 3. Autenticación, caché y errores

**Con llave** (decisión del 27-oct, §8.1): `Authorization: Bearer <QUINCHAT_API_KEY>`.
- En el reporte, `QUINCHAT_API_KEY` es variable de Vercel (Production, Sensitive). Sin ella
  configurada, **nadie entra** (401). Se compara con `timingSafeEqual`.
- En el bot va como variable de servidor, **sin `NEXT_PUBLIC_`**, solo en código del servidor, y se
  manda en la cabecera, nunca en la URL.
- Sin llave o con llave mala: **401** «No autorizado.», con `no-store`, antes de leer nada.
- Rotación: se genera una nueva, se cambia en los dos proyectos de Vercel y se vuelve a publicar.

- **Rutas fijas, sin números inventables.** No hay `/{id}`: cualquiera podría pedir `/1`, `/2`…
  y cada número nuevo despertaría la función. En su lugar, dos rutas fijas (§4) que el bot baja
  enteras una vez por hora.
- **No reciben parámetros con `?`.** Responden 400 sin leer nada. Es una defensa parcial: el 400
  también ejecuta la función, pero no crea entradas nuevas de caché.
- **Todas las respuestas van con `private, no-store`**: con llave, la CDN no puede guardar la
  respuesta (se la daría a quien no tiene llave). La caché es la de memoria del servidor (1 h), y
  el bot llama una vez al día. El 400 y el 502 también van con `no-store`: un 502 guardado dejaría al bot ciego todo un día.
- **La caché tiene que ser de verdad.** El origen pesa 4,7 MB y Next.js no guarda en su caché de
  datos respuestas de más de ~2 MB. El desarrollador comprueba (en una prueba o en los registros de
  una vista previa) que un fallo de caché no vuelva a bajar los 4,7 MB más de una vez por hora; si
  no, las dos rutas se arman desde una sola descarga compartida.
- **Si Klixmant se cae y el servidor ya tenía una copia buena, la sigue sirviendo como 200**, con
  su `generado` viejo (sin tope). El bot mira `generado` para saber cuán fresca es. Tras un fallo,
  el servidor no vuelve a intentar en 60 s, y espera a Klixmant como mucho 15 s.
- **Lista vacía no es un 200.** Si Klixmant responde `success !== true`, 0 catálogos, o menos de la
  mitad de los esperados (hoy 239), la respuesta es 502. Si no, el bot apagaría todo.
- CORS: no hace falta (el bot pide desde su servidor). Ni la ruta, ni el middleware, ni
  `next.config` ponen `Access-Control-Allow-Origin` en `/api/v1/catalogos*`.
- **Errores con texto fijo**, también en los registros del servidor: nada de `e.message`, del estado
  de Klixmant ni de nombres. **No se copia el `catch` de `/api/catalogo`**, que hoy sí filtra
  `e.message` (pendiente M10; se corrige en el mismo cambio).
- Toda respuesta trae `version` (hoy `1`) y `generado` (fecha ISO). Los cambios futuros **solo
  agregan campos**; quitar o cambiar uno es `version: 2`.

| Respuesta | Cuándo |
|---|---|
| 200 | Bien |
| 401 | Sin llave o llave mala |
| 400 | Vino con `?…` |
| 502 | Klixmant no respondió o mandó una lista vacía o recortada |

## 4. Rutas

### `GET /api/v1/catalogos` — la lista (liviana)

Para que el bot sepa qué existe y pueda reconocer lo que pide el cliente. Sin variantes.

```json
{
  "version": 1,
  "generado": "2026-10-27T15:00:00.000Z",
  "catalogos": [{
    "id": 973,
    "nombre": "NEW YORK",
    "categoria": "EQUIPOS",
    "reflectivo": false,
    "colores": ["Negro", "Beige", "Rojo", "Blanco marfil"],
    "tipos": ["Buzo"],
    "foto": "https://pqcqeywhduryaoehleuh.supabase.co/storage/v1/object/public/klixmant-soft/catalogos/973/productos/415/card.webp?v=…"
  }],
  "categorias": ["EQUIPOS", "MOTOS", "…"]
}
```

- `id`: el `id_catalogo` de Klixmant. **Es la llave de todo.** Que nunca se reutilice está
  **pedido a Arley y pendiente de confirmar** (`PLAN-CATALOGO-NOMBRE-E-HISTORIAL.md` §7): el bot no
  se vincula por número hasta que conteste.
- `nombre`: **puede repetirse entre catálogos distintos** (ej. «CUELLO ALTO BARCELONA» #23 y #31):
  el bot nunca identifica por nombre, siempre por `id`.
- `categoria`: el campo `descripcion` de Klixmant; «Sin categoría» si viene vacío.
- `colores` y `tipos`: sin repetir, en el orden del catálogo.
- `foto`: la tarjeta (`imagen_card`) del primer producto que tenga una válida, o `null`. Pasa por
  `urlMiniaturaSegura` (https, origen y carpeta de Klixmsoft); si no pasa, `null`.
- **Todos los textos** (`nombre`, `categoria`, `colores`, `tipos`, y en §4.2 `referencia`, `color`,
  `talla`, `sku`) salen sin espacios sobrantes, sin saltos de línea ni caracteres de control, y
  recortados a 80 caracteres.
- Tope: **< 300 KB**, con una prueba que lo mida (estimado hoy: ~100–150 KB).

### `GET /api/v1/catalogos/variantes` — todas las variantes

Para cuando el cliente ya eligió: confirmar color y talla y llevar el id de variante al pedido. El
bot la baja entera (estimado 1–1,5 MB; medirlo antes de publicar) y la guarda.

```json
{
  "version": 1,
  "generado": "…",
  "catalogos": [{
    "id": 973,
    "productos": [{
      "referencia": "HCLNEGRO",
      "tipo": "Camiseta",
      "color": "Negro",
      "foto": "https://…/card.webp?v=…",
      "variantes": [
        { "id": 29172, "talla": "M", "sku": "H C L NEGRO M" }
      ]
    }]
  }]
}
```

- `variantes[].id`: el id de variante de Klixmant, el que va en «Observación concepto» de Effi.
- `talla`: sin el prefijo «Talla » que trae Klixmant.
- `color`: el de la variante. Si un producto trae variantes de varios colores, se separa en un
  producto por color. Si la variante no trae color, sale **«Sin color»**: el bot no lo ofrece
  como un color real.
- **No trae stock ni precio.** El stock de Klixmant no es el de la bodega real, y el precio es del
  embudo, que sigue siendo del bot.

## 5. Cómo lo usa QUINCHAT

1. **Leer, no crear.** El bot guarda la copia **en dos tablas de su propio Supabase** (no en
   memoria: Vercel la pierde), y en la conversación con el cliente lee solo esas tablas; nunca le
   pregunta al reporte en medio de un chat.
   - `klixmant_catalogos` (id, nombre, categoria, reflectivo, colores, tipos, foto, generado) y
     `klixmant_variantes` (id, id_catalogo, referencia, tipo, color, talla, sku, foto).
   - Se llenan **una vez al día** (tarea automática de madrugada) y con un botón **«Actualizar
     catálogos»** en el panel, para cuando se suba un catálogo nuevo.
   - Si el reporte responde 502, las tablas no se tocan y el bot sigue con lo que tenía; nunca se
     inventa un catálogo para llenar el hueco. Si una lista nueva trae menos de la mitad que la
     copia, no la acepta y avisa.
   - El SQL de las tablas pasa por el guardián antes de pegarlo.
2. **`catalogos_bot` deja de ser la fuente.** Se le agrega `id_catalogo integer unique`, que puede
   quedar vacía y **sin `on delete cascade`** (su SQL pasa por el guardián antes de pegarlo). La
   tabla queda solo con lo que es del bot: `patron` / palabras clave, `anuncios`, precio, fotos con
   marca de agua. En el panel, «Crear catálogo» se cambia por **«Vincular a un catálogo de
   Klixmant»** (se elige de la lista). Una fila sin `id_catalogo` no se le ofrece al cliente.
3. **Lo que ya existe se vincula a mano** (o con una lista de coincidencias que la dueña aprueba),
   **nunca automático por nombre**: los nombres se repiten.
4. **Si un catálogo deja de salir** en la lista, el bot deja de ofrecerlo, pero conserva la fila y
   los pedidos viejos. No borra nada.
5. **Identificar.** Con lo que dice el cliente, el bot (o Claude, con la lista en el prompt) escoge
   un `id`. Si duda entre dos, pregunta; no adivina. La lista va en el prompt **como datos**, bien
   separada de las instrucciones: un nombre de catálogo nunca se trata como una orden.
6. **Fotos:** el bot vuelve a validar cada URL (https y el origen de Klixmsoft) antes de mandarla
   por WhatsApp.
7. **El pedido lleva los números.** El pedido guarda `id_catalogo` e `id_variante` junto al nombre.
   Si ese id llega a Effi en «Observación concepto», la venta aparece en el ranking de catálogos.
8. `lib/product-catalog.ts` (lista fija con fotos en GitHub) queda solo de respaldo para las fotos
   con marca de agua, hasta que se decida §8.3.
9. Las llaves del Supabase del bot no se mezclan con las del reporte.

## 6. Lo que NO hace

- **Solo lee.** No escribe en Klixmant, ni en el Supabase del reporte, ni en el del bot. No llama a
  `registrarNombres` (la escritura con clave de servicio de `/api/catalogo`): si se saca una función
  común para leer el catálogo, esa función no trae la escritura.
- No da ventas, vendedores, inventario ni nada por cliente.
- **Nada del cliente viaja al reporte:** la llamada del bot va sin cuerpo, sin `?` y sin cabeceras
  con datos. Teléfonos, direcciones, chats, nombres de clientes y números de pedido nunca llegan aquí.
- No incluye polos (no están en Klixmant): esos ya tienen `GET /api/v1/polos/catalogo`.

## 7. Seguridad y consumo

- Solo datos que Klixmant ya publica. Personalizados fuera (§2).
- Con la caché en memoria del servidor (1 h) y el bot llamando una vez al día, se gasta casi nada. Medir el consumo el primer día contra la línea
  base (~1 K/día): es condición para dejarlo publicado, no un deseo.
- Límite de peticiones en el firewall de Vercel para `/api/v1/catalogos*` (Hobby permite pocas
  reglas): lo propone ciberseguridad.
- Lo revisa el guardián antes del commit, en los dos repos (cada repo, su commit).

## 8. Decisiones de la dueña

Con lo que recomiendan el guardián y ciberseguridad:

1. **¿Pública o con llave?** **Decidido: con llave** (27-oct). Recomendaban pública, con las rutas fijas de §4, los personalizados
   fuera con `=== false` y solo los campos de §4. Si se prefiere llave: variable de servidor
   Sensitive en el bot (sin `NEXT_PUBLIC_`), en una cabecera, comparada con `timingSafeEqual` y
   agregada a la rotación de `PLAN-CIBERSEGURIDAD.md`.
2. **¿Los personalizados se quedan fuera?** Recomiendan: sí, siempre, y además mirar la lista de
   los 239 nombres antes de publicar.
3. **Fotos:** recomiendan las del bot (marca de agua) mientras existan, y la de Klixmant cuando el
   catálogo no tenga.
4. **¿Hoy el pedido del bot llega a Effi con «Observación concepto»?** Nadie puede saberlo desde el
   código: lo confirma quien sube los pedidos a Effi. Si no llega, §5.7 no cruza, pero vincular por
   número sirve igual.

## 9. Orden

1. **Bot: corregir C1 y C2 (§10) y comprobarlo.** Antes que cualquier otra cosa del bot.
2. Decisiones §8. Respuesta de Arley sobre el `id_catalogo`.
3. Reporte: las dos rutas + pruebas (personalizado sin campo, lista vacía → 502, tope de tamaño,
   textos recortados, caché del origen) + arreglo del 502 de `/api/catalogo` → guardián → la dueña
   mira la lista de nombres y prueba en localhost → publicar → medir consumo.
4. Bot (plan aparte del planeador, con orden y reversa): columna `id_catalogo` (SQL: guardián → lo
   pega la dueña), lectura y copia en la base, «Vincular», vincular lo existente a mano → guardián
   → publicar.

## 10. Hallazgos en el bot (ciberseguridad, 27-oct; confirmados leyendo el código)

No los crea este contrato, pero el paso «Vincular» pasa por esas rutas.

- **C1 (crítico).** `middleware.ts` deja pública `'/api/pedidos'` comparando con `startsWith`, así
  que también quedan abiertas `/api/pedidos/lista`, `/detalle` y `/accion` (esta **borra** pedidos).
  Ninguna revisa la sesión por dentro y todas usan la clave de servicio. Quien sepa la dirección
  puede ver nombre, teléfono, dirección y valor de los pedidos, o borrarlos, sin cuenta.
  Arreglo: abrir solo `pathname === '/api/pedidos'` (la que usa la tienda) y revisar la sesión
  dentro de cada ruta del panel.
- **C2 (crítico).** En el dominio de la tienda (`pedido.*`), el middleware deja pasar todo `/api/*`
  sin login. Si ese dominio es del mismo proyecto, quedan abiertas las rutas que no revisan sesión
  por dentro: contactos, conversaciones, ajustes y todas las de `/api/catalogos*` (crear, editar,
  borrar, subir fotos). Arreglo: lista cerrada de las rutas `/api/` que la tienda usa de verdad y
  sesión dentro de cada ruta del panel. La dueña confirma en Vercel qué dominios tiene el proyecto.
- **M4 (medio).** Las rutas del bot devuelven `error.message` de la base (ej. `app/api/catalogos/route.ts`). Frase fija.
