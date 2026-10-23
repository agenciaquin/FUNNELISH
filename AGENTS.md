# ConfirmaYa — Contexto del Proyecto

## Qué es
Herramienta web interna para el equipo de KLIXMANT (Josué y Mallerlis) que automatiza la generación del mensaje de confirmación de pedidos y la búsqueda de la foto del producto para enviar por WhatsApp.

## Identidad visual
Negro, dorado y blanco. Diseño limpio, moderno, tipo streetwear premium.

## Stack obligatorio
- HTML + CSS + JavaScript puro. Sin frameworks, sin build, sin backend, sin login.
- Desplegable directo en GitHub Pages.
- Archivos: `index.html`, `styles.css`, `app.js`, `catalogo.js`, carpeta `/img`.

## Reglas de negocio
- Si el teléfono tiene prefijo `+57`, eliminarlo (dejar solo 10 dígitos).
- Si no hay correo → usar `Gerenciaquin7@gmail.com`.
- Si no hay valor a pagar → usar `$130.000`.
- Si la talla no especifica género → asumir "Hombre".

## Plantilla del mensaje (EXACTA, sin líneas en blanco entre campos)
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

## Botón "Enviar a cliente"
- Descarga la foto del producto al equipo.
- Abre WhatsApp con `https://wa.me/57{telefono}?text={mensaje_codificado}`.
- WhatsApp NO permite adjuntar foto por URL — el usuario arrastra la foto descargada al chat manualmente.

## Flujo de agentes
1. **planeador** → produce PLAN.md + TASKS.md → humano aprueba.
2. **implementador** → implementa tarea por tarea con commits.
3. **auditor** → revisa y produce AUDIT.md (APROBADO o REQUIERE CORRECCIONES).
4. Si hay fallos → implementador corrige → auditor revuelve a revisar.
