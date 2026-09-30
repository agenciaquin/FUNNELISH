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

- Generar una cadena larga al azar y crearla en los dos proyectos de Vercel.
- En Funnelish, cambiar la URL del webhook añadiendo `?token=<la cadena>` (conservar `&modo=agente` si lo lleva).
- **Sin la variable** funciona como hoy. **Con la variable pero sin cambiar la URL en Funnelish**, se
  rechazan las ventas de Funnelish (el checkout propio no se ve afectado).

### 4 · Freno del bot (opcional, ya viene con valores por defecto)

| Variable | Por defecto | Uso |
| --- | --- | --- |
| `BOT_IA` | (vacía = encendido) | `off` apaga las respuestas de IA en todos los chats |
| `BOT_TOPE_DIARIO` | `40` | Respuestas del bot por chat en 24 h antes de pasar a HUMANO. `0` lo desactiva |

Recomendado para la reactivación: publicar con `BOT_IA=off`, comprobar webhooks y crons, y después quitarla.

### 5 · Otras cosas que cambian de comportamiento

- `/api/cron/carrito-recuperacion` en quinchat antes pedía sesión en el dominio del panel; ahora usa `CRON_SECRET`.
- `/api/recargas/webhook` (Mercado Pago, quin-comercial) antes pedía sesión en el panel, así que es probable
  que las notificaciones de pago no llegaran. Ahora está abierta; la ruta verifica el pago con Mercado Pago.
- Cualquier herramienta externa que llamara otras rutas de `/api/` sin sesión dejará de funcionar. Las
  conocidas (ConfirmaYa → `/api/whatsapp/confirmar`, con su API key) siguen abiertas.

## Lo que NO entra en esta rama (sigue en la auditoría)

Intervalos del panel (6 s / 12 s), compresión en quin-comercial, ISR en landings, seguimiento agrupado,
carrito cada 1,5 s, clasificación de fotos con el bot apagado (M5: tocarla cambia cuándo se marca un abono,
hay que decidirlo con negocio).
