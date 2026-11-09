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

Ese flujo es el del primer ConfirmaYa en HTML puro. Para **QuinChat** (`quinchat/`, `quin-comercial/`)
se usa el equipo de abajo, copiado del reporte de ventas y adaptado a este repo.

## Equipo de agentes de QuinChat (`.claude/agents/agente-*`)

| Agente | Hace | No hace |
|---|---|---|
| `agente-planeador` | Convierte el pedido en un plan en `docs/PLAN-*.md`: fases chicas, comprobaciones, SQL en borrador, interruptor, reversa y decisiones del dueño | Escribir código, SQL ejecutable o en Supabase, commitear |
| `agente-desarrollador` | Escribe el código según un plan aprobado y corre typecheck, lint y build | Escribir en Supabase, disparar WhatsApp o crons, commitear |
| `agente-pruebas` | Verifica lo del desarrollador y simula el flujo real sin tocar clientes reales | Código de producción |
| `agente-diseno-ux-ui` | Que se entienda y se use bien: tienda, checkout, live y panel; protocolo de celular | Lógica, `app/api`, Supabase, commitear |
| `agente-diseno-grafico` | Que se vea de marca: color, tipografía, Quino, imágenes, acabado | Lo mismo que UX |
| `agente-animador-ux-ui` | El movimiento, con CSS y lo que ya existe en `globals.css` | Lo mismo que UX; librerías nuevas sin aprobación |
| `agente-guardian-seguridad` | Revisa todo antes de commit y push y todo SQL antes de pegarlo; veredicto que bloquea | Escribir código o en Supabase |
| `agente-ciberseguridad` | Solo seguridad, a fondo: rutas, Supabase, Vercel, WhatsApp/Meta, cuentas, rotación de claves. Sus críticos los hace cumplir el guardián | Escribir código o en Supabase, commitear |
| `agente-contratos-api` | Que el bot use las APIs como dicen sus contratos (catálogos del reporte, Funnelish, Meta) y que la copia del contrato esté al día | Editar código o el contrato copiado, commitear |
| `quino-wiki` | Explica la plataforma y mantiene `WIKI-QUINO/` | Implementar o desplegar |

Orden habitual: planeador → guardián del plan → desarrollador → pruebas → diseño (si toca) → guardián →
el dueño en localhost → commit a `master` (publica) → mirar el despliegue y los registros de ejecución.

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

### 6 · Módulo «Ventas Vendedores» es una PRUEBA con interruptor

Todo junto y aislado: `quinchat/lib/ventas-vendedores/`, `quinchat/app/api/ventas-vendedores/`,
`quinchat/app/api/cron/vv-catalogo/`, `quinchat/components/panel/ventas-vendedores/` y tablas `vv_*`.
Único punto de entrada en el webhook: el bloque «MÓDULO VENTAS VENDEDORES» antes de `esVendedor`.
**Apagar:** `ajustes_bot` clave `ventas_vendedores` → `activo: false` (o botón Apagar en ⚙️ Ajustes del panel).
Cuando el dueño diga «apaga esta parte», se apaga y se deja apagado; no tocar nada más de QuinChat.
Decisión del dueño (01-nov-2026): QuinChat sube a Effi directo. Desde el 08-nov-2026 `envio_effi: 'real'`
(lo pidió el dueño): «Enviar a Effi» crea remisiones de verdad tras vista previa + confirmación.
Abonos/pagos por transferencia → cuenta Effi id 6 (KLIXMANT SAS Bancolombia), en `ajustes_bot.effi_remision.cuenta_transferencia`.
Volver a simulación: `ajustes_bot` clave `ventas_vendedores` → `envio_effi: 'simulacion'`.
Línea de recepción (08-nov-2026, dueño): el MÓDULO (panel + Effi) recibe ventas por el número **Funnel 317 265 3897**.
Por el número de VENTAS (chat WhatsApp) sigue lo de siempre: el bot le ORGANIZA la venta al vendedor (flujo viejo).
`linea_recepcion: 'funnel'` (por defecto): en el número de ventas el módulo no entra, salvo para terminar una venta
del módulo ya abierta allí (`tieneVentaAbiertaVV`). `'todas'` = el módulo atiende en ambos números.
**El módulo es APARTE, solo para subir a Effi (dueño, 08-nov-2026):** sus ventas (`vv_ventas`) NO cuentan en las ventas
de QuinChat, metas diarias ni ventas confirmadas (`clientes_funnelish`, etiqueta VENTA REALIZADA, reportes de vendedores).
No escribir en esas tablas desde el módulo. Un número del módulo que no es vendedor de la lista y escribe al Funnel no cae
al bot de clientes.

