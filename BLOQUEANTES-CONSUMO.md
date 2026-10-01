# Rama `bloqueantes-consumo` · qué hace y qué configurar antes de publicar

**Fecha:** 30-09-2026 · **Base:** `master` @ `5a2f455` · **No publicada.**
Son los 5 arreglos que la auditoría (`AUDITORIA-CONSUMO-2026-09-30.md`, rama `auditoria-consumo`) marcó como
imprescindibles antes de reactivar el bot.

> ⚠️ **No fusionar a `master` todavía.** Producción corre v174 (`bff4e19`), que solo existe en el PC de
> agenciaquin. Primero hay que unir v174 con `master` (ver `NOTA-PC-AGENCIAQUIN.md`); después se rebasa
> esta rama encima.

## Los 5 commits

| Commit | Qué arregla |
| --- | --- |
| `fix(seguridad)` | `/api/` pide sesión salvo una lista cerrada. Antes la tienda abría la API entera: remarketing de pago, IA, pedidos con datos personales |
| `fix(crons)` | Sin `CRON_SECRET` los crons **no corren** (antes quedaban abiertos). `ventas-seguimiento` ahora pide la clave |
| `fix(webhook)` | Firma de Meta (`X-Hub-Signature-256`) en el webhook de WhatsApp |
| `fix(funnelish)` | Token en la URL del webhook de Funnelish |
| `fix(bot)` | `BOT_IA=off`, tope de respuestas por chat y día, y sin respuestas dobles por reintentos de Meta (quinchat) |

**Comprobado:** `tsc` y `next build` pasan en las dos apps; 6/6 pruebas de firma (`quinchat/pruebas/firma-meta.ts`).
El middleware se probó en local con `Host: pedido.klixmant.shop`: las rutas públicas llegan a su código y
`/api/pedidos/lista`, `/api/remarketing`, `/api/plantillas-wa/enviar`, `/api/quinchat`, `/api/push/test` y
`/api/funnels/imagen` redirigen al login.

**No comprobado:** con tráfico real de Meta, Funnelish ni cron-job.org. Por eso existe la lista de abajo.

---

## Antes de publicar: configurar, o se corta algo

### 1 · `CRON_SECRET` — si falta, los crons dejan de correr

| Proyecto Vercel | ¿Existe hoy? | Qué hacer |
| --- | --- | --- |
| `quinchat-agencia-quin` | ✅ sí | Revisar en cron-job.org que **todas** las tareas lo manden (`Authorization: Bearer …` o `?secret=`). **`ventas-seguimiento` antes no lo pedía**: seguramente su tarea no lo manda |
| `quinchat-comercial` | ❌ **no** | Crearla en Vercel **y** añadirla a todas sus tareas en cron-job.org. Sin eso, al publicar se paran todos los crons de quin-comercial |

En quin-comercial, `aprendizaje`, `objeciones`, `apagar-vendidos` y `seguimiento-ia` también se pueden lanzar
con sesión del panel, pero entonces **solo corren para la empresa de esa sesión**. Para que corran para todos
los clientes hace falta la clave: sin `CRON_SECRET`, esos crons ya no recorren a todos.

### 2 · `WHATSAPP_APP_SECRET` — firma de Meta

- Meta → developers.facebook.com → la app → Configuración → Básica → **Clave secreta de la app**.
- Crearla en los dos proyectos de Vercel.
- **Sin ella** el webhook sigue funcionando como hoy (deja pasar y avisa en el registro). Con una clave
  equivocada, se rechazan **todos** los mensajes: tras publicar, mandar un WhatsApp de prueba y mirar el
  registro de Vercel (`[Webhook] aviso rechazado`).
- En quin-comercial solo aplica a la línea propia de la agencia. Las rutas por cliente
  (`/api/whatsapp/webhook/<cliente>`) quedan sin comprobar: cada cliente puede tener su propia app de Meta y
  hoy no guardamos su clave. Pendiente.

### 3 · `FUNNELISH_WEBHOOK_TOKEN` — webhook de Funnelish

- Generar una cadena larga al azar y crearla en los dos proyectos de Vercel (puede ser distinta en cada uno).
- **Sin la variable** funciona como hoy. **Con la variable pero sin cambiar la URL en Funnelish**, se
  rechazan las ventas de Funnelish (el checkout propio no se ve afectado).

**quinchat** (una sola empresa): en Funnelish, añadir a la URL del webhook `?token=<la cadena>` (conservar
`&modo=agente` si lo lleva).

**quin-comercial** tiene dos tipos de URL:

| URL | Token que acepta |
| --- | --- |
| `/api/funnelish/webhook` (la de la agencia) | la cadena de la variable, tal cual |
| `/api/funnelish/webhook/<slug>` (una por cliente) | `HMAC-SHA256(FUNNELISH_WEBHOOK_TOKEN, <slug>)` en hex: **uno distinto por cliente** |

