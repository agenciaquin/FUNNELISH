# PLAN — Subir las ventas de QuinChat a Effi como REMISIONES DE VENTA

Estado: **PLANEACIÓN** (07-nov-2026). Nada construido, nada enviado a Effi.
Regla vigente: la integración con Effi es **solo lectura** hasta que el dueño autorice escribir.
Fuente: Documentación API de Effi (Integraciones → Documentación API), leída el 07-nov-2026.

---

## 1. Lo que dice la API de Effi (confirmado)

- `POST https://effi.com.co/api/remision_v` — mismas reglas que el formulario web. Effi calcula los totales,
  descuenta inventario y valida stock y precio mínimo. Respuesta 201:
  `sucursal, id, prefijo, id_transaccion (ej. «RV-1234»), total, fecha_trans`.
- **Anti-duplicado nativo:** `idempotency_key` obligatorio (8–36 caracteres). Si se repite → **409** y no crea otra.
  Usaremos `qc-<id de la venta>`: aunque se oprima dos veces, Effi crea una sola.
- Límite: 600 peticiones/min por clave. Clave Bearer, vigencia 360 días.
- La clave debe tener permiso **«crear» en Notas de remisión de venta** (y crear clientes, ver abajo).

### Campos de la remisión y de dónde sale cada uno

| Campo Effi | Obligatorio | Valor que pondría QuinChat |
|---|---|---|
| `idempotency_key` | Sí | `qc-<id venta>` |
| `sucursal` | Sí | 1 (Principal) — confirmar id con `GET api/sucursal` |
| `bodega` | Sí | 1 (Bucaramanga) — confirmar con `GET api/bodega` |
| `centro_costos` | Sí | el que usan hoy — `GET api/centro_costos` |
| `fecha_entrega` | Sí | día de la confirmación (YYYY-MM-DD) |
| `divisa` / `trm` | Sí | `COP` / `1` |
| `cliente` | Sí | **código del tercero** en Effi (ver §2) |
| `id_pais_cliente`, `id_provincia_cliente`, `id_ciudad_cliente` | — | ids de Effi de Colombia / depto / municipio (copia de `api/ciudad`) |
| `direccion_cliente` | — | dirección + barrio de la venta (Effi reutiliza la dirección si ya existe) |
| `referencia_cliente` | — | apto / torre / indicaciones |
| `vendedor` | si la empresa lo exige | código del empleado (Lilibeth, etc.) — `GET api/empleado` |
| `ubicacion_venta` | — | `GET api/ubicacion_venta` |
| `articulo[]` | Sí | id del artículo en Effi — **decisión del dueño** |
| `descripcion[]` | Sí | nombre del producto |
| `cantidad[]` | Sí | prendas (debe haber stock en la bodega) |
| `precio[]` | Sí | **precio unitario SIN impuestos** (no menor al mínimo del artículo) |
| `impuestos` | — | `{ "1": [id IVA] }` si aplica — `GET api/impuesto` |
| `observacion_concepto[]` | — | **código de la variante KlixmSoft** (producto + color + talla), como hoy a mano |
| `t_forma_pago[]` / `valor_forma_pago[]` | Sí | la suma debe ser **igual al total** que calcula Effi |
| `medio_pago[]` / `valor_medio_pago[]` | si la forma es de contado | p. ej. el abono por transferencia |
| `observacion` | según config. | teléfono + «QuinChat #id» (máx. 255) |

**No hay transportadora en la remisión.** La transportadora va en la **guía de transporte** (otro servicio:
`POST api/guia_transporte`). Effi además publica su propia **cobertura por ciudad**
(`GET api/cobertura_transportadora`, por ciudad origen → destino, con «admite recaudo»), que podría reemplazar
la consulta a `kls-app/transportadoras`. Se deja para una fase posterior.

## 2. El cliente en Effi

- Buscar primero: `GET api/cliente` por `numero` (cédula exacta), o por `celular` / `whatsapp` (coincidencia parcial).
- Si no existe: `POST api/cliente`. Obligatorios: **`t_dni` (2 = cédula), `numero`, `nombre`, `direcciones`**.
  Si la cédula ya existe como cliente → 400 (por eso se busca antes).
- ⚠️ **Hueco:** para crear un cliente nuevo Effi pide **número de identificación**. Muchas ventas de QuinChat
  no tienen cédula.

## 2b. Respuestas del dueño (07-nov-2026)

- **Sin cédula → se usa el teléfono del cliente** como número de identificación.
- **El precio YA incluye IVA** (no se suma). En la API el precio va *sin* impuestos, así que QuinChat debe
  enviar la base (ej. 129.900 / 1,19) para que Effi recalcule y dé exacto el total. Equivale al botón
  «Recalcular precios antes de impuestos» del formulario. Hay que verificar el redondeo en la simulación.
