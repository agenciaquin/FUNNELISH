# INFORME COMPLETO — Proyecto FUNNELISH / ConfirmaYa / QuinChat

> Auditoría completa del repositorio `github.com/agenciaquin/FUNNELISH`.
> **Fecha:** 2026-08-28 · **Commit auditado:** `0cface9` (v169) · **Rama:** `master`
>
> Este informe **no se basa solo en el código**: se verificó contra los servicios en
> vivo (Supabase y Vercel vía API) para distinguir lo que *existe* de lo que
> *realmente se usa*.

---

## 🔴 ALERTA CRÍTICA — LEER ANTES QUE NADA

Al consultar las bases de datos en vivo apareció un problema de seguridad grave que
**no está documentado en ningún archivo del repositorio**:

### Las tablas están abiertas al público

| Base | Tablas con RLS desactivado | Qué queda expuesto |
|---|---|---|
| **quinchat** (producción Klixmant) | **25 de 28** | `messages` (**40.984 mensajes reales de clientes**), `conversations` (2.578 chats), `clientes_funnelish` (**935 clientes con nombre, teléfono y dirección**), `funnels`, `effi_guias`, `catalogo_colores`… |
| **confirma-ya** (SaaS comercial) | **11 de 36** | `usuarios` (**3 usuarios — y las contraseñas están en texto plano según el propio doc**), `tenants` (4 empresas), `carritos_abandonados`, `funnel_eventos`, `reglas_etiqueta`… |

**Por qué es grave:** la llave que usa el navegador es `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(`quinchat/lib/supabase.ts:48`). Esa llave viaja al navegador de **cualquier persona que
abra la página** — se lee con "Inspeccionar elemento" en 10 segundos. Con RLS
desactivado, esa llave pública permite **leer y modificar todas las filas** de esas
tablas. No hace falta hackear nada: es una consulta HTTP.

En la práctica, hoy mismo:
- Cualquiera puede descargar los 935 clientes con sus datos de contacto.
- Cualquiera puede leer las 40.984 conversaciones de WhatsApp.
- Cualquiera puede leer los usuarios y contraseñas del SaaS comercial.
- Cualquiera puede **borrar o alterar** pedidos, embudos y precios.

Esto además choca de frente con el modelo de negocio del punto 7 de quin-comercial:
un SaaS multi-tenant donde los clientes pagan (`recargas`, 5 registros reales) **no
puede** tener las tablas de todos los inquilinos abiertas.

**Qué NO hacer:** correr el `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` de golpe.
Sin políticas escritas primero, eso **bloquea todo** y tumba las páginas públicas y el
realtime del panel. Hay que hacerlo tabla por tabla, escribiendo la política antes.

Esto se retoma con plan concreto en el **[punto 8](#8-fallos-y-errores)**.

Además, el propio `quin-comercial/CONTINUACION-PROYECTO.md:36-38` ya registraba dos
pendientes de seguridad que **siguen sin resolverse**:
- El token de Meta y la llave de Groq quedaron expuestos en chats previos → **regenerarlos**.
- Contraseñas de `usuarios` en texto plano → **cifrar (hash)**.

---

## Índice

1. [Necesidad, objetivos y bases iniciales](#1-necesidad-objetivos-y-bases-iniciales)
2. [Usos: infraestructura, APIs y servicios](#2-usos-infraestructura-apis-y-servicios)
3. [El desarrollo: agentes y auditoría](#3-el-desarrollo-agentes-y-auditoría)
4. [Por qué existen 169 versiones](#4-por-qué-existen-169-versiones)
5. [Qué se usa, qué no, qué está en desarrollo y qué se abandonó](#5-qué-se-usa-qué-no-qué-está-en-desarrollo-y-qué-se-abandonó)
6. [Servicios actualmente activos](#6-servicios-actualmente-activos)
7. [El MD de inicio, el MD de cambios y la organización de la documentación](#7-el-md-de-inicio-el-md-de-cambios-y-la-organización-de-la-documentación)
8. [Fallos y errores](#8-fallos-y-errores)

---

# 1. Necesidad, objetivos y bases iniciales

## 1.1 La necesidad original (28 de junio de 2026)

**El problema real del negocio:** el equipo de **KLIXMANT** (Josué y Mallerlis) vendía
ropa contra entrega en Colombia. Cada pedido que entraba por Funnelish obligaba a una
persona a hacer, **a mano y uno por uno**:

1. Copiar los datos del pedido desde el Excel de Funnelish.
2. Limpiar el teléfono (quitar el `+57`).
3. Rellenar los datos que faltaban (correo, valor, género de la talla).
4. Escribir el mensaje de confirmación completo, sin equivocarse en ningún campo.
5. Buscar la foto del producto en una carpeta.
6. Abrir WhatsApp, pegar el mensaje y adjuntar la foto.

Eso es **6 pasos manuales por pedido**, con riesgo de error en cada uno, decenas de
veces al día. El objetivo era eliminar los pasos 2, 3, 4 y 5.

## 1.2 Objetivos declarados (`CLAUDE.md`, el documento fundacional)

| Objetivo | Cómo se especificó |
|---|---|
| **Automatizar el mensaje** | Una plantilla EXACTA, sin líneas en blanco entre campos, con emojis literales |
| **Automatizar la foto** | Un catálogo `nombre de producto → ruta de imagen` con búsqueda en 3 niveles |
| **Cero fricción técnica** | "HTML + CSS + JavaScript puro. Sin frameworks, sin build, sin backend, sin login" |
| **Desplegable ya** | GitHub Pages directo, rutas relativas, sin paso de compilación |
| **Identidad de marca** | Negro, dorado y blanco. "Limpio, moderno, tipo streetwear premium" |

### Las 4 reglas de negocio (siguen vigentes hoy)

```
1. Teléfono con prefijo +57  → eliminarlo, dejar 10 dígitos
2. Sin correo                → usar Gerenciaquin7@gmail.com
3. Sin valor a pagar         → usar $130.000
4. Talla sin género          → asumir "Hombre"
```

### La plantilla del mensaje (literal, es la base de todo el producto)

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

### La limitación que condicionó todo el diseño

> "WhatsApp NO permite adjuntar foto por URL — el usuario arrastra la foto descargada al chat manualmente."

Por eso el botón "Enviar a cliente" hace **dos cosas**: descarga la foto al equipo y
abre `https://wa.me/57{telefono}?text={mensaje}`. Esta limitación es la semilla de
todo lo que vino después: el deseo de mandar la foto automáticamente llevó a la API
de WhatsApp Cloud, y de ahí al bot, y del bot al SaaS.

## 1.3 Las bases iniciales — la arquitectura de arranque (`PLAN.md`)

El planeador definió una **SPA estática de un solo archivo HTML**, sin router y sin
estado persistente:

```
[PASO 1 — Formulario] → [PASO 2 — Vista previa: mensaje + foto] → [PASO 3 — Enviar]
```

| Archivo | Responsabilidad |
|---|---|
| `index.html` | Estructura del DOM: formulario, vista previa, botones |
| `styles.css` | Identidad visual negro/dorado/blanco. Responsive |
| `catalogo.js` | **Solo datos**, sin lógica. Objeto global `CATALOGO` |
| `app.js` | **Toda** la lógica: reglas, plantilla, WhatsApp, descarga |
| `/img/` | Fotos de producto |

Decisión clave y correcta para el momento: `catalogo.js` se carga **antes** que
`app.js`; `app.js` lee el global `CATALOGO`. Separación de datos y lógica sin
necesidad de módulos ni bundler.

## 1.4 Los criterios de aceptación de origen (`TASKS.md`)

El proyecto se declaraba terminado cuando cumplía **10 criterios globales**, entre ellos:

1. Abrir `index.html` directo en el navegador (sin servidor) sin errores en consola.
2. El texto generado coincide **exactamente** con la plantilla, emojis incluidos.
3. Las 4 reglas de negocio funcionan.
4. Si el producto no está en el catálogo → placeholder, sin lanzar errores.
5. Funciona en GitHub Pages (rutas relativas).
6. **Cero frameworks, cero librerías externas, cero build.**

Se descompuso en **20 tareas** numeradas (`TAREA 01` … `TAREA 20`), cada una con su
criterio de aceptación verificable. Las 20 se ejecutaron y commitearon el mismo día.

## 1.5 El giro que cambió el proyecto — el mismo día 1

El commit `413db5f`, **el 28 de junio**, apenas horas después de terminar las 20 tareas:

> `feat: rediseno completo - Excel a tabla, modal, filtros y estados por pedido`

El producto dejó de ser "un formulario para escribir un pedido" y pasó a ser
"**sube el Excel de Funnelish y gestiona todos los pedidos en una tabla**". Ese giro
—en el día 1, sin volver a pasar por el planeador— es el origen de casi todo lo que
el informe describe después. La base inicial (SPA estática sin estado) nunca se
rediseñó para el nuevo alcance; se fue estirando.

