# Recuperación de v174 (tareas Z2–Z5)

**Fecha:** 30-09-2026 · **Quién:** Claude (agente desarrollador, sesión de Tatiss30)
**Rama:** `v174-recuperada` (commit `4fb9872`), **solo local, sin subir**. Vive en un worktree aparte:
`C:\Users\Tati\AppData\Local\Temp\claude\D--PROYECTO-IA-FUNNELISH\729bd79f-ccde-4f87-9305-376527c1bb11\scratchpad\wt-v174`.
La copia principal (`optimizacion-videos`, con cambios sin guardar) no se ha tocado.

---

## 1 · Qué se bajó y cómo se verificó

- Origen: despliegue `dpl_Ef4y12bUvR9u9pJB3LVNtDkFRHxU` (el de `pedido.klixmant.shop`), publicado por CLI desde `bff4e19`.
- API: `GET /v7/deployments/{id}/files/{uid}?teamId=team_EZLmPFGxZMhSohs76iZF5Mo3` con la sesión de la CLI.
  La respuesta llega como JSON `{"data": "<base64>"}`. Solo lectura: nada se publicó ni se cambió en Vercel.
- Alcance: todo `src/quinchat/` salvo `node_modules`, `.next` y `*.tsbuildinfo` → **736 archivos**.
- Verificación: **736/736** con SHA-1 igual a su `uid`, comprobado dos veces (en el script de descarga y con
  `sha1sum -c` aparte). Después, los 736 archivos del worktree se compararon byte a byte con lo bajado: 0 distintos.
- No van a git: `*.tsbuildinfo` (no se bajaron) y `next-env.d.ts` (lo ignora `quinchat/.gitignore`).
  `quinchat/.gitignore` no viene en el despliegue (Vercel no lo sube); se conserva el de la base.

## 2 · Base elegida: `b4db066` (v173)

Se puntuaron los 45 últimos commits de `origin/master` contando, dentro de `quinchat/`, archivos modificados +
solo en v174 + solo en el commit (con los finales de línea normalizados como los guarda git):

| Commit | Diferencias | Comentario |
| --- | ---: | --- |
| **`b4db066`** v173 | **477** (14 modificados + 462 solo en v174 + 1 solo en base) | Elegido: el más parecido y el más reciente de los empatados |
| `4783ba4` v172, `7286b20` v171 | 478 | Empatan en el recuento bruto, son más antiguos |
| `origin/master` `5a2f455` | 490 | Añade el compresor con `sharp` encima de v173 |

De los 462 «solo en v174», 450 son las fotos de `public/promo-fotos/` y 1 es `next-env.d.ts`.
La lectura es clara: **v174 = v173 + el trabajo de promociones y bot**, hecho en el PC de agenciaquin **sin**
fusionar la compresión que entró en `master` el 29–30-08. Por eso, uniendo desde v173, la fusión con `master`
es de tres vías real y no ve cambios falsos.

## 3 · Qué cambia v174 respecto a v173 (y por tanto respecto a `master`)

`master` = v173 + compresión (`catalogos/upload-imagen`, `funnels/imagen`, `funnels/video`,
`plantillas-wa/imagen`, `lib/collage.ts`, `lib/imagen-comprimir.ts`, `lib/optimizar-imagen-servidor.ts`,
`next.config.ts`, `package*.json`, 2 pruebas) + 5 líneas del collage en el webhook de Funnelish.
**Ninguno de esos archivos lo toca v174**, salvo el webhook de Funnelish. Lo que trae v174:

### Modificados (14)

