---
tipo: modulo
titulo: Herramienta original ConfirmaYa (legado, estática)
tags: [legado, confirmaya, github-pages]
actualizado: 2026-09-04
estado: vigente
archivos: ["index.html", "app.js", "catalogo.js", "styles.css"]
---

# ConfirmaYa original (legado)

Antes de QuinChat existió —y sigue en la raíz del repo— la herramienta interna estática del equipo
KLIXMANT (Josué y Mallerlis): genera el mensaje de confirmación y busca la foto del producto para
mandar por WhatsApp a mano.

- Stack: **HTML + CSS + JS puro**, sin frameworks, sin build, sin backend, sin login.
- Archivos: `index.html`, `styles.css`, `app.js`, `catalogo.js`, carpeta `img/`.
- Despliegue: **GitHub Pages desde `master`**. Requiere push **y** subir la versión para salir en
  vivo.
- Identidad: negro, dorado y blanco (streetwear premium) — distinta de [[identidad-de-marca]].

## Plantilla exacta del mensaje

Sin líneas en blanco entre campos:

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

1. Descarga la foto del producto al equipo.
2. Abre `https://wa.me/57{telefono}?text={mensaje_codificado}`.
3. WhatsApp **no** permite adjuntar foto por URL: el usuario arrastra la foto descargada al chat.

Reglas de normalización compartidas → [[confirmacion-de-pedidos]].
Lo que automatiza esto hoy es QUINO → [[bots-quino]].