- **Contraentrega = forma de pago «Contado a 1 día»**, por el total. Al ser de contado exige medio de pago
  (en el formulario sale la caja «QUIN JOSUE»).
- **La transportadora va en «Ubicación de venta»** (ids vistos: 32 CIUDAD BONITA CR, 33 CIUDAD BONITA SR,
  25 COORDINADORA CR, 24 COORDINADORA SR, 27 ENVIA CR, 26 ENVIA SR, 31 INTER PROPIO…; CR = con recaudo,
  SR = sin recaudo). QuinChat la elegirá por ciudad (tabla de transportadoras) + CR si hay que cobrar.
- Dirección del cliente: en el web es la lista de direcciones del cliente; por API se manda como datos.
- **Medio de pago** de «Contado a 1 día»: caja **QUIN** (predeterminada).
- **Centro de costos: AGENCIA QUIN.** **Vendedor:** el de quien hizo la venta (mapa vendedor QuinChat → empleado Effi).
- **Venta con abono:** dos formas de pago → «Contado a 1 día» por lo que falta cobrar + «1 - Contado» por lo
  ya abonado. **Siempre que haya algo por cobrar → transportadora CR (con recaudo).** Si no hay nada por
  cobrar → SR.

- **Lo ya pagado (abono o pago total):** forma «Contado» → medio **Transferencia bancaria**, caja **QUIN JOSUE**,
  cuenta bancaria **KLIXMANT SAS BAN…** (nombre completo e id se sacan con `GET api/medio_pago` / cuentas).
  Pago total = una sola forma «Contado» por el total → transportadora **SR**.

- **Artículo y observación (confirmado con captura y con la copia del catálogo):**
  - En KlixmSoft cada variante tiene **ID** (ej. `#7476`) y **SKU** (ej. `H R L NEGRO M ES`).
  - El **SKU es la prenda base** (buzo HRL negro talla M): la comparten 101 variantes de distintos estampados
    (América Línea, Tribal, Spider Man…). En Effi el artículo es esa prenda base: **Ref. = SKU sin espacios**
    (`HRLNEGROMES` → artículo 3839), con impuesto **1 - IVA 19%**.
  - El **ID de la variante** dice el **estampado + talla** → va en **Observación del concepto** (`7476`).
  - Por tanto QuinChat necesita, por cada prenda vendida, **el ID de la variante**; de ahí saca el SKU →
    `GET api/articulo?referencia=<SKU sin espacios>` → id del artículo.

### Reglas de armado (resumen)
```
total        = valor de la venta (IVA incluido)
abono        = abono recibido (0 si no hay)
por_cobrar   = total - abono
formas_pago  = [Contado a 1 día: por_cobrar → caja QUIN]  (si por_cobrar > 0)
             + [Contado: abono → Transferencia, caja QUIN JOSUE, cta KLIXMANT SAS]  (si abono > 0)
ubicacion    = transportadora de la ciudad + (por_cobrar > 0 ? CR : SR)
por prenda   = articulo: id Effi de Ref.(SKU sin espacios) · descripcion: SKU · cantidad 1
               observacion_concepto: ID variante KlixmSoft · impuestos: IVA 19%
precio[]     = precio con IVA / 1,19   → Effi recalcula y da el total exacto (verificar redondeo)
cliente      = buscar por cédula/celular; si no existe crear con cédula o, sin ella, con el teléfono
```

## 2c. DECISIÓN (07-nov-2026): el canal es el panel «Ventas Vendedores»

El vendedor manda la venta al bot por WhatsApp (foto con el **nombre del catálogo arriba** + datos) → el bot
reconoce el catálogo, busca en la copia de KlixmSoft la variante (catálogo + color + talla) → la venta queda
en el panel lista → **un clic «Subir a Effi»**.

Revisión de las 13 preventas de prueba (solo lectura):
- ✅ **Las 13 ya traen el ID de variante y el SKU** reconocidos de la foto (confianza 0,95). Ej.:
  CUELLO ALTO BARCELONA · Cocoa · S → `#1888`, SKU `H N L COCOA S BOR`. El hueco grande (ID de variante)
  **ya está resuelto en este canal**.
- ❌ **Transportadora vacía** en las 13 → falta calcularla por ciudad (CR/SR).
- ❌ **Vendedor** = nombre libre («Prueba») → falta el mapa vendedor → empleado de Effi.
- Transportadora (dato del dueño, 07-nov): **Bucaramanga → CIUDAD BONITA** (CR = ubicación 32, SR = 33).
  Resto de ciudades: tabla de transportadoras (kls-app) o la cobertura de Effi.
