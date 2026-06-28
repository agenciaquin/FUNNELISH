# AUDIT_PLAN.md — Auditoría Pre-Implementación de ConfirmaYa

> Auditor: Rol de Auditor de Calidad
> Fecha de auditoría: 2026-06-28
> Documentos revisados: CLAUDE.md, PLAN.md, TASKS.md
> Objetivo: Detectar inconsistencias, ambigüedades y vacíos ANTES de que el implementador empiece a trabajar.

---

## Punto 1 — Consistencia Interna

**Estado: ❌ Hay dos contradicciones que deben resolverse antes de implementar.**

### Contradicción 1.A — Teléfono normalizado: ¿10 dígitos o 12?

CLAUDE.md define la regla así:
> "Si el teléfono tiene prefijo `+57`, eliminarlo (dejar solo 10 dígitos)."

Y en el botón "Enviar a cliente":
> `https://wa.me/57{telefono}?text={mensaje_codificado}`

Interpretación de CLAUDE.md: `{telefono}` = 10 dígitos; la URL concatena "57" delante.

PLAN.md sección 5.1 define la regla así:
> "El número resultante siempre representa el formato `57XXXXXXXXXX`."

Y PLAN.md sección 5.3 dice:
> "`telefonoNormalizado` ya incluye el prefijo `57`. No anteponer `57` adicional."

Interpretación de PLAN.md: `telefonoNormalizado` = 12 dígitos; se usa directamente en wa.me.

**El resultado en WhatsApp es idéntico en ambos casos**, pero hay una pregunta sin responder que afecta al MENSAJE DE CONFIRMACIÓN que ve el cliente:

> ¿El campo `Teléfono: {telefono}` del mensaje muestra 10 dígitos (`3001234567`) o 12 dígitos (`573001234567`)?

Ninguno de los tres documentos lo especifica explícitamente. El implementador de la Tarea 10 (construcción de la plantilla) tendrá que adivinar. Si muestra 12 dígitos, el cliente verá un número poco convencional para Colombia.

**Corrección requerida:** Especificar explícitamente en PLAN.md sección 5.1 y en TASKS.md tarea 10 que el teléfono mostrado al cliente en el cuerpo del mensaje usa los 10 dígitos originales (o los 12, según decisión del negocio), y que la variable `telefonoNormalizado` de 12 dígitos se usa exclusivamente para la URL de WhatsApp.

---

### Contradicción 1.B — Claves del catálogo: ¿minúsculas o capitalización original?

PLAN.md sección 6, comentario en el ejemplo de código:
> `// clave: nombre exacto del producto en minúsculas`

TASKS.md tarea 16:
> "El texto de cada opción debe verse con capitalización correcta (no todo en minúsculas). Considerar almacenar las claves con capitalización original y normalizar solo al buscar."

Estas instrucciones son contradictorias. Si el implementador sigue PLAN.md, las claves quedan en minúsculas y el datalist muestra opciones en minúsculas (mala UX). Si sigue TASKS.md tarea 16, las claves tienen capitalización original (correcta).

**Corrección requerida:** Eliminar el comentario `// clave: nombre exacto del producto en minúsculas` de PLAN.md sección 6 y reemplazarlo por `// clave: nombre del producto con capitalización original; la búsqueda normaliza a minúsculas al comparar`.

---

### Contradicción 1.C — Responsabilidad del datalist duplicada entre Tarea 06 y Tarea 16

La Tarea 06 describe y tiene como criterio de aceptación poblar el datalist:
> "Al final del archivo, generar y poblar el `<datalist id="lista-productos">` con las claves del catálogo."
> "El datalist del campo 'Nombre del Producto' muestra sugerencias de autocompletado al tipear."

La Tarea 16 existe exclusivamente para poblar el datalist y es idéntica en propósito.

El implementador no sabrá si implementar el datalist en la Tarea 06 (como dice su descripción) o en la Tarea 16 (como indica el título de esa tarea). Además, el criterio de aceptación de la Tarea 06 depende de una funcionalidad que según el orden de implementación se completa en la Tarea 16.