---

# 2. Usos: infraestructura, APIs y servicios

## 2.1 Los tres productos del repositorio

Este repositorio **no es un proyecto**: son tres, con historia compartida.

| # | Producto | Carpeta | Qué es | Último commit propio |
|---|---|---|---|---|
| **A** | **ConfirmaYa** | raíz | App estática, GitHub Pages | 2026-07-17 |
| **B** | **QuinChat** | `quinchat/` | Panel + bot + embudos de Klixmant | 2026-08-27 (v164) |
| **C** | **quin-comercial** | `quin-comercial/` | El mismo sistema, multi-tenant, para vender | 2026-08-27 (v169) |

> **Corrección importante:** contrario a lo que sugiere el nombre de la carpeta y la
> documentación vieja, **quin-comercial NO está en pausa — es el proyecto principal
> hoy**. De los últimos 15 commits, **13 tocaron solo `quin-comercial/`**. La versión
> `v169` vive en `quin-comercial/lib/version.ts`. Ver el punto 5.

## 2.2 Vercel — cómo se despliega cada uno

| Producto | Proyecto Vercel | Conectado a Git | Cómo se despliega |
|---|---|---|---|
| ConfirmaYa | *(GitHub Pages, no Vercel)* | sí, `master` | `git push` + subir número de versión (cache bust) |
| QuinChat | `quinchat-agencia-quin`<br>`prj_0NcuzAfKSSom4rnQnXlSobIhN9Qw` | **sí** | push a `master` → despliega solo |
| quin-comercial | `quinchat-comercial` | **NO** | `vercel --prod` a mano desde la carpeta |

**Cuenta Vercel:** equipo `AGENCIA QUIN` (`team_EZLmPFGxZMhSohs76iZF5Mo3`),
**plan Hobby**.

> ⚠️ El plan **Hobby** tiene límites que este proyecto ya está rozando: los Cron Jobs
> nativos de Vercel están limitados y el proyecto tiene **14 rutas de cron**.
> `vercel.json` está literalmente vacío (`{}`), lo que confirma que **los crons no se
> declaran en Vercel** — se disparan desde fuera. Ver el punto 6.

## 2.3 Qué es `.next` y por qué importa

`.next/` es la carpeta que **genera Next.js al compilar** (`next build`). Contiene el
JavaScript optimizado, las páginas pre-renderizadas y el manifiesto de rutas. Puntos
prácticos para este proyecto:

- **No se sube al repo** — está en `.gitignore` (correcto). Vercel la genera en cada deploy.
- Si algo "no cambia" tras editar código en local, casi siempre es `.next` con caché vieja: borrarla y volver a `npm run dev`.
- `tsconfig.tsbuildinfo` y `_verify.tsbuildinfo` (que **sí están en el disco**) son la caché incremental de TypeScript, del mismo tipo. También ignorados.

**Configuración especial** en `next.config.ts` que es fácil de romper:

```ts
outputFileTracingIncludes: {
  '/api/**': ['./fonts/**/*'],   // fuentes bitmap de Jimp
}
```
Sin esto, la marca de agua del catálogo **falla en producción con ENOENT** aunque
funcione perfecto en local — porque Vercel no incluye `fonts/` en el bundle si nadie
la importa explícitamente. Es un caso real que ya ocurrió.

## 2.4 Las APIs propias

**82 rutas** en QuinChat, **116** en quin-comercial. Las dos más grandes concentran
casi todo el riesgo:

| Ruta | Tamaño | Qué hace |
|---|---|---|
| `api/whatsapp/webhook/route.ts` | **162 KB** | El cerebro completo del bot |
| `api/funnelish/webhook/route.ts` | **42 KB** | Entrada de pedidos desde Funnelish |

Familias principales:

| Familia | Nº | Para qué |
|---|---|---|
| `api/funnels/*` | 12 | Embudos: CRUD, carrito, evento, imagen, audio, video, stats, CAPI |
| `api/cron/*` | **14** | Automatizaciones (ver 2.6) |
| `api/catalogos/*` | 7 | Catálogo, colores, marca de agua |
| `api/whatsapp/*` | 6 | Webhook, envío, media |
| `api/pedidos/*`, `api/ventas/*` | 8 | Pedidos y ventas |
| `api/campanas/*`, `api/seguimiento/*` | 7 | Meta Ads |

**Solo en quin-comercial** (42 rutas extra) — aquí está el negocio SaaS:

- `api/recargas/*` (5) — **cobros con MercadoPago**: crear, confirmar, retorno, webhook
- `api/registro` — alta de clientes nuevos
- `api/admin/tenants`, `api/tenant/dominio`, `api/tenant/whatsapp/*` — multi-tenant
- `api/asistente-bot/*` (5) — entrevista, compilar, actualizar, transcribir, leer-archivo
- `api/ia/*`, `api/entrenar-bot`, `api/quino-aprendizaje` — el bot se auto-entrena
- `api/version` — devuelve `VERSION` para verificar el deploy (ver punto 4)
- `api/whatsapp/webhook/[tenant]` — un webhook por cliente

## 2.5 APIs de terceros que consume el sistema

| Servicio | Para qué | Dónde |
|---|---|---|
| **Meta WhatsApp Cloud API** | Enviar y recibir mensajes, plantillas aprobadas, media | `lib/whatsapp.ts`, `lib/whatsapp-templates.ts` |
| **Anthropic (Claude)** | El cerebro del bot y el asistente de configuración | `lib/quinchat/claude.ts`, `systemPrompt.ts` |
| **Groq** | Transcripción de audios (Whisper) | `lib/transcribir.ts` (solo quin-comercial) |
| **OpenAI** | Segundo proveedor de IA | solo quin-comercial |
| **Meta Marketing API + CAPI** | Gasto por campaña, alertas, eventos de conversión | `lib/meta-ads.ts`, `lib/capi.ts`, `lib/meta-capi.ts` |
| **Lupap** | Geocodificación y validación de direcciones colombianas | `lib/lupap.ts` |
| **MercadoPago** | Cobro de recargas del SaaS | `api/recargas/*` (solo quin-comercial) |
| **Supabase** | Base de datos, Storage y Realtime | todo el sistema |
| **Web Push (VAPID)** | Notificaciones del panel como app instalada | `lib/push.ts` |

**Modelos de Claude en uso hoy** (encontrados en el código):
`claude-haiku-4-5-20251001` · `claude-sonnet-4-6` · `claude-3-5-haiku-latest`

## 2.6 Las 14 automatizaciones (crons)

| Cron | KB | Qué automatiza |
|---|---|---|
| `vendedores` | 12.6 | Ranking y reportes del equipo |
| `aprendizaje` | 9.1 | El bot aprende de las conversaciones |
| `objeciones` | 8.5 | Detecta y clasifica objeciones de clientes |
| `seguimiento-ia` | 7.8 | Seguimiento automático con IA |
| `remarketing` | 6.3 | Campañas de recuperación |
| `ventas-seguimiento` | 5.7 | Post-venta |
| `oficina-rescate` | 4.1 | Rescate de pedidos varados en oficina |
| `carrito-recuperacion` | 3.3 | Carritos abandonados |
| `meta-alertas` | 3.3 | Alertas de gasto de Meta Ads |
| `capi` | 3.1 | Conversions API de Meta |
| `mantener-chat` | 2.6 | Mantiene viva la ventana de 24h de WhatsApp |
| `registros-funnel` | 2.5 | Registros del embudo |
| `apagar-vendidos` | 2.1 | Apaga el bot en chats ya vendidos |
| `promo-cierre` | 0.7 | Promo de cierre |

> ⚠️ **12 de 14 validan `CRON_SECRET`. Dos no: `promo-cierre` y `ventas-seguimiento`
> están abiertos** — cualquiera que sepa la URL puede dispararlos. Ver punto 8.

## 2.7 Estructura de datos: cómo se guarda un embudo

**Un embudo = una fila** de la tabla `funnels`. Su diseño visual completo vive en una
sola columna `layout` (jsonb):

```ts
LayoutEmbudo = {
  bloques: { id, tipo, visible?, props? }[],
  checkout?: { titulo, subtitulo, textoBoton, colorBoton, sellos[], … }
}
```

Hay **19 tipos de bloque** (`lib/bloques.ts`): banner, titular, portada, botón, precio,
contador, últimas unidades, características, estrellas, testimonios, gatillos, stock,
más vendido, ventas en vivo, checkout, checkout PRO, texto, imagen, espacio.

