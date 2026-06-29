# CORRECCIONES V9 — Eliminar emojis del mensaje WhatsApp

## Archivo a modificar: `app.js`

### Buscar:

```javascript
function generarMensaje(p) {
  // Escape sequences ASCII puras — nunca se corrompen en ningún encoding
  var SMILE    = "😊"; // 😊
  var TRUCK    = "🚚"; // 🚚
  var SPARKLES = "✨";        // ✨
  var CHECK    = "✅";        // ✅
  var PENCIL   = "✏️"; // ✏️

  return (
    "Hola " + SMILE + " te saluda Lilibeth. Tu pedido ya está listo para despacho " + TRUCK + SPARKLES + " Por favor confirma que estos datos estén correctos:\n" +
    "Nombre: "              + p.nombre          + "\n" +
    "Teléfono: "       + p.telefonoMensaje + "\n" +
    "Dirección: "      + p.direccion       + "\n" +
    "Ciudad: "              + p.ciudad          + "\n" +
    "Departamento: "        + p.departamento    + "\n" +
    "Correo: "              + p.correo          + "\n" +
    "Talla: "               + p.talla           + "\n" +
    "Nombre del Producto: " + p.producto        + "\n" +
    "Valor a pagar: "       + p.valor           + "\n" +
    CHECK + " Si todo está correcto responde: CONFIRMO\n" +
    PENCIL + " Si deseas corregir algún dato, escríbelo en este chat.\n" +
    TRUCK + " Una vez confirmado, tu pedido será despachado en las próximas 24 horas."
  );
}
```

### Reemplazar por:

```javascript
function generarMensaje(p) {
  return (
    "Hola, te saluda Lilibeth. Tu pedido ya está listo para despacho. Por favor confirma que estos datos estén correctos:\n" +
    "Nombre: "              + p.nombre          + "\n" +
    "Teléfono: "            + p.telefonoMensaje + "\n" +
    "Dirección: "           + p.direccion       + "\n" +
    "Ciudad: "              + p.ciudad          + "\n" +
    "Departamento: "        + p.departamento    + "\n" +
    "Correo: "              + p.correo          + "\n" +
    "Talla: "               + p.talla           + "\n" +
    "Nombre del Producto: " + p.producto        + "\n" +
    "Valor a pagar: "       + p.valor           + "\n" +
    "Si todo está correcto responde: CONFIRMO\n" +
    "Si deseas corregir algún dato, escríbelo en este chat.\n" +
    "Una vez confirmado, tu pedido será despachado en las próximas 24 horas."
  );
}
```