**Corrección requerida:** En TASKS.md, eliminar de la Tarea 06 la instrucción de poblar el datalist y el criterio relacionado, dejando esa responsabilidad exclusivamente en la Tarea 16. La Tarea 06 solo debe crear y exportar el objeto `CATALOGO`.

---

## Punto 2 — Cobertura de Requisitos

**Estado: ⚠️ Un requisito de CLAUDE.md no tiene tarea de UI asignada.**

Todos los requisitos funcionales de CLAUDE.md están cubiertos por tareas en TASKS.md, con una excepción:

CLAUDE.md dice:
> "WhatsApp NO permite adjuntar foto por URL — el usuario arrastra la foto descargada al chat manualmente."

Esto es información operativa crítica para el operador, pero ninguna tarea contempla agregar una nota o instrucción visible en la interfaz que le recuerde al operador qué hacer tras presionar "Enviar a cliente". El operador nuevo podría confundirse si no ve esa instrucción en pantalla.

**Corrección recomendada (menor):** Agregar a la Tarea 13 (o a la Tarea 04 en el HTML) una instrucción de UI: un texto visible junto al botón "Enviar a cliente" que diga algo como "Se descargará la foto. Agrégala manualmente al chat de WhatsApp." No es bloqueante pero mejora la usabilidad.

---

## Punto 3 — Reglas de Negocio

**Estado: ⚠️ Dos ambigüedades menores.**

### Regla de teléfono
Bien definida en PLAN.md y TASKS.md tarea 07 con sus cuatro casos y cuatro ejemplos verificables. Sin embargo, la ambigüedad sobre qué se muestra en el mensaje (10 vs 12 dígitos) ya fue señalada en el Punto 1.A.

Adicionalmente: el caso "cualquier otro número de dígitos" está definido como "conservar el mejor esfuerzo posible". Esto cubre números de 11 dígitos, pero el Nivel 2 de validación en la Tarea 15 dice "menos de 10 dígitos útiles". Un número de 11 dígitos pasaría esa validación aunque sea inválido. No es un caso frecuente, pero el implementador debe saber qué hacer: ¿muestra aviso o no?

**Corrección recomendada:** Aclarar en TASKS.md tarea 15 Nivel 2 que el criterio es "el número normalizado tiene exactamente 10 o 12 dígitos (en el segundo caso comenzando por 57)"; cualquier otro resultado (9, 11, 13 dígitos) se trata como inválido.

### Regla de correo
✅ Sin ambigüedad. Valor concreto: `Gerenciaquin7@gmail.com`.

### Regla de valor
✅ Sin ambigüedad. Valor concreto: `$130.000`.

### Regla de talla/género
✅ La lista de indicadores (dama, mujer, femenino, hombre, caballero) está especificada. La constante `GENERO_POR_DEFECTO = "Hombre"` está documentada en PLAN.md sección 7.8 y en TASKS.md tarea 09. Los tres casos (contiene indicador / no vacía sin indicador / vacía) están claros con ejemplos verificables.

Ambigüedad menor: no se especifica si la lista de indicadores es exhaustiva y cerrada. El implementador podría preguntarse si "señora", "masculino" o "fem" también deberían reconocerse. Debería decirse explícitamente que esa lista de 5 palabras es la lista completa y definitiva.

---

## Punto 4 — Plantilla del Mensaje

**Estado: ✅ La plantilla está definida exactamente, con emojis, sin líneas en blanco entre campos.**

La plantilla en CLAUDE.md y en TASKS.md tarea 10 es idéntica carácter por carácter. El criterio de aceptación de la Tarea 10 exige comparación carácter a carácter. Sin ambigüedad en este punto.

La única dependencia pendiente es la del Punto 1.A (valor de `{telefono}` en el mensaje), que afecta a la plantilla pero es un problema del Punto 1, no de la plantilla en sí.

---

## Punto 5 — Flujo de la Aplicación

**Estado: ⚠️ El flujo es correcto pero hay una ambigüedad sobre el estado inicial del botón "Enviar a cliente".**

El flujo paso a paso en PLAN.md sección 5 y las tareas 07–14 son coherentes. No falta ningún paso. El orden de implementación es lógico.

