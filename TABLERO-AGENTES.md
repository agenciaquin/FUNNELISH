# TABLERO · Qué hay que hacer, en qué orden y cómo no romper nada

**Creado:** 30-09-2026 · **Para:** los agentes (planeador, implementador, auditor, desarrollador, pruebas)
y para quien los dirige.
**Regla de este archivo:** aquí no se planifica más. Cada tarea tiene dueño, criterio de "hecho" y dice si
toca producción. Si una tarea necesita más detalle, el detalle ya existe: se enlaza, no se reescribe.

> Los planes largos siguen valiendo como referencia (`PLAN-CONSUMO.md`, `TASKS-CONSUMO.md`,
> `PLAN-PLATAFORMA.md`, `TASKS-PLATAFORMA.md`, `DISENO-LEY-IMAGENES.md`, en la rama `bloqueantes-consumo`;
> los hallazgos en `arreglos-supabase/`). **Este tablero manda sobre el orden.**

---

## 1 · Por qué cada arreglo rompe otra cosa

No es mala suerte. Son cinco causas concretas, y mientras sigan ahí cualquier arreglo es una apuesta:

1. **Producción no es GitHub.** `pedido.klixmant.shop` corre `bff4e19` ("v174"), publicado a mano con
   `vercel --prod` desde el PC de agenciaquin, **5 veces seguidas con el mismo commit** (probablemente con
   cambios sin guardar). Ese código no está en GitHub. Todo lo que se arregla sobre `master` se arregla
   sobre algo que **no es lo que corre**, y al publicarlo se pierde lo que sí corría.
2. **Publicar es destructivo.** Cualquier envío a `master` publica `quinchat-agencia-quin` y
   `quinchat-comercial` a la vez, sin filtro por carpeta. Hoy un cambio en un `.md` de la raíz borraría v174.
3. **Hay dos copias de casi todo.** `quinchat/` y `quin-comercial/` tienen archivos gemelos. Un arreglo en
   una no llega a la otra (observación 3 de `CLAUDE.md`).
4. **Local escribe en la base real.** No hay base de pruebas: probar en `localhost` escribe en producción.
5. **No hay red de seguridad automática.** Las pruebas existen (`*/pruebas/`), pero nadie las corre antes de
   publicar y no hay una lista de "lo que no se puede romper".

El frente 0 ataca 1 y 2. Las reglas de la sección 6 atacan 3, 4 y 5.

---

## 2 · Estado real (medido el 30-09-2026, solo lectura)

**Almacenamiento de quinchat (Supabase `bjbjqmbuzpyjvcugbusx`): 3 651 archivos, 2 502 MB en tres buckets.** La tabla es
`chat-media`; además están **`catalogo-imagenes` (204 MB, 975 kB de media por foto: el peor)** y `plantillas-images` (12 MB).
Antes de tocar `catalogo-imagenes` hay que ver qué lo usa.

| Zona | Archivos | Peso | Qué es | ¿Comprimido? |
| --- | ---: | ---: | --- | --- |
| `_originales/` | 723 | **1 010 MB** | Respaldo de la pasada de compresión de agosto | Es el respaldo |
| Vídeos de `embudos/` (incl. `embudos/chat/`) | 32 | **486 MB** | 18 huérfanos (226,8 MB) + 10 de chats (222,7 MB) + 4 usados | No |
| Chat saliente (`57xxxxxxxx/`) | 683 | **412 MB** (381 MB en 511 imágenes) | Fotos que manda el asesor por chat | **No**, y crece: eran 289 MB el 30-08 (**+92 MB en un mes**) |
| Imágenes de `embudos/` | 495 | 124 MB | Fotos de las landings | Casi todas; **98 nuevas desde el 31-08** |
| `catalogo/` | 319 | 80 MB | Catálogo | 293 de 319 |
| `ventas/` | 574 | 74 MB | Fotos del bot vendedor | **No** |
| `entrantes/` | 491 | 61 MB | Lo que mandan los clientes | **No** |

**Bot (misma base):** 2 901 conversaciones, **1 029 con el bot apagado**. En los últimos 7 días el bot mandó
**1 536** mensajes y los clientes **768**. La última respuesta del bot fue el 30-09 a las 18:12 (hora de
Colombia). **El bot responde.** Lo que está en cero hay que medirlo (tarea B1): ¿ventas, pedidos, o la
línea de ventas?

