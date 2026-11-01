# PLAN — Ventas Vendedores (QuinChat)

Estado: **IMPLEMENTADO COMO PRUEBA (01-nov-2026), interruptor APAGADO.**
Decisiones del dueño: D2 = **B (QuinChat sube directo a Effi)**; todo el módulo junto y apagable sin afectar nada más.
Pendiente: documentación + credenciales de la API de Effi (hoy la subida es simulación), número de prueba, confirmar D3.
Tablas creadas: vv_cat_productos, vv_cat_variantes, vv_cat_sync, vv_ventas, vv_items, vv_eventos (las klixmant_* del contrato del reporte NO se tocaron).
Fecha: 01-nov-2026 · App afectada: `quinchat/` (pedido.klixmant.shop). `quin-comercial/` no se toca.

Regla madre: **el WhatsApp de clientes sigue igual.** Todo lo nuevo corre solo cuando quien
escribe es un vendedor del equipo, y además detrás de un interruptor que arranca apagado.

---

## 1. Auditoría (Fase 1) — lo que hay hoy

| Tema | Hallazgo | Consecuencia |
|---|---|---|
| Cómo se reconoce a un vendedor | Lista fija de 13 números en `lib/vendedores.ts` (`esVendedor`). La etiqueta `VENDEDOR` la pone el código al chat; no es lo que decide. | La identificación debe seguir por la lista (una etiqueta la puede poner cualquiera en el panel). Ver decisión D1. |
| Qué hace hoy el bot con un vendedor | `atenderVendedor()` en el webhook: es **supervisor**. Toma "cuántas ventas llevas", cronometra el check-in, ranking, tips. | El flujo nuevo debe convivir: un número suelto sigue siendo reporte; un pedido (foto, dirección, celular, talla, valor) va al flujo nuevo. |
| Fotos que manda un vendedor | Hoy se guardan como el texto `[image]`; **no se descargan**. | Hay que descargar la foto (Meta) y guardarla (Storage/R2) como evidencia. |
| IA con imágenes | `lib/quinchat/claude.ts` ya acepta fotos (base64). | El reconocimiento por imagen se puede hacer con lo que ya existe. |
| Catálogo Klixmant | API pública `klixmsoft-production.up.railway.app/api/catalogo/publico` (sin clave, 5,9 MB): 355 catálogos (116 PERSONALIZADO), 1.952 productos, 22.389 variantes (color + talla + SKU + id). **Sin precio y sin inventario** (`totalStock: 0`). | Tablas `klixmant_catalogos` / `klixmant_variantes` **ya existen y están vacías**. Falta el llenado. |
| Cola de preventas | **No existe en QuinChat.** Existe en **Klixmsoft** (Panel Empleado → Cola de Preventas), y Klixmsoft es quien ya sube a Effi (remisión, "En Effi", Novedades). | Decisión clave D2: no duplicar la cola ni la subida a Effi. |
| API de Effi | **No hay ninguna conexión** de QuinChat con Effi (solo se cargan guías a mano en `effi_guias`). | Sin documentación ni credenciales no se puede integrar directo. |
| HTML "Cola de Preventas Klixmant" | No está en la carpeta del proyecto. | Se replica con las 2 capturas; si me pasas el HTML, mejor. |

---

## 2. Decisiones del dueño (antes de programar)

- **D1 · ¿Quién cuenta como vendedor?** Recomendado: la lista de `lib/vendedores.ts` (hoy 13). Si entra uno nuevo, se agrega ahí. La etiqueta `VENDEDOR` sigue solo como marca visual.
- **D2 · ¿A dónde va la venta confirmada?** (la más importante)
  - **A (recomendada):** QuinChat organiza y confirma la venta, y la **entrega a la Cola de Preventas de Klixmsoft**, que ya sabe subir a Effi. Una sola cola, una sola subida, cero remisiones dobles. Requiere que Klixmsoft tenga (o exponga) una ruta para **crear una preventa** con su clave, y una para **consultar su estado/remisión**.
  - **B:** QuinChat tiene su propia cola y sube **directo a Effi**. Duplica lo que Klixmsoft ya hace y abre la puerta a remisiones dobles. Requiere documentación y credenciales de la API de Effi.
- **D3 · El número de variante.** ¿El `id` de variante del catálogo público es el mismo que va en "Observación concepto" de Effi? Lo confirma quien maneja Klixmsoft.
- **D4 · Precio.** El catálogo no trae precio: se usa el **valor que escribe el vendedor**. Si no lo escribe, el bot lo pide (no se inventa).
- **D5 · Envío a la cola.** ¿Automático al confirmar el vendedor, o con aprobación humana en el panel? Recomendado: **aprobación humana** las primeras 2 semanas.
- **D6 · Vendedor de prueba.** Un número para arrancar (el tuyo o uno del equipo). El resto sigue con el flujo actual hasta que lo apruebes.

---

## 3. Fases

Cada fase se puede publicar sola, sin romper lo anterior.

### Fase A — Copia del catálogo Klixmant (bajo riesgo)
- `lib/catalogo-klixmant.ts`: descarga la API pública, valida la forma, excluye `PERSONALIZADO ###`, escribe en `klixmant_catalogos` y `klixmant_variantes` (upsert). Lo que deja de venir se marca `activo=false`; **nunca se borra**.
- Si la API falla o viene rara (menos del 50 % de lo que había), **no toca la copia** y deja registro del error.
- Cron diario (cron-job.org, `CRON_SECRET`) + botón «Actualizar catálogo» en el panel (Catálogos).
- Tabla nueva `klixmant_sync` (fecha, conteos, cambios, error).
- Falta en las tablas de hoy: id de producto, género y foto pequeña → columnas nuevas, aditivas (ver §4).
- **Comprobación:** conteos iguales a la API (355 − 116 personalizados, etc.), y la segunda corrida no cambia nada.

