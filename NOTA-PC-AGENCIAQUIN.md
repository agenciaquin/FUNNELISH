# Nota para Claude en el PC de agenciaquin

**Escrita:** 30-09-2026, desde el PC de Tatiss30 / creativoquin.
**Para:** la sesión de Claude que se abra en el equipo de agenciaquin, donde vive el commit `bff4e19` (v174).
**Léela entera antes de tocar nada.** Contexto completo: `AUDITORIA-CONSUMO-2026-09-30.md` (rama `auditoria-consumo`).

---

## Por qué existe esta nota

Producción y GitHub se separaron:

| | Tiene v174 | Tiene compresor de imágenes (`sharp`) |
| --- | --- | --- |
| `pedido.klixmant.shop` (desplegado a mano con `vercel --prod` desde **este** PC, commit `bff4e19`) | ✅ | ❌ |
| `master` en GitHub (`5a2f455`) | ❌ | ✅ |

- `bff4e19` **no existe en GitHub**. Solo está aquí.
- Desde el 31-08, **316 imágenes (168 MB) entraron sin comprimir**; 109 pesan más de 300 kB (134 MB).
- `quinchat-agencia-quin` publica solo al hacer push a `master`. Un push de `master` tal como está **borraría v174 de producción**.

---

## Fase 0 · Comprobar antes de nada (solo lectura)

```bash
git status                                 # ¿hay cambios sin commitear? NO descartarlos
git log --oneline -5                       # ¿aparece bff4e19?
git branch --contains bff4e19
git fetch origin
git log --oneline origin/master -3         # debe salir 5a2f455
git log --oneline bff4e19 ^origin/master   # lo que tiene v174 y master no
git log --oneline origin/master ^bff4e19   # lo que tiene master y v174 no (compresor, libvips, collages)
```

Si hay cambios sin commitear, **preguntar a agenciaquin** qué son antes de seguir.

## Fase 1 · Subir v174 a GitHub, sin tocar `master`

```bash
git checkout -b v174-local bff4e19     # o la rama donde esté
git push origin v174-local
```

Una rama que no es `master` solo genera una vista previa en Vercel. **No publica producción.**

## Fase 2 · Unir v174 con `master`

```bash
git checkout -b union-v174-compresor v174-local
git merge origin/master
```

Conflictos esperables:
- `quinchat/lib/imagen-comprimir.ts`: quedarse con la versión de `master` (1920/q85, PNG sin alfa → JPG).
- `quinchat/package.json`: **debe quedar `sharp`** en `dependencies`.
- `quinchat/next.config.ts`: **debe quedar** en `outputFileTracingIncludes` tanto `sharp` como `./node_modules/@img/**/*` (libvips). Sin libvips reventó el 31-08 con `ERR_DLOPEN_FAILED` (ver `CLAUDE.md`, observación 1).
- En todo lo demás (bot, embudos, webhooks), manda v174.

Comprobar antes de publicar:

```bash
cd quinchat && npm install && npm run build
npx tsx pruebas/optimizar-imagen.ts        # 18 pruebas del compresor
grep -n '"sharp"' package.json
grep -n "@img" next.config.ts
```

## Fase 3 · Publicar (necesita el visto bueno de agenciaquin)

- Abrir un PR `union-v174-compresor` → `master` y fusionarlo. Eso publica `pedido.klixmant.shop`.
- **A partir de aquí, nunca más `vercel --prod` desde un equipo.** Solo se publica desde GitHub.
- Marcha atrás si algo falla: Vercel → Deployments → promover `dpl_Ef4y12bUvR9u9pJB3LVNtDkFRHxU` (el v174 actual).

## Fase 4 · Verificar en producción

1. Mirar primero los **registros de ejecución** de Vercel y buscar `DLOPEN` o `ENOENT`.
2. Subir una foto real desde el panel, en Embudos. Debe quedar así:

```sql
-- proyecto Supabase quinchat (bjbjqmbuzpyjvcugbusx)
select name, metadata->>'cacheControl', metadata->>'size', metadata->>'mimetype'
from storage.objects where bucket_id='chat-media' order by created_at desc limit 5;
-- esperado: max-age=31536000 y menos de ~400 kB
```

## Fase 5 · Comprimir lo acumulado

Con `arreglos-supabase/media-api`, pasar las imágenes subidas desde el 31-08 que superan 300 kB (109 archivos, ~134 MB).
Los originales van a `_originales/`. Hacerlo primero en seco y validar con `validar-landings.ts`.

