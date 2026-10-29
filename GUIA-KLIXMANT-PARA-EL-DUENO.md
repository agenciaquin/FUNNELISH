# Catálogos de Klixmant en QuinChat — guía para el dueño

> Escrita el 28-10-2026. Rama `seguridad-c1-c2`. **Nada de esto está publicado todavía.**
> Detalle técnico completo: `CONTRATO-API-CATALOGOS.md` (sobre todo §4, §5 y §11).

## Qué se entrega

**QuinChat ya sabe reconocer cualquier catálogo de Klixmant a partir de lo que escribe un cliente.**
Es una «puerta abierta»: está lista para usarse, pero **no cambia nada del bot por sí sola**. El
bot sigue vendiendo exactamente como hoy hasta que el dueño decida cómo y dónde usarla.

| Pieza | Para qué sirve |
| --- | --- |
| Botón **«🔗 Klixmant»** en *Catálogos* | Ver todos los catálogos por categoría y probar: escribes lo que diría un cliente y ves qué catálogo reconoce. No guarda nada. |
| `reconocerCatalogo(texto)` | La función para el bot o cualquier código del servidor. Una línea. |
| `GET /api/klixmant/reconocer?texto=…` | Lo mismo como dirección web (pide sesión del panel). |
| `GET /api/klixmant/catalogos` | La lista completa de catálogos (pide sesión). |
| Fotos WebP → JPG | Las fotos de Klixmant son WebP y WhatsApp no las acepta; el bot ya las convierte solo. |
| Filtro «COLOR NO DISPONIBLE» | 58 fotos de Klixmant son un cartel rojo, no una prenda. Nunca se ofrecen (se filtran en el reporte). |

### Ejemplos reales (probados con los 239 catálogos de Klixmant)

| El cliente escribe | Reconoce |
| --- | --- |
| «tienen el de nacional?» | Los **8** catálogos de Nacional, empatados → hay que preguntarle cuál |
| «el nacional rey de copas» | Primero los 2 «Rey de Copas» |
| «el de nacional en negro» | Los 8, marcando que pidió **Negro** |
| «buzo kawasaki» | Los 4 de Kawasaki |
| «hola buenas tardes» / «quiero un buzo» | Nada → el bot sigue como hoy |

## Lo que el dueño decide (nada de esto está hecho a propósito)

1. **¿Qué hace el bot cuando reconoce un catálogo?** Mandar la portada, preguntar el color,
   mandar el enlace… La respuesta de la puerta trae número, nombre, categoría, colores, foto y
   si hay **empate** (`dudoso: true` → hay que preguntar, no adivinar).
2. **¿Qué categorías se ofrecen?** EQUIPOS, MOTOS, ANIME, CAMIONES… Se pasa la lista a la
   función. Decisión ya tomada: sin ninguna activada, el bot sigue como hoy.
3. **¿Precio?** Klixmant no da precio. Sigue saliendo de los embudos.
4. **¿Guardar el número de catálogo en el pedido?** Así la venta llega a Effi y al ranking.

## Antes de publicar (en este orden)

1. **Llave `QUINCHAT_API_KEY`.** Sin ella solo se ven 5 catálogos de muestra (y solo en local).
   Va en `quinchat/.env.local` y en Vercel `quinchat-agencia-quin`, marcada **Sensitive**.
   **Nunca** con `NEXT_PUBLIC_` delante.
2. **Publicar el reporte** con la rama `catalogos-sin-cartel` (quita los 58 carteles). Unir a `main`
   del reporte publica.
3. **Publicar QuinChat**: unir `seguridad-c1-c2` a `master`. ⚠️ **Eso publica `pedido.klixmant.shop`**
   y también los arreglos de seguridad C1/C2. Después, revisar los registros de ejecución de Vercel.
4. **Probar una foto WebP con un número propio**, nunca el de un cliente.

## Lo que hay que saber para no gastar de más

- La lista de catálogos se pide al reporte como mucho **una vez cada 10 minutos** (queda en memoria).
- **No se copian fotos**: se usa el enlace de Klixmant.
- A la IA del bot **no hay que pasarle los 239 catálogos** en cada mensaje: se le pasan solo los
  candidatos que devuelve la puerta. Es lo que más ahorra.
- **Tope de fotos por respuesta** (sugerido: 4). Un catálogo puede tener muchos colores.

## Pendientes conocidos

- **La foto que da la API es pequeña** (400×400). Klixmant tiene una de 1.200 px (`imagen_main`)
  que se vería mucho mejor en WhatsApp: hay que añadirla en el reporte (`lib/catalogo/quinchat.ts`).
- **Carteles nuevos**: el filtro es una lista fija. Si Klixmant sube otro cartel, volver a revisar
  las fotos (el método está en `CONTRATO-API-CATALOGOS.md` §11).
- **Arley** debe confirmar que un número de catálogo nunca se reutiliza, antes de guardar números
  en los pedidos.
- Las variantes (color + talla + id) existen en `/api/v1/catalogos/variantes`; aún no se leen.