- Prueba real 07-nov: PV-20261107-152032-G1 → variante #28546 (CUELLO ALTO NACIONAL LIBERTADORES, Marfil L),
  SKU H N L MARFIL L ES → todo correcto salvo transportadora y vendedor (vacíos).
- Mapa vendedor (primer dato, 07-nov): **573143534918 → «QUINO AGENCIA - CC 96582541250»** (número de prueba).
- ⚠️ Cédula: casi nunca viene → se usa el celular (regla del dueño).
- ⚠️ El adaptador actual (`lib/ventas-vendedores/effi.ts`) arma un formato provisional y pone el correo
  `gerencia@klixmant.com`; hay que pasarlo al formato real de §1 y usar `Gerenciaquin7@gmail.com`.

## 2d. Ids de Effi (Fase 0, consulta de solo lectura 07-nov-2026)

| Qué | Id |
|---|---|
| Sucursal Principal (Bucaramanga) | 1 |
| Bodega Bucaramanga | 1 (2 = Bucaramanga DS, 3 = Garantías) |
| Centro de costos AGENCIA QUIN | **12** |
| Vendedor QUINO AGENCIA | tercero **46502** (cédula 96582541250) |
| Ubicaciones | 33/32 CIUDAD BONITA SR/CR · 29/28 INTER RAPIDISIMO CR/SR · 27/26 ENVIA CR/SR · 25/24 COORDINADORA CR/SR · 23/22 SERVIENTREGA CR/SR · 21/20 JOSE ENVIOS CR/SR · 31 INTER PROPIO · 30 PUNTO DE VENTA |
| IVA 19% | 1 |
| Forma «Contado a 1 día» | **2** (tipo crédito → queda por cobrar, **no lleva medio de pago**) |
| Forma «Contado» | **1** (contado → exige medio) |
| Medio Transferencia bancaria | 5 |
| Caja QUIN JOSUE | 5 (sucursal 1) |
| Cuenta KLIXMANT SAS | ⏳ el servicio es `api/cuenta` — reintentar |
| Artículo HNLMARFILLES | **21703**, IVA 19%, «sin control de stock» (no lo frena el inventario) |
| Bucaramanga / Santander / Colombia | ciudad 13371 · provincia 802 · país 47 |
| Cliente 3143534918 | ya existe: tercero **26414** («josue»); también 414 JOSUE QUINTERO LEON (otra cédula) |

## 2e. Fase 1–2 construida (07-nov-2026) — vista previa, NO envía

- `quinchat/lib/ventas-vendedores/effi-remision.ts` → `armarRemision()`: arma el cuerpo exacto de
  `POST api/remision_v` con las reglas de §2b–2d. Consulta Effi solo con GET (departamento, ciudad,
  cliente por cédula/celular, artículo por Ref.). Si el cliente no existe, deja listo el cuerpo de
  `POST api/cliente` (no lo crea).
- Config editable en `ajustes_bot` clave `effi_remision`: `vendedores {tel: {tercero, nombre}}`,
  `transportadoras {municipio: nombre}`, `cuenta_transferencia`. Por defecto: 573143534918 → QUINO AGENCIA
  (46502); bucaramanga → CIUDAD BONITA.
- Botón «⬆ Subir a Effi» del panel → guarda la vista previa en `vv_ventas.effi_payload` y la muestra en el
  detalle (errores ✖, avisos ⚠️, conceptos, pagos y «datos técnicos» con el JSON). Estado `lista_effi`.
- Pendiente: id de la cuenta KLIXMANT SAS (solo para ventas con abono/pago total).

## 2f. Fase 3 construida (07-nov-2026) — envío real con candados

- El dueño autorizó subir **solo** PV-20261107-152032-G1 → `ajustes_bot.effi_remision.autorizadas`.
- Panel: tras la vista previa aparece **«✅ Enviar a Effi»** (pide confirmación) → `POST /api/ventas-vendedores/[id]/effi {enviar:true}`.
- Candados: clave aparte `EFFI_API_TOKEN_ESCRITURA`; venta en `autorizadas` (o `envio_effi='real'` en Fase 4);
  bloqueo atómico a `enviando_effi`; `idempotency_key qc-<código>` (409 si se repite); clientes nuevos aún
  no se crean por API.
- Éxito → `estado en_effi`, `effi_remision = id_transaccion`, respuesta en `effi_respuesta`.
  Error → `error_effi` con el mensaje de Effi; sin reintentos automáticos.

**Resultado Fase 3 (07-nov-2026 15:58 COL):** Effi respondió 201 → **remisión 78344**, total $130.000,00
(cuadra exacto con el precio sin IVA 109.243,6975 + IVA 19%). 1 intento, sin errores. Prefijo vacío.