**Regla de oro del proyecto:** todo bloque nuevo es **opcional y con valor por
defecto**, para que los 31 embudos ya publicados no se rompan. Si un embudo no trae
`layout`, se usa `layoutPorDefecto()` — que replica exactamente el orden histórico.

---

# 3. El desarrollo: agentes y auditoría

## 3.1 Sí, los agentes existen y están definidos

`.claude/agents/` contiene los tres, con modelo asignado:

| Agente | Modelo | Herramientas | Rol |
|---|---|---|---|
| **planeador** | opus | Read, Grep, Glob, **Write** | Produce `PLAN.md` + `TASKS.md`. **No implementa** |
| **implementador** | sonnet | Read, Write, Edit, Bash, Grep, Glob | Código tarea por tarea. **No improvisa fuera del plan** |
| **auditor** | opus | Read, Grep, Glob, Bash, **Write** | Produce `AUDIT.md`. **No modifica código** |

El flujo está formalizado en `CLAUDE.md` y, más estricto todavía, en
`quin-comercial/AGENTS.md`:

```
PLANEADOR    → "APROBADO PARA IMPLEMENTAR"
   ↓
IMPLEMENTADOR → escribe + corre tsc → "APROBADO PARA AUDITAR"
   ↓
AUDITOR      → verifica → "APROBADO PARA ENTREGAR" o "RECHAZADO"
   ↓
ENTREGA (solo con los 3 APROBADO)
```

## 3.2 ¿Se auditó de verdad? — La respuesta honesta: **una sola vez**

**Sí, el 28 de junio de 2026.** `AUDIT.md` es una auditoría real y seria:

| Categoría | Puntos | ✅ | ⚠️ | ❌ |
|---|---|---|---|---|
| Requisitos funcionales | 10 | 10 | 0 | 0 |
| Reglas de negocio | 9 | 9 | 0 | 0 |
| Plantilla del mensaje | 2 | 2 | 0 | 0 |
| Catálogo | 3 | 3 | 0 | 0 |
| Validación | 2 | 2 | 0 | 0 |
| Diseño | 4 | 4 | 0 | 0 |
| Compatibilidad GitHub Pages | 3 | 3 | 0 | 0 |
| Calidad de código | 3 | 3 | 0 | 0 |
| **TOTAL** | **36** | **36** | **0** | **0** |
| | | | **Veredicto: ✅ APROBADO** | |

Cada punto con evidencia citada (archivo y línea). Incluso registró 3 observaciones
menores honestas (el catálogo tenía productos demo, `/img` solo tenía el placeholder).

**Y después: nunca más.**

| Evidencia | Dato |
|---|---|
| Archivos `AUDIT*.md` en el repo | **2**, ambos del 28-jun-2026 |
| Auditorías de la era QuinChat (jul–ago, 126 commits) | **0** |
| Auditorías de quin-comercial | **0** (aunque `AGENTS.md` las exige por escrito) |
| Commits que mencionan planeador/implementador/auditor | **0** después del 28-jun |
| Archivos `PLAN.md`/`TASKS.md` posteriores | `PLAN-FASE5.md` y `PLAN_BOT_VENTAS.md` — planes, pero **sin auditoría de cierre** |

### La brecha, en números

```
28 jun 2026  ·  40 commits  ·  1 plan · 20 tareas · 1 auditoría formal · 36/36 ✅
29 jun → hoy ·  126 commits ·  0 auditorías
```

El **76% del proyecto se construyó sin pasar por el auditor**, incluyendo todo el bot
de WhatsApp, el constructor de embudos, el checkout y el SaaS multi-tenant con cobros.

### Qué se perdió con eso

Los hallazgos de este informe son exactamente los que un auditor habría encontrado:

- El RLS abierto en 25 tablas con datos de 935 clientes reales.
- Las contraseñas en texto plano de un SaaS que ya cobra.
- Los 2 crons sin proteger.
- Los dos archivos de 162 KB y 120 KB sin dividir.
- El código muerto (`_to_delete/` con 19 archivos, 2 componentes huérfanos).
- Los 67 archivos `.md` sin estructura.

Ninguno de estos es un bug difícil. Todos son **exactamente lo que una revisión de
cierre detecta en 20 minutos**. El flujo de agentes estaba bien diseñado; simplemente
dejó de ejecutarse cuando el ritmo de trabajo se aceleró.

## 3.3 Lo que además nunca existió

| Práctica | Estado | Consecuencia |
|---|---|---|
| **Tests** (unitarios, integración, E2E) | **Cero.** No hay ni un `.test.ts`, ni jest, ni vitest, ni playwright | Toda verificación es manual, abriendo la página |
| **CI/CD** | **No hay `.github/workflows/`** | Nada valida el código antes de que llegue a producción |
| **Hooks de Claude Code** | `.claude/settings.local.json` solo tiene 5 permisos, **ningún hook** | Nada corre `tsc --noEmit` automáticamente antes de commitear |
| **Linter en el pipeline** | `next lint` existe en `package.json` pero nadie lo ejecuta en automático | — |
| **Entorno de staging** | No hay. quin-comercial ni siquiera está conectado a Git | Cada `vercel --prod` va directo a producción, sobre clientes que pagan |
| **Revisión de código** | 164 de 166 commits son del mismo autor, sin PRs | Nadie revisa nada |
| **Uso de la rama `dev`** | Existe, último uso **30-jun-2026** | Todo va directo a `master` |

---

# 4. Por qué existen 169 versiones

Este es el punto que más llama la atención, y con razón. La respuesta corta:

> **No son 169 versiones de un producto. Es un contador manual, arrastrado a través de
> tres productos distintos, cuya única función es comprobar que el deploy llegó vivo.**

## 4.1 Qué es realmente el número

El número vive en `quin-comercial/lib/version.ts`, y el comentario del propio archivo
explica su función sin ambigüedad:

```ts
// VERSIÓN DEL BOT — se sube este número cada vez que se hacen cambios que hay
// que desplegar. Sirve para confirmar, desde /api/version, que el `vercel --prod`
// SÍ quedó en vivo (si el número que ves en la web coincide con el último, los
// cambios ya están activos para TODOS los bots de los clientes).
export const VERSION = 'v169';
```

Eso **no es un número de versión**. Es un **acuse de recibo del despliegue**. Es la
respuesta a la pregunta "¿el `vercel --prod` que acabo de correr sí quedó?".

## 4.2 De dónde salieron los 169

El contador **no empezó en quin-comercial**. Se arrastró:

| Rango | Dónde vivía | Para qué servía |
|---|---|---|
| `V5` … `V70` | ConfirmaYa (raíz) | **Cache bust de GitHub Pages** — hay commits llamados literalmente `chore: cache bust v20 en scripts y styles` |
| `V70` … `V81` | `quinchat/CORRECCIONES_VNN.md` | Numerar los documentos de corrección |
| `v155` … `v169` | `quin-comercial/lib/version.ts` | Verificar que `vercel --prod` llegó |

Es el mismo contador humano, saltando de producto en producto. El tramo `V81 → v155`
ni siquiera está registrado en el repositorio.

## 4.3 La causa raíz: no hay forma automática de saber si un deploy quedó

Encadenando las condiciones reales del proyecto:

```
quin-comercial NO está conectado a Git en Vercel
        ↓
el deploy es un `vercel --prod` manual desde la carpeta
        ↓
no hay CI, no hay tests, no hay URL de preview, no hay checks
        ↓
la ÚNICA forma de saber si el cambio quedó vivo es
abrir /api/version y leer un número que tú mismo subiste
        ↓
∴ CADA cambio, por chico que sea, necesita su propio número
```

Por eso `v169` es *"el DEPARTAMENTO ahora va ARRIBA del Municipio"* — un cambio de
**2 líneas en 1 archivo**. No merece una versión; la merece porque es la única manera
de confirmar que salió.

## 4.4 Lo que los números realmente dicen

| Métrica | Valor | Lectura |
|---|---|---|
| Commits `fix:` | **56** | |
| Commits `feat:` | **59** | Ratio **casi 1:1**. En un proyecto sano suele ser 1 fix por cada 3 features. Aquí, **la mitad del trabajo es arreglar lo anterior** |
| Commits `debug:` | 4 | Se commiteó código de depuración a producción para poder diagnosticar |
| Commits en un solo día (récord) | **26** (17-jul y 28-jun) | |
| Cambios a `app.js` | **46** | Un solo archivo tocado 46 veces |
| Cambios a `CatalogosPanel.tsx` | **19** | **10 de ellos consecutivos, el mismo día, por un bug de scroll CSS** |

### El caso que lo resume todo: la saga del scroll

El 17 de julio, **diez commits seguidos** para un solo problema de CSS:

