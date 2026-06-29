# CORRECCIONES V7 — Fix emojis WhatsApp

## Archivo a modificar: `app.js`

### Problema
Los emojis del mensaje aparecen como `◆` o `?` en WhatsApp porque los caracteres literales se corrompen al copiar/pegar o al codificar la URL.

### Solución
Reemplazar el bloque de variables emoji con **escape sequences ASCII puras** (`\uXXXX`). El intérprete de JavaScript las convierte a los emojis correctos en tiempo de ejecución, sin riesgo de corrupción.

---

### Buscar este bloque en `generarMensaje`:

```javascript
  var SMILE    = "😊"; // 😊
  var TRUCK    = "🚚"; // 🚚
  var SPARKLES = "✨";       // ✨
  var CHECK    = "✅";       // ✅
  var PENCIL   = "✏️"; // ✏️
```

### Reemplazar por:

```javascript
  // Escape sequences ASCII puras — nunca se corrompen en ningún encoding
  var SMILE    = "😊"; // 😊
  var TRUCK    = "🚚"; // 🚚
  var SPARKLES = "✨";        // ✨
  var CHECK    = "✅";        // ✅
  var PENCIL   = "✏️"; // ✏️
```

---

## Nota
Esta corrección ya fue aplicada directamente al archivo `app.js` en la carpeta FUNNELISH.  
Solo hace falta hacer **commit + push a GitHub** para que Vercel la despliegue automáticamente.