El token de un cliente no sirve para la URL de otro, y ningún cliente conoce la cadena general. No se guarda
nada en la base: se recalcula. Para sacar la URL de cada cliente (desde `quin-comercial/`, con la **misma**
cadena que se va a poner en Vercel):

```bash
FUNNELISH_WEBHOOK_TOKEN='<la cadena>' npx tsx pruebas/token-por-cliente.ts <slug1> <slug2> …
# BASE=https://<dominio> si el cliente usa otro dominio distinto de www.klixmant.shop
```

> ⚠️ **Orden obligatorio en quin-comercial.** Al crear `FUNNELISH_WEBHOOK_TOKEN` en `quinchat-comercial`,
> **todas** las URLs de Funnelish sin token (la de la agencia y la de **cada cliente**) empiezan a recibir
> 401 y **se cortan sus ventas**. Antes de crear la variable:
> 1. Sacar la lista de clientes que usan Funnelish (slug de `tenants`) y generar sus URLs con el script.
> 2. Que cada cliente cambie la URL en **su** Funnelish (conservar `&modo=agente` si lo lleva), y la agencia la suya.
> 3. Solo entonces crear la variable y publicar. Mientras la variable no exista, la URL con token también
>    funciona (se acepta todo), así que el cambio de URL se puede hacer antes sin cortar nada.
>
> Cambiar la cadena más adelante invalida la URL de todos los clientes a la vez.

### 4 · Freno del bot (opcional, ya viene con valores por defecto)

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `BOT_IA` | (vacía = encendido) | `off` apaga las respuestas de IA en todos los chats |
| `BOT_TOPE_DIARIO` | `80` | Mensajes salientes del bot por chat en 24 h antes de pasar a HUMANO. `0` lo desactiva |

`BOT_TOPE_DIARIO` cuenta **mensajes salientes** del bot (filas `role: 'assistant'`), no turnos: cada parte de
una respuesta separada por `---` cuenta como uno, igual que cada foto y los mensajes de los crons. Con 40
(el valor anterior) un comprador que pedía ver colores podía pasar a HUMANO en una conversación normal;
80 son unos 20-30 turnos. Al pasar a HUMANO se **añade** la etiqueta: el estado del chat (VENTA REALIZADA,
PEDIDO PROGRAMADO…) se conserva.

Recomendado para la reactivación: publicar con `BOT_IA=off`, comprobar webhooks y crons, y después quitarla.

### 4b · Tabla `rate_limits` en la base de quinchat — límite de `/api/pedidos`

`/api/pedidos` admite como mucho **5 pedidos por teléfono y 20 por IP cada hora** (respuesta 429 con un mensaje
para el cliente). El conteo se guarda en la tabla `rate_limits`. quin-comercial ya la tiene
(`sql/mt-12-rate-limits.sql`); en quinchat hay que crearla con `quinchat/sql/rate-limits.sql` (misma tabla).

- **Necesita aprobación**: es SQL que escribe en la base de producción de quinchat.
- **Sin la tabla no se corta nada**: el límite falla abierto y deja pasar todos los pedidos, pero entonces no
  limita. Se ve en el registro de Supabase, no en el de Vercel.
- Comprobar primero si quinchat y quin-comercial comparten proyecto de Supabase: si lo comparten, la tabla ya
  existe.

### 5 · Otras cosas que cambian de comportamiento

- `/api/cron/carrito-recuperacion` en quinchat antes pedía sesión en el dominio del panel; ahora usa `CRON_SECRET`.
- `/api/recargas/webhook` (Mercado Pago, quin-comercial) antes pedía sesión en el panel, así que es probable
  que las notificaciones de pago no llegaran. Ahora está abierta; la ruta verifica el pago con Mercado Pago.
- Cualquier herramienta externa que llamara otras rutas de `/api/` sin sesión dejará de funcionar. Las
  conocidas (ConfirmaYa → `/api/whatsapp/confirmar`, con su API key) siguen abiertas.
- `/api/pedidos`, `/api/funnels/evento`, `/api/funnels/carrito` (y `/api/registro` en quin-comercial) solo son
  públicas con `POST`. El `GET` de diagnóstico de `/api/funnels/evento` en quinchat pide sesión.
- `/api/pedidos` ignora las fotos (`imagen`, `imagenes`) que no sean de Supabase, `R2_PUBLIC_URL`, las tiendas o
  el mismo dominio que recibe el pedido, y usa la del catálogo o la de respaldo. **Si algún embudo usa fotos
  alojadas en otro sitio**, su plantilla de confirmación saldrá con la foto del catálogo: tras publicar, hacer
  un pedido de prueba en cada embudo activo y mirar la foto que llega por WhatsApp.
- Un pedido que sale duplicado ya no manda la compra a Meta (CAPI).

## Revisión del agente de pruebas (30-09-2026, antes de la auditoría)

