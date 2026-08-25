-- =====================================================================
-- EMBUDO "FORMULA 1 PRO" — versión de CIERRE ALTO
-- Copia TODO lo real del embudo formula-1-copia (fotos, video, píxeles,
-- WhatsApp, color, características…) y solo cambia:
--   · la dirección  -> formula-1-pro
--   · las variantes -> 4 escuderías (Red Bull, McLaren, Mercedes, Ferrari)
--   · el diseño     -> layout de cierre alto con Checkout PRO embebido
--
-- IMPORTANTE: primero despliega el código (vercel --prod). Luego corre esto
-- en Supabase → SQL Editor. Si ya existe 'formula-1-pro', bórralo antes:
--   delete from public.funnels where slug = 'formula-1-pro';
-- =====================================================================

insert into public.funnels (
  slug, activo, nombre, titulo, producto, precio, precio_antes,
  imagenes, imagen_banner, imagen_clientes, imagen_detalle,
  caracteristicas, frases, tallas, variantes,
  horas_contador, personas_comprando, whatsapp,
  pixel_meta, pixel_tiktok, audio_url, video_url, color, miniatura_url, anuncios, layout
)
select
  'formula-1-pro',                       -- nueva dirección
  true,
  'FORMULA 1 PRO',                       -- nombre interno
  titulo, producto, precio, precio_antes,
  imagenes, imagen_banner, imagen_clientes, imagen_detalle,
  caracteristicas, frases, tallas,
  -- 4 escuderías, cada una con su foto (tomadas de la galería del embudo).
  -- Si alguna foto no coincide con la escudería, se corrige en el panel.
  jsonb_build_array(
    jsonb_build_object('id','redbull', 'nombre','Red Bull', 'precio',precio, 'precioAntes',precio_antes, 'imagen', (imagenes::jsonb)->>0),
    jsonb_build_object('id','mclaren', 'nombre','McLaren',  'precio',precio, 'precioAntes',precio_antes, 'imagen', (imagenes::jsonb)->>1),
    jsonb_build_object('id','mercedes','nombre','Mercedes', 'precio',precio, 'precioAntes',precio_antes, 'imagen', (imagenes::jsonb)->>2),
    jsonb_build_object('id','ferrari', 'nombre','Ferrari',  'precio',precio, 'precioAntes',precio_antes, 'imagen', (imagenes::jsonb)->>3)
  ),
  horas_contador, personas_comprando, whatsapp,
  pixel_meta, pixel_tiktok, audio_url, video_url, color, miniatura_url, anuncios,
  -- Diseño de cierre alto: una sola pantalla, checkout PRO embebido.
  '{"bloques":[
    {"id":"ca_0_titular","tipo":"titular","visible":true},
    {"id":"ca_1_portada","tipo":"portada","visible":true},
    {"id":"ca_2_boton","tipo":"boton","visible":true},
    {"id":"ca_3_precio","tipo":"precio","visible":true},
    {"id":"ca_4_estrellas","tipo":"estrellas","visible":true},
    {"id":"ca_5_caracteristicas","tipo":"caracteristicas","visible":true},
    {"id":"ca_6_ultimas_unidades","tipo":"ultimas_unidades","visible":true},
    {"id":"ca_7_checkout_pro","tipo":"checkout_pro","visible":true}
  ]}'::jsonb
from public.funnels
where slug = 'formula-1-copia';

-- Verifica:
select slug, nombre, jsonb_array_length(variantes) as escuderias
from public.funnels where slug = 'formula-1-pro';