| Archivo | Qué hace el cambio |
| --- | --- |
| `app/api/cron/seguimiento-ia/route.ts` | Salta los chats con la etiqueta nueva `NO ENVIAR RECORDATORIO` |
| `app/api/cron/ventas-seguimiento/route.ts` | Igual: no escribe a chats con `NO ENVIAR RECORDATORIO` |
| `app/api/funnelish/webhook/route.ts` | Busca el celular en 11 campos posibles del pedido; foto del producto elegida por palabra distintiva (marca) y no por recuento (evita «PAREJA X» → foto de «PAREJA Y»); pedidos PAREJA/DUO/COMBO = 2 prendas, con collage de la misma foto dos veces |
| `app/api/plantillas-wa/route.ts` | Acepta `botonUrl` al crear una plantilla de Meta |
| `app/api/remarketing/route.ts` | Filtro por rango de fechas; `maxDuration` 300; deja la plantilla enviada (imagen + texto) en el chat del panel sin subir el chat al tope; respiro entre envíos de 250 a 120 ms |
| `app/api/whatsapp/webhook/route.ts` | Aviso a Lilibeth con otro texto; 👍/👌/✅ solos cuentan como «sí»; elegir entre dos pedidos por talla o número; si no entiende dos veces pasa a humano; dirección por partes sin exigir número; **handoff silencioso** (ya no avisa al cliente de que pasa a un asesor); **el bot deja de pisar el valor del pedido con precios fijos del código**; el prompt fija el valor |
| `components/panel/ChatArea.tsx` | Menú ⋮ en móvil que agrupa Notas, Bot y Etiquetas |
| `components/panel/PlantillasWhatsApp.tsx` | Campo «botón de enlace» y su vista previa |
| `components/panel/RemarketingPanel.tsx` | Selector de fechas y desplegable de plantillas aprobadas |
| `components/panel/Sidebar.tsx` | Entradas «Promociones» y «Links vendedores» |
| `components/panel/WhatsAppPanel.tsx` | Carga los dos paneles nuevos |
| `lib/address.ts` | Normaliza puntos y comas antes de validar la dirección («Cl. 12 #1-33, Garzón») |
| `lib/quinchat/ventas.ts` | Handoff silencioso también en la línea de ventas; aviso nuevo a Lilibeth |
| `lib/whatsapp-templates.ts` | Botón URL en plantillas (máx. 3 botones entre URL y respuesta rápida) |

`tsconfig.json` salía distinto en el recuento bruto solo por finales de línea mezclados; git lo ve igual.

### Nuevos (11 de código + 450 fotos)

| Archivo | Qué hace |
| --- | --- |
| `app/api/promociones/route.ts` | CRUD de la tabla `promociones` (GET público de activos, `?admin=1` todo, POST, DELETE) |
| `app/api/promociones/pedido/route.ts` | Compra de un producto desde `/promos`: valida y descuenta stock por color/talla, crea el pedido en `clientes_funnelish` (`referencia promo-*`), manda la plantilla de confirmación y apaga el bot |
| `app/api/promociones/pedido-multi/route.ts` | Lo mismo para un carrito de varios productos, con una sola confirmación |
| `app/api/promociones/vender/route.ts` | «Marcar vendido» desde el link de un vendedor: descuenta 1 unidad si el `token` coincide |
| `app/api/vendedores-promo/route.ts` | CRUD de `vendedores_promo` (código de link, celular, token) |
| `app/p/promos/page.tsx` | Catálogo público `/promos` (modo vendedor con `?v=<codigo>`) |
| `app/p/promos/[id]/page.tsx` | Ficha de un producto de promoción |
| `components/panel/PromocionesPanel.tsx` | Panel para crear promos, fotos por color y stock |
| `components/panel/VendedoresLinksPanel.tsx` | Panel de vendedores y sus links |
| `components/publico/PromoProducto.tsx` | Ficha pública con botón «Marcar vendido» |
| `components/publico/PromosLista.tsx` | Catálogo, carrito y formulario de compra |
| `public/promo-fotos/` (450 JPG) | 15 MB; entre 15 y 49 kB cada una, **todas por debajo del tope de 250 kB** de `LEY-DE-PESO.md`. Ningún código las nombra: se referencian desde la base |

Las tablas `promociones` y `vendedores_promo` **no tienen SQL en el repositorio**: existen en la base (la página
funciona en producción) pero su definición solo está en Supabase.

## 4 · Compresión en v174 y choque con `master`

v174 **no tiene `sharp`** ni el compresor del servidor. Tiene lo que ya había en v173:

- `lib/imagen-comprimir.ts` en el navegador (1600 px, q0,82). Lo usa también el panel de Promociones.
- `api/funnels/optimizar-fotos` de agenciaquin (botón manual, 1080/q72, SSIM 0,896): sigue ahí y sigue siendo el
  riesgo de `HALLAZGO-dos-compresores.md` (segunda pasada con pérdida sobre fotos ya en 1920/q85).
- `api/funnels/imagen` **sube tal cual**. Las fotos de promociones van por esa ruta, así que hoy en producción
  entran solo con la compresión del navegador. Al unir con `master`, pasarán por `sharp` 1920/q85: las que ya
  vienen a 1600/q82 del navegador reciben una segunda pasada (pequeña, pero es pérdida sobre pérdida; lo mismo
  que ya ocurre con embudos en `master`).
- **Collages a calidad 100.** En v174 `generarCollagePack` codifica JPEG sin calidad (Jimp → q100, ~1,6 MB).
  v174 lo usa **más** que antes (nuevo collage PAREJA). En la unión gana la línea de `master` (`quality(85)`,
  ~442 kB) sin conflicto, pero **442 kB sigue por encima del tope de 250 kB** de la LEY DE PESO: queda para A6.
- `next.config.ts` y `package*.json` de v174 son los de v173: no incluyen `libvips`. En la unión ganan los de
  `master` (con `libvips` en `outputFileTracingIncludes`), sin conflicto.

**Regla del tablero para Z6 (en compresión manda `master`):** se cumple sola; no hay que resolver nada a mano.

## 5 · Compilación

- `package-lock.json` de v174 = el de v173. **Es distinto del de `master` y del `node_modules` de la copia
  principal**: `master` añade `sharp ^0.35.4` (26 paquetes `@img/*` cambian de versión y 27 aparecen). El resto,
  `next` incluido, es igual.
- La junction a `D:\PROYECTO IA\FUNNELISH\quinchat\node_modules` sirvió para `tsc`, pero **Turbopack no acepta
  una junction que salga de la raíz del proyecto** (`Symlink [project]/node_modules is invalid`). Se borró con
  `cmd /c rmdir` (el `node_modules` real sigue intacto, 413 entradas) y se hizo `npm ci --prefer-offline` dentro
  del worktree con el lock de v174.
- `npx tsc --noEmit -p .` → **0 errores**.
- `npx next build` sin `.env` → **verde** (Next 16.2.10, Turbopack, 44 páginas; solo el aviso de siempre de
  `middleware` → `proxy`). No hizo falta ninguna variable para compilar.
- No comprobado: que funcione en Linux/Vercel. Es el mismo código que ya corre allí, así que el riesgo está en la
  unión (Z6), no en esta rama.

## 6 · Secretos

Búsqueda de `sk-`, `eyJ`, `EAA`, `service_role`, `-----BEGIN`, `password=` y otros formatos (AWS, GitHub, Google,
Slack, `sb_secret_`, asignaciones `token/secret/key = "..."`) en los 736 archivos. **Ninguna clave real.**

| Coincidencia | Archivo | Qué es |
| --- | --- | --- |
| `sk-` | `.env.local.example` | Marcador `sk-ant-xxxx…` (idéntico a `master`) |
| `eyJ` | `package-lock.json` | Parte de un hash `integrity`, no un JWT |
| `EAA` | `components/panel/AjustesPanel.tsx` | `placeholder` recortado con «…» (24 caracteres), igual que en `master` |
| `EAA` | `public/encoderWorker.min.js` | Datos base64 del codificador de audio |
| `service_role` | `CarritosAbandonados.tsx`, `CORRECCIONES_V80.md`, `SETUP_WHATSAPP.md`, 4 `sql/*.sql` | Texto de ayuda y `grant ... to service_role`; ningún valor |

No hay `.env`, `.pem` ni `.key` en `quinchat/`. **Fuera de alcance:** el despliegue subió el repo entero
(fallo 7.2 del tablero: `quin-comercial/_to_delete/`, `.claude/settings.local.json`…). Eso no se ha revisado aquí.

## 7 · Fallos nuevos vistos en el código de v174 (no arreglados, para la sección 7 del tablero)

1. **El token del vendedor principal se sirve a cualquier visitante.** `app/p/promos/page.tsx` lee el `token` de
   `vendedores_promo` con código `__principal__` y lo pasa a `PromosLista` (componente de cliente), que lo pone en
   los enlaces (`?k=`). Con él, cualquiera puede llamar a `/api/promociones/vender` y vaciar el stock. Lo mismo con
   el token de cada vendedor en `/promos?v=<codigo>`: quien reciba el link del vendedor recibe su token. **Media.**
2. **Las APIs nuevas quedan abiertas en la tienda.** En `pedido.klixmant.shop` el middleware de v174 deja pasar
   todo `/api/`: `POST/DELETE /api/promociones` y `GET /api/vendedores-promo` (devuelve todos los tokens) responden
   sin sesión. Lo cierra `bloqueantes-consumo` al unir (ver 8). **Alta hasta Z7.**
3. `/api/promociones/pedido` y `pedido-multi` mandan una plantilla de pago a cualquier celular sin límite. No
   tienen el límite por IP y teléfono que `bloqueantes-consumo` pone a `/api/pedidos`. **Media.**

## 8 · Conflictos previstos al unir (Z6)

Simulado en el worktree con `git merge --no-commit --no-ff` y abortado después:

| Unión | Conflictos de texto | `tsc` |
| --- | --- | --- |
| `v174-recuperada` + `origin/master` | **Ninguno.** Solo `funnelish/webhook/route.ts` se une solo (v174 cambia búsqueda de foto y PAREJA; `master` la calidad del collage) | — |
| `v174-recuperada` + `origin/bloqueantes-consumo` (que ya contiene `master`) | **Ninguno.** Se unen solos `whatsapp/webhook`, `funnelish/webhook`, `lib/quinchat/ventas.ts` y los dos crons | **0 errores** en el árbol unido |

Que no haya conflictos de texto **no significa que no haya choques**. Los que hay que resolver a mano en Z6:

1. **El catálogo `/promos` dejará de vender.** El middleware de `bloqueantes-consumo` pide sesión en toda `/api/`
   salvo una lista cerrada. `/api/promociones/pedido`, `/api/promociones/pedido-multi` y `/api/promociones/vender`
   las llama la página pública, así que hay que añadirlas a `API_PUBLICA_EXACTA` **solo con POST**, y
   `pruebas/middleware-api.ts` con ellas. `/api/promociones` (POST/DELETE) y `/api/vendedores-promo` deben quedar
   **con sesión**. La página `/p/promos` en sí lee la base en el servidor y sigue abierta.
2. **Handoff silencioso frente al freno del bot.** v174 apaga el bot sin avisar al cliente; `bloqueantes` añade
   el freno que pone `HUMANO` sin borrar etiquetas. Se unen solos, pero hay que probar juntos «el bot no responde
   dos veces» y «las etiquetas no se pierden» (lista de la sección 6 del tablero).
3. **Etiqueta `NO ENVIAR RECORDATORIO`** (v174) en `ventas-seguimiento`, que `bloqueantes` protege con
   `CRON_SECRET`: se unen solos; comprobar en la prueba `crons.ts`.
4. **Collage de 442 kB** por encima del tope de la LEY DE PESO (sección 4).
5. **`CLAUDE.md`**: conflicto seguro entre `bloqueantes-consumo` y los cambios sin guardar de
   `optimizacion-videos` (fallo 10 del tablero). No afecta a esta rama, que no toca la raíz.

## 9 · Qué hay que hacer antes de publicar esta rama

**Esta rama no se debe publicar sola.** Es la foto de producción para poder unirla. Si alguien la sube y la
publica, `pedido.klixmant.shop` volvería a v174 sin compresión ni arreglos de seguridad (igual que hoy, sin
empeorar nada, pero sin mejorar). Pasos:

1. Decidir si se sube la rama a GitHub (`git push -u origin v174-recuperada` desde el worktree). Subir una rama
   no publica; solo genera una vista previa.
2. Z6: unir con `bloqueantes-consumo`, resolver los puntos 1 a 4 de la sección 8, y correr `tsc`, `next build` y
   `pruebas/*`.
3. Rotar el token `__principal__` de `vendedores_promo` cuando se arregle el fallo 7.1 (hoy es público).

Para quitar el worktree cuando ya no haga falta: `git worktree remove --force <ruta>` (tiene su propio
`node_modules` real, no una junction; se puede borrar sin riesgo para la copia principal).
