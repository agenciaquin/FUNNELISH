---
tipo: arquitectura
titulo: Supabase — base de datos y esquema
tags: [supabase, postgres, sql]
actualizado: 2026-09-04
estado: vigente
archivos: ["quinchat/lib/supabase.ts", "quinchat/sql/"]
---

# Supabase (Postgres)

- Proyecto id: `bjbjqmbuzpyjvcugbusx`.
- En el servidor se usa la **service_role key**.

## Regla de oro del esquema

Toda tabla nueva necesita el grant, o el servidor responde **permission denied**:

```sql
grant all on table <tabla> to service_role;
```

Y toda migración debe ser **idempotente**:

```sql
create table if not exists ...;
alter table ... add column if not exists ...;
```

Las migraciones sueltas viven en `quinchat/sql/`.

## Tablas en uso

<!-- verificado: 2026-09-04 — extraídas de las llamadas .from(...) en quinchat/lib y quinchat/app -->

| Tabla | Para qué | Página |
|---|---|---|
| `clientes_funnelish` | Los pedidos. Tabla central. | [[pedidos]] |
| `conversations`, `messages` | Hilos y mensajes del chat | [[bots-quino]] |
| `funnels` | Embudos (`layout` jsonb) | [[embudos]] |
| `catalogo_colores`, `catalogos_bot` | Fotos por color/producto | [[catalogos]] |
| `faq_bot` | Preguntas frecuentes del bot | [[panel]] |
| `memoria_bot` | Memoria del bot | [[panel]] |
| `carritos_abandonados` | Carritos sin cerrar | [[remarketing]] |
| `remarketing_envios` | Rastreo de envíos (enviado/entregado/leído/respondió) | [[remarketing]] |
| `effi_guias` | Estado real de entrega + flete | [[effi]] |
| `funnel_eventos` | Analítica de embudos | [[embudos]] |
| `campanas_gasto` | Gasto por campaña | [[panel]] |
| `vendedor_preguntas`, `vendedor_reportes` | Módulo Vendedores | [[panel]] |
| `plantillas`, `plantillas_embudo` | Plantillas de mensaje y de embudo | [[panel]] |
| `disparadores`, `etiquetas`, `contactos` | Herramientas del panel | [[panel]] |
| `objeciones_analisis` | Objeciones detectadas | [[panel]] |
| `configuracion`, `ajustes` | Configuración global | [[panel]] |
| `push_subscriptions` | Notificaciones push del panel | [[panel]] |

> El listado sale de las llamadas `.from(...)` del código; verificar contra el esquema real
> antes de asumir columnas.