Sin embargo, la Tarea 15 Nivel 2 dice:
> "no habilitar el botón 'Enviar a cliente'"

Pero ninguna tarea especifica el estado inicial del botón. La Tarea 04 crea el botón sin mencionar `disabled`. La Tarea 13 agrega el listener sin mencionar estado. La Tarea 15 condiciona el botón sin definir de dónde parte.

**Pregunta sin respuesta:** ¿El botón "Enviar a cliente" nace deshabilitado y se habilita al generar exitosamente, o nace habilitado y se deshabilita si el teléfono es inválido?

La primera opción es más segura. La segunda puede generar un estado intermedio inconsistente (el botón activo antes de generar el mensaje).

**Corrección requerida:** Agregar en TASKS.md tarea 04 que el botón `#btn-enviar` y el botón `#btn-copiar` se crean con el atributo `disabled` por defecto, y en la Tarea 10 o Tarea 15 se especifica cuándo se habilitan.

---

## Punto 6 — Criterios de Aceptación

**Estado: ❌ Un criterio es técnicamente imposible de cumplir con la implementación especificada.**

### Problema 6.A — Tarea 03: validación nativa vs type="button" (Crítico)

La Tarea 03 especifica crear el botón como:
> `<button type="button" id="btn-generar">Generar mensaje</button>`

Y su criterio de aceptación dice:
> "Los campos marcados como requeridos muestran validación nativa del navegador al intentar enviar el formulario vacío."

Esto es imposible. Con `type="button"` el navegador NO realiza un submit del formulario y por tanto la validación nativa HTML (`required`, mensajes de burbuja del navegador) no se activa jamás. Para que funcione la validación nativa, el botón necesitaría ser `type="submit"`, y el listener haría `event.preventDefault()`.

La Tarea 15 implementa validación personalizada en JS, lo cual es coherente con `type="button"`. Pero el criterio de la Tarea 03 contradice ambas decisiones.

**Corrección requerida:** Eliminar ese criterio de la Tarea 03 y reemplazarlo por: "Al presionar el botón 'Generar mensaje', no ocurre ningún submit del formulario ni recarga de página (verificar en la consola que no hay navegación)."

---

### Problema 6.B — Tarea 06: criterio que depende de Tarea 16 (ya cubierto en Punto 1.C)

El criterio "El datalist muestra sugerencias" en la Tarea 06 no puede verificarse hasta completar la Tarea 16. Ver Punto 1.C.

---

### Resto de criterios
Todas las demás tareas (01, 02, 04, 05, 07, 08, 09, 10, 11, 12, 13, 14, 17, 18, 19) tienen criterios claros, concretos y verificables. Las tareas con ejemplos de entrada/salida explícitos (07, 08, 09) son especialmente buenas.

---

## Punto 7 — Responsive y Layout

**Estado: ⚠️ Ambigüedad en el breakpoint y en el lenguaje ("pueden" vs "deben").**

PLAN.md sección 8 y TASKS.md tareas 05 y 17 cubren el responsive. El comportamiento lado a lado en escritorio y apilado en móvil está especificado. Sin embargo:

**Ambigüedad 7.A — Breakpoint igual al max-width del contenedor:**

El `max-width` del contenedor `<main>` es `640px`. El breakpoint para el layout lado a lado es `viewport ≥ 640px`. En un viewport de exactamente 640px, el contenedor ocupa todo el ancho disponible sin margen lateral, y dentro de él hay que distribuir la imagen y el textarea en dos columnas. El espacio disponible para cada columna sería muy reducido.

En la práctica, en un viewport de 640px podría verse apretado o roto. Sería más seguro que el breakpoint para el layout lado a lado sea mayor (por ejemplo, ≥ 768px) o que el max-width del contenedor sea menor (500px) para que haya márgenes en desktop.

**Corrección recomendada:** Definir el breakpoint de "lado a lado" en ≥ 768px en lugar de ≥ 640px, o ajustar el max-width del main a 600px para que haya margen lateral en desktop.

**Ambigüedad 7.B — "Pueden disponerse lado a lado" (opcional) vs "van lado a lado" (definitivo):**