```
cca2eea  fix: scroll en panel de catálogos
7dba0db  fix: h-screen en CatalogosPanel para scroll correcto
b2076fe  fix: min-w-0 overflow-hidden en CatalogosPanel
345b4fb  fix: scroll con absolute inset-0 en CatalogosPanel
b3f4af2  fix: min-h-0 en CatalogosPanel (igual que ContactosPanel)
bd03efd  fix: revertir overflow-hidden body + overflow-y-scroll catalogo
f1d4ba9  fix: scroll catalogo con inline styles para forzar altura
75cb362  fix: position fixed en catalogo para scroll garantizado
8b27bf4  fix: scrollbar visible 8px en catalogo
98c9765  fix: scroll en panel de catálogos — reemplazar position:fixed por flex layout  ← el que funcionó (al día siguiente)
```

Esto es **prueba y error a través de producción**. Cada línea es un deploy completo
para ver si esta vez sí. Con un entorno local funcionando o una URL de preview, esto
habría sido una sesión de 15 minutos con el inspector del navegador, y **un** commit.

## 4.5 Por qué Claude Code no avisa de esto

Esta es la parte que hay que decir sin rodeos, porque la pregunta es legítima.

### Lo que Claude Code sí puede hacer y no hizo

**1. No hay nada configurado que lo obligue a verificar.**
`.claude/settings.local.json` tiene exactamente esto:
```json
{ "permissions": { "allow": ["PowerShell(git init *)", "PowerShell(gh repo *)",
  "PowerShell(Get-Content *)", "Bash(git add *)", "Bash(git commit *)"] } }
```
Cinco permisos. **Ningún hook.** Un hook es lo que ejecuta el sistema —no el modelo—
antes o después de una acción. Sin un hook, nada corre `tsc --noEmit` antes de un
commit, nada bloquea un push que no compila, nada avisa "van 8 fixes al mismo archivo
hoy". El modelo puede olvidarlo; un hook no.

**2. Cada sesión empieza sin memoria de las anteriores.**
Claude Code no ve, por defecto, que ayer hiciste 10 commits al mismo archivo. Ve la
petición de hoy: "arregla el scroll". La hace. La patrón de 10 intentos solo es
visible mirando el historial completo — que es justo lo que este informe hizo, pero
porque **se pidió explícitamente**.

**3. La instrucción guardada empuja en la dirección contraria.**
En la memoria de este proyecto está guardado, textualmente:
> *"Always auto commit+push after corrections — don't ask, just push."*

Esa preferencia es razonable para no interrumpir el ritmo, pero su efecto mecánico es
**un commit y un deploy por cada corrección**. Es, en parte, el motor de los 169.

**4. Nadie pidió el trabajo de fondo.**
Cada sesión fue "arregla esto" → se arregló → se desplegó. En 166 commits **nunca se
pidió** "revisa si esto está bien montado", "audita la seguridad" o "por qué llevo
tantas versiones". La primera vez que se pidió es hoy — y aparecieron el RLS abierto,
las contraseñas en texto plano y los crons sin proteger.

### Lo que sí se puede montar para que no vuelva a pasar

| # | Acción | Efecto | Esfuerzo |
|---|---|---|---|
| 1 | **Conectar `quin-comercial` a Git en Vercel** | Cada push da una **URL de preview** para probar antes de producción. Elimina de raíz la necesidad del contador: Vercel ya te dice qué commit está vivo | 10 min |
| 2 | **Hook `PreToolUse` sobre `git commit`** que corra `npx tsc --noEmit` | Ningún commit que no compile entra al repo. Lo ejecuta el sistema, no el modelo | 15 min |
| 3 | **`.github/workflows/ci.yml`** con `tsc` + `next lint` | Valida cada push automáticamente | 20 min |
| 4 | **Versionado semántico real** (`1.4.0`) solo en entregas de verdad | El número vuelve a significar algo | — |
| 5 | **Regla de agrupación**: acumular cambios pequeños y desplegar 1–2 veces al día | v169 en 3 días habría sido v158 | — |
| 6 | **Reactivar el auditor** antes de cada entrega, como manda `AGENTS.md` | Es literalmente lo que ya está escrito y no se cumple | — |

> El punto 1 y el 2 son los que más valen: con preview de Vercel y un hook de `tsc`,
> tanto los 169 números como la saga de los 10 scrolls dejan de tener razón de existir.

---

# 5. Qué se usa, qué no, qué está en desarrollo y qué se abandonó

Verificado contra **filas reales** de las bases de datos en vivo, no contra el código.

## 5.1 🟢 EN USO — con datos reales en producción

### QuinChat / base `quinchat` (Klixmant) — el sistema que factura hoy

| Tabla | Filas | Qué significa |
|---|---|---|
| `funnel_eventos` | **49.854** | El tracking de los embudos funciona y registra muchísimo |
| `messages` | **40.984** | El bot de WhatsApp está conversando de verdad |
| `conversations` | **2.578** | 2.578 clientes atendidos |
| `vendedor_preguntas` | **2.223** | El módulo de vendedores se usa intensamente |
| `clientes_funnelish` | **935** | Pedidos reales |
| `objeciones_analisis` | **905** | El cron de objeciones está trabajando |
| `effi_guias` | **735** | El cruce con la transportadora está activo |
| `faq_bot` | **708** | Base de conocimiento grande y viva |
| `vendedor_reportes` | **342** | |
| `campanas_gasto` | **323** | Meta Ads conectado y sincronizando |
| `catalogo_colores` | **185** | Catálogo con fotos poblado |
| `carritos_abandonados` | **148** | Recuperación de carritos activa |
| `remarketing_envios` | **107** | Remarketing enviando |
| `catalogos_bot` | **46** | |
| `memoria_bot` | **40** | El bot recuerda |
| `funnels` | **31** | **31 embudos publicados** |

### quin-comercial / base `confirma-ya` — el SaaS, **también vivo**

| Tabla | Filas | Qué significa |
|---|---|---|
| `funnel_eventos` | **1.818** | Hay tráfico real en los embudos de clientes |
| `messages` | **3.085** | Los bots de los clientes están conversando |
| `conversations` | **328** | |
| `funnels` | **14** | 14 embudos de clientes |
| `catalogo_colores` | **44** | |
| `carritos_abandonados` | **30** | |
| `catalogo_variables` | **25** | Función que **solo existe aquí** |
| `clientes_funnelish` | **23** | Pedidos reales de clientes del SaaS |
| `rate_limits` | **10** | Control de abuso activo |
| `ai_integraciones` | **6** | Varios proveedores de IA configurados |
| **`recargas`** | **5** | **Hay cobros reales con MercadoPago** |
| `reglas_etiqueta` | **5** | |
| **`tenants`** | **4** | **4 empresas clientes dadas de alta** |
| `catalogo_categorias` | **4** | |
| `plantillas` | **4** | |
| **`usuarios`** | **3** | ⚠️ con contraseñas en texto plano |

> **Conclusión que corrige la documentación existente:** quin-comercial **no está en
> pausa**. Tiene 4 empresas clientes, cobros procesados y 3.085 mensajes cursados.
> Es un producto **en producción con clientes pagando**.

## 5.2 🟡 CONSTRUIDO PERO SIN USAR — 0 filas

| Módulo | Tabla | Filas | Diagnóstico |
|---|---|---|---|
| **Contactos** (`ContactosPanel.tsx`, 19 KB + 2 rutas API) | `contactos` | **0** | Panel completo, terminado, **nunca usado**. Su función la absorbió `conversations` |
| **Effi anulados** | `telefonos_effi_anulados` | **0** | Tabla creada, lógica escrita, sin un solo registro |
| **Catálogo por variables/categorías** (en QuinChat) | `catalogo_variables`, `catalogo_categorias` | **0 / 0** | Las tablas existen en QuinChat pero la función solo se desarrolló y se usa en quin-comercial (25 y 4 filas) |
| **Disparadores** (`DisparadoresPanel.tsx`, **29 KB**) | `disparadores` | **1** | 29 KB de interfaz de condiciones/acciones estilo SellerChat, con **una sola regla creada en dos meses**. Efectivamente sin uso |
| **Plantillas de embudo** | `plantillas_embudo` | **1** | Apenas estrenada |
| **Insignia flotante** | — | — | `EditorInsignia.tsx` + `InsigniaFlotante.tsx`: **componentes huérfanos**, no los importa nadie. Código muerto confirmado |

## 5.3 🔵 EN DESARROLLO ACTIVO (hoy)

| Frente | Dónde | Evidencia |
|---|---|---|
| **Constructor de embudos y checkout** | `quin-comercial` | v155→v169 en 3 días (25–27 ago) |
| **Editor de productos del checkout** | `quin-comercial` | v163–v168 |
| **Backport a QuinChat** | `quinchat` | Los 3 archivos sin commitear en el working tree |