### Fase B — Tablas de la venta (aditivo)
- `vv_ventas` (una por venta): vendedor, cliente (nombre, celular, **identificación aparte**), departamento, municipio, dirección, barrio, complemento, referencia, transportadora, total, tipo de pago, abono, estado, origen, `idem_key` único, id/estado externo (remisión).
- `vv_items` (una por prenda): catálogo, producto, variante, SKU, referencia, color, talla, género, cantidad, precio, foto oficial, foto del vendedor, confianza del reconocimiento.
- `vv_eventos` (trazabilidad): quién, qué cambió, antes/después, motivo, validaciones, errores, reintentos.
- Estados internos → pestañas: Recibida / Interpretando / Incompleta / Producto sin identificar / Esperando confirmación → **Pendientes**; Confirmada / Lista → **Por atender**; Enviando → **En proceso**; Registrada (con remisión) → **Procesadas**; Error de integración → **Errores**; Revisión humana → **Escaladas**; Cancelada → **Canceladas**.

### Fase C — Panel «Ventas Vendedores» (solo lectura + edición de preventas)
- Nueva entrada en el menú. Réplica de la Cola de Preventas de Klixmsoft: 4 indicadores, pestañas con contador y colores, buscador con botón dorado, «Filtros y orden» (fechas, orden, vendedor, estado, ciudad, tipo de prenda), tarjetas en 2 columnas con foto real, panel lateral derecho de detalle (Cliente / Dirección / Prendas / Pago / Trazabilidad).
- Edición solo si no está registrada; al cambiar talla/color/producto se recalcula la variante real. Si ya tiene remisión: aviso azul y botón Novedades.
- Botón WhatsApp → abre el chat dentro de QuinChat (como en Pedidos).
- Sin datos de ejemplo en producción: arranca vacío.

### Fase D — Recepción por WhatsApp (detrás del interruptor, solo el vendedor de prueba)
- Interruptor `ajustes_bot.ventas_vendedores = {activo:false, numeros:[...]}`.
- Dentro de `atenderVendedor`, **antes** de leer el número del reporte: si el lote trae foto o datos de pedido → flujo nuevo; si es un número suelto → flujo de reporte de siempre.
- Borrador abierto por vendedor: los mensajes seguidos se suman al mismo borrador (no se crean dos ventas). Se cierra al confirmar, cancelar o tras X horas sin actividad. "Nueva venta" abre otro.
- Descarga de fotos y guardado como evidencia.
- IA (Claude) arma la venta y dice qué falta. Solo se piden los datos que faltan.
- Resumen de confirmación con la foto oficial; el vendedor responde **CONFIRMO**, corrige, agrega prendas o **CANCELAR**.

### Fase E — Reconocimiento del producto
1. Filtro por texto en la copia local (marca/diseño, tipo, color) → hasta 6 candidatos.
2. Claude compara la foto del vendedor con las fotos oficiales de esos candidatos.
3. Si la confianza es alta y hay una sola opción, se elige; si hay varias parecidas, el bot pregunta con las opciones numeradas.
4. Solo se aceptan talla y color que **existan** en las variantes de ese producto; si no existe, se avisa.

### Fase F — Entrega a la cola (según D2)
- **Si A:** cliente de la API de Klixmsoft para crear la preventa, con `idem_key` y con consulta de estado antes de reintentar. Se guarda la remisión que devuelva.
- **Si B:** cliente de la API de Effi con las mismas protecciones.
- En ambos casos: **ningún envío real sin tu autorización**; primero se prueba en modo «simulación» (arma la solicitud y la guarda, no la manda).

### Fase G — Pruebas
- Los 20 escenarios del pedido, con el número de prueba y la simulación de envío.
- Escritorio y celular.

---

## 4. SQL en borrador (no ejecutable todavía; lo revisa el guardián y lo pega el dueño)

```
-- Fase A
alter table klixmant_catalogos add column if not exists personalizado boolean not null default false;
alter table klixmant_variantes add column if not exists id_producto integer, add column if not exists id_item integer,
  add column if not exists genero text, add column if not exists foto_thumb text;
create table if not exists klixmant_sync (id bigserial primary key, inicio timestamptz default now(),
  fin timestamptz, ok boolean, catalogos int, variantes int, nuevos int, cambiados int, inactivados int, error text);
-- Fase B: vv_ventas, vv_items, vv_eventos (con RLS activa y sin permisos para anon/authenticated)
```

**Reversa:** las columnas nuevas y las tablas `vv_*` / `klixmant_sync` se pueden borrar sin tocar nada existente.
**Interruptor:** `ventas_vendedores.activo=false` apaga el flujo nuevo al instante; los vendedores vuelven al reporte de siempre.

---

## 5. Riesgos

- **Confundir un reporte con una venta.** Se mitiga: número suelto = reporte; venta = foto o datos de cliente.
- **Elegir mal el producto.** Se mitiga: candidatos por texto + foto + pregunta si hay duda; nunca se elige solo por el logo.
- **Remisión doble en Effi.** Se mitiga con D2-A + `idem_key` + consultar antes de reintentar.
- **Costo de IA por foto.** Unas pocas llamadas por venta (Haiku para texto, comparación de fotos solo con los candidatos).
- **La API pública de Klixmsoft cambia.** La copia local sigue funcionando con la última copia buena.
