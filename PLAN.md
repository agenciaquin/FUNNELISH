# ConfirmaYa — Plan de Arquitectura

## 1. Visión General

ConfirmaYa es una herramienta web interna para el equipo de KLIXMANT.
El operador ingresa los datos del pedido, la app aplica las reglas de negocio,
genera el mensaje de confirmación exacto y ofrece un botón que descarga la foto
del producto y abre WhatsApp con el mensaje listo para enviar.

No hay backend, no hay login, no hay base de datos. Todo vive en el navegador.

---

## 2. Arquitectura de la Aplicación

### Patrón: Single-Page Application estática

Una sola página HTML. Sin router. Sin estado persistente entre sesiones.
El flujo completo ocurre en la misma pantalla en tres pasos:

```
[PASO 1 — Formulario]  →  [PASO 2 — Vista previa del mensaje + foto]  →  [PASO 3 — Enviar]
```

Los tres pasos son secciones visibles o colapsables dentro de `index.html`.
No hay navegación entre páginas.

### Módulos lógicos (archivos JS)

```
catalogo.js   → Define el catálogo: nombre de producto → ruta de imagen
app.js        → Toda la lógica de la aplicación
```

`catalogo.js` se carga antes que `app.js` en el HTML.
`app.js` lee el objeto global `CATALOGO` definido en `catalogo.js`.

### Separación de responsabilidades

| Archivo       | Responsabilidad                                              |
|---------------|--------------------------------------------------------------|
| index.html    | Estructura del DOM: formulario, vista previa, botones        |
| styles.css    | Identidad visual: negro, dorado, blanco. Responsive.         |
| catalogo.js   | Datos del catálogo. Solo datos, sin lógica.                  |
| app.js        | Toda la lógica: reglas de negocio, plantilla, WhatsApp, descarga |
| /img/         | Fotos de productos (JPG/PNG/WebP)                            |

---

## 3. Estructura de Archivos y Carpetas

```
FUNNELISH\
├── index.html
├── styles.css
├── app.js
├── catalogo.js
├── CLAUDE.md
├── PLAN.md
├── TASKS.md
└── img\
    ├── placeholder.png       ← imagen por defecto cuando no hay foto en catálogo
    ├── producto-ejemplo-1.jpg
    └── producto-ejemplo-2.jpg
```

Todas las rutas de imágenes en `catalogo.js` son relativas a la raíz:
`"img/nombre-del-producto.jpg"`

---

## 4. Diseño del Formulario (campos)

Basado en la plantilla del mensaje obligatoria:

| Campo              | Input      | Obligatorio | Valor por defecto       |
|--------------------|------------|-------------|-------------------------|
| Nombre             | text       | Sí          | —                       |
| Teléfono           | tel        | Sí          | —                       |
| Dirección          | text       | Sí          | —                       |
| Ciudad             | text       | Sí          | —                       |
| Departamento       | text       | Sí          | —                       |
| Correo             | email      | No          | Gerenciaquin7@gmail.com |
| Talla              | text       | No          | (vacío, regla de género)|
| Nombre del Producto| text + select/datalist | Sí | —               |
| Valor a pagar      | text       | No          | $130.000                |

---

## 5. Flujo de la Aplicación (paso a paso)

### 5.1 El operador llena el formulario y presiona "Generar mensaje"

`app.js` ejecuta en orden:

