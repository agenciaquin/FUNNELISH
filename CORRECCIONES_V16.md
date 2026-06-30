# CORRECCIONES V16 — WhatsApp abre directo sin ventana intermedia

## Archivo a modificar: `app.js`

### Buscar:

```javascript
  const url = "https://wa.me/" + p.telefonoWhatsApp + "?text=" + encodeURIComponent(generarMensaje(p));
```

### Reemplazar por:

```javascript
  const url = "https://web.whatsapp.com/send?phone=" + p.telefonoWhatsApp + "&text=" + encodeURIComponent(generarMensaje(p));
```

---

**Por qué funciona:** `web.whatsapp.com/send` abre WhatsApp Web directamente en el navegador con el mensaje prellenado, sin mostrar la ventana "¿Abrir WhatsApp?".