## 2g. Botón «🧾 Enviar al panel de Effi» en el chat (07-nov-2026)

- Junto a la etiqueta del chat. Abre «Confirmar datos antes de pasar al panel» (`components/panel/EnviarPanelEffiModal.tsx`).
- Prellenado (`lib/ventas-vendedores/desde-chat.ts` → `prellenarDesdeChat`): último pedido del cliente +
  lo que escribió en el chat (1 llamada de IA) + candidatos del catálogo KLIXMANT. No escribe nada.
- Todo editable: cliente, dirección, transportadora, pago/abono, producto (buscador del catálogo), color
  (cambia al producto hermano del mismo diseño), talla-género, precio, cantidad, notas y foto (subir otra,
  foto del catálogo o foto del chat).
- «Confirmar y pasar al panel» → `POST /api/ventas-vendedores/desde-chat`: el servidor vuelve a calcular
  ID de variante y SKU; crea `vv_ventas` (estado confirmada, `vendedor_tel='panel'`, `conversacion_id`) +
  `vv_items`. Anti-duplicado: si el chat ya tiene preventa viva (3 días) pide marcar «Es otra compra».
- Pendiente: vendedor de Effi para las ventas del panel → `ajustes_bot.effi_remision.vendedores.panel`.

## 3. Huecos que quedan (en orden)

Cédula, artículo, IVA, formas/medios de pago, centro de costos, vendedor y transportadora: **resueltos** (§2b).

1. **ID de variante:** resuelto en el canal Ventas Vendedores (§2c). Para embudos/chat queda para después.
2. **Transportadora por ciudad:** tabla depto/municipio → transportadora (hoy en kls-app, otro Supabase).
3. **Ids de Effi** (centro de costos AGENCIA QUIN, empleados, ubicaciones de venta, formas y medios de pago,
   caja, cuenta bancaria, IVA, ciudades) → GET con la clave de lectura actual.
4. **Clave de escritura** (`EFFI_API_TOKEN_ESCRITURA` en Vercel) — solo para la Fase 3.

## 4. Flujo propuesto

```
Venta confirmada en QuinChat
  → variante exacta KlixmSoft (automático; si duda → revisión humana)
  → ciudad/depto → ids de Effi (copia local de api/ciudad; si no cuadra → revisión)
  → botón «📤 Subir a Effi» → VISTA PREVIA (cliente, dirección, artículo, código, precio, pagos)
  → humano aprueba → buscar/crear cliente → POST remision_v (idempotency_key qc-<id>)
  → guardar id_transaccion (ej. RV-1234) en la venta; el botón queda bloqueado
```

## 5. Fases

- **Fase 0 — Datos (solo lectura):** ruta interna que hace GET a Effi con la clave actual (sucursal, bodega,
  centro_costos, empleado, ubicacion_venta, impuesto, forma_pago, medio_pago, ciudades) y guarda los ids.
  + copia de la tabla de transportadoras por ciudad.
- **Fase 1 — Completar la preventa en el panel VV** (el ID de variante ya lo trae):
  - Transportadora automática por ciudad (CR si hay cobro, SR si está pago) — editable en el detalle.
  - Vendedor → empleado de Effi (lista en Ajustes del módulo).
  - Artículo Effi por SKU (Ref. sin espacios) verificado con `GET api/articulo`; si no existe → error visible.
  - (Embudos / chat de clientes: más adelante, con el mismo mecanismo.)
- **Fase 2 — Simulación:** botón con vista previa; arma el JSON exacto y lo guarda. **No envía.**
- **Fase 3 — Una remisión real** escogida por el dueño, con autorización expresa; se compara con una manual.
- **Fase 4 — Uso diario:** por lotes con interruptor `ajustes_bot.effi_remisiones`, registro de cada intento,
  errores visibles, reintento seguro (la idempotency_key evita duplicados).
- **Fase 5 (opcional) — Guía de transporte** con la cobertura de Effi.

## 6. Riesgos

| Riesgo | Protección |
|---|---|
| Remisión duplicada | `idempotency_key` (Effi responde 409) + id de remisión guardado |
| Prenda/talla equivocada | código exacto de variante; si duda → revisión humana |
| Cliente duplicado | buscar por cédula/celular antes de crear |
| Totales que no cuadran | vista previa; precio sin IVA calculado igual que Effi |
| Sin stock en bodega | Effi responde 400 → la venta queda «con error», visible, sin reintentos automáticos |
| Tocar datos reales | simulación primero; envío real solo con interruptor y autorización |

## 7. Decisiones del dueño (pendientes)

- ¿Qué canales se suben (embudos, WhatsApp, promos, vendedores)?
- ¿Quién aprueba la subida? ¿Las ventas con abono se suben antes o después de recibirlo?