PLAN.md sección 8 usa "pueden disponerse lado a lado" (condicional, opcional).
TASKS.md tarea 17 lo trata como un requerimiento definitivo.

El implementador debe saber si el layout lado a lado es obligatorio o sugerido. Dado que TASKS.md lo exige en su criterio de aceptación, ese es el criterio vinculante. Pero conviene eliminar el lenguaje ambiguo de PLAN.md.

---

## Punto 8 — Casos Límite No Cubiertos

**Estado: ❌ Un caso límite del plan no tiene tarea de implementación. Varios casos edge sin documentar.**

### Caso 8.A — Mensaje largo: mencionado en riesgos, sin tarea ❌

PLAN.md sección 9, Riesgo R1:
> "WhatsApp trunca mensajes muy largos en la URL | Mitigación: Mantener mensaje dentro de ~2000 caracteres. **Advertir si se excede.**"

No existe ninguna tarea que implemente esta advertencia. Si la mitigación está en el plan de riesgos como acción concreta ("advertir"), debe haber una tarea que la implemente.

**Corrección requerida:** Agregar en TASKS.md una verificación en la generación del mensaje: si `encodeURIComponent(mensaje).length > 2000` (o un umbral razonable), mostrar un aviso en la UI antes de habilitar el botón "Enviar a cliente".

### Caso 8.B — Teléfono de 11 dígitos: validación incompleta ⚠️

Ver Punto 3 (regla de teléfono). Un número con 11 dígitos pasa la validación de "al menos 10 dígitos" pero no encaja en ninguno de los casos definidos (10 o 12 dígitos). El comportamiento no está documentado.

### Caso 8.C — Imagen del producto rota: sin manejo de error ⚠️

Ninguna tarea especifica agregar `onerror` al elemento `<img id="img-producto">`. Si la ruta del catálogo apunta a un archivo que no existe, la imagen mostrará el ícono de imagen rota del navegador en lugar del placeholder.

**Corrección recomendada:** Agregar en TASKS.md tarea 11 que el `<img id="img-producto">` debe tener un handler `onerror` que cambie el `src` a `"img/placeholder.png"` si la imagen no carga.

### Caso 8.D — Campo "Nombre del Producto" tipado pero que no existe en el catálogo ✅

Bien manejado: se muestra el placeholder. Cubierto en Tarea 11 y en el criterio global #7.

### Caso 8.E — Clipboard API no disponible en `file://` ✅

Cubierto: la Tarea 12 especifica un fallback con `alert()`. Aceptable.

### Caso 8.F — Descarga programática bloqueada por el navegador ✅

Cubierto: PLAN.md riesgo R2 menciona "mostrar enlace de descarga visible como fallback". Sin embargo, ninguna tarea implementa este fallback explícitamente. La Tarea 13 no menciona el fallback del enlace visible.

**Corrección recomendada (menor):** Agregar en TASKS.md tarea 13 que si el click programático no funciona, debe mostrarse un enlace `<a href="..." download>` visible como alternativa.

---

## Punto 9 — GitHub Pages

**Estado: ✅ El plan garantiza compatibilidad sin configuración adicional.**

La Tarea 19 cubre exhaustivamente la verificación de rutas relativas, ausencia de dependencias locales y correcta nomenclatura de archivos. PLAN.md sección 7.4 explica correctamente por qué la descarga con `<a download>` funciona en el mismo origen sin CORS. El archivo de entrada se llama `index.html` en la raíz (GitHub Pages lo sirve automáticamente).

Nota informativa: al probar en `file://` (Tarea 18), `navigator.clipboard.writeText()` puede requerir HTTPS en algunos navegadores. GitHub Pages usa HTTPS, así que en producción funciona. El fallback de la Tarea 12 cubre el caso local.

---

## Punto 10 — Catálogo: Normalización con trim() y Minúsculas

**Estado: ⚠️ Bien especificado en la búsqueda; inconsistencia en cómo se almacenan las claves (ya cubierto en Punto 1.B).**

La Tarea 11 especifica claramente:
> "Aplicar `trim()` y normalizar a minúsculas TANTO a la clave de búsqueda COMO a cada clave del catálogo al comparar."

