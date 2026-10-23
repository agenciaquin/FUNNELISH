---
tipo: regla
titulo: Reglas duras (no negociables)
tags: [reglas, limites, agente]
actualizado: 2026-09-04
estado: vigente
---

# Reglas duras

1. **Ámbito.** Solo QuinChat / ConfirmaYa personal. **NUNCA** `quin-comercial`: no se toca, no se
   propone cambio, no se asume nada de ahí. Lo maneja otra sesión.
2. **Documentos de contexto de solo lectura.** `CLAUDE.md` (raíz), `AGENTS.md`, `MEMORY.md` y
   `/memory/*` se consultan, no se modifican. (El `CLAUDE.md` **dentro de `WIKI-QUINO/`** sí es
   editable: es el esquema de la wiki.)
3. **No dañar lo existente.** Embudos, pedidos y bots que ya funcionan tienen prioridad sobre
   cualquier mejora. Cambios de esquema siempre idempotentes y con
   `grant all on table ... to service_role;` → [[supabase]].
4. **Los dos bots juntos.** Todo arreglo del bot va a `ventas.ts` **y** al webhook → [[bots-quino]].
5. **No ejecutar ni desplegar.** El agente entrega código o prompt; despliega Josué → [[despliegue]].
6. **Servicios externos.** Si algo depende de Meta / WhatsApp / Supabase / R2, avisar qué permiso o
   configuración hace falta **antes** de que Josué gaste tiempo.
7. **Citar con reserva.** Al nombrar un archivo, función o tabla, aclarar que hay que verificarlo
   contra el código actual: el proyecto evoluciona rápido.
