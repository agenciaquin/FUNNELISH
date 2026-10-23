---
tipo: arquitectura
titulo: Stack y arquitectura
tags: [stack, nextjs, typescript]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/package.json", "quinchat/next.config.ts", "quinchat/middleware.ts"]
---

# Stack

- **Framework:** Next.js 16 (App Router) + TypeScript + React.
- **Sin tests formales.** La validación de referencia es `npx tsc --noEmit`.
- **Hosting:** Vercel → [[despliegue]].
- **Base de datos:** Supabase Postgres → [[supabase]].
- **Medios:** Cloudflare R2 (respaldo Supabase Storage) → [[almacenamiento-r2]].
- **Mensajería:** WhatsApp Cloud API + Meta CAPI + pixel TikTok → [[whatsapp-cloud-api]].

## Mapa de carpetas (raíz del repo)

```
quinchat/            <- la aplicación Next.js (esto es ConfirmaYa)
  app/               <- App Router: /panel, /p/[slug] (embudo público), /api/*
  components/panel/  <- UI del panel, un componente por módulo
  lib/               <- lógica de negocio compartida
  lib/quinchat/      <- cerebro del bot: ventas.ts, systemPrompt.ts, claude.ts, registro-venta.ts
  sql/               <- migraciones sueltas (idempotentes)
quin-comercial/      <- FUERA DE ÁMBITO. Otra sesión lo maneja. Ver [[reglas-duras]]
```

## Piezas clave de lib

| Archivo | Para qué |
|---|---|
| `lib/quinchat/ventas.ts` | Bot de Chat WhatsApp — `atenderVenta(...)` → [[bot-chat-whatsapp]] |
| `lib/quinchat/systemPrompt.ts` | Prompt del sistema del bot QUINO |
| `lib/whatsapp.ts` | Envío de texto, plantillas y media por WhatsApp |
| `lib/whatsapp-contexto.ts` | Línea activa (funnel / ventas) — `phoneIdActual()` |
| `lib/whatsapp-templates.ts` | Plantillas de Meta |
| `lib/r2.ts` | Firma SigV4 para Cloudflare R2 |
| `lib/funnels.ts`, `lib/bloques.ts` | Embudos → [[embudos]] |
| `lib/imagen-comprimir.ts` | Compresión en navegador → [[imagenes]] |
| `lib/capi.ts`, `lib/meta-capi.ts`, `lib/meta-ads.ts` | Eventos de conversión |

<!-- verificado: 2026-09-04 — listado de lib/ y lib/quinchat/ contra el repo -->

> Verificar siempre contra el código actual: el proyecto cambia rápido.