La PLAN.md sección 6 también lo especifica correctamente para la búsqueda.

El único problema es la inconsistencia en cómo se definen las claves originales en el objeto `CATALOGO` (minúsculas vs capitalización original), ya documentado en el Punto 1.B. Resuelta esa contradicción, la normalización de búsqueda está bien definida.

---

## Resumen de Hallazgos

| # | Punto | Estado | Descripción breve |
|---|-------|--------|-------------------|
| 1.A | Consistencia interna | ❌ | `{telefono}` en el mensaje: ¿10 dígitos o 12? No definido |
| 1.B | Consistencia interna | ❌ | Claves del catálogo: minúsculas (PLAN.md) vs original (TASKS.md T16) |
| 1.C | Consistencia interna | ❌ | Datalist duplicado en T06 y T16: responsabilidad ambigua |
| 2 | Cobertura | ⚠️ | Instrucción "arrastra la foto manualmente" no tiene tarea de UI |
| 3 | Reglas de negocio | ⚠️ | Teléfono 11 dígitos sin criterio; lista de indicadores de género no declarada exhaustiva |
| 4 | Plantilla | ✅ | Plantilla exacta, sin ambigüedad |
| 5 | Flujo | ⚠️ | Estado inicial del botón "Enviar a cliente" no definido |
| 6.A | Criterios de aceptación | ❌ | Tarea 03: `type="button"` nunca activa validación nativa del navegador |
| 6.B | Criterios de aceptación | ❌ | Tarea 06: criterio del datalist depende de T16 (no verificable en T06) |
| 7 | Responsive | ⚠️ | Breakpoint 640px = max-width del contenedor; "pueden" vs "deben" en PLAN.md |
| 8.A | Casos límite | ❌ | Advertencia de mensaje largo documentada en riesgos pero sin tarea |
| 8.B | Casos límite | ⚠️ | Teléfono de 11 dígitos: comportamiento indefinido |
| 8.C | Casos límite | ⚠️ | Sin `onerror` en img-producto para imagen rota |
| 8.F | Casos límite | ⚠️ | Fallback de descarga visible no tiene tarea explícita |
| 9 | GitHub Pages | ✅ | Garantizado sin configuración adicional |
| 10 | Catálogo / trim | ⚠️ | Depende de resolución del Punto 1.B |

**Conteo:** 5 ❌ (bloqueantes) · 8 ⚠️ (ambigüedades menores) · 3 ✅

---

## Correcciones Requeridas (ordenadas por prioridad)

### CRÍTICAS — Deben resolverse antes de que el implementador empiece

**C1 — Especificar el valor de `{telefono}` en el mensaje de confirmación**

En PLAN.md sección 5.1 (paso 4 o donde se construye la plantilla) y en TASKS.md tarea 10, agregar explícitamente:

> "El campo `{telefono}` en el cuerpo del mensaje muestra [DECISIÓN: 10 dígitos sin código de país / 12 dígitos con código de país]. La variable `telefonoNormalizado` (formato `57XXXXXXXXXX`) se usa exclusivamente para construir la URL de WhatsApp y NO se inserta directamente en el texto del mensaje."

Esta es una decisión de negocio. El valor más natural para el cliente colombiano es los 10 dígitos.

**C2 — Resolver la inconsistencia de claves del catálogo**

En PLAN.md sección 6, cambiar el comentario del ejemplo:

```
// Antes: "// clave: nombre exacto del producto en minúsculas"
// Después: "// clave: nombre del producto con capitalización legible; la búsqueda normaliza a minúsculas al comparar"
```

**C3 — Eliminar la responsabilidad del datalist de la Tarea 06**

En TASKS.md tarea 06:
- Eliminar el párrafo: "Al final del archivo, generar y poblar el `<datalist id="lista-productos">`..."
- Eliminar el criterio: "El datalist del campo 'Nombre del Producto' muestra sugerencias de autocompletado al tipear."
- Dejar solo: "catalogo.js carga sin errores" y "window.CATALOGO está disponible en la consola del navegador como objeto."