**Seguimiento de ventas por hora a vendedores: APAGADO (08-nov-2026, dueño).** `ajustes_bot.seguimiento_vendedores.activo=false`:
`/api/cron/vendedores` no envía nada y `atenderVendedor` ya no pide ni cuenta reportes (solo guarda; a un «Hola» le dice
«mándame la venta»). En el Funnel, los números del módulo van al módulo y no al organizador.

**Abono vs. anticipado (08-nov-2026):** «abono / anticipo / anticipado / adelanto / pagó por adelantado X» con resto por
cobrar = `contraentrega` + `abono`. `anticipado`/`contado` solo si pagó TODO; con abono < total el código lo baja a
contraentrega (ia.ts, effi-remision.ts). El resumen al vendedor muestra VALOR TOTAL / ABONO / COBRAR.

**Dos paneles separados (08-nov-2026, dueño):** «Centro Maestro EFFI» muestra SOLO `vendedor_tel like 'panel%'`
(lo pasado desde los chats de Funnelish y Quino). Las ventas de VENDEDORES (vendedor_tel = su teléfono) salen solo en
la ficha de cada vendedor en «Master Vendedores».

**Cliente ya creado en Effi (08-nov-2026):** `armarRemision` compara la ficha de Effi (nombre, celular, correo) y su
última remisión en `effi_remisiones_api` (dirección por números, ciudad, departamento) con la venta. Si difiere, AVISO
arriba en la vista previa (`vista.cliente_diferencias`); no bloquea, la remisión sale con los datos de la venta.

**Papelera de ventas (09-nov-2026):** 🗑 en las tarjetas de Master Vendedores (solo si NO está en Effi) pide MOTIVO y
hace PATCH `accion:'papelera'` → `estado='cancelada'` + `papelera_at/motivo/por` + `estado_previo`. Pestaña «🗑 Papelera»
con «Restaurar» (`accion:'restaurar'`). Nada se borra. El Centro Maestro excluye `papelera_at`.

**BEIGE = COCOA (dueño, 09-nov-2026):** es el mismo color; en el catálogo KLIXMANT se llama «Cocoa». «Enviar al panel de Effi»
(desde-chat.ts y EnviarPanelEffiModal.tsx) traduce Beige → Cocoa. La IA de desde-chat también lee las FOTOS con letrero que
manda el asesor (`messages.caption`, ej. «REAL MADRID · BEIGE»): si cambió el color con una foto, ese color manda.

**Chat borrado = mensajes perdidos en silencio:** `messages.conversation_id` tiene llave foránea a `conversations`
(ON DELETE CASCADE). Si se borra el chat desde el panel, todo insert de mensaje falla hasta que el chat exista.
VV, `atenderVendedor` y el organizador crean el chat (upsert ignoreDuplicates) ANTES de guardar mensajes.

### 7 · Organizador de pedidos (Yamile León) — aislado con interruptor

`quinchat/lib/organizador-pedidos/` + un bloque «ORGANIZADOR DE PEDIDOS» en el webhook, antes de VV.
El vendedor reenvía fotos y pedazos de texto en desorden; tras 15 s sin piezas el bot devuelve un collage
con la ficha ordenada (nombre, celular, dirección, barrio, ciudad, valor, talla) y avisa lo que falta. No inventa.
Sus reportes numéricos al supervisor ("0", "1") siguen yendo a `atenderVendedor`.
**Apagar:** `ajustes_bot` clave `organizador_pedidos` → `activo: false`. Números en `numeros`.

### 8 · Horas pico: nada pesado en la base mientras hay tráfico

