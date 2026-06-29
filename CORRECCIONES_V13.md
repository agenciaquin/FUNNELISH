# CORRECCIONES V13 — Fix carga de archivo Excel/CSV

## CAMBIO 1 — `index.html`: Volver a button + quitar hidden del input

### Buscar:

```html
        <input type="file" id="input-excel" accept=".xlsx,.xls,.csv" hidden>
        <label for="input-excel" id="btn-subir">Seleccionar archivo</label>
```

### Reemplazar por:

```html
        <input type="file" id="input-excel" accept=".xlsx,.xls,.csv" style="display:none">
        <button type="button" id="btn-subir">Seleccionar archivo</button>
```

---

## CAMBIO 2 — `app.js`: Reescribir handlers de clic en initUpload

### Buscar:

```javascript
  // El label #btn-subir abre el explorador de archivos de forma nativa (sin JS)
  // Solo necesitamos el clic en la zona para clicks fuera del label
  dropZone.addEventListener("click", (e) => {
    if (e.target === btnSubir || e.target === inputFile) return;
    inputFile.click();
  });
```

### Reemplazar por:

```javascript
  function abrirExplorador() {
    inputFile.value = "";   // permite seleccionar el mismo archivo dos veces
    inputFile.click();
  }

  btnSubir.addEventListener("click", function(e) {
    e.stopPropagation();
    abrirExplorador();
  });

  dropZone.addEventListener("click", function(e) {
    if (e.target === btnSubir || e.target === inputFile) return;
    abrirExplorador();
  });
```
