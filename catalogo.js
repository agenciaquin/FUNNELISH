/* ================================================================
   ConfirmaYa — KLIXMANT
   catalogo.js — Catálogo de productos

   Mapea el nombre del producto (con capitalización original)
   a la ruta relativa de su imagen.

   Reglas:
   - Las claves se escriben tal como el equipo quiere verlas (capitalización legible).
   - La búsqueda normaliza al vuelo (minúsculas + trim); el objeto NO se modifica.
   - Rutas de imagen relativas a la raíz del proyecto (compatibles con GitHub Pages).
   - Usar "img/placeholder.png" como valor temporal si aún no hay foto real.

   Para agregar un producto:
   "Nombre del Producto": "img/nombre-del-archivo.jpg",
   ================================================================ */

const CATALOGO = {
  /* Productos de ejemplo — reemplazar con los productos reales de KLIXMANT */
  "Producto Demo 1": "img/placeholder.png",
  "Producto Demo 2": "img/placeholder.png",

  /* Agregar aquí los productos reales, por ejemplo:
  "Cinturón Deportivo": "img/cinturon-deportivo.jpg",
  "Camiseta Básica":    "img/camiseta-basica.jpg",
  */
};
