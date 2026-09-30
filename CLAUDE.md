# ConfirmaYa — Contexto del Proyecto

## Qué es
Herramienta web interna para el equipo de KLIXMANT (Josué y Mallerlis) que automatiza la generación del mensaje de confirmación de pedidos y la búsqueda de la foto del producto para enviar por WhatsApp.

## Identidad visual
Negro, dorado y blanco. Diseño limpio, moderno, tipo streetwear premium.

## Stack obligatorio
- HTML + CSS + JavaScript puro. Sin frameworks, sin build, sin backend, sin login.
- Desplegable directo en GitHub Pages.
- Archivos: `index.html`, `styles.css`, `app.js`, `catalogo.js`, carpeta `/img`.

## Reglas de negocio
- Si el teléfono tiene prefijo `+57`, eliminarlo (dejar solo 10 dígitos).
- Si no hay correo → usar `Gerenciaquin7@gmail.com`.
- Si no hay valor a pagar → usar `$130.000`.
- Si la talla no especifica género → asumir "Hombre".

## Plantilla del mensaje (EXACTA, sin líneas en blanco entre campos)
```
Hola 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚✨ Por favor confirma que estos datos estén correctos:
Nombre: {nombre}
Teléfono: {telefono}
Dirección: {direccion}
Ciudad: {ciudad}
Departamento: {departamento}
Correo: {correo}
Talla: {talla}
Nombre del Producto: {producto}
Valor a pagar: {valor}
✅ Si todo está correcto responde: CONFIRMO
✏️ Si deseas corregir algún dato, escríbelo en este chat.
🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas.
```

## Botón "Enviar a cliente"
- Descarga la foto del producto al equipo.
- Abre WhatsApp con `https://wa.me/57{telefono}?text={mensaje_codificado}`.
- WhatsApp NO permite adjuntar foto por URL — el usuario arrastra la foto descargada al chat manualmente.

## Flujo de agentes
1. **planeador** → produce PLAN.md + TASKS.md → humano aprueba.
2. **implementador** → implementa tarea por tarea con commits.
3. **auditor** → revisa y produce AUDIT.md (APROBADO o REQUIERE CORRECCIONES).
4. Si hay fallos → implementador corrige → auditor revuelve a revisar.

---

## Observaciones para futuros desarrollos

Cosas que ya costaron un fallo. No repetirlas.

### 1 · Windows no decide sobre Linux

Una comprobación hecha en el equipo de desarrollo **no prueba** que algo
funcione en el servidor. El 31-08-2026 se publicó la compresión de imágenes y
reventó al primer uso:

```
ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.6: cannot open shared object file
```

Se había comprobado que el binario `.node` de `sharp` viajaba dentro de cada ruta.
Era cierto y era insuficiente: `sharp` necesita **dos** piezas, y en Windows la
segunda (`libvips`) va dentro del propio `.node`, mientras que en Linux va aparte.

**Regla:** con cualquier dependencia que cargue un binario nativo o un archivo
por su ruta en disco (`sharp`, `Jimp`, fuentes, `.wasm`), enumerar **todas** las piezas,
no solo la principal, y añadirlas a `outputFileTracingIncludes` en
`quinchat/next.config.ts`. Ese archivo ya tenía el mismo problema resuelto para
las fuentes de Jimp: si aparece un `ENOENT` o un `DLOPEN` en producción, mirar ahí.

### 2 · Si no se puede probar en el destino, decirlo

Los despliegues de vista previa de Vercel piden inicio de sesión, así que **no
se puede ejercitar una ruta antes de publicar** desde la terminal. Cuando pase
eso, la salida honesta es dejarlo escrito como hueco abierto y proponer la
prueba más barata tras publicar —subir un archivo real y mirar el resultado—,
no rebajar la duda.

**Lo que sí se lee sin sesión:** el registro de construcción y, sobre todo, los
**registros de ejecución** del proyecto en Vercel. Fueron los que revelaron el
fallo real en un minuto. Ante un problema tras publicar, ir ahí primero.

### 3 · Hay dos aplicaciones en este repositorio

| Carpeta | Proyecto Vercel | Sirve |
| --- | --- | --- |
| `quinchat/` | `quinchat-agencia-quin` | `pedido.klixmant.shop` |
| `quin-comercial/` | `quinchat-comercial` | `www.klixmant.shop`, `tienda.skioo.shop` |

**Las dos tienen el mismo `name` en su `package.json`**, así que el nombre no las
distingue. Un cambio en `quinchat/` no llega a las tiendas, y al revés. Durante
el despliegue del 31-08 se confundieron y se anunció un efecto que no existía.

### 4 · Publicar ya no es inocuo

Desde el 31-08-2026 `quinchat-agencia-quin` está conectado a GitHub, así que
**cualquier envío a `master` publica `pedido.klixmant.shop`** sin pasos manuales.
Antes se publicaba a mano y por eso llegó a ir 21 commits por detrás.

Marcha atrás: Vercel guarda 20 despliegues de producción; se vuelve a cualquiera
desde el panel sin reconstruir.

### 5 · No todas las subidas comprimen

Comprimen: `funnels/imagen`, `plantillas-wa/imagen`, `catalogos/upload-imagen`.

No comprimen: el chat (`whatsapp/send-media`), las subidas por URL firmada
(`funnels/upload-url`, que además puede ir a R2 y no a Supabase) y todo
`quin-comercial/`. Para probar la compresión hay que subir por una de las tres
primeras, y con un archivo que tras comprimirse en el navegador **no pase de
4 MB** — por encima de eso el panel se salta el servidor.

---

## ⚖️ LEY · Toda imagen que se suba se comprime. Sin excepciones.

Decidido por dirección el 30-09-2026. Aplica a `quinchat/`, `quin-comercial/` y a cualquier app futura.

1. **Ninguna imagen llega al almacenamiento (Supabase Storage o R2) sin pasar por el compresor del
   servidor** (`lib/optimizar-imagen-servidor.ts`: 1920 px, JPEG q85, PNG con transparencia real se queda en
   PNG). Da igual el origen: panel, embudos, catálogo, plantillas, chat saliente, fotos que entran por
   WhatsApp, collages, URLs firmadas, integraciones o scripts.
2. **La compresión del navegador es una ayuda, no la garantía.** La garantía es el servidor. Una ruta que sube
   directo desde el navegador (URL firmada) tiene que pasar por el servidor si el archivo es una imagen.
3. **Toda imagen se sube con `cacheControl` de 1 año** (`CACHE_UN_ANO`). Es la marca que permite comprobar en
   la base de datos que pasó por el compresor: `metadata->>'cacheControl' = 'max-age=31536000'`.
4. **Quien añada una ruta o función que escriba archivos** usa el compresor y lo demuestra con la prueba
   `pruebas/ley-imagenes.ts` de cada app, que tiene que pasar antes de publicar.
5. **Si algo no se puede comprimir** (un formato raro, un fallo de `sharp`), se registra en el log y se sube el
   original, pero **nunca se desactiva la compresión para “que funcione”**.
6. Con `sharp` van **todas** sus piezas en `outputFileTracingIncludes`, incluido `./node_modules/@img/**/*`
   (observación 1). Una publicación que no incluya `sharp` rompe esta ley: así pasó del 31-08 al 30-09 sin que
   nadie lo notara.
