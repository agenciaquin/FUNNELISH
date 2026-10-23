---
tipo: arquitectura
titulo: Despliegue en Vercel
tags: [vercel, deploy]
actualizado: 2026-09-04
estado: vigente
---

# Despliegue

- Proyecto Vercel: **quinchat-agencia-quin** (equipo `agencia-quin`).
- **Root Directory = `quinchat`**.
- Alias en vivo: `pedido.klixmant.shop` y `quinchat-agencia-quin.vercel.app/panel`.

## Comando (lo corre Josué, no el agente)

Desde la carpeta **FUNNELISH** — no entrar a `quinchat`:

```powershell
cd "C:\Users\Josue\OneDrive\Documentos\PROYECTO IA CONFIRMA YA\FUNNELISH"
vercel --prod
```

PowerShell encadena con `;`, **no** con `&&`.

## Antes de desplegar

1. `npx tsc --noEmit` sin errores.
2. Si el cambio toca el bot, verificar que se aplicó a **los dos** → [[bots-quino]].
3. Si el cambio crea tablas o columnas, correr el SQL con `grant` incluido → [[supabase]].

El agente **nunca despliega**. Entrega el código y recuerda el comando. Ver [[reglas-duras]].