1. Recolectar valores del formulario.
2. Aplicar reglas de negocio:
   - Teléfono: eliminar todos los caracteres no numéricos; si el resultado tiene 12 dígitos y empieza por `57`, usarlo tal cual; si tiene 10 dígitos, anteponer `57`; en otro caso, conservar el mejor esfuerzo posible. Se generan **dos valores separados**:
     - `telefonoMensaje`: `+57` seguido de los 10 dígitos limpios → se inserta en el texto del mensaje que ve el cliente (ej: `+573001234567`).
     - `telefonoWhatsApp`: `57` seguido de los 10 dígitos limpios (sin el `+`) → se usa exclusivamente en la URL `wa.me/57XXXXXXXXXX` y nunca se inserta en el texto del mensaje.
   - Correo: si vacío → `Gerenciaquin7@gmail.com`.
   - Valor: si vacío → `$130.000`.
   - Talla (tres casos):
     - Si ya contiene un indicador de género (dama, mujer, femenino, hombre, caballero — cualquier capitalización) → dejarla tal cual.
     - Si NO está vacía y NO contiene indicador de género → agregar el género por defecto al final (ver sección 7.8).
     - Si está vacía → dejarla en blanco; no agregar género a un campo vacío.
2b. Validación mínima del teléfono:
   - Si el teléfono está vacío, o el número resultante de la normalización tiene menos de 10 dígitos útiles, no continuar con la generación: mostrar un aviso visible en la UI y no habilitar el botón "Enviar a cliente".
   - Los demás campos opcionales que estén vacíos (correo, talla, valor) se dejan en blanco en el mensaje sin generar ningún aviso.
3. Buscar el producto en `CATALOGO`:
   - Si existe → mostrar la imagen correspondiente.
   - Si no existe → mostrar `img/placeholder.png`.
4. Rellenar la plantilla del mensaje con los datos procesados.
5. Mostrar el mensaje generado en un área de texto de solo lectura.
6. Mostrar la foto del producto.
7. Habilitar los botones "Copiar mensaje" y "Enviar a cliente".

### 5.2 El operador presiona "Copiar mensaje"

`navigator.clipboard.writeText(mensaje)` — copia el texto al portapapeles.
Feedback visual: el botón cambia texto brevemente a "¡Copiado!".

### 5.3 El operador presiona "Enviar a cliente"

Dos acciones secuenciales:

1. **Descarga de foto**: crear un `<a>` temporal con `href` a la imagen y atributo `download`, hacer click programático.
2. **Abrir WhatsApp**: construir la URL `https://wa.me/{telefonoNormalizado}?text={mensajeCodificado}`, donde `{telefonoNormalizado}` ya incluye el prefijo `57` (formato `57XXXXXXXXXX`, obtenido en 5.1). No anteponer `"57"` adicional para evitar duplicar el código de país. Abrir con `window.open(url, "_blank")`.

El operador arrastra la foto descargada al chat de WhatsApp manualmente.

---

## 6. Estructura de `catalogo.js`

```javascript
// Ejemplo de estructura — no es código de implementación
// Las claves se escriben con su capitalización original (tal como se quieren mostrar al operador).
// El catálogo mapea nombre del producto → ruta de imagen
const CATALOGO = {
  "Nombre Producto A": "img/producto-a.jpg",
  "Nombre Producto B": "img/producto-b.png",
  // ...
};
```

Las claves del objeto `CATALOGO` se almacenan con su capitalización original y no se modifican.
La normalización a minúsculas + `trim()` se aplica SOLO al momento de comparar: tanto la clave
ingresada por el operador como la clave del catálogo se normalizan al vuelo durante la búsqueda,
pero el objeto original no se toca. Esto garantiza que el datalist muestre los nombres con
capitalización legible y que la búsqueda sea case-insensitive y trim-safe.

---

## 7. Decisiones Técnicas Justificadas

### 7.1 Sin frameworks, sin build
Requisito del stack. Permite despliegue inmediato en GitHub Pages sin pipeline CI/CD.
La complejidad de la app no justifica overhead de framework.

### 7.2 `catalogo.js` separado de `app.js`
Permite que el equipo actualice el catálogo de productos sin tocar la lógica.
El archivo solo contiene un objeto literal — cero riesgo de romper la app.

### 7.3 WhatsApp URL scheme `wa.me`
Es la única forma confiable de abrir WhatsApp con mensaje pre-llenado sin backend.
Funciona en móvil (abre app) y desktop (abre WhatsApp Web).