Después, **y solo con el visto bueno**, borrar `_originales/` (1.010 MB del backfill de agosto más lo nuevo).

---

## Plan para pulir la auditoría

La auditoría (`AUDITORIA-CONSUMO-2026-09-30.md`) tiene huecos que desde el otro PC no se pudieron cerrar.
Desde aquí, o con acceso a los paneles, hay que cerrarlos:

### A · Datos que faltan (necesitan acceso a cuentas)

| Qué | Dónde | Para qué |
| --- | --- | --- |
| Frecuencia real de cada cron | cron-job.org (cuenta de agenciaquin) | Saber cuántas plantillas pagas y llamadas de IA salen solas al día. Quitar `promo-cierre` y los duplicados entre las dos apps |
| Gasto real de IA | console.anthropic.com → Usage | Contrastar con la estimación (0,05–0,40 USD/conversación). Poner **límite mensual** |
| Plan y egress de Supabase | Supabase → Settings → Usage | Ver si el egress está cerca del límite. Activar **Spend Cap** |
| Gasto de WhatsApp | Meta Business → WhatsApp → Insights | Cuántas conversaciones de marketing o utilidad se pagan al mes |
| Vercel del mes completo | Vercel → Usage | Solo se midieron 4 días (sistema casi dormido). Activar **Spend Management** |

### B · Revisar el código de v174

La auditoría se hizo sobre `master`, **no sobre v174**. Una vez unidos, repetir la revisión sobre la rama unida:
- ¿Sigue abierta la rama `/api/` en `middleware.ts`?
- ¿v174 añadió rutas nuevas que envíen WhatsApp o llamen a la IA?
- ¿Cambió el webhook de WhatsApp (espera de 12 s, `upsert` sin deduplicar)?
- ¿Cambiaron los intervalos del panel (`WhatsAppPanel` 6 s, `MonederoFlotante` 12 s)?

### C · Medir en vez de estimar

- Registrar `usage` de Anthropic (`input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`,
  `output_tokens`) en una tabla. Hoy `lib/quinchat/claude.ts` lo descarta.
- Una semana con el bot activo → coste real por conversación y por día.

### D · Arreglos bloqueantes antes de reactivar el bot

En este orden, cada uno en su rama y con su PR:
1. Middleware: cerrar `/api/` en la tienda y poner `/api/pedidos` como coincidencia exacta (en las dos apps).
2. `CRON_SECRET` en `quinchat-comercial` (hoy **no existe**) y crons que fallen cerrados.
3. Firma de Meta (`WHATSAPP_APP_SECRET`) y token de Funnelish.
4. Interruptor `BOT_IA` y tope de respuestas por conversación y por día.
5. Deduplicar por id de mensaje en el webhook de quinchat (copiar lo de quin-comercial).

Luego, en la primera semana: intervalos del panel, compresión en quin-comercial e ISR en landings.
Detalle, archivos y líneas en la auditoría.

---

## Reglas

- No hacer push a `master` sin que agenciaquin lo apruebe: publica producción.
- No hacer `vercel --prod` desde local.
- No borrar nada del bucket sin respaldo y sin el visto bueno.
- La clave `service_role` se dio por comprometida en agosto: **rotarla** sigue pendiente.

---

## Actualización · los arreglos bloqueantes ya están escritos

Rama **`bloqueantes-consumo`** (desde `master`, sin publicar). Los 5 arreglos de la sección D, probados con
`tsc`, `next build` y el middleware en local. Detalle y lista de configuración en `BLOQUEANTES-CONSUMO.md`.

Orden al volver aquí:
1. Fases 0–2 de arriba (subir v174 y unirlo con `master` en `union-v174-compresor`).
2. `git rebase union-v174-compresor bloqueantes-consumo`. Los conflictos más probables son
   `quinchat/app/api/whatsapp/webhook/route.ts` y `quinchat/lib/quinchat/ventas.ts`, si v174 los cambió.
   Comprobar después que siguen `leerAvisoDeMeta`, `botPuedeResponder` y el INSERT anti-duplicados.
3. **Repetir la revisión de la sección B sobre v174**: puede haber rutas nuevas que el middleware ahora cierra
   y que la tienda necesite (añadirlas a `API_PUBLICA_EXACTA` en `middleware.ts`).
4. Configurar `CRON_SECRET` (falta en quinchat-comercial), `WHATSAPP_APP_SECRET`, `FUNNELISH_WEBHOOK_TOKEN`
   y `BOT_IA=off` para la primera publicación. Ver `BLOQUEANTES-CONSUMO.md`.
