# FASE 1 — DIAGNÓSTICO · Panel de Pedidos y Estadísticas (QUINCHAT)

> Inspección del proyecto real. **No se modificó ningún código ni dato.** Las cifras salen de consultas de solo lectura sobre la base en producción (11 oct 2026).

---

## 1. Arquitectura real encontrada

- **Todos los pedidos viven en UNA sola tabla: `clientes_funnelish`** — Funnelish, embudos propios, bot de WhatsApp y promociones, todos juntos.
- **NO existe una columna `canal` ni `origen`.** El canal se *deduce* del prefijo del campo `referencia`:
  - `web-…` → embudos propios (páginas de venta de QuinChat)
  - número puro (ej. `48213`) → Funnelish (plataforma externa)
  - `venta-…` → **bot de ventas de WhatsApp** (lo genera `lib/quinchat/ventas.ts`)
  - `wa-…` → ruta `api/ventas/registrar` (otra vía WhatsApp)
  - `promo-…` → ventas de Promociones / links de vendedores
- La **atribución publicitaria** se guarda por pedido en `utm_source`, `utm_campaign`, `referrer`.
- Pantallas que leen estos datos (cada una con SUS propias consultas):
  - `components/panel/PedidosPanel.tsx` → `GET /api/pedidos/lista`
  - `components/panel/SeguimientoPanel.tsx` (META ADS) → `GET /api/seguimiento/campanas`
  - `EstadisticasPanel.tsx`, `VentasPanel.tsx`, `VentasPorCampana.tsx`

---

## 2. Clasificación de canales — estado REAL (conteo en la base)

| Prefijo `referencia` | Canal real | Pedidos | Confirmados | Desde |
|---|---|---:|---:|---|
| `web-` | Embudos propios QuinChat | **663** | 520 | 21-jul |
| número | Funnelish | **629** | 449 | 18-jul |
| `venta-` | Bot ventas WhatsApp | **108** | 108 | 22-jul |
| `promo-` | Promociones / vendedores | **7** | 0 | 21-sep |
| `wa-` | WhatsApp (ventas/registrar) | **4** | 4 | 22-ago |

---

## 3. PROBLEMAS DETECTADOS (lo que hay que corregir)

**🔴 P1 — El filtro "WhatsApp" está mal mapeado (bug de clasificación).**
El panel busca `referencia LIKE 'wa-%'` → solo encuentra **4** pedidos. Pero el bot de ventas de WhatsApp guarda sus pedidos como `venta-%` → **108** ventas reales. **Esas 108 ventas del bot NO aparecen hoy en el filtro WhatsApp.** (Es justo lo que pide auditar la sección 3C de tu brief.)

**🔴 P2 — "Todas" no es realmente todas.**
El valor por defecto `todas` trae solo `web- OR wa-`. Excluye Funnelish (629), `venta-` (108) y `promo-` (7). **Hoy la igualdad de conciliación (Funnelish + Embudos + WhatsApp + Sin identificar = Total) NO se cumple** en la vista "Todas".

**🟠 P3 — Etiqueta "Funnel" ambigua.**
El chip "🚀 Funnel" son los **embudos propios** (`web-`), que quieres renombrar a **"Embudos QuinChat"**. El identificador interno `funnel` se usa en el fetch (`?canal=funnel`) y en textos; se puede cambiar la **etiqueta visible** sin tocar el valor interno (como pides en 3B).

**🟠 P4 — El canal "Promociones" (`promo-`) no existe en el panel.** 7 pedidos quedan fuera de toda categoría.

**🟠 P5 — No hay categoría "Origen sin identificar".** Cualquier referencia atípica no cae en ningún lado.

**🟡 P6 — Cada pantalla reclasifica por su cuenta.** `pedidos/lista`, `seguimiento/campanas` y `Estadisticas` aplican reglas distintas → riesgo de que los números no cuadren entre secciones. Falta una **fuente única de clasificación**.

---

## 4. Atribución publicitaria (TikTok / Meta) — estado REAL

**Buena noticia: SÍ existe atribución real por UTM; no está todo asignado a ciegas.** (Desde 1-sep)

| Canal | TikTok | Meta | Indeterminado | Sin dato |
|---|---:|---:|---:|---:|
| Embudos QuinChat | 125 | 44 | 2 | — |
| Funnelish | 40 | 169 | 32 | — |
| WhatsApp (bot) | — | — | — | 9 |
| Promociones | — | — | — | 7 |

