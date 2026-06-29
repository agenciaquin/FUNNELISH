# CORRECCIONES V14 — Restaurar carga de archivo (versión que funcionaba)

## CAMBIO 1 — `index.html`: Restaurar input hidden original

### Buscar:

```html
        <input type="file" id="input-excel" accept=".xlsx,.xls,.csv" style="display:none">
        <button type="button" id="btn-subir">Seleccionar archivo</button>
```

### Reemplazar por:

```html
        <input type="file" id="input-excel" accept=".xlsx,.xls,.csv" hidden>
        <button type="button" id="btn-subir">Seleccionar archivo</button>
```

---

## CAMBIO 2 — `app.js`: Restaurar handlers de clic originales (versión funcional)

### Buscar todo este bloque:

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

### Reemplazar por:

```javascript
  btnSubir.addEventListener("click", () => inputFile.click());
  dropZone.addEventListener("click", (e) => {
    if (e.target !== btnSubir) inputFile.click();
  });
```
