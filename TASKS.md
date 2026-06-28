# ConfirmaYa — Lista de Tareas de Implementación

## Criterios de Aceptación Globales del Proyecto

El proyecto se considera **terminado y correcto** cuando:

1. Al abrir `index.html` directamente en el navegador (sin servidor local), la página carga sin errores en consola.
2. El formulario muestra todos los campos requeridos con sus etiquetas correctas.
3. Al llenar el formulario y presionar "Generar mensaje", el texto generado coincide exactamente con la plantilla definida en CLAUDE.md (incluyendo emojis, sin líneas en blanco entre campos).
4. Las cuatro reglas de negocio funcionan correctamente (ver tareas 07–10).
5. El botón "Copiar mensaje" copia el texto al portapapeles del sistema.
6. El botón "Enviar a cliente" descarga la imagen del producto Y abre WhatsApp con el mensaje codificado.
7. Si el producto no está en el catálogo, se muestra la imagen placeholder y la app no lanza errores.
8. El diseño visual usa negro, dorado y blanco, es legible y no presenta elementos rotos.
9. Todos los archivos funcionan desplegados en GitHub Pages (rutas relativas, sin rutas absolutas locales).
10. El código no usa ningún framework, librería externa, ni requiere paso de build.

---

## Tareas

---

### TAREA 01 ✅ — Crear la carpeta `/img` y agregar imagen placeholder

**Descripción**
Crear el directorio `img\` dentro de la raíz del proyecto y colocar en él una imagen de placeholder que se mostrará cuando el producto no esté en el catálogo.

**Criterio de aceptación**
- Existe la carpeta `C:\...\FUNNELISH\img\`.
- Dentro de esa carpeta existe el archivo `placeholder.png` (puede ser cualquier imagen genérica, preferiblemente 400×400 px).
- El archivo `placeholder.png` no pesa más de 100 KB.

---

### TAREA 02 — Crear `index.html` con estructura base

**Descripción**
Crear el archivo `index.html` con:
- `<!DOCTYPE html>`, `<html lang="es">`, `<head>` con charset UTF-8, viewport, título "ConfirmaYa — KLIXMANT", y links a `styles.css`, `catalogo.js` y `app.js`.
- `<body>` con un `<header>`, un `<main>` y un `<footer>`.
- El `<main>` contiene dos secciones: `<section id="seccion-formulario">` y `<section id="seccion-preview">`.
- La sección preview tiene `display: none` por defecto (se activa desde JS).
- Los scripts se cargan al final del `<body>`: primero `catalogo.js`, luego `app.js`.

**Criterio de aceptación**
- El archivo abre en el navegador sin errores en consola.
- El HTML valida sin errores en el validador W3C (https://validator.w3.org/).
- Se pueden inspeccionar en el DOM los dos `<section>` con sus IDs correctos.
- La sección preview no es visible al cargar la página.

---

### TAREA 03 — Agregar el formulario completo en `index.html`

**Descripción**
Dentro de `<section id="seccion-formulario">`, agregar un `<form id="form-pedido">` con los siguientes campos (en orden):

| id del campo         | Tipo    | Label                | Requerido |
|----------------------|---------|----------------------|-----------|
| `input-nombre`       | text    | Nombre               | Sí        |
| `input-telefono`     | tel     | Teléfono             | Sí        |
| `input-direccion`    | text    | Dirección            | Sí        |
| `input-ciudad`       | text    | Ciudad               | Sí        |
| `input-departamento` | text    | Departamento         | Sí        |
| `input-correo`       | email   | Correo               | No        |
| `input-talla`        | text    | Talla                | No        |
| `input-producto`     | text    | Nombre del Producto  | Sí        |
| `input-valor`        | text    | Valor a pagar        | No        |

- El campo `input-producto` debe tener `list="lista-productos"`. El `<datalist id="lista-productos">` se llenará desde JS (en la Tarea 16).
- Al final del formulario, un `<button type="button" id="btn-generar">Generar mensaje</button>`.

**Criterio de aceptación**
- El formulario es visible en el navegador con todos los campos y sus etiquetas.
- Al inspeccionar el DOM, los 9 campos existen con sus IDs correctos y sus etiquetas asociadas.
- El campo de producto muestra datalist (aunque vacío por ahora, sin errores).
- El botón "Generar mensaje" es visible y clicable.

---

### TAREA 04 — Agregar la sección de vista previa en `index.html`

**Descripción**
Dentro de `<section id="seccion-preview">`, agregar:

- Un `<img id="img-producto" src="img/placeholder.png" alt="Foto del producto">`.
- Un `<textarea id="texto-mensaje" readonly rows="18">`.
- Un `<button type="button" id="btn-copiar">Copiar mensaje</button>`.
- Un `<button type="button" id="btn-enviar">Enviar a cliente</button>`.
- Un `<button type="button" id="btn-nuevo">Nuevo pedido</button>` que recargará el formulario.

**Criterio de aceptación**
- Al inspeccionar el DOM, los elementos existen con sus IDs correctos.
- La sección no es visible en pantalla (sigue con `display:none` desde CSS o atributo).

---

### TAREA 05 — Crear `styles.css` con identidad visual y layout base

**Descripción**
Crear `styles.css` con:

- Variables CSS en `:root` para la paleta:
  - `--color-bg: #0a0a0a`
  - `--color-surface: #1a1a1a`
  - `--color-gold: #c9a84c`
  - `--color-gold-hover: #e8c96b`
  - `--color-white: #f5f5f5`
  - `--color-muted: #888888`
  - `--color-border: #2a2a2a`
