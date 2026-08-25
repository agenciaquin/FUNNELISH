# Prompt — "Productos del checkout" (productos, colores, tallas, packs y variables)

Pega este prompt en el chat de tu otra app para armar el mismo sistema de productos
del checkout (con colores con foto, tallas, packs x2/x3, pareja, "variables polos" y
editar masivo), que alimenta el formulario que ve el cliente.

```
Arma el sistema de "Productos del checkout" del editor de embudos. Cada producto es
una opción que el cliente puede escoger; si no hay productos, se vende uno solo con el
precio general del embudo.

MODELO DE DATOS (en el embudo, campo `variantes` jsonb):
  VarianteFunnel = {
    id: string;
    nombre: string;                 // ej. "ESCUDERIA RED BULL", "PACK X2 RED BULL"
    precio: number;
    precioAntes?: number;           // precio tachado
    imagen?: string;                // miniatura del producto
    tallas?: string[];              // atajo: equivale a un único selector de TALLA
    selectores?: SelectorVariante[];// hasta 6 elecciones (COLOR, TALLA, ESCUDERÍA…)
    esPack?: boolean;
    armarPack?: ArmarPackConfig;    // si existe → constructor "arma tu pack"
    estilo?: string;                // 'polos' → editor y checkout de VARIABLES POLOS
  }
  SelectorVariante = {
    etiqueta: string;               // "COLOR", "TALLA"…
    grupo?: string;                 // "ELIGE BUZO 1" (para packs multi-prenda)
    opciones: (string | { valor: string; imagen?: string })[]; // el COLOR lleva foto
  }

EDITOR (sección "Productos del checkout"):
1. Encabezado con:
   - "+ Agregar producto": agrega una VarianteFunnel simple (con un selector TALLA
     usando las tallas del embudo).
   - "⚡ + Producto variable (color + talla)": agrega un producto con dos selectores
     (COLOR con fotos + TALLA).
2. "✏️ Editar masivo": cambia el precio y las tallas de TODOS los productos del mismo
   tipo de una sola vez. Muestra chips con el conteo por tipo: "Unidad (N)",
   "Pack x2 (N)", "Pack x3 (N)".
3. Por cada producto (tarjeta, reordenable con ▲▼, con Duplicar y Quitar):
   - Nombre, Precio, Precio tachado.
   - "Colores (cada uno con su foto)": lista editable; cada color tiene miniatura
     (subir/elegir), su nombre y una X para borrar. Botón "+ Agregar color".
   - "📥 Traer de Catálogos": importa colores con foto (y tallas por defecto) desde un
     catálogo ya creado; todo queda editable.
   - "Tallas (una sola vez, valen para todos los colores)": textarea (una por línea) +
     enlace "↺ Usar las del embudo".
   - Casilla "🏁 Elegir escudería en el pack".
   - "📦 Opciones de pack (pareja, polos, arma tu pack…)" DESPLEGABLE con:
       * "⚡ Armar pack de 2 / de 3": crea selectores COLOR+TALLA por cada prenda
         (grupo "ELIGE BUZO 1/2/3"), usando los colores ya creados.
       * "👫 Pareja (Dama + Caballero)": estructura fija de dos lados, cada uno con sus
         colores y tallas (helper selectoresPareja()).
       * "🎽 Variables Polos (pack x2 / x3)": estilo 'polos' → cada polo con su propio
         color y talla (helper selectoresPolos(n)).
       * "🧩 Arma tu unidad / pack x2/x3": abre un selector con buscador para elegir SOLO
         las escuderías/categorías que se quieran (armarPack).

4. VARIABLES POLOS (cuando estilo==='polos' o es pareja): editor especial que muestra
   una tarjeta por prenda ("BUZO 1", "POLO 1"…): nombre, COLORES (chips con X + agregar
   a mano + "Importar del catálogo") y TALLAS (chips con X, atajos "+ Hombre / + Dama /
   − Dama / − Hombre" y "Agregar talla a mano"). Botón "＋ Agregar otra variable (pasa a
   pack x3)".

PÁGINA PÚBLICA (checkout):
- El checkout lee `variantes`. Si hay varias, el cliente ELIGE producto; si hay una, va
  directa. Renderiza los `selectores` de la variante elegida (COLOR con su foto, TALLA,
  etc.). Para packs/polos, renderiza un bloque por prenda (por su `grupo`).
- El total y el nombre del producto se arman de la variante/pack elegidos; la foto del
  pedido sale del color elegido (o del collage x2 para packs).

Backward compatible: si un embudo no tiene `variantes`, se vende el producto único con
el precio del embudo. Verifica con tsc --noEmit y despliega.
```

> Nota: es un sistema grande. Si tu otra app ya tiene un editor de variantes, pásale
> este prompt para que le agregue lo que le falte (packs, polos, editar masivo, importar
> del catálogo) sin rehacer lo existente.
