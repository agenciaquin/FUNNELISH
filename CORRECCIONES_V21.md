# CORRECCIONES V21 — Abrir WhatsApp app directamente

## Archivo a modificar: `app.js`

### Buscar:
```javascript
  const url = "https://web.whatsapp.com/send?phone=" + p.telefonoWhatsApp + "&text=" + encodeURIComponent(generarMensaje(p));
  window.open(url, "whatsapp_web");
```

### Reemplazar por:
```javascript
  const url = "whatsapp://send?phone=" + p.telefonoWhatsApp + "&text=" + encodeURIComponent(generarMensaje(p));
  window.open(url, "_self");
```

**Por qué funciona:** `whatsapp://` es el protocolo nativo que el sistema operativo reconoce y abre directamente la aplicación de escritorio de WhatsApp, sin pasar por el navegador.