**Trabajo sin commitear ahora mismo** (candidato a v170):

| Archivo | Cambio |
|---|---|
| `quinchat/components/panel/EditorBloqueLateral.tsx` | Recuadro "💲 Editar precios" en el bloque lateral + botón ✕ para borrar una foto de la galería, con confirmación |
| `quinchat/components/panel/EditorPareja.tsx` | El pack numerado ya no depende del nombre "POLO": detecta cualquier grupo con número (BUZO 1, BUZO 2…) y respeta el nombre base al agregar variante |
| `quinchat/components/panel/EmbudosPanel.tsx` | La miniatura usa `variantes[0].imagen` (porque `imagenes[0]` quedaba compartida al duplicar embudos) + el nombre ya no se corta |

## 5.4 🔴 ABANDONADO O CONGELADO

| Qué | Última señal de vida | Estado real |
|---|---|---|
| **ConfirmaYa** (app estática de la raíz) | `app.js` sin tocar desde **17-jul-2026** | **Congelado.** Cumplió su función; el flujo migró al panel de QuinChat |
| **Rama `dev`** | **30-jun-2026** | **Muerta.** 2 meses sin uso; todo va directo a `master` |
| **Bot de ventas (segundo número)** | `PLAN_BOT_VENTAS.md`, 21-jul-2026 | **Planeado y nunca implementado.** No hay código ni tabla |
| **Fase 5 del multi-tenant** | 29-jul-2026 | ⏳ **Detenida.** Es la fase que evita fugas de datos entre clientes — y hay 4 clientes activos |
| **Fase 6 del multi-tenant** | — | ⏳ Nunca empezada |
| **`imgOptim()`** | `lib/funnels.ts:118` | **Desactivada.** Devuelve la imagen original: la optimización con `/_next/image` rompía las fotos en producción |
| **Carpeta `_to_delete/`** | quin-comercial | **19 archivos basura commiteados**: `.bak`, `.txt` de depuración, `HEAD.lock.26672.old` |
| **Auditorías** | 28-jun-2026 | Abandonadas tras la primera |
| **Simulador de 2 escenarios** | commit `607bed9`, 28-jul | Sin señales de uso posterior |

## 5.5 Un hallazgo aparte: existe una **tercera base de datos** no documentada

Al listar los proyectos de Supabase apareció uno que **no se menciona en ningún
archivo del repositorio**:

**`master-quin`** (`oejbsibpjiwakpsgkyvq`), creada el **27-jul-2026**, `ACTIVE_HEALTHY`.

Sus tablas: `courses` (7), `lessons` (9), `plans` (3), `plan_courses` (14),
`memberships` (4), `profiles` (5), `payments` (4), `course_overrides` (13),
`community_posts` (3), `community_comments` (3), `community_likes` (3),
`lesson_progress` (1), `lesson_comments` (1), `site_settings` (2).

Es **una plataforma de cursos con membresías, pagos y comunidad** — otro producto de
Agencia Quin, ajeno a este repositorio, pero activo y consumiendo cuota de la misma
organización de Supabase. Vale la pena saber que está ahí. (Nota positiva: **esta base
sí tiene RLS activado en todas sus tablas**, a diferencia de las dos del proyecto.)

---

# 6. Servicios actualmente activos

Verificado por API en vivo el 2026-08-28.

## 6.1 Supabase — 3 proyectos, todos `ACTIVE_HEALTHY`

| Proyecto | Ref | Región | Creado | Para qué | Estado |
|---|---|---|---|---|---|
| **quinchat** | `bjbjqmbuzpyjvcugbusx` | us-west-2 | 2026-07-15 | **Producción Klixmant.** 28 tablas, ~100k filas | 🟢 Crítico |
| **confirma-ya** | `glmnuqfnxwaibckufgtr` | us-east-2 | 2026-07-01 | **SaaS comercial.** 36 tablas, 4 tenants, cobros reales | 🟢 Crítico |
| **master-quin** | `oejbsibpjiwakpsgkyvq` | us-west-2 | 2026-07-27 | Plataforma de cursos (**otro producto**) | 🟢 Ajeno al repo |

Postgres 17 en los tres. Organización única: `rvnsovatdxlkypdsizrj`.

**Por qué siguen activos:** los tres tienen datos de producción y tráfico. Ninguno es
candidato a apagarse. La base `confirma-ya` es la que más atención necesita (Fase 5).

## 6.2 Vercel

| Dato | Valor |
|---|---|
| Equipo | **AGENCIA QUIN** (`team_EZLmPFGxZMhSohs76iZF5Mo3`) |
| Plan | **Hobby** |
| Proyecto 1 | `quinchat-agencia-quin` — conectado a Git, despliega con push a `master` |
| Proyecto 2 | `quinchat-comercial` → `quinchat-comercial.vercel.app` — **sin conectar a Git**, deploy manual |

> ⚠️ **El plan Hobby es un riesgo de negocio ahora mismo.** quin-comercial ya tiene
> clientes pagando (5 recargas registradas). El plan Hobby de Vercel está pensado para
> proyectos personales y no comerciales, tiene límites de ejecución más bajos y
> restricciones fuertes en Cron Jobs. Con clientes de pago encima, esto debería ser
> plan Pro. **Es la razón por la que `vercel.json` está vacío y los 14 crons se
> disparan desde fuera.**

## 6.3 Meta / WhatsApp

| Servicio | Estado | Evidencia |
|---|---|---|
| **WhatsApp Cloud API** | 🟢 Activo | 40.984 mensajes en producción + 3.085 en el SaaS |
| **Plantillas aprobadas** | 🟢 Activo | `lib/whatsapp-templates.ts`; hubo un fix por template de 10 variables |
| **Marketing API (Ads)** | 🟢 Activo | `campanas_gasto` con 323 filas sincronizando |
| **Conversions API (CAPI)** | 🟢 Activo | Crons `capi` y `meta-alertas` |
| **Webhook por tenant** | 🟢 Activo | `api/whatsapp/webhook/[tenant]`, 4 tenants |

⚠️ El token de Meta figura como **expuesto en chats previos y pendiente de regenerar**
desde julio (`CONTINUACION-PROYECTO.md:37`).

## 6.4 Inteligencia artificial