- Reset básico (`*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`).
- `body`: fondo `--color-bg`, color `--color-white`, fuente `sans-serif`.
- `header`: centrado, padding, título en dorado.
- `main`: `max-width: 640px`, centrado con `margin: auto`, padding lateral.
- Formulario (`form`): fondo `--color-surface`, padding, border-radius, sombra suave.
- Cada campo: `label` en blanco, `input` con fondo oscuro, borde dorado en focus, color blanco.
- Botón primario (generar/enviar): fondo dorado, texto negro, hover más claro.
- Botón secundario (copiar/nuevo): borde dorado, fondo transparente, texto dorado.
- `#img-producto`: ancho máximo 100%, border-radius, borde dorado fino.
- `#texto-mensaje`: fondo oscuro, texto blanco, font-family monospace, ancho 100%.
- `#seccion-preview { display: none; }`.
- `footer`: texto centrado, pequeño, en gris.

**Criterio de aceptación**
- La página en el navegador muestra fondo negro, texto blanco, acentos dorados.
- Los inputs tienen borde dorado al tener foco.
- No hay estilos rotos ni texto ilegible por contraste insuficiente.
- La página no tiene scroll horizontal en viewport de 390px (móvil) ni en 1280px (desktop).

---

### TAREA 06 — Crear `catalogo.js` con estructura del catálogo

**Descripción**
Crear `catalogo.js` que define en el scope global el objeto `CATALOGO`:

```javascript
const CATALOGO = {
  // clave: nombre del producto con capitalización original (ej: "Cinturón Deportivo")
  // valor: ruta relativa a la imagen
};
```

- Agregar al menos 2 productos de ejemplo con imágenes que existan en `/img`.
- Si aún no hay imágenes reales, usar `"img/placeholder.png"` como valor temporal.
- Las claves se escriben con su capitalización natural. La búsqueda normaliza al vuelo; el objeto no se modifica.
- **No** poblar el datalist desde este archivo; esa responsabilidad es exclusiva de la Tarea 16.

**Criterio de aceptación**
- `catalogo.js` carga sin errores en consola.
- `window.CATALOGO` está disponible en la consola del navegador como objeto con al menos 2 entradas.

---

### TAREA 07 — Implementar en `app.js`: recolección de datos y regla de teléfono

