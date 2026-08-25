# Prompt — Editar el CHECKOUT desde la pestaña del teléfono

Pega este prompt en el chat de tu otra app para replicar el comportamiento:
al tocar la pestaña **"Checkout"** del teléfono, el editor del centro muestra SOLO
lo del checkout (Productos, Textos y ajustes, Color) y oculta lo demás.

```
En el editor de embudos quiero que, al tocar la pestaña "Checkout" del teléfono de
la derecha, el editor del CENTRO cambie para mostrar SOLO lo relacionado al checkout,
y al volver a "Inicio" vuelva a lo normal. Detalle:

CONTEXTO
- El teléfono de vista previa (componente VistaPreviaEmbudo) tiene dos pestañas
  arriba: "🏠 Inicio" y "🛒 Checkout", con un estado interno `modo`.
- El editor del centro (componente EmbudosPanel) tiene:
  * un aviso "👉 Toca un bloque en el teléfono para editarlo…" cuando no hay bloque
    seleccionado,
  * un botón "⚙️ Contenido y ajustes" que despliega (estado `verContenido`) el
    formulario completo con estas secciones EN ORDEN:
    1) "Fotos" (portada/galería/banners/miniatura)
    2) "Productos del checkout" (productos, colores, tallas, precio, packs)
    3) "Textos y ajustes" (características, tallas, contador, personas, WhatsApp bot, IDs)
    4) "Color de la página"
    5) (otras: música, píxeles, diseño por bloques)

1) AVISAR EL CAMBIO DE PESTAÑA
   En VistaPreviaEmbudo agrega una prop opcional `onModoChange?: (m: 'inicio'|'checkout') => void`.
   Envuelve el setState del modo para que también llame onModoChange:
     const [modo, setModoState] = useState<'inicio'|'checkout'>('inicio');
     const setModo = (m) => { setModoState(m); onModoChange?.(m); };
   Los botones de las pestañas deben usar setModo('inicio') / setModo('checkout').

2) ESTADO EN EL EDITOR
   En EmbudosPanel agrega un estado `checkoutModo` (boolean, default false).
   Al renderizar la vista previa, pásale:
     onModoChange={(m) => {
       if (m === 'checkout') { setBloqueSelId(null); setVerContenido(true); setCheckoutModo(true); }
       else { setCheckoutModo(false); }
     }}

3) QUÉ SE OCULTA Y QUÉ SE MUESTRA EN MODO CHECKOUT
   - Muestra un aviso arriba: "🛒 Editando el CHECKOUT · aquí armas los productos,
     colores, tallas y precio que el cliente elige." (solo si checkoutModo).
   - Oculta el aviso "Toca un bloque…": condición `{!bloqueSel && !checkoutModo && (...)}`.
   - Oculta el botón "⚙️ Contenido y ajustes": envuélvelo en `{!checkoutModo && (...)}`.
   - Abre el formulario con la condición `{(verContenido || checkoutModo) && (<> ... </>)}`.
   - Oculta SOLO la sección "Fotos": envuélvela en `{!checkoutModo && ( <section>Fotos…</section> )}`.
   - DEJA VISIBLES: "Productos del checkout", "Textos y ajustes" y "Color de la página"
     (y las demás secciones normales). NO las ocultes.

RESULTADO ESPERADO
   - En "Inicio": todo igual que antes (aviso de tocar bloque + botón Contenido y ajustes).
   - En "Checkout": desaparecen el aviso de tocar bloque, el botón de contenido y la
     sección Fotos; y quedan visibles Productos del checkout + Textos y ajustes + Color.

Verifica con tsc --noEmit y despliega. No toques la lógica de guardado ni el envío
del pedido; esto es solo mostrar/ocultar secciones del editor.
```

> Nota: es solo UI del editor (mostrar/ocultar). No cambia cómo se guarda el embudo
> ni cómo se registra el pedido.