| Proveedor | Uso | Modelos encontrados |
|---|---|---|
| **Anthropic (Claude)** | El bot, el asistente de configuración, el análisis de objeciones | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-3-5-haiku-latest` |
| **Groq** | Transcripción de audios (Whisper) | solo quin-comercial |
| **OpenAI** | Segundo proveedor | solo quin-comercial |

Hay una tabla `ai_integraciones` con **6 configuraciones activas** en el SaaS: los
clientes pueden traer su propio proveedor.

⚠️ La llave de Groq también figura como **expuesta y pendiente de regenerar**.

## 6.5 Otros servicios en producción

| Servicio | Estado | Para qué |
|---|---|---|
| **MercadoPago** | 🟢 Activo | Cobro de recargas del SaaS. 5 transacciones registradas |
| **Lupap** | 🟢 Activo | Validación y geocodificación de direcciones colombianas |
| **Web Push (VAPID)** | 🟢 Activo | 2 + 3 suscripciones al panel como app instalada |
| **Supabase Storage** | 🟢 Activo | Bucket público `chat-media` para fotos y audios |
| **GitHub Pages** | 🟡 Activo pero congelado | Sirve ConfirmaYa; sin cambios desde julio |
| **Funnelish** | 🟡 En retirada | El webhook sigue vivo (42 KB), pero los embudos propios lo están reemplazando |

## 6.6 Resumen de costos y dependencias críticas

Si mañana falla uno de estos, **el negocio se detiene**:

1. **Supabase `quinchat`** — sin ella no hay pedidos, ni chats, ni catálogo.
2. **WhatsApp Cloud API** — sin ella no hay confirmaciones. Es el canal de venta.
3. **Vercel `quinchat-agencia-quin`** — sin ella no hay panel ni páginas de venta.
4. **Anthropic** — sin ella el bot deja de responder (el panel sigue, en modo manual).

Los demás (MercadoPago, Lupap, Groq, Meta Ads) degradan funciones pero no detienen la
operación.

---

# 7. El MD de inicio, el MD de cambios y la organización de la documentación

## 7.1 El diagnóstico: 67 archivos `.md` sin estructura

| Ubicación | Cantidad |
|---|---|
| Raíz | **51** |
| `quinchat/` | 7 |
| `quin-comercial/` | 9 |
| **TOTAL** | **67** |

De los 51 de la raíz, **35 son `CORRECCIONES_VNN.md`** — uno por versión, todos en el
mismo nivel, con nombres que no dicen nada sobre su contenido y con **huecos**
(`V43` y `V48` no existen; `CORRECCIONES_V7.md` está fuera de secuencia, creado el
18-jul entre los V60).

Esto tiene tres consecuencias prácticas:
- Para saber cuándo se hizo algo hay que abrir archivos hasta encontrarlo.
- Hay documentación **contradictoria**: `CONTINUACION-PROYECTO.md` dice que
  quin-comercial está en Fase 5 pendiente, mientras el proyecto tiene 4 clientes y
  cobros activos.
- Información crítica está **enterrada**: los dos pendientes de seguridad están en las
  líneas 36-38 de un archivo de 41 KB.

## 7.2 📄 EL MD DE INICIO — *Dónde nació el proyecto*

> Esto es lo que debería ser `docs/00-ORIGEN.md`.

### ConfirmaYa — Acta de nacimiento

**Fecha:** 28 de junio de 2026
**Commit inicial:** `da54cff` — *Initial commit*
**Autor:** agenciaquin
**Cliente:** KLIXMANT (Josué y Mallerlis)
**Agencia:** Agencia Quin

#### El problema
El equipo confirmaba cada pedido de Funnelish **a mano**: copiaba los datos, limpiaba
el teléfono, rellenaba los campos faltantes, escribía el mensaje completo, buscaba la
foto en una carpeta y armaba el chat de WhatsApp. Seis pasos manuales, decenas de
veces al día, con riesgo de error en cada uno.

#### La solución pedida
Una herramienta web interna que generara el mensaje exacto y encontrara la foto sola.

#### Las restricciones que definieron la arquitectura
```
HTML + CSS + JavaScript puro
Sin frameworks · Sin build · Sin backend · Sin login
Desplegable directo en GitHub Pages
Archivos: index.html, styles.css, app.js, catalogo.js, /img
```

#### La identidad
Negro, dorado y blanco. Limpio, moderno, tipo streetwear premium.

#### Las 4 reglas de negocio
1. Teléfono con `+57` → quitarlo, dejar 10 dígitos.
2. Sin correo → `Gerenciaquin7@gmail.com`.
3. Sin valor → `$130.000`.
4. Talla sin género → asumir "Hombre".

#### La limitación de WhatsApp que marcó el futuro
WhatsApp no permite adjuntar una foto por URL. Por eso el botón hace dos cosas
(descargar la foto + abrir el chat) y el usuario arrastra la foto a mano.
**Querer eliminar ese último paso manual es lo que llevó, dos semanas después, a la
API de WhatsApp Cloud, al bot con IA, y de ahí a todo lo demás.**

#### Cómo se construyó
Con el flujo de 3 agentes: **planeador** (`PLAN.md` + `TASKS.md` con 20 tareas y
criterios de aceptación) → **implementador** (20 commits, uno por tarea) → **auditor**
(`AUDIT.md`, 36/36 criterios, **✅ APROBADO**).

#### El giro del día 1
El mismo 28 de junio, tras cerrar las 20 tareas, el commit `413db5f` cambió el
producto: de *"formulario para escribir un pedido"* a *"sube el Excel de Funnelish y
gestiona todos los pedidos en una tabla"*. Ese giro no volvió a pasar por el planeador,
y la arquitectura inicial (SPA estática sin estado) nunca se rediseñó para el nuevo
alcance.

#### La línea que va de ahí hasta hoy
```
Generador de mensajes (28 jun)
  → Mini-CRM con Excel y Supabase (jun–jul)
    → Bot de WhatsApp con IA (15 jul)
      → Embudos y checkout propios (ago)
        → SaaS multi-tenant con cobros (ago)
```

---

## 7.3 📄 EL MD DE CAMBIOS — *Changelog consolidado*

> Esto es lo que debería ser `CHANGELOG.md`. Consolida los 35 `CORRECCIONES_VNN.md`,
> el `version.ts` y los 166 commits en una sola línea de tiempo legible.

### v169 — 2026-08-27 · quin-comercial
Checkout: el **Departamento** va arriba del Municipio (se elige departamento y luego
se filtra la ciudad).

### v168 — 2026-08-27 · quin-comercial
Editor: los colores de cada producto se ven como **tabla** (encabezado FOTO / COLOR,
un color por fila con su foto).

### v167 — 2026-08-27 · quin-comercial
Editor: cada producto del checkout es un **bloque tipo mockup** (foto de portada
grande, nombre, precio antiguo tachado en rojo + precio promoción en verde).
Nuevo botón **⧉ Duplicar** por producto.

### v166 — 2026-08-27 · quin-comercial
Checkout: **bloque de producto arriba del formulario** (foto, nombre, precio antiguo
tachado + promoción). Se activa con el interruptor "Mostrar bloque de producto arriba".

### v165 — 2026-08-27 · quin-comercial
Checkout: modo **desplegable** de color y talla, con foto. Opcional.

### v164 — 2026-08-27 · quin-comercial + quinchat
Checkout: los campos personalizados también aplican en "Productos del checkout"
(**una sola fuente de verdad**).

### v163 — 2026-08-27 · quin-comercial
Checkout: **campos personalizados** + renombrar y ocultar campos (etapa 2).

### v162 — 2026-08-27 · quin-comercial
Checkout: **departamento y ciudad como desplegables dependientes** de Colombia.

### v161 — 2026-08-27 · quinchat + quin-comercial
**Constructor de Embudos en 3 columnas**: arrastrar y soltar + panel de propiedades.
Además: reporte de remarketing, ajustes de embudo, compresión de imágenes.

### v160 — 2026-08-27 · quinchat + quin-comercial
**Pie de página editable por embudo** (nombre de empresa; deja de estar "Klixmant" fijo).

### v159 — 2026-08-26 · quin-comercial
Se unifica en **una sola versión de la página** (se retira el toggle Actual/Nueva).

### v158 — 2026-08-26 · quin-comercial
Los botones **Inicio / Checkout** del teléfono de vista previa navegan entre ambas.

### v156 — 2026-08-26 · los tres proyectos
Pestañas **Inicio** y **Checkout** en la vista previa.

### v155 — 2026-08-26 · quin-comercial
Opción de **ocultar los campos básicos** del checkout.

### 2026-08-25 — Bloque "Pedidos y embudos" (sin número de versión)
- Pedidos: **embudo de origen exacto** por `funnel_slug` + referrer; columna Embudo;
  panel a ancho completo; el checkout **espera al guardado**; las stats pasan a contar
  ventas reales; lista resiliente.
- Pedidos: se muestra el producto del embudo (no el nombre interno duplicado).
- Pedidos: **botón editar embudo** (abre el editor).
- Embudos: al duplicar **pide nombre** (slug derivado del nombre) y guarda siempre
  activo — arregla el bug de la papelera.
- Carritos abandonados: excluye a quien **ya hizo pedido**, no solo a los confirmados.
- Catálogos: "al llegar a 0" con popover y aplicar a todas las filas.
- Se sube **quin-comercial completo** al repositorio.

### 2026-07-28 · `607bed9`
Simulador con 2 escenarios: WhatsApp y ventas web (`demo:whatsapp` / `demo:web`).

### 2026-07-19 · `e966af0`
Color correcto en productos individuales · validación de direcciones · producción para
todos · aviso de handoff a humano.

### 2026-07-18 — Bloque QuinChat maduro
- Menú verde agua, colores de pestañas, **reenvío de ventas al admin**.
- **Remarketing**, PACK X2 en collage, FAQ de empresa, etiquetas y mensajes naturales.
- Manejo correcto de **abono / oficina**: no negar recogida, objeción y cuentas.
- Fix de scroll definitivo en Catálogos (flex layout en vez de `position:fixed`).
- **Los 3 bugs de `MEMORIA_QUINCHAT.md`**: dirección sin `#`/`-`, "quiero otro" en
  pending, familias de color.

### 2026-07-17 — El día de los 26 commits
- **Refactor clave:** el bot **solo confirma pedidos**; cambio de color y catálogo
  pasan a un humano.
- Panel **Catálogos** + el bot consulta la base para el cambio de color.
- Confirmación en lenguaje natural + recordatorio de abono en oficina + mensaje final.
- Subida de fotos desde el computador, formulario inline sin modal, botones
  subir/bajar con orden persistido, **drag & drop** para reordenar colores.
- Fixes: `params` como Promise (Next.js 15), wamid del template, imagen desde el
  catálogo de Supabase, template solo si hay imagen real, **insert defensivo** al
  guardar el pedido, `wa_enviado` fuera de las queries (race condition), respuesta en
  contexto post-confirmación.
- **10 commits consecutivos** intentando arreglar el scroll de Catálogos.

### 2026-07-16
Template de WhatsApp con **catálogo de imágenes por producto** · productos NEW YORK ·
template de 10 variables (saludo `{{1}}`) · imágenes vía `raw.githubusercontent.com` ·
eliminar conversación · **ManualPanel** con la identidad de Agencia Quin · 3 commits
de `debug:` en producción para diagnosticar los campos que manda Funnelish.