El 6-nov-2026 Supabase (tamaño **Nano**) se saturó a las 12:04 p. m. y se colgaron panel, bot
y crons ~20 min; hubo que reiniciar el proyecto. Causa de fondo: cada panel abierto pedía las
6.400 conversaciones completas en cada cambio y cada 6 s (ya corregido en `WhatsAppPanel.tsx`).

**Picos (hora Colombia):** 8–11 a. m. · 12–1 p. m. · 2–3 p. m. · 6–9 p. m. (más pedidos: 8 p. m.).
**Ventana de mantenimiento:** 2:00–5:00 a. m. Ahí van: cambio de tamaño de Supabase, reinicios
(salvo emergencia), conversiones/cargas masivas de fotos, migraciones que reescriban tablas,
sincronizaciones grandes y consultas de diagnóstico sobre `messages`/`conversations`/`storage`.
Publicar en Vercel sí se puede a cualquier hora. Detalle y tabla completa: `WIKI-QUINO/reglas/horas-pico.md`.

### 9 · Embudos → «Mi Página» (08-nov-2026), independiente de los embudos

`components/panel/EmbudosModulo.tsx` pone dos pestañas: **Mis Embudos** (`EmbudosPanel` tal cual; solo se
rediseñó el JSX de su lista, mismos handlers) y **Mi Página** (`MiPaginaPanel`).
Mi Página: tabla propia `mi_pagina` (borrador / publicado), `lib/mi-pagina.ts`, `app/api/mi-pagina` (con sesión),
pública en `pedido.klixmant.shop/web/<slug>` → `app/p/web/[slug]` (sin tocar el middleware). Solo LEE
catálogos, embudos y promociones. Comprar = embudo enlazado al catálogo; sin embudo = WhatsApp.
Cifras de las tarjetas: `app/api/funnels/resumen` (solo lectura, 30 días, caché 10 min).
Píxeles: `marca.pixel_meta` / `marca.pixel_tiktok` van en la config (públicos). Los TOKENS van en columnas
`mi_pagina.meta_token` / `tiktok_token` (PATCH `/api/mi-pagina`), nunca en borrador/publicado. Visita a Meta por
servidor: `app/api/mi-pagina/evento` (público, mismo event_id que el navegador). El token de TikTok solo se guarda
(los embudos tampoco lo usan aún). «Ver producto» abre el embudo con `?utm_source=mi-pagina…`; los enlaces de anuncios no cambian.

### 10 · Master Vendedores (08-nov-2026), módulo independiente

Menú «Master Vendedores» → `components/panel/master-vendedores/MasterVendedoresPanel.tsx` + `app/api/master-vendedores`.
Tabla propia `mv_vendedores` (13 vendedores de Effi: tercero, nombre, nombre_effi, teléfono principal de Effi +
teléfonos extra; el número viejo del bot quedó como extra). Lee `vv_ventas` por teléfono y `effi_remisiones_api` por
`nombre_effi`. Ver/editar/enviar reusa `DetalleVenta` del Centro Maestro. La recepción de ventas por WhatsApp se
enciende POR VENDEDOR (botón en el módulo) y queda en `ajustes_bot.ventas_vendedores.numeros_reales` (vacío = nada
cambia para los vendedores). Effi: el vendedor sale PRIMERO de `mv_vendedores` (teléfono principal o extra) y solo después del mapa
`effi_remision.vendedores` (que traía 573143534918 → QUINO AGENCIA de la fase de prueba; corregido 08-nov-2026).

### 11 · Chats sin número (CO.xxxx) y ventas (08-nov-2026)

Los chats de usuario de WhatsApp tienen id `CO.<dígitos>`: esos dígitos NO son un teléfono. Antes el bot
guardaba la venta con los últimos 10 dígitos como «teléfono» y «Ir al chat» no encontraba nada.
Ahora `clientes_funnelish.conversation_id` guarda el chat cuando no es `57+telefono` (nulo = 57+telefono);
`lib/quinchat/ventas.ts` no inventa teléfono y `api/ventas/lista` usa ese chat. `api/ventas/registrar` aún no.
También se guarda el chat cuando el cliente da el celular de OTRA persona (quien recibe), y el teléfono que
saca el modelo solo vale si el cliente lo escribió en el chat (el modelo puso 3124686638 a 4 clientes distintos).

