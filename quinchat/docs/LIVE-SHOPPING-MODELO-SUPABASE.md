# QUIN LIVE SHOPPING — Modelo de datos propuesto (Fase 2)

> **PROPUESTA. No se ejecutó nada.** No hay tablas, migraciones ni buckets creados.
> Los videos NO van a Supabase Storage: solo se guarda la URL (Cloudflare R2).

## Diagrama

```
live_productos 1─* live_producto_colores
      │
      └─* live_lives_productos *─1 live_lives 1─* live_timeline_eventos
                                      │
                                      ├─* live_pedidos
                                      └─* live_eventos
```

## SQL propuesto (borrador)

```sql
create table live_lives (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  titulo        text not null,
  tienda_nombre text not null default 'KLIXMANT',
  tienda_logo   text,
  video_url     text not null,          -- Cloudflare R2 (mp4 o .m3u8)
  poster_url    text,
  duracion_seg  int,
  whatsapp      text not null,          -- 57XXXXXXXXXX
  modo          text not null default 'desde_inicio' check (modo in ('desde_inicio','sincronizado')),
  ciclo_inicio  timestamptz,            -- solo modo 'sincronizado': base para calcular la posición por hora
  estado        text not null default 'borrador' check (estado in ('borrador','activo','archivado')),
  creado_en     timestamptz not null default now()
);

create table live_productos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text,
  precio        int not null,           -- COP
  precio_antes  int,
  promo_etiqueta text,                  -- ej. 'Pack x2'
  promo_unidades int,
  promo_precio   int,
  tallas        text[] not null default '{S,M,L,XL}',
  activo        boolean not null default true
);

create table live_producto_colores (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references live_productos(id) on delete cascade,
  nombre      text not null,
  hex         text,
  foto_url    text not null,
  orden       int not null default 0
);

create table live_lives_productos (
  live_id     uuid references live_lives(id) on delete cascade,
  producto_id uuid references live_productos(id),
  orden       int not null default 0,
  primary key (live_id, producto_id)
);

-- Línea de tiempo: reemplaza al JSON de la maqueta (se puede seguir sirviendo como JSON generado).
create table live_timeline_eventos (
  id          uuid primary key default gen_random_uuid(),
  live_id     uuid not null references live_lives(id) on delete cascade,
  inicio_seg  numeric not null,
  fin_seg     numeric not null check (fin_seg > inicio_seg),
  tipo        text not null check (tipo in ('producto','pregunta_frecuente','comentario')),
  producto_id uuid references live_productos(id),   -- tipo = producto
  pregunta    text, respuesta text,                  -- tipo = pregunta_frecuente
  autor       text, texto text,                      -- tipo = comentario
  es_demo     boolean not null default false         -- los comentarios de ejemplo siempre true
);
create index on live_timeline_eventos (live_id, inicio_seg);

create table live_pedidos (
  id              uuid primary key default gen_random_uuid(),
  live_id         uuid references live_lives(id),
  producto_id     uuid references live_productos(id),
  talla           text not null,
  color           text not null,
  modalidad       text not null check (modalidad in ('unidad','pack')),
  cantidad        int not null,
  total           int not null,                      -- COP, recalculado en servidor (nunca confiar en el cliente)
  nombre          text not null,
  celular         text not null,
  departamento    text not null,
  ciudad          text not null,
  direccion       text not null,
  barrio          text not null,
  notas           text,
  autoriza_datos  boolean not null check (autoriza_datos),   -- Ley 1581
  autoriza_en     timestamptz not null default now(),
  autoriza_ip     inet,
  estado          text not null default 'nuevo',
  quino_estado    text not null default 'pendiente',        -- envío a QUINO por webhook
  quino_intentos  int not null default 0,
  event_id        text unique,                               -- deduplicación Pixel + Conversions API
  utm_source text, utm_campaign text, utm_content text,
  fbp text, fbc text, ttclid text,
  creado_en       timestamptz not null default now()
);

create table live_eventos (
  id          bigint generated always as identity primary key,
  live_id     uuid references live_lives(id),
  sesion_id   text not null,                 -- id anónimo por visita
  evento      text not null check (evento in ('live_view','video_play','sound_on','product_shown','product_click','buy_here_open','order_submit','buy_whatsapp_click')),
  producto_id uuid,
  segundo     numeric,
  datos       jsonb,
  utm_source text, utm_campaign text, utm_content text,
  creado_en   timestamptz not null default now()
);
create index on live_eventos (live_id, evento, creado_en);
```

## Notas para implementarlo

- **Permisos:** en este Supabase cada tabla nueva necesita `GRANT ... TO service_role` explícito, o el servidor da "permission denied" (ver `grants-tablas-nuevas`).
- **Seguridad:** la ruta pública `/live/[slug]` no debe hablar con Supabase desde el navegador. Los pedidos y eventos entran por rutas `/api/live/...` del servidor (service role) con validación, límite de peticiones y total recalculado en servidor. RLS activado y sin políticas públicas.
- **Pedido → QUINO:** al insertar en `live_pedidos`, un envío por webhook a QUINO con reintentos (`quino_estado`, `quino_intentos`).
- **Medición:** `track()` pasa a enviar el mismo `event_id` al Pixel de Meta (navegador), a la Conversions API (servidor) y al Pixel de TikTok, y a `live_eventos`.
- **Modo sincronizado:** usar `ciclo_inicio` + `posicionSincronizada()` (ya existe en `lib/live/config.ts`).
- **Video:** subir a R2 (el proyecto ya tiene `lib/r2.ts`); para HLS, instalar `hls.js` solo dentro de `VideoBackground.tsx`.
