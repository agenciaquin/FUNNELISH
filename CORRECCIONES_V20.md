# CORRECCIONES V20 — WhatsApp siempre en la misma pestaña

## Archivo a modificar: `app.js`

### Buscar:
```javascript
  window.open(url, "_blank");
```

### Reemplazar por:
```javascript
  window.open(url, "whatsapp_web");
```

**Por qué funciona:** al darle un nombre fijo `"whatsapp_web"` a la ventana, el navegador reutiliza esa misma pestaña en cada clic en lugar de abrir una nueva.