### 12 · Panel de Catálogos (collages) — 09-nov-2026, módulo independiente

Menú «Panel de Catálogos» → `components/panel/collages/CollagesPanel.tsx`, API `app/api/collages` (+ `/foto` proxy de
fotos de Supabase Storage para el canvas, `/imagen` sube el JPG a `chat-media/collages/`). Tabla `catalogos_collage`
(nombre, familia, items, imagen_url, imagenes, firma). Solo LEE `vv_cat_productos`. El collage se arma EN EL NAVEGADOR
(`lib/collage-canvas.ts`, sin binarios nativos) con el formato aprobado: foto original cuadrada + franja con letrero
«// NOMBRE //», filas sin huecos (5 = 2 grandes + 3). Fuente `public/fonts/Poppins-BoldItalic.ttf`. «Pendiente de
actualizar» si cambió una foto o se apagó una prenda. No modificar el formato sin pedido del dueño.
Tipos (`tipo`): `auto` = uno por catálogo KLIXMANT (`id_catalogo`, índice único; solo HOMBRE si existe, 1 por color,
sin fotos «COLOR NO DISPONIBLE»), se generan solos al buscar una familia en «Por catálogo» (uno por uno, en el navegador);
`familia` = varios collages unidos (`hijos`, en orden) → «Mis catálogos»; `personal` = mezcla manual de prendas.
**Portada** (🖼 en «Mis catálogos»): plantilla SOBRIA fija aprobada por el dueño (`generarPortada` en `lib/collage-canvas.ts`,
1080×1160: fondo de estudio del mismo tono de la foto, prenda grande al centro, abajo el NOMBRE COMPLETO con color en blanco
y una línea del color de la prenda). El dueño elige UNA foto (de las prendas, que llena el nombre y el color, o subida de su equipo). Se guarda en
`portada_url` / `portada_foto` / `portada_titulo` y sale de PRIMERA al descargar o mandar por WhatsApp.

### 13 · Panel de Novedades (09-nov-2026), módulo independiente