**Código:** hay tres versiones que no se han unido.

| Versión | Dónde está | Qué tiene |
| --- | --- | --- |
| v174 (`bff4e19`) | Producción y el PC de agenciaquin | Lo que corre hoy |
| `master` (`5a2f455`) | GitHub | Compresor con `sharp` y `libvips` |
| `bloqueantes-consumo` | GitHub, sin publicar | 5 arreglos de seguridad y consumo, auditados y corregidos |

Además hay una rama local, `optimizacion-videos` (`03aecdd`, más cambios sin guardar), que hace que el vídeo
no se descargue hasta que se ve.

---

## 3 · FRENTE 0 · Una sola base (bloquea publicar código)

Sin esto se puede **escribir** código en ramas, pero no **publicarlo** sin romper producción.

| ID | Tarea | Quién | ¿Toca producción? | Hecho cuando |
| --- | --- | --- | --- | --- |
| **Z1** | Iniciar sesión en Vercel en este PC (`! npx vercel login`) | Humano | No | `vercel whoami` responde |
| **Z2** | Bajar el código de la publicación `dpl_Ef4y12bUvR9u9pJB3LVNtDkFRHxU` (la de `pedido.klixmant.shop`) a una carpeta de trabajo, **fuera del repo**. El conector de Vercel corta el árbol en profundidad: usar la API `/v6/deployments/{id}/files` con la sesión de Z1 | desarrollador | No (lectura) | Todos los archivos bajados; cada uno coincide con su `uid` (SHA-1) |
| **Z3** | Comprobar que está completo: `npm ci` y `next build` de `quinchat/` pasan; buscar `.env` y claves (no pasan a git) | desarrollador | No | Build verde y lista de secretos, si los hay |
| **Z4** | Filtro por carpeta en el panel de Vercel ("Ignored Build Step") en los dos proyectos, comparando contra el último despliegue y no contra `HEAD^` | Humano, o agente con permiso | Configuración, sin publicar | Un envío que solo toca `docs/` no dispara ninguna publicación (probarlo en una rama) |
| **Z5** | Rama `v174-recuperada` = el código de Z2 sin secretos, sobre el commit de `master` más parecido | desarrollador | No (rama → solo vista previa) | La rama compila |
| **Z6** | Rama `integracion` = Z5 + `master` (compresor, `libvips` en `outputFileTracingIncludes`) + `bloqueantes-consumo`. En conflictos del bot, embudos y webhooks **manda v174**; en compresión **manda `master`** | desarrollador → auditor | No | `tsc`, `next build` y `pruebas/*` de las dos apps en verde; el auditor la aprueba |
| **Z7** | Publicar `integracion` con alguien mirando: variables creadas antes (ver B2), registros de ejecución abiertos y marcha atrás a mano (Vercel guarda 20 despliegues) | Humano + desarrollador | **Sí** | 1 h sin errores nuevos en los registros; un mensaje real respondido en cada línea |

**Desde Z7, `master` es la verdad y `vercel --prod` queda prohibido.**

---

## 4 · FRENTE A · Fotos y vídeos: bajar el peso

Van primero las que **no dependen del frente 0**: operan sobre el almacenamiento, no sobre el código publicado.
Todas escriben o borran en producción, así que **cada una necesita el visto bueno explícito del humano** y un
cruce contra **todas** las tablas justo antes de ejecutarla (observación 6 bis de `CLAUDE.md`).

