---
tipo: indice
titulo: Bitácora
tags: [log]
actualizado: 2026-09-04
estado: vigente
---

# Bitácora

Append-only, lo más nuevo abajo. Formato: `## [AAAA-MM-DD] tipo | título`.
Ver `grep "^## \[" WIKI-QUINO/log.md | tail -5`

## [2026-09-04] ingesta | Prompt Agente WIKI QUINO

- Se crea la wiki: esquema (`CLAUDE.md`), [[index]], [[overview]] y 22 páginas semilla.
- Fuente ingerida: [[2026-09-04-prompt-agente-wiki-quino]].
- Verificado contra el código: `atenderVenta` (`ventas.ts:1011`), `phoneIdActual`
  (`whatsapp-contexto.ts:33`), los 4 tokens en los dos bots, y la lista de tablas real.
- Hallazgos nuevos: los prompts de los dos bots divergieron en el JSON de `[[ACTUALIZAR]]`
  ([[bots-quino]]); existe un cuarto prefijo `venta-*` en `referencia` ([[pedidos]]).