Menú «Panel de Novedades» → `components/panel/novedades/NovedadesPanel.tsx`, API `app/api/novedades` (+ `[id]`, `chat`),
lógica `lib/novedades-effi.ts`. Tablas propias `novedades_effi` (una fila por guía: `id_guia_effi` único → sin duplicados),
`novedades_effi_historial`, `novedades_effi_sync`. SOLO LEE Effi con `listarGuias`/`listarRemisiones` de `lib/effi-api.ts`
(misma API key) o la copia `effi_guias_api`/`effi_remisiones_api`; no escribe en ellas ni en Effi.
Novedad = guía vigente con estado Effi «Novedad» / «Disponible para retiro en oficina» o transportadora con novedad,
incidencia, siniestro, intento de entrega, telemercadeo, reclame en oficina — y no entregada/devuelta/anulada.
Solo vendedores de Effi **FUNNELISTH LANDING** y **QUINO AGENCIA** (por la remisión de la guía).
EL PORQUÉ (09-nov-2026, dueño): Effi → Logística → «Novedades de guías» (app/novedad_guia_transporte). Se pide a
`GET api/novedad_guia_transporte` (ruta SUPUESTA por el patrón de las otras; sin confirmar con datos reales) y se guarda
CRUDA en `effi_novedades_api` (id_novedad, id_guia, datos). `leerNovedadEffi` lee los campos con tolerancia; si la ruta
falla queda en `novedades_effi_sync.error_novedades` y se usa el estado de la transportadora. Una novedad «Pendiente de
solución» también abre tarjeta aunque la guía no diga novedad. Tras el primer uso: revisar `effi_novedades_api.datos` y
fijar los nombres reales de los campos. Effi no manda push: con el panel abierto se revisa Effi; con el panel abierto se revisa Effi cada 10 min
(copia cada 2 min); el servidor lo frena para que varios paneles no golpeen a Effi.
Estados del EQUIPO: nueva → pendiente (al abrirla) → en_gestion → solucionada. Si Effi la marca entregada/devuelta/
anulada pasa sola a solucionada (`resultado`); si vuelve a novedad se reabre la MISMA tarjeta.
Producto/foto: pedido de `clientes_funnelish` por teléfono (el más reciente antes de la guía); si no, `vv_ventas`/`vv_items`.
Chat: busca `57tel`, `tel`, `+57tel`, `…@funnel` y el `conversation_id` del pedido; NO crea chats. Si no hay: wa.me + copiar.
Botón «← Volver a Novedades» en el chat (WhatsAppPanel, estado `volverNovedades`); los filtros quedan en memoria del módulo.
**Aviso «Pedido listo para reclamar» (09-nov-2026, dueño):** `lib/aviso-oficina.ts`, API `app/api/novedades/oficina`,
UI `components/panel/novedades/AvisoOficina.tsx` (botón 📲 en el Panel de Novedades). Plantilla Meta `pedido_listo_para_reclamar`
(UTILITY, es, encabezado IMAGE o VIDEO — GIF no: convertir a MP4 —, {{1}} primer nombre y {{2}} guía de Effi, 3 botones rápidos).
Interruptor `ajustes_bot.aviso_oficina` {activo, desde, vendedores, media_url, media_tipo, horas [7,20]}; APAGADO por defecto y
solo se enciende con la plantilla APROBADA. Guías de Interrapidísimo «Reclame en oficina / Disponible para retiro en oficina»
de FUNNELISTH LANDING y QUINO AGENCIA. Tabla `avisos_oficina` (llave = id de la guía → una sola vez). Al encender, las que ya
estaban en oficina quedan «previo» (envío manual con confirmación). Corre en el paso 5 de `sincronizarGuiasEffi` (máx. 3 por
pasada, cron de cada hora) y con «Revisar ahora». Freno de Meta + pausa + «NO ENVIAR RECORDATORIO». Chat: etiqueta «EN OFICINA»,
nota, bot apagado (atiende un humano), mensajes `tpl-oficina-*`. Respuestas: primer mensaje del cliente tras el envío.
**Aviso «Intento de entrega» (09-nov-2026, dueño):** `lib/aviso-intento.ts`, API `app/api/novedades/intento`, misma pantalla
`AvisoOficina.tsx` con `config={AVISO_INTENTO}` (botón 🚗). Plantilla `novedad_intento_entrega` (UTILITY, es, solo texto EXACTO del
dueño; {{1}} primer nombre, {{2}} ciudad, {{3}} guía, de Effi). Detecta tarjetas activas de `novedades_effi` con estado «Intento de
entrega» o novedad «701 - Se visita, no se logra entrega». Tabla `avisos_intento` (llave guía:novedad → una vez por novedad; además
máx. 1 por cliente cada 48 h). Interruptor `ajustes_bot.aviso_intento` APAGADO por defecto. Corre en el paso 6 de
`sincronizarGuiasEffi` (pone al día las tarjetas con la copia y máx. 2 avisos) y tras cada sincronización del panel (`after`).
Chat: etiqueta «NOVEDAD ENTREGA», nota, bot apagado; la tarjeta pasa a «En gestión»; la respuesta del cliente va al historial.
**OJO tablas nuevas:** en este Supabase una tabla creada por migración NO trae permisos para `service_role`
(salió «permission denied for table novedades_effi»). Siempre: `grant select, insert, update, delete on <tabla> to service_role`
+ `grant usage, select on sequence <tabla>_id_seq to service_role`.

### 5 · No todas las subidas comprimen

Comprimen: `funnels/imagen`, `plantillas-wa/imagen`, `catalogos/upload-imagen`.

No comprimen: el chat (`whatsapp/send-media`), las subidas por URL firmada
(`funnels/upload-url`, que además puede ir a R2 y no a Supabase) y todo
`quin-comercial/`. Para probar la compresión hay que subir por una de las tres
primeras, y con un archivo que tras comprimirse en el navegador **no pase de
4 MB** — por encima de eso el panel se salta el servidor.
