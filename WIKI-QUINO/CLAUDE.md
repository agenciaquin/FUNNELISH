# Esquema de la WIKI QUINO

Este archivo le dice al agente **QUINO WIKI** cómo está organizada esta wiki y cómo mantenerla.
No es documentación del producto: es el manual del mantenedor.

> Ojo: este `CLAUDE.md` es **local de la wiki** y SÍ se puede editar (el esquema evoluciona).
> El `CLAUDE.md` de la raíz del repo, `AGENTS.md`, `MEMORY.md` y `/memory/*` son **solo lectura**.

## 1. Qué es esta wiki

Base de conocimiento viva de la plataforma **ConfirmaYa / QuinChat** (Agencia Quin — KLIXMANT).
La escribe el agente, la lee Josué en Obsidian. El código es la fuente de verdad; la wiki es la
síntesis navegable de cómo funciona, por qué se decidió así, y qué se ha resuelto antes.

**Ámbito: solo QuinChat / ConfirmaYa personal. NUNCA `quin-comercial`.**

## 2. Estructura

```
WIKI-QUINO/
  CLAUDE.md        <- este esquema
  index.md         <- catálogo de todas las páginas (se actualiza en cada cambio)
  log.md           <- bitácora cronológica, append-only
  overview.md      <- puerta de entrada: qué es la plataforma
  arquitectura/    <- stack, hosting, base de datos, almacenamiento, mensajería
  modulos/         <- una página por módulo o pieza del sistema
  reglas/          <- reglas de negocio y reglas duras
  decisiones/      <- una página por decisión tomada (tipo ADR), con el porqué
  consultas/       <- respuestas archivadas a preguntas de Josué
  fuentes/         <- resumen de cada documento crudo ingerido
  _plantillas/     <- plantillas de página (no son contenido)
```

## 3. Convenciones de página

- Nombre de archivo en kebab-case, sin acentos. Ej: `bot-chat-whatsapp.md`.
- Toda página empieza con frontmatter YAML:

```yaml
---
tipo: modulo | arquitectura | regla | decision | consulta | fuente | indice
titulo: Título legible
tags: [quinchat, bot, pedidos]
actualizado: AAAA-MM-DD
estado: vigente | por-verificar | obsoleto
archivos: ["quinchat/lib/quinchat/ventas.ts"]
---
```

- Enlaces internos SIEMPRE en formato Obsidian: `[[nombre-de-archivo]]` o `[[nombre|texto visible]]`.
  Enlazar generoso: un `[[link]]` a una página que aún no existe es válido, marca lo que falta escribir.
- Rutas de código siempre relativas a la raíz del repo y entre backticks: `quinchat/lib/quinchat/ventas.ts`.
- Cada afirmación técnica delicada lleva marca de verificación:
  `<!-- verificado: 2026-09-04 -->` o el estado `por-verificar` en el frontmatter.
- Sin relleno. Frases cortas. Si algo no se sabe, se escribe "no verificado" en vez de inventarlo.

## 4. Operaciones

### Ingestar (una fuente nueva)
1. Leer la fuente (documento, hilo, informe, fragmento de código).
2. Escribir/actualizar `fuentes/AAAA-MM-DD-slug.md` con el resumen y los puntos clave.
3. Propagar: actualizar las páginas de `modulos/`, `arquitectura/` y `reglas/` afectadas.
4. Si la fuente contradice algo existente, NO borrar: dejar la nota
   `> **Contradicción:** la fuente X (fecha) dice A; esta página decía B. Pendiente verificar contra código.`
5. Actualizar [[index]] y anexar entrada en [[log]].

### Consultar (Josué pregunta algo)
1. Leer [[index]] primero, luego las páginas relevantes; verificar contra el código si aplica.
2. Responder en el chat siguiendo el formato de la sección 6 del agente
   (Diagnóstico / Solución propuesta / Código / Verificación).
3. **Si la respuesta tiene valor duradero, archivarla**: `consultas/AAAA-MM-DD-slug.md`,
   enlazarla desde las páginas que toca, actualizar [[index]] y [[log]].
   Las respuestas triviales no se archivan.

### Registrar una decisión
Cuando se elige un enfoque (o se descarta uno), crear `decisiones/slug.md` con:
contexto, opciones evaluadas, decisión, consecuencias, fecha. Enlazar desde los módulos afectados.

### Lint (revisión de salud)
Cuando Josué lo pida, o cada ~10 entradas del log:
- contradicciones entre páginas
- afirmaciones viejas que el código ya no respalda (verificar con grep/lectura)
- páginas huérfanas (sin enlaces entrantes)
- conceptos mencionados muchas veces sin página propia
- entradas de [[index]] rotas o faltantes
Reportar hallazgos y proponer arreglos. Los arreglos se aplican dentro de la wiki.

## 5. Formato del log

`log.md` es append-only, lo más nuevo abajo. Cada entrada empieza igual para poder grepear:

```
## [2026-09-04] ingesta | Prompt Agente WIKI QUINO
```

Prefijos válidos: `ingesta`, `consulta`, `decision`, `lint`, `correccion`.
Cuerpo: 1-4 viñetas con qué cambió y qué páginas se tocaron.

Comando útil: `grep "^## \[" WIKI-QUINO/log.md | tail -5`

## 6. Límites duros del agente

1. Solo escribe dentro de `WIKI-QUINO/`. Nunca modifica código de la aplicación.
2. Nunca toca `CLAUDE.md` (raíz), `AGENTS.md`, `MEMORY.md` ni `/memory/*`.
3. Nunca ejecuta despliegues ni comandos que cambien estado (git push, vercel, SQL de escritura).
4. Nunca documenta ni propone cambios sobre `quin-comercial`.
5. Al citar archivo/función/tabla, aclara que debe verificarse contra el código actual.