**C4 — Corregir el criterio contradictorio de la Tarea 03**

En TASKS.md tarea 03, reemplazar el criterio:

```
// Antes:
"Los campos marcados como requeridos muestran validación nativa del navegador al intentar enviar el formulario vacío."

// Después:
"Al presionar el botón 'Generar mensaje', no ocurre ningún submit ni recarga de página (verificar en consola que no hay navegación). La validación de campos obligatorios se implementará en la Tarea 15."
```

**C5 — Crear tarea para advertencia de mensaje largo**

Agregar en TASKS.md (o incorporar en la Tarea 10 o Tarea 15) la validación:

> Después de construir el mensaje, verificar que `encodeURIComponent(mensaje).length` no supere 2000 caracteres (límite seguro para URLs de WhatsApp). Si supera, mostrar un aviso visible en la UI informando que el mensaje es muy largo y que podría truncarse en WhatsApp.

---

### RECOMENDADAS — Mejoran la claridad sin ser bloqueantes

**R1 — Estado inicial de los botones "Copiar" y "Enviar a cliente"**
Agregar en TASKS.md tarea 04 que ambos botones se crean con `disabled` por defecto, y en TASKS.md tarea 10 que se habilitan tras una generación exitosa.

**R2 — Declarar la lista de indicadores de género como exhaustiva**
Agregar en TASKS.md tarea 09: "Esta lista es exhaustiva y cerrada. Solo estas 5 palabras (dama, mujer, femenino, hombre, caballero) activan el reconocimiento de género. Otras palabras como 'señora', 'masculino' o abreviaciones NO se reconocen como indicadores."

**R3 — Agregar onerror en la imagen del producto**
En TASKS.md tarea 11 agregar criterio: "Si la imagen del catálogo no carga (error HTTP), el elemento `<img id='img-producto'>` debe mostrar automáticamente `img/placeholder.png` mediante un handler `onerror`."

**R4 — Ajustar el breakpoint responsive**
En TASKS.md tarea 17 y PLAN.md sección 8, cambiar el breakpoint de "≥ 640px" a "≥ 768px" para el layout lado a lado, evitando conflicto con el `max-width: 640px` del contenedor.

**R5 — Aclarar comportamiento del teléfono de 11 dígitos**
En TASKS.md tarea 15 Nivel 2, cambiar "menos de 10 dígitos útiles" por "el número normalizado no tiene exactamente 10 ni 12 dígitos (en el caso de 12, debe comenzar con 57)".

**R6 — Instrucción visible de "arrastra la foto"**
En TASKS.md tarea 13, agregar que se debe mostrar una nota visible junto al botón: "Se descargará la foto del producto. Arrástrala al chat de WhatsApp manualmente."

**R7 — Eliminar lenguaje ambiguo en PLAN.md sección 8**
Cambiar "pueden disponerse lado a lado" por "se disponen lado a lado" para que sea coherente con el criterio de aceptación de la Tarea 17.

---

## Veredicto Final

# REQUIERE AJUSTES

Hay **5 problemas bloqueantes** que el implementador no puede resolver por su cuenta sin adivinar o contradecir el plan. Específicamente:

1. No sabe qué número mostrar en el mensaje al cliente (10 vs 12 dígitos).
2. No sabe cómo definir las claves del catálogo (minúsculas vs capitalización original).
3. No sabe si implementar el datalist en la Tarea 06 o en la Tarea 16 (o en ambas, duplicando código).
4. El criterio de validación nativa de la Tarea 03 es técnicamente imposible de cumplir con `type="button"`.
5. No hay tarea para implementar la advertencia de mensaje largo, que está prometida en los riesgos del plan.

Las correcciones C1–C5 son pequeñas (ninguna requiere reescribir el plan), pero son necesarias para que el implementador pueda trabajar sin tomar decisiones de arquitectura o negocio por su cuenta.

Una vez aplicadas las correcciones críticas C1–C5, el plan está en muy buen estado general: la arquitectura es sólida, las tareas están bien secuenciadas, la mayoría de los criterios son verificables, y el stack elegido es el correcto para el caso de uso.