**Descripción**
En `app.js`, agregar el listener al botón `#btn-generar`.
Al hacer click, recolectar todos los valores del formulario.
Aplicar la regla de normalización del teléfono (ver sección 5.1 del PLAN.md):
- Eliminar todos los caracteres no numéricos del valor ingresado.
- Si el resultado tiene 12 dígitos y empieza por `57` → usarlo tal cual (ya incluye código de país).
- Si el resultado tiene 10 dígitos → anteponer `57` (número colombiano sin código de país).
- En cualquier otro caso → conservar el resultado limpio (mejor esfuerzo).
- El número final debe tener el formato `57XXXXXXXXXX` para usarse en la URL de WhatsApp sin duplicar el código de país.

**Criterio de aceptación**

Para cada entrada se generan dos valores: `telefonoMensaje` (con `+`, para el cuerpo del mensaje) y `telefonoWhatsApp` (sin `+`, para la URL de WhatsApp):

- `+573001234567` → `telefonoMensaje`: `+573001234567` | `telefonoWhatsApp`: `573001234567`.
- `3001234567` → `telefonoMensaje`: `+573001234567` | `telefonoWhatsApp`: `573001234567` (se antepone `57` / `+57`).
- `573001234567` (sin el +) → `telefonoMensaje`: `+573001234567` | `telefonoWhatsApp`: `573001234567`.
- `+57 300 123 4567` (con espacios) → `telefonoMensaje`: `+573001234567` | `telefonoWhatsApp`: `573001234567` (se eliminan no-dígitos).
- En el mensaje generado el campo `Teléfono:` muestra SIEMPRE el formato `+57XXXXXXXXXX` (12 dígitos con el símbolo `+`).
- La URL de WhatsApp usa SIEMPRE `wa.me/57XXXXXXXXXX` (sin el `+`).
- Se puede verificar con `console.log` en esta etapa.

---

### TAREA 08 — Implementar en `app.js`: regla de correo y regla de valor

**Descripción**
Continuar en `app.js` con las otras dos reglas de valor por defecto:
- Si el campo correo está vacío → asignar `Gerenciaquin7@gmail.com`.
- Si el campo valor está vacío → asignar `$130.000`.

**Criterio de aceptación**
- Al dejar el campo correo vacío y generar, el mensaje contiene `Gerenciaquin7@gmail.com`.
- Al ingresar un correo real y generar, el mensaje contiene ese correo.
- Al dejar el campo valor vacío y generar, el mensaje contiene `$130.000`.
- Al ingresar un valor y generar, el mensaje contiene ese valor.

---

### TAREA 09 — Implementar en `app.js`: regla de talla/género

**Descripción**
Aplicar la regla de género a la talla usando la constante `GENERO_POR_DEFECTO` definida al inicio de `app.js` (ver sección 7.8 del PLAN.md). Los tres casos son:

- Si la talla contiene un indicador de género (dama, mujer, femenino, hombre, caballero — cualquier capitalización) → dejarla tal cual.
- Si la talla NO está vacía y NO contiene indicador de género → agregar `" " + GENERO_POR_DEFECTO` al final.
- Si la talla está vacía → dejarla en blanco; no agregar nada.

Indicadores de género reconocidos (case-insensitive): `dama`, `mujer`, `femenino`, `hombre`, `caballero`.

**Criterio de aceptación**
- Talla `"M"` → resultado: `"M Hombre"` (usando el valor de `GENERO_POR_DEFECTO`).
- Talla `"L Mujer"` → resultado: `"L Mujer"` (sin modificar).
- Talla `"S femenino"` → resultado: `"S femenino"` (sin modificar).
- Talla `"XL Dama"` → resultado: `"XL Dama"` (sin modificar; "Dama" es indicador de género).
- Talla `"L Caballero"` → resultado: `"L Caballero"` (sin modificar).
- Talla `""` (vacío) → resultado: `""` (el campo queda vacío en el mensaje, sin asumir nada).

---

### TAREA 10 — Implementar en `app.js`: generación del mensaje con plantilla exacta