Primera pasada: **NO LISTO**. El cron `objeciones` (usa IA) seguía abierto sin `CRON_SECRET` en las dos apps
(`} else { return true; }` que no se había cambiado). Corregido; la prueba de crons pasa ahora **56/56**
(quinchat) y **52/52** (quin-comercial).

| Prueba (`<app>/pruebas/`) | quinchat | quin-comercial |
| --- | --- | --- |
| `middleware-api.ts`: todas las rutas × hosts de tienda y panel | 287/287 | 520/520 |
| `crons.ts` sin clave / con clave | 56/56 · 84/84 | 52/52 · 78/78 |
| `token-funnelish.ts` | 20/20 | 22/22 |
| `firma-meta.ts` (+ `firma-meta-ruta.ts` en quinchat) | 6/6 · 4/4 | 15/15 |
| `freno-bot.ts` | 22/22 | 22/22 |

Cómo correrlas: el encabezado de cada archivo trae el comando. Las de middleware y crons necesitan
`next build` + `next start` en local; ninguna usa variables de producción.

Observaciones que quedan abiertas:
- **Anti-duplicados (quinchat):** solo revisión de código; no se puede ejecutar sin montar la ruta entera.
  Efecto menor, igual que en quin-comercial: reacciones, ubicaciones y tipos no soportados dejan un globo vacío
  en el panel, y una reacción que llega durante los 12 s de espera hace que el bot no responda al texto anterior.
- **Con `BOT_IA=off` o el tope alcanzado se sigue gastando en dos sitios** que van antes del freno: la
  clasificación de fotos con Claude (M5) y la transcripción de audios con Groq (gratis hoy).
- `BOT_TOPE_DIARIO` con un valor que no es número (p. ej. `cuarenta`) desactiva el tope, igual que `0`.
- Si llegan `?token=` vacío y la cabecera `x-webhook-token` correcta, manda la query y se rechaza.

## Correcciones tras la auditoría (`AUDIT-BLOQUEANTES.md`, 30-09-2026)

La auditoría dio **REQUIERE CORRECCIONES** con 5 fallos. Un commit por fallo:

| Commit | Fallo | Qué se hizo | App |
| --- | --- | --- | --- |
| `fix(api)` | Carritos del panel sin sesión (datos personales) | Las rutas públicas exactas solo aceptan `POST` en el middleware, y además `GET/PATCH/DELETE` de `funnels/carrito` y el `GET` de `funnels/evento` piden sesión en la ruta | middleware: las dos · rutas: quinchat |
| `fix(bot)` | El freno borraba las etiquetas | Añade `HUMANO` a la lista de `label` en vez de reemplazarla; tope por defecto 80 | las dos (`lib/freno-bot.ts` idéntico) |
| `fix(crons)` | Cualquier sesión lanzaba la IA de todos los clientes | Con clave, todas las empresas; con sesión, solo la suya (`alcanceCron`) en `aprendizaje`, `objeciones`, `apagar-vendidos` y `seguimiento-ia` | quin-comercial |
| `fix(pedidos)` | `/api/pedidos` sin límite | 5 por teléfono y 20 por IP cada hora, solo fotos propias, sin CAPI para duplicados | las dos |
| `fix(funnelish)` | Un único token para todos los clientes | Token por cliente derivado del slug con HMAC, y script para generar las URLs | quin-comercial |

Pruebas tras las correcciones (en local, sin variables de producción):

| Prueba (`<app>/pruebas/`) | quinchat | quin-comercial |
| --- | --- | --- |
| `middleware-api.ts` (ahora prueba también los métodos de las exactas) | 323/323 | 584/584 |
| `crons.ts` sin clave / con clave | 56/56 · 84/84 | 52/52 · 78/78 |
| `token-funnelish.ts` (+ token por cliente en quin-comercial) | 20/20 | 33/33 |
| `firma-meta.ts` (+ `firma-meta-ruta.ts` en quinchat) | 6/6 · 4/4 | 15/15 |
| `freno-bot.ts` (etiquetas conservadas, tope 80) | 26/26 | 26/26 |
| `imagen-propia.ts` (nueva) | 17/17 | 17/17 |

Sin comprobar (necesitan la base real): que el límite de `/api/pedidos` cuente de verdad en `rate_limits`,
y que un cron lanzado con sesión recorra solo la empresa de la sesión (se comprobó que con sesión sin empresa
responde 401 y que con empresa pasa la comprobación; el filtro por empresa es una consulta a `tenants`).

## Lo que NO entra en esta rama (sigue en la auditoría)

Intervalos del panel (6 s / 12 s), compresión en quin-comercial, ISR en landings, seguimiento agrupado,
carrito cada 1,5 s, clasificación de fotos con el bot apagado (M5: tocarla cambia cuándo se marca un abono,
hay que decidirlo con negocio).