| ID | Tarea | Ahorro | ¿Depende de Z? | Detalle |
| --- | --- | ---: | --- | --- |
| **A1** | Borrar `_originales/`. El motivo para guardarlo era poder recomprimir a otro perfil, y **el 30-08 se decidió mantener 1920/q85**. Antes: comprobar que ninguna tabla apunta a `_originales/` y **bajar una copia a disco** (1 GB) | **−1 010 MB** | No | `HALLAZGO-dos-compresores.md` |
| **A2** | Borrar los 18 vídeos huérfanos. Rehacer el cruce con `funnels`, `messages` y el resto de tablas **el mismo día** | **−227 MB** | No | `HALLAZGO-videos.md` (tiene la consulta corregida) |
| **A3** | Recomprimir en su sitio las 511 imágenes del chat saliente (mismo nombre, así ninguna referencia se rompe), con respaldo local antes | La muestra da ~−70 %: **≈ −250 MB** (a confirmar con `pruebas/medir-chat-saliente.ts`) | No | `HALLAZGO-chat-saliente-sin-comprimir.md` |
| **A4** | Igual con lo que entró sin comprimir desde el 31-08 (`embudos/`, `catalogo/`, `packs/`, `ventas/`, `entrantes/`) | ≈ −100 MB | No | `TASKS-CONSUMO.md` T2.15 |
| **A5** | Recomprimir el único vídeo usado que mejora y publicar la carga diferida de vídeo (rama `optimizacion-videos`) | Menos peso **por visita**, que es lo que nota el cliente | La carga diferida sí (Z7) | `HALLAZGO-videos.md` |
| **A6** | **Cerrar el grifo:** que chat saliente, entrantes, ventas, packs y URLs firmadas pasen por el compresor (la LEY de `CLAUDE.md`) | Evita +90 MB/mes | Sí (Z6 → Z7) | `DISENO-LEY-IMAGENES.md`, T2.1–T2.8 |
| **A7** | Que al sustituir o borrar una foto de un embudo se borre el archivo **si nadie más lo usa** (hay archivos con 14 dueños) | Evita ~2 GB/año | Sí | `HALLAZGO-nadie-borra-del-bucket.md` |

**A1 + A2 + A3 llevan el bucket de 2,5 GB a menos de 1,1 GB** sin tocar código publicado.
**Orden de ejecución: A6 antes que A3 y A4 en cuanto Z7 esté hecho** (primero el grifo, después el charco,
observación 6 ter). Si Z7 va a tardar, A3 y A4 se hacen igual y se repite una pasada corta después.

Para **quin-comercial** la base es otra cuenta a la que no tenemos acceso (D5 de `TASKS-PLATAFORMA.md`).
Allí A1–A4 esperan a tener acceso.

---

## 5 · FRENTE B · Bot listo para vender

| ID | Tarea | Quién | ¿Toca producción? | Hecho cuando |
| --- | --- | --- | --- | --- |
| **B1** | **Medir qué está en cero.** Pedidos por día (últimos 60), respuestas del bot en la línea de ventas frente a la de confirmación, y cuántas de las 1 029 conversaciones con el bot apagado se apagaron solas (crons `apagar-vendidos` y freno) y cuántas a mano | desarrollador | No (lectura) | Una tabla con la cifra y la causa probable |
| **B2** | Hoja de configuración por proyecto de Vercel: `CRON_SECRET` (**falta en `quinchat-comercial`**), `WHATSAPP_APP_SECRET`, `FUNNELISH_WEBHOOK_TOKEN` (y el `?token=` en Funnelish **el mismo día**), `BOT_TOPE_DIARIO`; cron-job.org mandando la clave en **todas** las tareas (`ventas-seguimiento` no la mandaba) | Humano + desarrollador | Configuración | Cada variable está marcada como existente, sin mostrar su valor |
| **B3** | Tabla `rate_limits` en la base de quinchat (`quinchat/sql/rate-limits.sql`). Sin ella el límite de `/api/pedidos` no limita nada | Humano aprueba | **Sí (SQL)** | La tabla existe |
| **B4** | Publicar los arreglos de seguridad **dentro de Z6/Z7**, no aparte | — | Sí | Queda en Z7 |
| **B5** | **Prueba de humo del ciclo de venta** tras Z7, con un número de la agencia: anuncio → mensaje → respuesta del bot → pedido en la landing → plantilla de confirmación con **la foto correcta** → "CONFIRMO" → etiqueta de venta. Una vez por cada línea (confirmación y ventas) | Humano + pruebas | Sí (un pedido de prueba; anularlo después) | Los 7 pasos en verde, con captura |
| **B6** | Revisar que la plantilla de confirmación de Meta está aprobada, que el token de WhatsApp no caduca pronto y que las dos líneas están suscritas al webhook **con la misma app de Meta** (si no, la firma rechazará una de ellas) | desarrollador | No (lectura) | Las tres comprobaciones anotadas |
| **B7** | El freno cuenta mensajes, no llamadas a la IA: con 80 un comprador que pide muchas fotos puede pasar a HUMANO. Contar solo lo que responde la IA, o subir el tope | implementador | En rama | Prueba `freno-bot.ts` actualizada |
| **B8** | Decidir qué hacer con las conversaciones apagadas que salgan de B1 (reactivar solo las que se apagaron solas) | Humano decide | Sí | Decisión anotada aquí |