**Descripción**
Con los datos procesados, construir el mensaje usando la plantilla exacta de CLAUDE.md.
El mensaje debe ser un string con saltos de línea `\n` entre cada campo, sin líneas en blanco.

Plantilla a reproducir:
```
Hola 😊 te saluda Lilibeth. Tu pedido ya está listo para despacho 🚚✨ Por favor confirma que estos datos estén correctos:
Nombre: {nombre}
Teléfono: {telefono}
Dirección: {direccion}
Ciudad: {ciudad}
Departamento: {departamento}
Correo: {correo}
Talla: {talla}
Nombre del Producto: {producto}
Valor a pagar: {valor}
✅ Si todo está correcto responde: CONFIRMO
✏️ Si deseas corregir algún dato, escríbelo en este chat.
🚚 Una vez confirmado, tu pedido será despachado en las próximas 24 horas.
```

Mostrar el resultado en `#texto-mensaje`.
Mostrar la sección `#seccion-preview` (quitar `display:none`).

**Criterio de aceptación**
- El texto en `#texto-mensaje` coincide exactamente con la plantilla (copiar el contenido del textarea y comparar carácter a carácter con la plantilla en CLAUDE.md).
- No hay líneas en blanco entre "Valor a pagar" y "✅ Si todo está correcto...".
- Los emojis se muestran correctamente.
- La sección de preview se hace visible.

---

### TAREA 11 — Implementar en `app.js`: búsqueda de foto del producto

**Descripción**
Después de generar el mensaje, buscar el nombre del producto en `CATALOGO`:
- Aplicar `trim()` y normalizar a minúsculas TANTO a la clave de búsqueda (lo que ingresó el operador) COMO a cada clave del catálogo al comparar, de modo que espacios sobrantes en cualquiera de los dos lados no impidan encontrar la foto.
- Si se encuentra → asignar `src` del `#img-producto` a la ruta del catálogo.
- Si no se encuentra → asignar `src` a `"img/placeholder.png"`.

**Criterio de aceptación**
- Si el producto ingresado existe en el catálogo (con nombre exacto o case diferente), la imagen del producto correcto se muestra en la sección preview.
- Si el producto no existe en el catálogo, se muestra `placeholder.png` sin errores en consola.
- La búsqueda no es sensible a mayúsculas/minúsculas: `"PRODUCTO A"`, `"producto a"` y `"Producto A"` deben encontrar el mismo registro.

---

### TAREA 12 — Implementar en `app.js`: botón "Copiar mensaje"

**Descripción**
Agregar listener al botón `#btn-copiar`:
- Copiar el texto de `#texto-mensaje` al portapapeles con `navigator.clipboard.writeText()`.
- Cambiar el texto del botón a `"¡Copiado! ✓"` por 2 segundos y luego restaurar a `"Copiar mensaje"`.

**Criterio de aceptación**
- Al presionar el botón, el contenido del textarea se copia al portapapeles (verificar pegando en otro lugar).
- El botón muestra `"¡Copiado! ✓"` brevemente y luego vuelve a su texto original.
- Si el navegador no soporta Clipboard API (muy raro hoy), la app no lanza error sin manejar; mostrar un `alert` con instrucción manual como fallback.

---

### TAREA 13 — Implementar en `app.js`: botón "Enviar a cliente"

**Descripción**
Agregar listener al botón `#btn-enviar` que ejecuta DOS acciones:

**Acción 1 — Descarga de foto:**
- Crear un `<a>` temporal con `href = img-producto.src` y atributo `download`.
- Hacer `.click()` programático y remover el elemento.

**Acción 2 — Abrir WhatsApp:**
- Construir la URL: `"https://wa.me/" + telefonoNormalizado + "?text=" + encodeURIComponent(mensaje)`.
- `telefonoNormalizado` ya incluye el prefijo `57` (formato `57XXXXXXXXXX`, obtenido en TAREA 07). No anteponer `"57"` adicional para evitar duplicar el código de país y generar links rotos.
- Abrir con `window.open(url, "_blank")`.

