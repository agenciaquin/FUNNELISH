# CORRECCIONES V12 — Fix clic seleccionar archivo + Fix correo cliente

## CAMBIO 1 — `index.html`: Convertir botón en label (abre archivos de forma nativa)

### Buscar:

```html
        <button type="button" id="btn-subir">Seleccionar archivo</button>
```

### Reemplazar por:

```html
        <label for="input-excel" id="btn-subir">Seleccionar archivo</label>
```

---

## CAMBIO 2 — `app.js`: Actualizar initUpload para que funcione con el label

### Buscar:

```javascript
  btnSubir.addEventListener("click", (e) => {
    e.stopPropagation();
    inputFile.click();
  });
  dropZone.addEventListener("click", (e) => {
    if (e.target === btnSubir) return;
    inputFile.click();
  });
```

### Reemplazar por:

```javascript
  // El label #btn-subir abre el explorador de archivos de forma nativa (sin JS)
  // Solo necesitamos el clic en la zona para clicks fuera del label
  dropZone.addEventListener("click", (e) => {
    if (e.target === btnSubir || e.target === inputFile) return;
    inputFile.click();
  });
```

---

## CAMBIO 3 — `app.js`: Fix correo cliente (saltar columnas vacías)

### Buscar:

```javascript
      if (rowLower[alias] !== undefined) return String(rowLower[alias]).trim();
```

### Reemplazar por:

```javascript
      const val = String(rowLower[alias] ?? "").trim();
      if (rowLower[alias] !== undefined && val !== "") return val;
```
