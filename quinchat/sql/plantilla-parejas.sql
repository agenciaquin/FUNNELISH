-- Crea la "Plantilla de parejas" en el apartado de Plantillas de Embudo.
-- Trae un producto PAREJA con dos lados fijos (Dama y Caballero), cada uno con
-- sus tallas por género ya puestas (S–XXXL) y los colores VACÍOS (se importan del
-- catálogo al usar la plantilla, eligiendo cuáles van a cada lado).

insert into plantillas_embudo (nombre, categoria, tipo, layout, datos)
values (
  'Plantilla de parejas',
  'Parejas',
  'completa',
  null,
  '{
    "activo": true,
    "nombre": "COMBO PAREJA",
    "titulo": "🔥 COMBO PAREJA 🔥 2 BUZOS A JUEGO",
    "producto": "COMBO PAREJA",
    "precio": 219900,
    "precio_antes": 260000,
    "imagenes": [],
    "imagen_banner": null,
    "imagen_clientes": null,
    "imagen_detalle": null,
    "caracteristicas": ["Buzo de Dama + Buzo de Caballero", "Eliges color y talla de cada uno", "Pago contra entrega · Envío gratis a toda Colombia"],
    "frases": ["🔥 COMBO PAREJA 🔥", "💑 2 BUZOS A JUEGO"],
    "tallas": [],
    "variantes": [
      {
        "id": "pareja",
        "nombre": "PAREJA",
        "precio": 219900,
        "precioAntes": 260000,
        "esPack": true,
        "selectores": [
          { "grupo": "DAMA", "etiqueta": "COLOR", "opciones": [] },
          { "grupo": "DAMA", "etiqueta": "TALLA", "opciones": [{"valor":"S DAMA"},{"valor":"M DAMA"},{"valor":"L DAMA"},{"valor":"XL DAMA"},{"valor":"XXL DAMA"},{"valor":"XXXL DAMA"}] },
          { "grupo": "CABALLERO", "etiqueta": "COLOR", "opciones": [] },
          { "grupo": "CABALLERO", "etiqueta": "TALLA", "opciones": [{"valor":"S HOMBRE"},{"valor":"M HOMBRE"},{"valor":"L HOMBRE"},{"valor":"XL HOMBRE"},{"valor":"XXL HOMBRE"},{"valor":"XXXL HOMBRE"}] }
        ]
      }
    ],
    "horas_contador": 10,
    "personas_comprando": 27,
    "whatsapp": "",
    "color": null,
    "layout": null
  }'::jsonb
);