### 2026-07-15 — **Nace QuinChat**
`1099d54` **UI de admin de 4 paneles** · plantillas con foto · **DisparadoresPanel**
estilo SellerChat · panel de **Ajustes** con configuración de WhatsApp.
*(El mismo día se cerraba la era ConfirmaYa con V62–V69 sobre las guías anuladas de Effi.)*

### V62–V69 · 2026-07-15 · ConfirmaYa
Anuladas en Effi: stat card, badge amarillo, "WA Hola" · badge **ANULADA + VIGENTE**
para clientes que volvieron · detectar anuladas por **valor de celda** y no por nombre
de columna · limpiar el cruce entre vigentes y anulados al subir el Excel · filtro
Anuladas que excluye a los que volvieron · rediseño visual (iconos en stats, botones
pill, sidebar premium).

### V57–V60 · 2026-07-09 a 07-11 · ConfirmaYa
**Remarketing KLIXMANT** · barra de distribución porcentual · stats que respetan el
filtro de fecha · barra de conversión deduplicada.

### V49–V56 · 2026-07-04 a 07-05 · ConfirmaYa
**Billetera QUINO** (comisiones sobre Effi) · filtro de fechas · **bono de WhatsApp**
con imagen e icono SVG · filtro "sin WA" · persistencia definitiva localStorage-first ·
el bono abre la app de WhatsApp directa.

### V44–V48 · 2026-07-02 a 07-04 · ConfirmaYa
Badge de mensaje enviado en remarketing · **segundo mensaje** para clientes ya
contactados (badge azul celeste) · nuevo mensaje de confirmación "Santiago" en
mayúsculas · cancelar venta mantiene la página actual.

### V33–V43 · 2026-07-02 · ConfirmaYa (13 commits en un día)
**Persistencia en Supabase** · tabla persistente con empalme de clientes · auto-confirmar
al enviar WhatsApp · filtros por columna · cancelar venta · vista de canceladas ·
paginación 30×30 · fecha de pedido · columnas separadas de confirmar datos y estado
Effi · selección masiva · orden por más reciente · productos RETRO, Portugal y Argentina.

### V24–V32 · 2026-07-01 · ConfirmaYa
Sidebar premium + barra de stats · **deduplicación de clientes** · limpiar filtros ·
auto-guardado del historial · filtro de fechas desde/hasta · fecha de compra visible ·
días reales de atraso · filtro por `fecha_pedido` · auto-eliminar confirmados ·
**fix del encoding corrupto** en la columna "Teléfono" del Excel de Effi.

### V22–V23 · 2026-06-30 · ConfirmaYa
**Rediseño visual premium** (fuente Inter, gradientes dorados, glass blur) ·
**módulo Historial y Comparación de Excel**.

### V15–V21 · 2026-06-29 · ConfirmaYa
Tabla visible · filtro por fecha de creación · **time picker AM/PM** · botón copiar
teléfono · productos Retro 1990 · WhatsApp abre la app directa · varios *cache bust*
de GitHub Pages.

### V5–V14 · 2026-06-28 · ConfirmaYa
Fondo hero, logo, packs · **emojis eliminados del mensaje** · revert de V10 · varios
intentos hasta que el botón de seleccionar archivo abrió el explorador · fix del correo
vacío · **restaurar `app.js` que se había guardado truncado**.

### VERSION1 · 2026-06-28 · `4a8de67`
Primer corte estable tras el giro a vista de tabla: catálogo completo de 13 productos,
rutas con `%20`, búsqueda en 3 niveles, lectura correcta del CSV de Funnelish.

### Tareas 01–20 · 2026-06-28 · **El origen**
`/img` + placeholder → `index.html` → formulario de 9 campos con datalist → sección
preview → `styles.css` negro/dorado/blanco → `catalogo.js` → `app.js` con las 4 reglas
→ estilos de preview → prueba de integración → compatibilidad GitHub Pages → aviso de
mensaje largo (1900 chars). **Auditoría: 36/36 ✅ APROBADO.**

---

## 7.4 La reorganización que recomiendo

```
FUNNELISH/
├── README.md                    ← NUEVO. Punto de entrada: qué es cada carpeta y a
│                                   dónde ir. Hoy no existe
├── CHANGELOG.md                 ← el §7.3 de este informe
├── CLAUDE.md                    ← se queda (lo lee el agente)
│
└── docs/
    ├── 00-ORIGEN.md             ← el §7.2 de este informe
    ├── 01-ARQUITECTURA.md       ← funde ESTRUCTURA_COMPLETA_EMBUDOS +
    │                               SOLO_ESTRUCTURA_EMBUDOS (hoy duplicados)
    ├── 02-OPERACION.md          ← deploy, entornos, variables, servicios activos
    ├── 03-SEGURIDAD.md          ← NUEVO y urgente: RLS, contraseñas, tokens, crons
    ├── 04-ESTADO.md             ← qué se usa y qué no (el §5 de este informe)
    ├── replicacion/
    │   ├── PAQUETE_REPLICACION_QUINCHAT.md
    │   ├── COPIAR-CARRITOS-ABANDONADOS.md
    │   └── COPIAR-VARIABLES-POLOS.md
    ├── prompts/                 ← los 5 PROMPT_*.md y PROMPTS_BLOQUES_UNO_POR_UNO.md
    ├── planes/                  ← PLAN.md, TASKS.md, PLAN_BOT_VENTAS.md, PLAN-FASE5.md
    └── historico/
        ├── auditorias/          ← AUDIT.md, AUDIT_PLAN.md
        └── correcciones/        ← los 35 CORRECCIONES_VNN.md, ya resumidos en CHANGELOG
```

**Tres reglas para que no se vuelva a llenar:**
1. **Un cambio no crea un `.md` nuevo** — agrega una entrada a `CHANGELOG.md`.
2. **Los `.md` de trabajo van a `docs/`**, nunca a la raíz. La raíz solo lleva
   `README.md`, `CHANGELOG.md` y `CLAUDE.md`.
3. **Si un documento se contradice con la realidad, se corrige, no se crea otro al
   lado.** (Es lo que pasó con `CONTINUACION-PROYECTO.md`.)

---

# 8. Fallos y errores

## 8.1 🔴 CRÍTICOS — de seguridad, activos ahora mismo

### F-01 · RLS desactivado en 25 de 28 tablas de producción
**Dónde:** base `quinchat` (`bjbjqmbuzpyjvcugbusx`)
**Qué queda expuesto:** 40.984 mensajes de WhatsApp, 2.578 conversaciones, 935
clientes con nombre/teléfono/dirección, 31 embudos con sus precios, el catálogo, las
guías de Effi.
**Cómo se explota:** la llave `NEXT_PUBLIC_SUPABASE_ANON_KEY` viaja al navegador de
cualquier visitante (`quinchat/lib/supabase.ts:48`). Con RLS apagado, esa llave da
**lectura y escritura completas** sobre esas tablas vía HTTP. No requiere ninguna
habilidad técnica especial.
**Impacto:** fuga de datos personales de 935 clientes colombianos + posibilidad de que
un tercero altere precios o borre pedidos.

### F-02 · RLS desactivado en 11 tablas del SaaS, incluidas `usuarios` y `tenants`
**Dónde:** base `confirma-ya` (`glmnuqfnxwaibckufgtr`)
**Qué queda expuesto:** los 3 usuarios del sistema, las 4 empresas clientes, sus
carritos, sus eventos de embudo.
**Agravante:** según `CONTINUACION-PROYECTO.md:38`, **las contraseñas de `usuarios`
están en texto plano**. RLS apagado + texto plano = las credenciales de todos los
clientes del SaaS son legibles con la llave pública.

### F-03 · Token de Meta y llave de Groq expuestos, sin regenerar
**Documentado desde:** julio de 2026 (`CONTINUACION-PROYECTO.md:37`)
**Estado:** ⚠️ **sigue pendiente**. Con el token de Meta, un tercero puede enviar
mensajes de WhatsApp **desde el número del negocio**.

### F-04 · Dos crons sin autenticación
**Dónde:** `api/cron/promo-cierre` y `api/cron/ventas-seguimiento`
**Detalle:** los otros 12 validan `CRON_SECRET`; estos dos no. Cualquiera que conozca
la URL puede dispararlos en bucle → mensajes duplicados a clientes y consumo de cuota.

### Plan de corrección sugerido (en este orden)