---

## 5 bis · FRENTE V · Acabar con las "versiones" (pedido de dirección, 30-09-2026)

Dirección pidió que las versiones dejen de existir o se unifiquen en una sola, también para aligerar peso.
Medido el 30-09: hay **cinco cosas distintas** que se llaman "versión". **Ojo: ninguna hace la página más pesada
para el cliente** (eso lo arregla el frente A). Lo que sí hacen es **desordenar**, y el desorden es la causa nº 1
de que un arreglo rompa otra cosa.

| ID | Qué es | Medido | Qué hacer | ¿Toca producción? |
| --- | --- | --- | --- | --- |
| **V1** | **Numeración a mano v40…v174.** Cada versión era una publicación a mano desde un PC, con un `.md` de notas | 75 publicaciones de producción de `quinchat-agencia-quin` en un mes, todas por CLI | **Se acaba con Z7.** Desde ahí la versión es el commit de GitHub; si hace falta un nombre, una etiqueta de git (`git tag v175`). Prohibido `vercel --prod` | No |
| **V2** | **Documentos `CORRECCIONES_V*.md`** | 41 archivos, 180 kB (raíz, `quinchat/`, `quin-comercial/`) | Unificar en **un solo `docs/HISTORIAL-DE-VERSIONES.md`** (una sección por versión, con lo que siga vigente) y **borrar los 41**. Git conserva el original de cada uno | No (solo repo); **después de Z7** para no chocar con la integración |
| **V3** | **Collages `__v2` y `__v3`** en el almacenamiento | 93 en `packs/` (35,7 MB; los `__v3` a 625 kB de media) + 73 copias en `_originales/` (112 MB) | **No son versiones viejas:** el código actual usa las dos (`lib/collage.ts` → `__v2`, webhook de Funnelish → `__v3`). Unificar en **un solo generador de collages** con el tope de la LEY (250 kB) y recomprimir los existentes. Las copias de `_originales/` caen con A1 | Sí (recomprimir), con visto bueno |
| **V4** | **Publicaciones guardadas en Vercel** | 100 en un mes: 75 de producción de quinchat; el proyecto `quinchat` (`quinchat-sepia`, creado por error) construye en cada envío | No cuestan almacenamiento facturable y son la **marcha atrás**: no se borran a mano. Configurar la retención de despliegues (p. ej. conservar 1 mes) y **borrar el proyecto `quinchat`** (A16 de `TASKS-PLATAFORMA.md`) | Configuración del equipo: **lo hace el administrador de Vercel** |
| **V5** | **Archivos pesados versionados en git** que no son de las apps | Historial de 144 MB: `IDENTIDAD DE MARCA/` 57 MB (PDF), `img/` 35 MB, `LIBROS DE VENTAS/` 27 MB, `quin-comercial/_to_delete/` (5 `.tgz`, 13 MB) | Sacarlos a Google Drive, añadirlos a `.gitignore` y `.vercelignore`, y borrarlos del repo. **No** reescribir el historial ahora (obliga a todos a volver a clonar) | No (solo repo); después de Z7 |

**Orden:** V1 llega sola con Z7. V2 y V5 van en una rama `agente/V-orden` justo después de Z7 (son movimientos de
archivos y chocarían con la integración si se hacen antes). V3 va con el frente A. V4 es una lista para el
administrador de Vercel.

---

## 6 · Reglas para los agentes (para que un arreglo no rompa otra cosa)

1. **Nadie envía a `master` ni usa `vercel --prod` hasta que Z7 esté hecho.** Se trabaja en ramas
   `agente/<ID>-<descripcion>`, por ejemplo `agente/A6-ley-chat-saliente`. Una rama solo genera una vista previa.
2. **Una tarea, una rama, un objetivo.** Si al arreglar algo aparece otro fallo, se **anota en la sección 7**
   y no se arregla de paso.
3. **Archivos gemelos:** si se cambia un archivo que existe en `quinchat/` y en `quin-comercial/`, se cambia
   en los dos o se escribe en el commit por qué no.
