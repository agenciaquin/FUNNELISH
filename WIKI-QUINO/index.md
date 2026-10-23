---
tipo: indice
titulo: Índice de la WIKI QUINO
tags: [indice]
actualizado: 2026-09-04
estado: vigente
---

# Índice

Entrada principal: [[overview]] · Bitácora: [[log]] · Esquema del mantenedor: `CLAUDE.md`

## Arquitectura

| Página | De qué trata |
|---|---|
| [[stack]] | Next.js 16, TypeScript, mapa de carpetas y de `lib/` |
| [[despliegue]] | Vercel, root `quinchat`, comando desde FUNNELISH |
| [[supabase]] | Postgres, service_role, grants, tablas en uso |
| [[almacenamiento-r2]] | Cloudflare R2, SigV4, respaldo en Supabase Storage |
| [[whatsapp-cloud-api]] | Cloud API, CAPI, pixel TikTok, dos líneas, plantillas |

## Módulos

| Página | De qué trata |
|---|---|
| [[bots-quino]] | Los dos bots y la regla de oro de aplicar todo a ambos |
| [[bot-chat-whatsapp]] | `ventas.ts`, `atenderVenta`, guion de venta |
| [[bot-chat-funnel]] | Webhook entrante de WhatsApp |
| [[tokens-del-bot]] | `[[HUMANO]]`, `[[ACTUALIZAR]]`, `[[PEDIDO]]`, `[[FOTO]]` |
| [[pedidos]] | `clientes_funnelish`, webhook de Funnelish, origen por `referencia` |
| [[embudos]] | Tabla `funnels`, `layout` jsonb, editor y página pública |
| [[remarketing]] | Plantillas MARKETING por etiqueta, `remarketing_envios` |
| [[effi]] | `effi_guias`, estado real de entrega y flete |
| [[catalogos]] | `catalogo_colores`, `catalogos_bot`, foto exacta por color |
| [[imagenes]] | Compresión en navegador, formatos, `imgOptim()` |
| [[panel]] | Mapa de módulos y herramientas del panel |
| [[herramienta-legado-confirmaya]] | La herramienta estática original y su plantilla de mensaje |

## Reglas

| Página | De qué trata |
|---|---|
| [[confirmacion-de-pedidos]] | Normalización, valor fijo, oficina con abono, dirección por partes |
| [[reglas-duras]] | Los 7 límites no negociables |
| [[identidad-de-marca]] | Colores, tipografías, mascota QUINO |

## Decisiones

| Página | De qué trata |
|---|---|
| [[no-webp-en-headers-de-whatsapp]] | Meta acepta WebP pero no lo entrega |
| [[optimizador-de-imagenes-desactivado]] | `/_next/image` rompió producción |

## Fuentes ingeridas

| Fecha | Fuente |
|---|---|
| 2026-09-04 | [[2026-09-04-prompt-agente-wiki-quino]] |

## Consultas archivadas

_(vacío — se llena cuando una respuesta valga la pena guardarse)_