**Criterio de aceptación**
- Al presionar el botón, el navegador inicia la descarga de la imagen (aparece en la carpeta de descargas o la barra de descargas del navegador).
- Al presionar el botón, se abre una nueva pestaña con la URL de WhatsApp conteniendo el número colombiano correcto y el mensaje pre-llenado.
- El mensaje en la URL de WhatsApp, al decodificarse, es idéntico al mostrado en el textarea.
- La descarga funciona tanto si la imagen es del catálogo como si es el placeholder.

---

### TAREA 14 — Implementar en `app.js`: botón "Nuevo pedido"

**Descripción**
Agregar listener al botón `#btn-nuevo`:
- Limpiar el formulario con `form.reset()`.
- Ocultar la sección `#seccion-preview` (volver a `display: none`).
- Hacer scroll al inicio de la página o enfocar el primer campo.

**Criterio de aceptación**
- Al presionar "Nuevo pedido", el formulario queda en blanco.
- La sección de preview desaparece.
- El cursor/foco queda en el primer campo del formulario.
- No hay datos del pedido anterior visibles ni en el textarea ni en la imagen.

---

### TAREA 15 — Agregar validación básica del formulario en `app.js`

**Descripción**
Antes de generar el mensaje, verificar dos niveles de validación:

**Nivel 1 — Campos obligatorios vacíos:**
- Nombre, Teléfono, Dirección, Ciudad, Departamento, Nombre del Producto.
- Si alguno está vacío → mostrar un mensaje de error visible en la UI (no usar `alert()`).
  - Agregar en `index.html` un `<div id="error-msg" role="alert">` para este fin.
  - Mostrar el texto del error indicando cuáles campos faltan y hacer scroll a él.
- Si todos están completos → proceder con la generación.

**Nivel 2 — Teléfono inválido tras normalización:**
- Después de aplicar la normalización (TAREA 07), si el número resultante tiene menos de 10 dígitos útiles, no habilitar el botón "Enviar a cliente" y mostrar un aviso claro en la UI.
- Los campos opcionales vacíos (correo, talla, valor) se dejan en blanco en el mensaje sin generar ningún aviso de error.

**Criterio de aceptación**
- Al presionar "Generar mensaje" con campos obligatorios vacíos, aparece un mensaje de error visible indicando cuáles campos faltan.
- El mensaje de error desaparece cuando se genera exitosamente.
- No se muestra la sección preview si hay errores.
- El elemento de error tiene el atributo `role="alert"` para accesibilidad.

---

### TAREA 16 — Poblar el datalist de productos desde `catalogo.js`

**Descripción**
En `app.js`, dentro de un listener `DOMContentLoaded`, poblar el `<datalist id="lista-productos">` dinámicamente con las claves del objeto `CATALOGO`:

```javascript
// Por cada clave en CATALOGO, agregar una <option value="clave">
```

El texto de cada opción debe verse con capitalización correcta (no todo en minúsculas).
Considerar almacenar las claves con capitalización original y normalizar solo al buscar.

**Criterio de aceptación**
- Al hacer click en el campo "Nombre del Producto" y tipear las primeras letras de un producto del catálogo, aparecen sugerencias del datalist.
- Las sugerencias muestran los nombres con capitalización legible.
- Seleccionar una sugerencia auto-completa el campo.

---

### TAREA 17 — Revisar y ajustar estilos de la sección preview

**Descripción**
Agregar en `styles.css` los estilos específicos para la sección de preview que quizás falten tras las tareas anteriores:

- Espaciado entre la imagen y el textarea.
- La imagen centrada y con tamaño máximo razonable (máx 300px de alto).
- El textarea con altura suficiente para mostrar el mensaje completo sin scroll (o con scroll interno si el mensaje es largo).
- Los botones de acción alineados y con margen entre ellos.
- Una separación visual (línea o espacio) entre la sección formulario y la sección preview.
- Layout responsive de la vista previa:
  - En escritorio (viewport ≥ 640px): foto y textarea pueden ir lado a lado.
  - En móvil (viewport < 640px): foto y textarea se apilan en vertical (foto arriba, textarea abajo), sin scroll horizontal.