4. **Local = producción.** Cualquier cosa que escriba, borre o suba a Supabase o a R2 necesita el visto bueno
   del humano **antes**, diciendo qué escribe. Leer no necesita permiso.
5. **Antes de dar una tarea por hecha:** `tsc --noEmit` y las pruebas de `pruebas/` de la app en verde, y
   repasar la lista de abajo. Sin eso, la tarea no está hecha.
6. **Si no se puede probar en el destino, se dice** (observación 2): queda escrito como hueco abierto, con la
   prueba más barata para hacer después de publicar.

**Lo que no se puede romper** (se comprueba en cada cambio que toque estas zonas):

- [ ] Un pedido de la landing llega a `/api/pedidos`, se guarda y manda la plantilla con la foto del producto elegido
- [ ] El webhook de WhatsApp responde 200 a Meta en menos de 20 s (si no, Meta reintenta)
- [ ] El bot no responde dos veces al mismo mensaje
- [ ] Las etiquetas del chat (VENTA REALIZADA, PEDIDO PROGRAMADO…) no se pierden
- [ ] Las subidas de imagen pasan por `sharp`, y `libvips` va en `outputFileTracingIncludes`
- [ ] Los crons corren con `CRON_SECRET` y sin ella no corren
- [ ] El panel no pierde el "en vivo" de las conversaciones
- [ ] La tienda (`/p/`, `/[slug]`, `/gracias`) abre sin iniciar sesión, y `/api/pedidos/lista` pide sesión

---

## 7 · Fallos abiertos (de la revisión del 30-09 y anteriores)

Cada fallo nuevo se añade aquí con fecha, en lugar de arreglarse de paso.

| # | Fallo | Dónde | Gravedad | Tarea |
| --- | --- | --- | --- | --- |
| 1 | Producción corre un commit que no está en GitHub | Vercel | **Crítica** | Z1–Z7 |
| 2 | La publicación de v174 subió **el repo entero** a Vercel: `LIBROS/`, `AUDIOS/`, `.claude/settings.local.json` y **`quin-comercial/_to_delete/` (36 volcados, posibles claves o datos de clientes)** | Vercel | Alta | Z3 los revisa; `.vercelignore` en la raíz; rotar claves si aparecen |
| 3 | Chat saliente, entrantes y ventas suben fotos sin comprimir (+92 MB en septiembre) | quinchat | Alta | A6 |
| 4 | Nada borra archivos del bucket; el 75 % de `embudos/` está muerto | quinchat | Media | A7 |
| 5 | `/api/pedidos`: si la foto no es de un dominio propio (por ejemplo R2 sin `R2_PUBLIC_URL`), se sustituye en silencio por la del catálogo | las dos | Media | Comprobar `R2_PUBLIC_URL` en B2; B5 lo detecta |
| 6 | La firma de Meta supone una sola app para las dos líneas de quinchat | quinchat | Media | B6 |
| 7 | Anti-duplicados: si la ejecución se cae después de marcar el mensaje, el reintento de Meta se ignora y el cliente queda sin respuesta | quinchat | Baja | Anotar; revisar tras B5 |
| 8 | Webhooks de WhatsApp por cliente sin firma en quin-comercial | quin-comercial | Media | T4.9 de `TASKS-CONSUMO.md` |
| 9 | `WHATSAPP_APP_SECRET` vacía (no ausente) desactiva la firma sin avisar en el registro | las dos | Baja | Arreglo de una línea en `lib/firma-meta.ts` |
| 10 | La rama `bloqueantes-consumo` añade la LEY a `CLAUDE.md`, que tiene cambios sin guardar en `optimizacion-videos` → conflicto seguro | repo | Baja | Resolver en Z6 |
| 11 | Las pruebas no se pueden correr en este PC: falta `tsx` y `quin-comercial/node_modules` | este PC | Baja | `npm ci --prefer-offline` en las dos apps (no toca el repo) |
| 12 | **EN PRODUCCIÓN HOY:** la página pública `/promos` manda al navegador el token del vendedor `__principal__`, y con él `/api/promociones/vender` puede **vaciar el stock**. Además `GET /api/vendedores-promo` (todos los tokens) y `POST/DELETE /api/promociones` responden sin sesión en `pedido.klixmant.shop` | quinchat (v174) | **Crítica** | **Resuelto en rama** (2ª entrada `?v=__principal__` cerrada en `c006b73`) `integracion` (`124c505`, `34896a0`). Sigue en producción hasta Z7: **rotar el token** al publicar (`INTEGRACION.md` §6) |
| 13 | El middleware de `bloqueantes-consumo` cerraría la compra de `/promos`: hay que abrir solo con POST `/api/promociones/pedido`, `/pedido-multi` y `/vender` (con token no expuesto) y actualizar `pruebas/middleware-api.ts` | integración | Alta | **Resuelto en rama** `integracion` (`124c505`) |
| 14 | Los pedidos de promociones no tienen límite de envíos (mismo abuso que `/api/pedidos`) | quinchat (v174) | Media | **Resuelto en rama** `integracion` (`802c3de`). Sin la tabla `rate_limits` (B3) no limita |
| 15 | Los collages siguen por encima del tope (calidad 100 en v174 ≈ 1,6 MB; q85 en master ≈ 442 kB) y PAREJA genera más | quinchat | Media | Tarea de collages de `ESTRATEGIA-PESO.md` |
| 16 | Los pedidos de `/promos` aceptan del navegador la **foto y el precio** que salen en la plantilla de confirmación (mismo abuso que se cerró en `/api/pedidos` con `imagenPropia`) | quinchat (integracion) | Media | Siguiente rama: precio y foto se leen de la promoción en el servidor |
| 17 | El link de vendedor (`?v=<token>`) lleva el token **de ese vendedor** a todos sus clientes, que pueden usarlo para marcar ventas | quinchat | Media | Diseñar enlace de cliente distinto del token de vendedor |
| 18 | **EN PRODUCCIÓN (quin-comercial):** el anti-duplicados del webhook inserta una fila vacía al principio; con ubicación, reacción o contacto la espera de 12 s descarta el turno y **el bot se calla** (mismo fallo que se corrigió en quinchat en `4bfdd59`) | quin-comercial | Alta | Llevar el arreglo de `4bfdd59` y `pruebas/webhook-duplicados.ts` a quin-comercial |

