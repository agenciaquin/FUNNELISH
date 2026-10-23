---
tipo: modulo
titulo: Los dos bots QUINO — regla de oro
tags: [bot, quino, whatsapp]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/quinchat/ventas.ts", "quinchat/app/api/whatsapp/webhook/route.ts"]
---

# Los dos bots

QUINO vive en **dos** implementaciones distintas. No comparten el mismo archivo de lógica.

| Bot | Archivo | Página |
|---|---|---|
| Chat WhatsApp | `quinchat/lib/quinchat/ventas.ts` → `atenderVenta(...)` | [[bot-chat-whatsapp]] |
| Chat Funnel | `quinchat/app/api/whatsapp/webhook/route.ts` (webhook entrante) | [[bot-chat-funnel]] |

## 🔴 Regla de oro

> **Cada arreglo del bot se aplica a LOS DOS.**

Es el error más caro del proyecto: se corrige un comportamiento en `ventas.ts`, se despliega, y el
otro bot sigue haciendo lo viejo. Antes de dar por cerrado cualquier cambio de comportamiento del
bot, revisar el archivo hermano.

Chequeo rápido antes de cerrar un cambio del bot:

```bash
grep -n "<frase o token que tocaste>" quinchat/lib/quinchat/ventas.ts quinchat/app/api/whatsapp/webhook/route.ts
```

## Lo que comparten

- El mismo lenguaje de **tokens** → [[tokens-del-bot]].
- Las mismas [[confirmacion-de-pedidos|reglas de confirmación]].
- Persisten en `conversations` y `messages` → [[supabase]].
- Escriben el pedido en `clientes_funnelish` → [[pedidos]].

## Lo que NO comparten

Los prompts son textos largos e independientes dentro de cada archivo, y **han divergido**.
Ejemplo detectado el 2026-09-04: el JSON de `[[ACTUALIZAR]]` no lleva los mismos campos en los dos
lados (`municipio`/`barrio`/`color`/`precio`/`oficina`/`abono` en `ventas.ts` vs.
`ciudad`/`departamento` en el webhook). Verificar antes de asumir un contrato único.
<!-- verificado: 2026-09-04 — ventas.ts:564 y webhook/route.ts:1953 -->
