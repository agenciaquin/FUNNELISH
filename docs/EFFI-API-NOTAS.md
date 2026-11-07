# API de Effi — notas para la sincronización (solo lectura)

Objetivo: traer a QuinChat guías, pedidos y estados de Effi (sin crear ni modificar nada en Effi).
Fuente: documentación interna de Effi (Integraciones → Documentación API), pegada por el dueño el 02-nov-2026.

## Generales
- Autenticación: cabecera `Authorization: Bearer <API_KEY_EFFI>`.
- API key: Administración → Usuarios → Ver más detalles. Vigencia 360 días (botón «Renovar API Key»). 32–40 caracteres.
- Recomendado: usuario aparte «QuinChat API» solo con permisos de consulta.
- Rate limit: 600 peticiones/minuto por API key (doc. del 07-nov-2026; antes decía 120). Si se pasa → 429 + `Retry-After`.
- Escritura (POST): cuerpo JSON, `idempotency_key` obligatorio (409 si se repite). Ver `PLAN-subir-ventas-effi.md`.
- Paginación: `pagina` (def. 1), `por_pagina` (def. 100, máx. 100). Respuesta trae `paginacion {pagina, por_pagina, total, total_paginas}`.
- Respuesta OK: `{ "ok": true, "data": [...], "paginacion": {...} }`. Error: `{ "ok": false, "mensaje": "..." }`.
- Errores: 400 petición inválida · 401 token/usuario inválido o API key vencida · 403 sin permiso · 429 límite.
- Variables en Vercel (las pone el dueño, nunca en el chat): `EFFI_API_URL`, `EFFI_API_TOKEN`.

## Logística → Guías de transporte → GET «Consultar guías de transporte»
- `GET https://effi.com.co/api/guia_transporte?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&pagina=1&por_pagina=100`
- Implementado en `quinchat/lib/effi-api.ts` (sync de 60 días → `effi_guias_api` + resumen en `effi_guias`).
  Cron: `/api/cron/effi-sync?secret=CRON_SECRET`. Botón: «🔄 Sincronizar con Effi» en Estado en Effi.
- Campos útiles de cada guía:
  - `guia`, `guia_adicional`, `nombre_transportadora`, `nombre_transportadora_efficommerce`
  - `estado` / `est_guia` (ej. «Sin Recolectar»), `estado_efficommerce` / `est_guia_efficommerce` (ej. «Generada»)
  - `fecha_trans`, `fecha_envio`, `fecha_entrega_esperada`, `fecha_estado_final`, `fecha_anular`, `vigente`
  - Destinatario: `nombre_destinatario`, `id_destinatario` (cédula), `telefonos_destinatario` (→ cruce con QuinChat),
    `direccion_destinatario`, `nombre_ciudad_destinatario`, `nombre_provincia_destinatario`
  - Dinero: `valor_declarado`, `recaudo`, `valor_recaudo`, `valor_flete`, `descuento`
  - Pedido de origen: `t_trans_ref`, `tipo_trans_ref`, `prefijo_ref`, `id_ref` (remisión/orden de la que salió la guía)
  - `url_guia_transportadora`, `url_sticker_transportadora`, `contenido`
  - EffiCommerce: `devolucion_efficommerce`, `recaudo_efficommerce`, `liquidacion_efficommerce`…

## Pendiente de recibir
- GET «Histórico de cambios de estados de guías» (para traer solo lo que cambió).
- GET «Novedades de guías de transporte».
- GET «Remisiones de venta» (y «Órdenes de venta» si se usan).
- Lista completa de estados posibles (`est_guia` / `est_guia_efficommerce`).
