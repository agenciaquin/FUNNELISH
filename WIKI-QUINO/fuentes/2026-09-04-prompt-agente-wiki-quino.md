---
tipo: fuente
titulo: Prompt — Agente WIKI QUINO
tags: [fuente, agente, wiki]
actualizado: 2026-09-04
estado: vigente
archivos: ["PROMPT - Agente WIKI QUINO.md"]
---

# Fuente: Prompt del Agente WIKI QUINO

**Origen:** `PROMPT - Agente WIKI QUINO.md` (raíz del repo), escrito por Josué.
**Fecha de ingesta:** 2026-09-04. Primera fuente de esta wiki.

## Qué define

El rol del agente: **wiki viva + asesor técnico** de ConfirmaYa / QuinChat. Explica cómo funciona
todo y propone soluciones con código listo para pegar, pero **no ejecuta cambios ni despliega**.

## Contenido que se propagó a la wiki

| Sección de la fuente | Páginas creadas |
|---|---|
| Qué es la plataforma, módulos del panel | [[overview]], [[panel]] |
| Stack y arquitectura | [[stack]], [[despliegue]], [[supabase]], [[almacenamiento-r2]], [[whatsapp-cloud-api]] |
| Los dos bots y sus tokens | [[bots-quino]], [[bot-chat-whatsapp]], [[bot-chat-funnel]], [[tokens-del-bot]] |
| Embudos, pedidos, remarketing, Effi, catálogos, imágenes | [[embudos]], [[pedidos]], [[remarketing]], [[effi]], [[catalogos]], [[imagenes]] |
| Reglas de confirmación | [[confirmacion-de-pedidos]] |
| Reglas duras | [[reglas-duras]] |
| Identidad de marca | [[identidad-de-marca]] |
| Notas de imágenes (WebP, `/_next/image`) | [[no-webp-en-headers-de-whatsapp]], [[optimizador-de-imagenes-desactivado]] |

## Verificaciones hechas contra el código (2026-09-04)

- `atenderVenta(...)` existe en `quinchat/lib/quinchat/ventas.ts:1011`. ✅
- `phoneIdActual()` existe en `quinchat/lib/whatsapp-contexto.ts:33`. ✅
- Los cuatro tokens aparecen en los dos bots (22 usos en `ventas.ts`, 4 en el webhook). ✅
- Las tablas nombradas existen en las llamadas del código; se añadieron las que faltaban en el
  prompt (`conversations`, `messages`, `carritos_abandonados`, `funnel_eventos`, `campanas_gasto`,
  `vendedor_*`, `objeciones_analisis`, `push_subscriptions`). ✅

## Hallazgo nuevo (no estaba en la fuente)

Los prompts de los dos bots **han divergido**: el JSON de `[[ACTUALIZAR]]` no lleva los mismos
campos en `ventas.ts` que en el webhook. Registrado en [[bots-quino]].

Además, `referencia` tiene un cuarto prefijo no documentado en la fuente: `venta-*` (registro
manual). Registrado en [[pedidos]].