Observaciones:
- **Funnelish es mayormente Meta (169)** y **Embudos QuinChat mayormente TikTok (125)** — lo **contrario** del supuesto "Funnelish = TikTok". Confirmado que NO se debe asumir por canal.
- La lógica actual deduce la fuente del `utm_source` (regex tiktok/meta) y asume **Meta** cuando `utm_campaign` es numérico. Razonable, pero conviene validar que ningún id numérico de TikTok caiga por error en Meta.
- **WhatsApp bot y Promociones no traen UTM en el pedido** → hoy = "Sin identificar". Para WhatsApp se podría cruzar a futuro con `conversations.anuncio_id` (Click-to-WhatsApp), que sí existe.

---

## 5. Cálculos actuales (cómo se cuentan hoy)

- **Pedidos recibidos** = nº de filas del subconjunto filtrado (hasta 400, se calcula en servidor).
- **Confirmados** = `confirmado = true`.
- **Cancelados** = `estado = 'cancelado'`.
- **Valor vendido** = suma de `valor` **solo de confirmados** (es valor de pedidos confirmados, no dinero recaudado — coherente con tu nota).
- **Por confirmar / pendientes**: hoy es implícito (total − confirmados − cancelados). El campo `estado` tiene varios valores (`wa_enviado`, `pendiente`, etc.) que habría que mapear explícitamente.
- La gráfica "Confirmadas por día" usa confirmados ÷ total del día; con cancelados de por medio el % puede confundir (lo señalas en la sección 7).

---

## 6. Riesgos técnicos

- No hay columna `canal`/`fuente` materializada → cada pantalla reclasifica sola (origen de inconsistencias).
- Corregir el mapeo de WhatsApp (incluir `venta-`) **cambiará los totales que se ven** por canal (no los datos): hay que avisarlo, no es pérdida de información.
- `pedidos/lista` trae hasta 400 filas; para rangos largos (30+ días, "este mes") podría quedarse corto o pesar — a revisar al rediseñar.
- Hay que respetar zona horaria **America/Bogotá** en los rangos de fecha (hoy se usa UTC con `Date.now()`), para que "Hoy" no se corra de día.

---

## 7. PLAN DE IMPLEMENTACIÓN (Fases 2–4) — incremental y reversible

**FASE 2 — Capa de clasificación + propuesta visual (sin tocar recepción de pedidos):**
1. Crear **una sola función central** de clasificación de canal (p. ej. `lib/clasificacion.ts`) que mapee `referencia → canal`: `web-`→Embudos QuinChat · `venta-`/`wa-`→WhatsApp (bot) · numérico→Funnelish · `promo-`→Promociones · resto→Sin identificar. Que **todas** las pantallas la usen.
2. Una función igual para **fuente publicitaria** (TikTok / Meta / Orgánico / Directo / Otros / Sin identificar).
3. Corregir el filtro **WhatsApp** (incluir `venta-`) y **"Todas"** (incluir todos los canales) → la conciliación cuadrará.
4. Renombrar la **etiqueta** "Funnel" → "Embudos QuinChat" sin tocar el valor interno `funnel`.
5. Rediseño de la interfaz del mockup (tarjetas con tendencia, calendario con comparación al período anterior, gráficas apiladas, filtros combinados + "Limpiar filtros") reutilizando Chart.js y los estilos existentes, en una **rama Preview**.

**FASE 3 — Implementación segura (tras tu aprobación):** cambios incrementales, conservando rutas y contratos, con pruebas.

**FASE 4 — Validación:** archivos modificados, resultados de pruebas, conciliación de pedidos (la igualdad del total), capturas antes/después e instrucciones de reversión.

**Instrumentación futura (propuesta aparte, reversible):** guardar `canal` y `fuente` como **columnas** al crear el pedido (en los webhooks y el bot), para no depender de reclasificar por prefijo; y cruzar `anuncio_id` de la conversación para atribuir las ventas WhatsApp. No se toca el flujo de recepción hasta que lo apruebes.

---

## 8. Necesito que me confirmes antes de la Fase 2

1. **¿`wa-` y `venta-` cuentan ambos como "Ventas WhatsApp (bot)"?** (Lo recomiendo: los dos nacen en WhatsApp.) ¿O `wa-` significa otra cosa para ti?
2. **¿"Promociones" (`promo-`) es un canal propio nuevo** en el panel, o lo integro dentro de otro?
3. **¿Hago el rediseño visual completo del mockup** (con calendario mensual, comparación de períodos, etc.) de una, o prefieres un paso intermedio primero (solo corregir la clasificación y las etiquetas)?

> Con tus respuestas a estos 3 puntos arranco la **Fase 2** (propuesta visual en rama Preview, sin tocar producción).
