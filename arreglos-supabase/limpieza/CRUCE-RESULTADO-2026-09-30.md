# Resultado de `cruce-solo-lectura.sql` · 30-09-2026

Ejecutado por Claude mediante la herramienta MCP de Supabase (entra como `postgres`), en solo lectura, sobre el
proyecto `bjbjqmbuzpyjvcugbusx`. Es la condición que el agente de pruebas puso para A2
(`VERIFICACION-PRUEBAS.md`).

| Consulta | Resultado | Esperado |
| --- | --- | --- |
| 2 · `catalogo_categorias` con archivos | **0** filas | 0 |
| 2 · `catalogo_variables` con archivos | **0** filas | 0 |
| 3 · Los 18 vídeos de A2 contra todas las columnas de texto/JSON de todos los esquemas de la app | **0** coincidencias en 3 348 comprobaciones (30 tablas) | 0 |

**Validez:** solo para el día de hoy (observación 6 bis de `CLAUDE.md`). Si A2 se ejecuta otro día, hay que
repetir el cruce.

**Hueco que sigue abierto:** la base de **quin-comercial** (otra cuenta, sin acceso) no se ha cruzado, y su
código enlaza a mano al bucket de quinchat. Mover a `_borrar/` se puede deshacer (`restaurar.ts`, probado contra el
falso). La purga definitiva **no** se hace sin cruzar también esa base, o sin esperar los 14 días de papelera
vigilando errores 404 en los registros.