```
1. Regenerar el token de Meta y la llave de Groq.           (30 min · quita F-03)
2. Añadir CRON_SECRET a los 2 crons abiertos.               (10 min · quita F-04)
3. Hashear las contraseñas de `usuarios` (bcrypt).          (2 h  · mitiga F-02)
4. RLS tabla por tabla, escribiendo la política ANTES:
     · empezar por `usuarios` y `tenants` (las peores)
     · seguir por `clientes_funnelish`, `conversations`, `messages`
     · dejar para el final las que lee la página pública
   NO correr el ALTER TABLE masivo: sin políticas, tumba la app.  (1–2 días)
5. Cerrar la Fase 5 del multi-tenant (filtrado por tenant_id).
```

## 8.2 🟠 GRAVES — de arquitectura y proceso

### F-05 · Cero tests, cero CI, cero staging
No existe un solo archivo de test, ni `.github/workflows/`, ni un entorno de pruebas.
quin-comercial **ni siquiera está conectado a Git**: cada `vercel --prod` va directo a
producción, encima de 4 clientes que pagan. Es la causa raíz del punto 4.

### F-06 · Fase 5 del multi-tenant detenida con clientes activos
La fase que **filtra las consultas por `tenant_id`** lleva parada desde el 29 de julio.
Mientras tanto hay 4 tenants con datos en la misma base. Cada consulta que no filtre es
una fuga potencial entre clientes. Son 66 archivos y 21 tablas a revisar
(`PLAN-FASE5.md`).

### F-07 · Dos archivos concentran casi todo el riesgo
| Archivo | Tamaño |
|---|---|
| `api/whatsapp/webhook/route.ts` | **162 KB** |
| `components/panel/EmbudosPanel.tsx` | **120 KB** |

Cualquier cambio en ellos puede romper algo lejano, y sin tests no hay red. El webhook
ha sido modificado **18 veces**.

### F-08 · El flujo de agentes está escrito pero no se cumple
`AGENTS.md` exige tres "APROBADO" antes de entregar. **No ha habido ni una auditoría
desde el 28 de junio**, sobre 126 commits.

## 8.3 🟡 MEDIOS — deuda técnica confirmada

| # | Fallo | Detalle |
|---|---|---|
| F-09 | **`imgOptim()` desactivada** | `lib/funnels.ts:118` devuelve la imagen original. La optimización con `/_next/image` rompía las fotos en producción y se apagó. Todas las imágenes se sirven a tamaño completo → ancho de banda y velocidad |
| F-10 | **Código muerto commiteado** | `quin-comercial/_to_delete/` con **19 archivos**: `.bak`, `.txt` de depuración, `HEAD.lock.26672.old`. Está en el repositorio |
| F-11 | **Componentes huérfanos** | `EditorInsignia.tsx` y `InsigniaFlotante.tsx` no los importa nadie |
| F-12 | **Módulos construidos y sin usar** | `ContactosPanel` (19 KB, tabla con **0 filas**), `DisparadoresPanel` (**29 KB**, 1 sola regla en 2 meses) |
| F-13 | **Documentación contradictoria** | `CONTINUACION-PROYECTO.md` describe quin-comercial como proyecto en pausa; en realidad tiene 4 clientes y cobros |
| F-14 | **Duplicación de código entre proyectos** | quinchat y quin-comercial comparten la mayor parte del código copiado a mano. Cada arreglo hay que hacerlo dos veces — y a veces solo se hace en uno |
| F-15 | **Plan Hobby de Vercel con clientes de pago** | Límites de ejecución y de crons; `vercel.json` vacío por eso |
| F-16 | **Rama `dev` muerta** | Sin uso desde el 30-jun; todo va directo a `master` |
| F-17 | **Sin README** | El repositorio no tiene punto de entrada. Un desarrollador nuevo no sabe por dónde empezar entre 67 `.md` |
| F-18 | **Modelos de IA desactualizados** | En el código conviven `claude-3-5-haiku-latest`, `claude-sonnet-4-6` y `claude-haiku-4-5-20251001`. Vale revisar la migración a la generación actual, por costo y calidad |

## 8.4 📜 Fallos históricos ya resueltos (para no repetirlos)

Estos ya están corregidos, pero el patrón enseña:

| Fallo | Cuándo | Causa raíz | Lección |
|---|---|---|---|
| **`app.js` guardado truncado** | 28-jun | Un archivo se escribió a medias y se commiteó roto | Verificar el archivo tras escribirlo; un test lo habría cazado |
| **Encoding corrupto en el Excel de Effi** | 01-jul | La columna "Teléfono" llegaba como `Tel馯no`. Se resolvió con un fallback ASCII de 3 caracteres | Nunca confiar en el nombre de columna de un Excel externo |
| **Scroll de Catálogos** | 17-jul | **10 commits** de prueba y error en producción | Depurar CSS en local con el inspector, no desplegando |
| **Template de WhatsApp fallando en silencio** | 17-jul | Se enviaba el template aunque no hubiera imagen real → entrega fallida silenciosa | Validar precondiciones antes de llamar a una API externa |
| **Upsert que fallaba en silencio** | 17-jul | El pedido no se guardaba y nadie se enteraba. Se cambió a insert defensivo | Loguear los errores de la base **siempre** |
| **Race condition con `wa_enviado`** | 17-jul | La query filtraba por un flag que cambiaba en paralelo | Cuidado con filtrar por estado mutable |
| **`params` como Promise (Next.js 15)** | 16/17-jul | Cambio de API entre versiones mayores | Leer las notas de migración al subir de versión mayor |
| **Template de 10 variables** | 16-jul | Faltaba el saludo `{{1}}` y Meta rechazaba el envío | — |
| **Fuentes de Jimp ausentes en producción** | — | Vercel no incluía `fonts/` en el bundle → ENOENT solo en producción | Declarar `outputFileTracingIncludes` para assets no importados |
| **Permisos de `service_role` no clonados** | 29-jul | Al clonar el esquema, el rol quedó sin DML. El síntoma era "Correo o contraseña incorrectos"; la causa, `permission denied for table usuarios` | Al clonar un esquema de Supabase, **los grants no viajan** |
| **Imagen del embudo compartida al duplicar** | sin commitear | `imagenes[0]` se reutilizaba entre copias | — |
| **3 bugs de producción del bot** | 18-jul | Dirección sin `#`/`-`, "quiero otro" en pending, familias de color | Documentados en `MEMORIA_QUINCHAT.md` antes de arreglarlos: buena práctica |

## 8.5 Prioridades — qué haría primero

| Prioridad | Acción | Tiempo | Por qué |
|---|---|---|---|
| **1** | Regenerar token de Meta y llave de Groq | 30 min | Credenciales expuestas hace un mes |
| **2** | `CRON_SECRET` en los 2 crons abiertos | 10 min | Trivial de arreglar, evita spam a clientes |
| **3** | Hashear contraseñas de `usuarios` | 2 h | Es un SaaS con clientes reales |
| **4** | **RLS con políticas**, empezando por `usuarios`, `tenants`, `clientes_funnelish` | 1–2 días | El riesgo más grande del proyecto |
| **5** | Conectar quin-comercial a Git en Vercel | 10 min | Elimina el problema de los 169 números y da preview |
| **6** | Hook `PreToolUse` con `tsc --noEmit` antes de commit | 15 min | Barato y evita romper producción |
| **7** | Cerrar la Fase 5 del multi-tenant | 1 semana | Fugas entre clientes |
| **8** | Reorganizar `docs/` + `README.md` + `CHANGELOG.md` | 3 h | Para que el resto sea mantenible |
| **9** | Borrar `_to_delete/` y los componentes huérfanos | 20 min | Higiene |
| **10** | Primeros tests sobre `lib/address.ts`, `lib/funnels.ts`, `lib/bloques.ts` | 1 día | Empezar por lógica pura, sin base de datos |

---

## Cierre

En dos meses este proyecto pasó de un formulario HTML de una pantalla a un sistema de
e-commerce con bot de IA, constructor visual de embudos y un SaaS multi-tenant con
clientes pagando. Eso es una velocidad de construcción notable, y el producto funciona:
41.000 mensajes cursados, 935 pedidos, 31 embudos publicados, 4 empresas clientes.

Lo que quedó atrás fue el **proceso**: la auditoría se hizo una vez y funcionó
perfectamente (36/36), pero no se volvió a ejecutar. Los 169 números de versión, los
10 commits para un scroll, las tablas abiertas al público y los 67 `.md` sin orden
tienen todos la misma raíz — **no hay ningún control automático entre escribir el
código y ponerlo delante de un cliente**.

La buena noticia es que las seis primeras acciones de la lista de prioridades suman
menos de un día de trabajo y eliminan tanto el riesgo de seguridad como la causa de
los 169 números.

---

*Informe generado el 2026-08-28 sobre el commit `0cface9`. Datos de base verificados
en vivo contra Supabase; datos de Vercel contra la API de la cuenta.*