**Criterio de aceptación**
- La sección preview se ve ordenada: imagen arriba (o a la izquierda en escritorio), textarea abajo (o a la derecha en escritorio), botones al final.
- No hay elementos superpuestos ni desbordados.
- Los botones "Copiar", "Enviar a cliente" y "Nuevo pedido" son claramente distinguibles entre sí (primario, secundario, terciario).
- En un viewport de 390px (móvil), la foto y el mensaje se apilan verticalmente sin scroll horizontal.

---

### TAREA 18 — Prueba de integración completa y correcciones finales

**Descripción**
Ejecutar el flujo completo de punta a punta y verificar todos los criterios globales:

1. Abrir `index.html` directamente desde el sistema de archivos (protocolo `file://`).
2. Llenar el formulario con datos de prueba (incluir un producto del catálogo).
3. Probar todas las reglas de negocio (tareas 07–09).
4. Verificar el mensaje generado contra la plantilla exacta.
5. Verificar la descarga de foto y la apertura de WhatsApp.
6. Presionar "Nuevo pedido" y verificar limpieza.
7. Probar con un producto que NO esté en el catálogo.
8. Revisar la consola del navegador: debe estar libre de errores.

Corregir cualquier defecto encontrado.

**Criterio de aceptación**
- Flujo completo sin errores en consola (ni warnings evitables).
- El mensaje generado es textualmente idéntico al de CLAUDE.md.
- La URL de WhatsApp abre correctamente con número y mensaje.
- La foto se descarga sin errores.
- El formulario se limpia al presionar "Nuevo pedido".
- La app funciona en Chrome, Firefox y Edge (sin instalar nada).

---

### TAREA 19 — Verificar compatibilidad con GitHub Pages

**Descripción**
Verificar que no hay ninguna ruta absoluta ni dependencia que rompa en GitHub Pages:

- Revisar que todos los `src`, `href` y rutas en JS son relativas (empiezan con `img/`, `./`, o solo el nombre de archivo).
- Verificar que no hay `file://` hardcodeado en el código.
- Confirmar que el archivo de entrada se llama exactamente `index.html` (GitHub Pages lo sirve automáticamente).
- Confirmar que no hay dependencias a `localhost` ni a servidores externos (excepto `wa.me` que es intencional).

**Criterio de aceptación**
- Grep en todos los archivos: sin ocurrencias de `file://`, `localhost`, `C:\`, `C:/` en el código fuente.
- Todos los `<script src="...">`, `<link href="...">` e `<img src="...">` usan rutas relativas.
- `index.html` existe en la raíz del repositorio.
- El proyecto puede subirse a GitHub y habilitarse GitHub Pages sin configuración adicional.

---

### TAREA 20 — Advertencia de mensaje demasiado largo

**Descripción**
En `app.js`, después de generar el mensaje, calcular su longitud. Si supera 1900 caracteres (margen de seguridad antes del límite de WhatsApp), mostrar un aviso visible en la sección preview (ej: un `<div>` con fondo amarillo/naranja) que diga: "⚠️ El mensaje es muy largo. Puede que WhatsApp lo trunque. Considera acortar la dirección o el nombre del producto."
El aviso debe ocultarse automáticamente cuando el mensaje nuevo sea menor a 1900 caracteres.

**Criterio de aceptación**
- Si el mensaje generado tiene más de 1900 caracteres, aparece el aviso de advertencia en la sección preview.
- Si el mensaje tiene 1900 caracteres o menos, el aviso no aparece (o desaparece si estaba visible).
- El aviso no bloquea el uso de los botones — es informativo, no un error.
- El aviso es visible y tiene contraste suficiente sobre el fondo oscuro.

---

## Orden recomendado de implementación

```
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20
```

Cada tarea es independiente de las siguientes pero depende de las anteriores en la secuencia.
El implementador debe hacer commit al completar cada tarea y verificar su criterio de aceptación antes de avanzar.
