# Flujo de trabajo con 3 agentes — quin-comercial

Todo cambio de este proyecto pasa por tres agentes (definidos en `.claude/agents/`).
**Antes de ENTREGAR cualquier cambio, los tres deben dar su visto de "APROBADO".**

## Los agentes

1. **planeador** — diseña el plan (archivos, riesgos, criterios de aceptación). Da `APROBADO PARA IMPLEMENTAR`.
2. **implementador** — escribe el código siguiendo el plan y corre `tsc`. Da `APROBADO PARA AUDITAR`.
3. **auditor** — revisa bugs, fugas multi-tenant, retrocompatibilidad, foco de inputs y build. Da `APROBADO PARA ENTREGAR` (o `RECHAZADO`).

## Orden

```
PLANEADOR (aprueba el plan)
   → IMPLEMENTADOR (escribe + tsc, aprueba)
      → AUDITOR (verifica, aprueba)
         → ENTREGA (solo con los 3 "APROBADO")
```

Si algún agente RECHAZA o pide CAMBIOS, se corrige y se vuelve a pasar por el que corresponda. No se entrega hasta tener los tres "APROBADO".

## Reglas fijas que los tres respetan

- Solo `quin-comercial` (nunca `quinchat`).
- Multi-tenant: todo filtra por `tenant_id` / `tenantActual()`.
- Cada entrega sube `VERSION` + línea en `VERSION_CAMBIOS[]` (`lib/version.ts`).
- Retrocompatible: props/columnas nuevas opcionales con default; degradación con gracia si falta la migración SQL.
- Foco de inputs: editores con texto se renderizan `{Comp()}` o como componente top-level, nunca `<Comp/>` anidado.
- `npx tsc --noEmit` en verde antes de entregar.
