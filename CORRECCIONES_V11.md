# CORRECCIONES V11 — Fix correo cliente (Optin Email no se leía)

## Archivo a modificar: `app.js`

### Problema
El CSV de Funnelish tiene columna `Payer Email` (vacía) antes que `Optin Email` (con el correo real).
El código encontraba `Payer Email` vacío, devolvía `""` y usaba el correo por defecto sin llegar a revisar `Optin Email`.

### Buscar (dentro de la función `normalizarFila`):

```javascript
      if (rowLower[alias] !== undefined) return String(rowLower[alias]).trim();
```

### Reemplazar por:

```javascript
      const val = String(rowLower[alias] ?? "").trim();
      if (rowLower[alias] !== undefined && val !== "") return val;
```