---

## 8 · Qué se puede empezar HOY, en paralelo

| Quién | Tareas | Bloqueado por |
| --- | --- | --- |
| Humano | Z1 (login), visto bueno para A1 y A2, B2 (variables) | — |
| desarrollador | B1 (medir el cero), B6 (lectura), preparar los scripts de A1–A3 **sin ejecutarlos** | — |
| implementador | A6 en la rama `agente/A6-ley` sobre `bloqueantes-consumo`; B7 | — (se rebasa sobre `integracion` cuando exista) |
| desarrollador | Z2–Z6 | Z1 |
| auditor | Revisar cada rama al cerrarse, contra la sección 6 | Cada rama |

---

## 9 · Registro

| Fecha | Qué se hizo | Quién |
| --- | --- | --- |
| 30-09-2026 | Tablero creado. Revisión de los 21 commits del día. Comprobado que Vercel guarda el código de v174 (falta la sesión, Z1). Medición del bucket y del bot | Claude (sesión de Tatiss30) |
| 30-09-2026 | **P2 y P4 hechas** en la rama local `agente/P2-P4-ley-peso` (`dfb0037`, `b772e9d`): `lib/ley-peso.ts` idéntico en las dos apps y compresor por escalones sin la regla del 10 %. Pruebas 23/23, 27/27 y 18/18; `tsc` y build en verde (Windows). Falta conectar las rutas (P13+) | implementador |
| 30-09-2026 | `PLAN-UNA-SOLA-APP.md`: recomendada la opción A (todo en `quin-comercial`, KLIXMANT como tenant). Pendiente de decisión de dirección y de acceso a la base de quin-comercial (U1) | planeador |
| 30-09-2026 | Medición de topes (`MEDICION-TOPES.md`): 28/29 archivos cumplen con SSIM ≥ 0,95. **Topes definitivos en `LEY-DE-PESO.md` §2**; `ESTRATEGIA-PESO.md` alineada. Ahorro estimado: 2 502 MB → ~450–500 MB | desarrollador + Claude |
| 30-09-2026 | **LEY DE PESO** (`LEY-DE-PESO.md`): tope máximo por archivo para todos los formatos. Enlazada desde `CLAUDE.md` y los 5 agentes. Encargados `ESTRATEGIA-PESO.md` (planeador) y `arreglos-supabase/MEDICION-TOPES.md` (desarrollador) | Claude |
| 30-09-2026 | **Z2–Z5 hechas.** `quinchat/` de v174 bajado (736/736 con SHA-1 correcto), sin claves reales. Rama local `v174-recuperada` (`4fb9872`, sin subir) sobre `b4db066` (v173) en un worktree del scratchpad; `tsc` y `next build` en verde. Unión con `master` y con `bloqueantes-consumo` sin conflictos de texto, pero el middleware de `bloqueantes` cerraría las APIs de `/promos` (resolver en Z6). **Fallos nuevos para la sección 7:** token de vendedor principal servido en `/promos`; APIs de promociones abiertas en la tienda. Detalle en `RECUPERACION-V174.md` | desarrollador (Claude) |
| 30-09-2026 | **Z6 hecha (falta el auditor).** Rama local `integracion` (`99ec3dc`, sin subir) en `scratchpad\wt-integracion`: v174 + `master` + `bloqueantes-consumo`, uniones sin conflictos. **Fallos 12, 13 y 14 resueltos en rama**: compra de `/promos` abierta solo con POST; `/api/promociones` y `/api/vendedores-promo` con sesión en middleware y ruta; el token de `__principal__` ya no sale en la página (el dueño activa cada teléfono una vez con una cookie httpOnly); límite 5/teléfono y 20/IP en los pedidos de promociones. `tsc` y `next build` en verde en las dos apps; todas las pruebas en verde salvo `ley-imagenes.ts` (los mismos fallos que en `bloqueantes`, son de A6). Antes de publicar: lista de `INTEGRACION.md` §6 (variables por proyecto, Funnelish, cron-job.org, `rate_limits`, rotar tokens). **Fallos nuevos sin arreglar** (`INTEGRACION.md` §7): 16, los pedidos de `/promos` aceptan foto y precio del navegador en la plantilla; 17, el link de vendedor lleva su token a sus clientes | desarrollador (Claude) |
| 30-09-2026 | **Correcciones de `AUDIT-INTEGRACION.md`** en `integracion` (`e64793e`, sin subir). (1) Bloqueante: `/promos?v=__principal__` sacaba el token del principal; las dos páginas de `/promos` descartan ese código (`c006b73`, `promos-token.ts` 23/23). (2) El anti-duplicados del webhook dejaba filas vacías con ubicación/reacción y el bot no respondía al texto anterior; ahora se detecta al guardar el mensaje con INSERT, y en archivos antes de descargar (`4bfdd59`, `webhook-duplicados.ts` 16/16 con la ruta real). (3) `INTEGRACION.md` §6: rotar tras publicar con `c006b73`, comprobar la app de Meta de comercial, variables = volver a publicar, pedido de prueba sin tocar stock real. `tsc`, build y pruebas en verde en las dos apps (salvo `ley-imagenes.ts`, de A6). **Fallo nuevo 18:** el mismo anti-duplicados está en producción en quin-comercial. Pendiente: segunda revisión del auditor | desarrollador (Claude) |
| 30-09-2026 | **A1–A5 preparadas en SIMULACRO** (nada escrito en Supabase). `arreglos-supabase/limpieza/`: un script por tarea (simulacro por defecto; escriben solo con `--ejecutar`, con copia local y sha256 antes de tocar nada), `restaurar.ts` y `PLAN-LIMPIEZA.md`. Cruce rehecho contra 30 de 32 tablas (`catalogo_categorias` y `catalogo_variables` no las lee `service_role`: `cruce-solo-lectura.sql`). Medido con archivos reales y el compresor de `agente/P2-P4-ley-peso`: **A2** 18 vídeos, −226,8 MB · **A3** 289, −298,2 MB · **A4** 435, −242,9 MB · **A5** 3 vídeos −33,2 MB (+9 de chat −184,0 MB con D5) · **A1** 715 de 723, −999,8 MB, al final. SSIM ≥ 0,95 en todo (mín. 0,950, medio 0,970). Total 2 502 → **518 MB** (702 sin D5). Hallazgos: el compresor puede bajar de 0,95 en fotos de más de 2 000 px; 8 fotos de `embudos/` ya están bajo 0,95 desde agosto. Cada paso espera el visto bueno de dirección | desarrollador (Claude) |
