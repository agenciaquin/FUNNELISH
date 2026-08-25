# Revertir el "checkout editable" — dejar el checkout fijo como antes

Pega este prompt en tu otra app para **quitar la edición del checkout** y dejarlo
igual que antes (textos, sellos y botón fijos). No toca la lógica de envío del pedido.

```
Quita la función de "checkout editable" y deja el checkout con sus textos, sellos y
botón FIJOS como estaban antes (revertir, sin tocar la lógica de envío del pedido):

1. En el checkout PRO (componente CheckoutPro):
   - Elimina las variables que leían layout.checkout (ck, ckTitulo, ckSub,
     ckTituloDatos, ckBotonTexto, ckBotonColor, ckSellos, ckMostrarSellos).
   - Vuelve a poner FIJOS:
     * Sellos de confianza: 🛡️ "Pagas al recibir", 🔁 "Cambios gratis", 🚚 "Envío gratis".
     * Título: "Arma tu pedido" y subtítulo "Sin pagar nada ahora · Confirmas por WhatsApp".
     * Encabezado de datos: "Datos para el envío".
     * Botón: color = acento del embudo y texto = "COMPRAR CONTRA ENTREGA · {precio}".

2. En el checkout clásico (componente FormularioPedido):
   - Elimina las variables ck (ckBotonTexto, ckBotonColor, ckTituloDatos).
   - Vuelve a poner FIJOS:
     * Encabezado de datos: "✅ DATOS PARA EL ENVÍO:".
     * Botón (principal y flotante): color = acento del embudo y texto = "COMPLETAR MI PEDIDO".

3. En la vista previa del panel (VistaPreviaEmbudo):
   - Elimina el panel "🛒 Editar checkout" que aparecía en la pestaña Checkout.
   - Quita las variables ck/setCk/ckSellos/setSello y la prop ck que le pasabas a
     CheckoutPreview.
   - En CheckoutPreview vuelve a los textos fijos: "Completa tus datos 👇" y el botón
     "✅ COMPLETAR MI PEDIDO"; quita los sellos/subtítulo/tituloDatos dinámicos.
   - Limpia los imports que quedaron sin usar (CHECKOUT_DEFAULT, PALETA_COLORES si ya
     no se usan).

4. Puedes dejar el objeto CHECKOUT_DEFAULT en lib/bloques.ts (no molesta) o borrarlo.
   El campo layout.checkout queda sin efecto (retrocompatible: no rompe nada).

5. NO toques el resto: los bloques nuevos, el botón MÁS VENDIDO, remarketing, etc.
   siguen igual. Verifica con tsc --noEmit y despliega.
```

> Nota: esto revierte SOLO el checkout. El endpoint que guarda el pedido y el botón
> de enviar no se modifican, así que las ventas siguen registrándose igual.