### 7.4 Descarga de foto con `<a download>` programático
El atributo `download` del elemento `<a>` es el mecanismo nativo del navegador
para forzar descarga. No requiere CORS si la imagen está en el mismo origen
(que es el caso: imágenes en `/img` del mismo repositorio).

### 7.5 Sin `localStorage` ni cookies
La herramienta es operada en tiempo real; no hay necesidad de persistir datos.
Cada uso es una sesión limpia, reduciendo errores de datos viejos.

### 7.6 Datalist para nombre de producto
`<input list="productos">` + `<datalist>` generado desde `CATALOGO`
ofrece autocompletado sin perder libertad de tipear nombres no catalogados.

### 7.7 Identidad visual: CSS custom properties
Los colores del tema (negro, dorado, blanco) se definen como variables CSS
en `:root` para consistencia y fácil ajuste futuro.

### 7.8 Género por defecto como constante configurable
El género que se inserta cuando la talla no especifica ninguno es `"Hombre"` (regla estándar del negocio).
Se declara como constante al inicio de `app.js` para que cualquier ajuste futuro requiera cambiar solo esa línea:

```js
const GENERO_POR_DEFECTO = "Hombre"; // cambiar a "Caballero" u otro si el negocio lo decide
```

Si en el futuro se requiere cambiar a `"Caballero"` u otro valor, solo es necesario actualizar esa constante.

---

## 8. Diseño Visual

### Paleta de colores
```
--color-bg:       #0a0a0a   (negro profundo — fondo)
--color-surface:  #1a1a1a   (negro suave — tarjetas, formulario)
--color-gold:     #c9a84c   (dorado — acentos, botones primarios)
--color-gold-hover: #e8c96b (dorado claro — hover)
--color-white:    #f5f5f5   (blanco suave — texto principal)
--color-muted:    #888888   (gris — texto secundario, placeholders)
--color-border:   #2a2a2a   (gris oscuro — bordes de inputs)
```

### Layout
- Centrado con `max-width: 640px`, optimizado para escritorio y completamente funcional en móvil.
- Un header con logo/nombre del proyecto.
- Formulario en tarjeta oscura.
- Sección de vista previa debajo del formulario (oculta hasta generar):
  - En escritorio (viewport ≥ 640px): la foto del producto y el textarea del mensaje pueden disponerse lado a lado.
  - En pantallas angostas (celular, viewport < 640px): la foto y el textarea se apilan en vertical (foto arriba, mensaje abajo), evitando scroll horizontal y garantizando legibilidad.
- Botones de acción al final de la vista previa.

---

## 9. Riesgos Identificados

| # | Riesgo | Impacto | Mitigación |
|---|--------|---------|------------|
| R1 | WhatsApp trunca mensajes muy largos en la URL | Alto | Mostrar aviso visible en la sección preview si el mensaje supera ~2000 caracteres (implementado en TAREA 20). |
| R2 | El navegador bloquea la descarga programática | Medio | Mostrar enlace de descarga visible como fallback. |
| R3 | El catálogo desactualizado no encuentra la foto del producto | Medio | Mostrar `placeholder.png` + instrucción para actualizar `catalogo.js`. |
| R4 | `wa.me` abre WhatsApp Web en desktop, no la app de escritorio | Bajo | Comportamiento esperado y aceptable para el equipo. |
| R5 | Talla con género ambiguo aplica regla incorrecta | Bajo | Documentar la regla en la UI (tooltip o nota). |
| R6 | Fotos grandes ralentizan la descarga/carga inicial | Bajo | Optimizar imágenes a <200KB antes de agregar a `/img`. |
| R7 | GitHub Pages no sirve bien rutas con espacios en nombres de archivo | Bajo | Nombrar todas las imágenes en minúsculas con guiones, sin espacios. |
