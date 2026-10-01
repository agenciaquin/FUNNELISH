# TASKS-CONSUMO · Tareas ordenadas

Plan: `PLAN-CONSUMO.md`. Decisiones humanas: tabla H0-H12 del plan.

**Leyenda**
- **App:** `QC` = `quinchat/` (pedido.klixmant.shop) · `QCOM` = `quin-comercial/` (www.klixmant.shop, tienda.skioo.shop) · `SB` = Supabase · `EXT` = Vercel / Meta / Funnelish / cron-job.org.
- **Agente:** desarrollador · pruebas · auditor · humano.
- **Config/Aprob.:** `—` = ninguna · `CONFIG` = requiere configurar algo fuera del repo · `APROB` = requiere aprobación humana explícita · `HN` = decisión humana del plan.
- **YA:** se puede hacer hoy desde este PC sin v174 (sí/no).
- Reglas comunes: nada se fusiona a `master` ni se publica sin la Fase 0 cerrada; cada tarea de código termina con
  `npx tsc --noEmit -p .` y `npx next build` en verde **en cada app tocada**; commits pequeños en español.

---

## FASE 0 · Unir v174 (bloqueante externo)

### T0.1 · Leer la auditoría y la nota de agenciaquin, y ajustar estas tareas
- **App:** — · **Archivos:** `TASKS-CONSUMO.md`, `PLAN-CONSUMO.md` (solo añadir) · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- Ejecutar `git fetch origin auditoria-consumo` y leer `AUDITORIA-CONSUMO-2026-09-30.md` y `NOTA-PC-AGENCIAQUIN.md`.
- **Acepta si:** cada hallazgo ALTO/MEDIO/BAJO de la auditoría aparece en una tarea (con su ID anotado) o en una
  lista "descartado, porque…"; el procedimiento de unión de v174 de la nota queda copiado en T0.3.

### T0.2 · Lista de comprobación de la unión
- **App:** QC, QCOM · **Archivos:** `BLOQUEANTES-CONSUMO.md` (sección nueva) · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** lista los archivos que deben sobrevivir a la unión con su contenido clave: `lib/optimizar-imagen-servidor.ts`,
  `lib/imagen-comprimir.ts` (PNG comprimidos), `next.config.ts` con `./node_modules/@img/**/*`, `sharp` en
  `package.json`, las 4 rutas que comprimen; y la comprobación "`gitDirty`" del despliegue de v174.

### T0.3 · Subir v174 a GitHub
- **App:** QC · **Agente:** humano (PC de agenciaquin) · **YA:** no · **Config/Aprob.:** H0
- **Acepta si:** existe en GitHub una rama (p. ej. `v174-produccion`) cuyo HEAD es `bff4e19` o un commit que
  contiene exactamente lo desplegado (sin cambios sin guardar). `master` no se ha tocado.

### T0.4 · Unir v174 y `master` en una rama
- **App:** QC, QCOM · **Agente:** desarrollador · **YA:** no (depende de T0.3) · **Config/Aprob.:** —
- **Acepta si:** rama `union-v174` con v174 + `master`; la lista de T0.2 se cumple punto por punto; `tsc` y
  `next build` verdes en las dos apps; `quinchat/pruebas/optimizar-imagen.ts` 18/18; se rehace la tabla de la
  sección 3 del plan sobre esta rama y se anotan diferencias.

### T0.5 · Revisión de la unión
- **Agente:** pruebas, luego auditor · **YA:** no · **Config/Aprob.:** —
- **Acepta si:** pruebas emite LISTO PARA PUBLICAR con comandos y resultados; auditor confirma que ningún cambio
  de v174 se perdió (diff de v174 contra `union-v174` limitado a lo que venía de `master`).

### T0.6 · Publicar la unión
- **App:** QC, QCOM · **Agente:** humano · **YA:** no · **Config/Aprob.:** APROB
- Fusión a `master` con alguien mirando.
- **Acepta si:** los dos proyectos Vercel muestran el commit unido; registros de construcción sin errores; una
  imagen subida por `funnels/imagen` en QC queda con `cacheControl max-age=31536000` y `image/jpeg`; registros de
  ejecución sin `DLOPEN`/`ENOENT` en 1 h. Marcha atrás anotada (despliegue de v174).

### T0.7 · (Opcional) Desacoplar despliegues por carpeta
- **App:** EXT · **Agente:** humano · **YA:** no (tras T0.6) · **Config/Aprob.:** H1, CONFIG
- **Acepta si:** un commit de prueba que solo toca `quin-comercial/` no genera despliegue de producción en
  `quinchat-agencia-quin` (y al revés).

---

## FASE 1 · Publicar los bloqueantes

### T1.1 · Cerrar observaciones abiertas del freno y del token
- **App:** QC, QCOM · **Archivos:** lógica de `BOT_TOPE_DIARIO` y del token de Funnelish (según los commits `fix(bot)` y `fix(funnelish)`) · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** `BOT_TOPE_DIARIO` no numérico usa el valor por defecto (40) y lo avisa en el log, en vez de
  desactivar el tope; `?token=` vacío no anula una cabecera `x-webhook-token` correcta. Documentado en
  `BLOQUEANTES-CONSUMO.md`.

### T1.2 · Pruebas de T1.1
- **App:** QC, QCOM · **Archivos:** `pruebas/freno-bot.ts`, `pruebas/token-funnelish.ts` · **Agente:** pruebas · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** casos nuevos (`cuarenta`, `-1`, `''`; query vacía + cabecera buena) en verde en las dos apps, y
  las cifras previas (22/22, 20/20, 22/22) no bajan.

### T1.3 · Confirmar que el código de producción ignora `?token=`
- **App:** QC, QCOM · **Agente:** desarrollador · **YA:** parcial (QCOM y master sí; QC sobre v174 tras T0.4) · **Config/Aprob.:** —
- **Acepta si:** queda escrito, con archivo y línea, si añadir `?token=` a la URL de Funnelish antes de publicar es
  inocuo. Si no lo es, el orden de T1.6 se invierte y se anota.

### T1.4 · Rebasar `bloqueantes-consumo` sobre la unión
- **App:** QC, QCOM · **Agente:** desarrollador · **YA:** no (tras T0.6) · **Config/Aprob.:** —
- **Acepta si:** rama rebasada, sin conflictos pendientes; `tsc`, `next build` y **todas** las pruebas de la tabla
  de `BLOQUEANTES-CONSUMO.md` con las mismas cifras o mejores.

### T1.5 · Hoja de configuración por proyecto
- **App:** EXT · **Archivos:** `BLOQUEANTES-CONSUMO.md` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** tabla por proyecto Vercel con cada variable (`CRON_SECRET`, `WHATSAPP_APP_SECRET`,
  `FUNNELISH_WEBHOOK_TOKEN`, `BOT_IA`, `BOT_TOPE_DIARIO`), y lista de **todas** las tareas de cron-job.org por
  proyecto con la ruta que llaman (sacada de las rutas `app/api/cron/*` de cada app).

### T1.6 · Configurar antes de publicar
- **App:** EXT · **Agente:** humano · **YA:** sí (no rompe nada con el código actual) · **Config/Aprob.:** CONFIG
- Orden: `CRON_SECRET` en `quinchat-comercial` → clave en todas las tareas de cron-job.org de los dos proyectos →
  `?token=` en Funnelish (si T1.3 lo permite) → `FUNNELISH_WEBHOOK_TOKEN`, `WHATSAPP_APP_SECRET` y `BOT_IA=off`
  en los dos proyectos.
- **Acepta si:** la hoja de T1.5 está marcada entera; nadie ha pegado los valores en chats ni en el repo.

### T1.7 · Publicar bloqueantes
- **App:** QC, QCOM · **Agente:** humano · **YA:** no · **Config/Aprob.:** APROB
- **Acepta si:** los dos proyectos corren el commit con los bloqueantes; registros de construcción limpios.

### T1.8 · Verificar en producción (primeras 48 h)
- **App:** QC, QCOM · **Agente:** humano (acciones) + pruebas (sondeo sin efectos y lectura de registros) · **YA:** no · **Config/Aprob.:** —
- **Acepta si:** WhatsApp de prueba a cada línea llega al panel y no hay `[Webhook] aviso rechazado`; cron-job.org
  24 h en 200; una venta de Funnelish entra; `auditar-rutas-api.ts` desde fuera solo deja abierta la lista
  pública; registros de Vercel sin 401/307 inesperados en `/api/`; notificación de Mercado Pago (QCOM) llega.

### T1.9 · Reactivar el bot
- **App:** QC, QCOM · **Agente:** humano · **YA:** no · **Config/Aprob.:** H2, CONFIG
- **Acepta si:** `BOT_IA` eliminada tras T1.8 en verde; el bot responde a un mensaje de prueba una sola vez; al
  llegar al tope el chat pasa a HUMANO.

---

## FASE 2 · LEY de imágenes

Rama `ley-imagenes` desde `bloqueantes-consumo` (rebasar tras T1.4). Todo el código es **YA: sí**; publicar no.

### T2.1 · Módulo único de escritura `lib/subir-archivo.ts`
- **App:** QC, QCOM (archivo idéntico) · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** existe en las dos apps; con `image/*` llama a `optimizarImagen()`, usa el tipo y extensión que
  devuelve y `cacheControl: CACHE_UN_ANO`; si el compresor falla escribe `[LEY-IMAGEN] sin comprimir <ruta> <motivo>`
  y sube el original; con otros tipos no toca el buffer; soporta Supabase y R2 (`lib/r2.ts`).

### T2.2 · Compresor y `sharp` en quin-comercial
- **App:** QCOM · **Archivos:** `lib/optimizar-imagen-servidor.ts` (copia de QC), `lib/imagen-comprimir.ts` (PNG), `package.json`, `next.config.ts` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** `sharp` en dependencias; `'/api/**'` incluye `./node_modules/@img/**/*` y cualquier otra pieza
  que `sharp` cargue por ruta (enumeradas en el commit, observación 1); `next build` verde; el compresor es
  byte a byte igual al de QC.

### T2.3 · Rutas del panel por el módulo único
- **App:** QC, QCOM · **Archivos:** `app/api/funnels/imagen`, `plantillas-wa/imagen`, `catalogos/upload-imagen`, `funnels/video`, `funnels/audio` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** las cinco usan `subir-archivo`; `video` y `audio` rechazan `image/*` con 400.

### T2.4 · Chat saliente
- **App:** QC, QCOM · **Archivos:** `app/api/whatsapp/send-media/route.ts` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** la imagen se comprime antes de subir y **a Meta se manda el buffer comprimido**; `document`,
  `audio` y `video` no cambian.

### T2.5 · Fotos que entran por WhatsApp
- **App:** QC, QCOM · **Archivos:** `app/api/whatsapp/webhook/route.ts`, `lib/quinchat/ventas.ts` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** toda `image/*` entrante se guarda por `subir-archivo`; queda escrito qué versión (original o
  comprimida) recibe la clasificación M5 y por qué; el tiempo añadido por foto se mide en local y se anota.

### T2.6 · Collages y marcas de agua
- **App:** QC, QCOM · **Archivos:** `lib/collage.ts`, `app/api/funnelish/webhook/route.ts`, `lib/watermark.ts` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** los tres generan el buffer y lo suben por `subir-archivo` (una sola pasada con pérdida, q85);
  QCOM deja de producir JPEG a calidad 100.

### T2.7 · Subidas directas desde el navegador
- **App:** QC, QCOM · **Archivos:** `components/panel/PlantillasPanel.tsx`, `EmbudosPanel.tsx`, `ChatArea.tsx`, `app/api/funnels/upload-url/route.ts`, ruta nueva `app/api/media/procesar/route.ts` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** `PlantillasPanel` sube por `/api/plantillas-wa/imagen` (ya no usa la clave anónima para escribir);
  `upload-url` rechaza `image/*` salvo destino `_entrada/`; una imagen >4 MB tras comprimir en el navegador va a
  `_entrada/`, `/api/media/procesar` la comprime a su ruta final y borra la temporal; el vídeo sigue por URL
  firmada / R2 como hoy.

### T2.8 · Prueba `pruebas/ley-imagenes.ts`
- **App:** QC, QCOM · **Agente:** pruebas · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** (a) parte estática: falla si hay `.upload(`, `createSignedUploadUrl`, `r2Subir`, `r2PresignPut`,
  `/storage/v1/object` o `PutObject` fuera de `lib/subir-archivo.ts` y de una lista cerrada de excepciones
  justificadas; (b) parte funcional, importando el módulo real con un almacenamiento simulado: PNG opaco, PNG con
  transparencia, JPEG de móvil, WebP, GIF y archivo corrupto → salida JPEG/PNG ≤ 1920 px, `cacheControl`
  de 1 año, nunca WebP, el corrupto sube original con el log; PDF y audio intactos. Pasa en las dos apps.

### T2.9 · Revisión visual del chat saliente
- **App:** QC · **Agente:** humano · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** tres capturas reales con texto pequeño (tallas, precios) pasadas por el compresor se leen igual
  que el original.

### T2.10 · Botón "Optimizar fotos" (1080/q72)
- **App:** QC · **Archivos:** `app/api/funnels/optimizar-fotos/route.ts`, `EmbudosPanel.tsx` · **Agente:** humano decide, desarrollador aplica · **YA:** sí (decidir) · **Config/Aprob.:** H6
- **Acepta si:** decisión escrita con agenciaquin enterado; la ruta queda retirada o alineada con `subir-archivo`
  (1920/q85); `ley-imagenes.ts` no la tiene como excepción.

### T2.11 · Revisión de la rama
- **Agente:** pruebas, luego auditor · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** `tsc`, `next build`, `optimizar-imagen.ts`, `ley-imagenes.ts` y las pruebas de bloqueantes en
  verde en las dos apps; auditor confirma que cada fila de la sección 3 del plan está cubierta.

### T2.12 · Publicar la LEY
- **App:** QC, QCOM · **Agente:** humano · **YA:** no (tras T1.8) · **Config/Aprob.:** APROB
- **Acepta si:** registro de construcción de los dos proyectos sin errores; se anota la hora exacta de publicación
  (la usa T2.13).

### T2.13 · Verificar la LEY en producción
- **App:** QC, QCOM, SB · **Agente:** humano (subidas reales) + pruebas (SQL de solo lectura y registros) · **YA:** no · **Config/Aprob.:** —
- **Acepta si:** por cada app, una subida real por embudo, catálogo, plantilla, chat (<4 MB y >4 MB) y una foto
  entrante por WhatsApp quedan en `storage.objects` con `max-age=31536000`; la consulta "imágenes posteriores a la
  publicación, fuera de `_originales/` y `_entrada/`, sin caché de 1 año" da **0** a la hora, a las 24 h y a los 7
  días; registros sin `DLOPEN`/`ENOENT`; `[LEY-IMAGEN] sin comprimir` en 0 o explicado.

### T2.14 · Añadir la consulta de la LEY al chequeo mensual
- **App:** SB · **Archivos:** `arreglos-supabase/sql/004_chequeo_consumo.sql` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** el chequeo devuelve también el recuento de imágenes sin la marca de la LEY por carpeta, y el
  veredicto pasa a REVISAR si es mayor que 0.

### T2.15 · Backfill de lo que entró sin comprimir
- **App:** SB · **Archivos:** `arreglos-supabase/media-api` · **Agente:** desarrollador prepara (simulación), humano aprueba y lanza · **YA:** simulación sí; aplicar no (tras T2.13) · **Config/Aprob.:** H10, APROB
- **Acepta si:** simulación lista con recuento y peso (esperado ~109 imágenes / 134 MB desde el 31-08, y 389 /
  289 MB de chat saliente si H10 lo incluye); tras aplicar, esas imágenes tienen la marca de la LEY, el original
  está en `_originales/`, `validar-todo.ts`, `validar-landings.ts` (31/31) y `validar-whatsapp.ts` en verde.

---

## FASE 3 · Consumo del panel y las landings

### T3.1 · Línea base de consumo
- **App:** SB, EXT · **Agente:** pruebas (lectura) + humano (paneles con sesión) · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** queda en `arreglos-supabase/sql/salidas/LINEA-BASE-consumo-<fecha>.md`: egress, mensajes
  Realtime y conexiones (Supabase Usage), top 10 de `pg_stat_statements` por llamadas y tiempo, invocaciones de
  funciones por ruta en los dos proyectos Vercel, y Logs Ingest del mes.

### T3.2 · Realtime de `conversations` sin recarga completa
- **App:** QC, QCOM · **Archivos:** `components/panel/WhatsAppPanel.tsx`, `EstadisticasPanel.tsx` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** un cambio en una conversación actualiza esa fila con el `payload` en lugar de recargar la lista
  entera; `EstadisticasPanel` agrupa recargas (una como mucho cada N s, N anotado).

### T3.3 · Sondeos del panel
- **App:** QC, QCOM · **Archivos:** `WhatsAppPanel.tsx` (6 s), `MonederoFlotante.tsx` y `MetasPanel.tsx` (12 s), `EstadisticasPanel.tsx`, `PedidosPanel.tsx`, `IntegrarIaPanel.tsx` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** el sondeo del chat solo corre si el canal Realtime no está `SUBSCRIBED`; los demás suben a los
  intervalos acordados en T0.1 (o, si la auditoría no los fija, ≥ 60 s) y solo con la pestaña visible;
  `IntegrarIaPanel` también respeta la visibilidad.

### T3.4 · Prueba del "en vivo"
- **App:** QC, QCOM · **Agente:** pruebas · **YA:** sí (local) · **Config/Aprob.:** —
- **Acepta si:** en local, con el canal forzado a caer, el panel recupera mensajes por sondeo; con el canal activo,
  no se hace ninguna petición de sondeo en 2 min (contadas en la red del navegador o en el registro).

### T3.5 · ISR en landings
- **App:** QC, QCOM · **Archivos:** `app/p/[slug]/page.tsx`, `pedido/page.tsx`, `gracias/page.tsx`, `app/tienda/page.tsx`, ruta de guardado de embudos · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** las páginas sin datos por visitante dejan `force-dynamic` y usan `revalidate`; guardar un embudo
  llama a `revalidatePath` de su landing; las páginas con datos por visitante se quedan dinámicas y se justifica.

### T3.6 · Guardado del carrito
- **App:** QC, QCOM · **Archivos:** `components/publico/FormularioPedido.tsx`, `CheckoutPro.tsx` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** el guardado del carrito abandonado ya no se dispara cada 1,5 s de escritura; solo al cambiar
  teléfono/nombre/producto y con espera ≥ 5 s o al salir del campo; el cron de recuperación sigue encontrando el
  carrito (prueba en local).

### T3.7 · Seguimiento agrupado
- **App:** QC, QCOM · **Archivos:** según la auditoría (T0.1) · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** el cron de seguimiento hace un número de consultas acotado por lote (no una por conversación),
  medido en local con datos de prueba; `crons.ts` sigue en verde.

### T3.8 · Collages sin ráfagas (defecto nº 5)
- **App:** QC, QCOM · **Archivos:** `lib/collage.ts` · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** —
- **Acepta si:** descarga de una en una con reintento y espera ante 429; prueba de módulo con descargas simuladas
  que fallan una vez y el collage sale completo.

### T3.9 · M5 y transcripción antes del freno
- **App:** QC, QCOM · **Agente:** humano decide, desarrollador aplica · **YA:** decidir sí · **Config/Aprob.:** H3
- **Acepta si:** decisión escrita (con negocio) sobre cuándo se clasifica una foto y cómo afecta al marcado de
  abonos; implementada y cubierta en `freno-bot.ts`.

### T3.10 · Publicación Realtime de Supabase
- **App:** SB · **Agente:** desarrollador (consulta de solo lectura y propuesta), humano aplica · **YA:** sí (propuesta) · **Config/Aprob.:** APROB
- **Acepta si:** lista de tablas en `supabase_realtime` frente a las que el código escucha; se quitan solo las que
  nadie escucha, con su vuelta atrás escrita.

### T3.11 · Decisión y ejecución sobre los 38 vídeos (515 MB)
- **App:** SB, EXT · **Agente:** humano decide; desarrollador prepara con `media-api` · **YA:** decidir y simular sí · **Config/Aprob.:** H5, APROB
- **Acepta si:** decisión escrita; si se recomprime, simulación con peso antes/después y los vídeos siguen
  reproduciendo en las landings (`validar-landings.ts` 31/31); si se mueven a R2, las URLs de `funnels` se
  actualizan y la carpeta vieja se conserva hasta verificar.

### T3.12 · Revisión, publicación y medición
- **Agente:** pruebas → auditor → humano publica · **YA:** no · **Config/Aprob.:** APROB
- **Acepta si:** a los 7 días, frente a T3.1: bajan los mensajes Realtime y las llamadas de la consulta nº 1,
  bajan las invocaciones de las landings; un WhatsApp entrante aparece en el panel en < 5 s; editar un embudo se
  ve en la landing al recargar.

---

## FASE 4 · Seguridad de Supabase y limpieza

### T4.1 · Fase 1 de seguridad: revocar 12 tablas sin uso
- **App:** SB · **Archivos:** `arreglos-supabase/sql/000…003` · **Agente:** humano ejecuta; pruebas vigila registros · **YA:** sí · **Config/Aprob.:** H9, APROB
- **Acepta si:** salida de `000` guardada; `003_verificacion.sql` da 4 filas; 48 h en el Logs Explorer sin
  401/403 nuevos (consulta del README); rollback preparado por tabla.

### T4.2 · Quick wins de los otros proyectos
- **App:** SB (`master-quin`, `confirma-ya`) · **Agente:** humano · **YA:** sí · **Config/Aprob.:** APROB
- **Acepta si:** revocado `EXECUTE` de `handle_new_user()` y `prevent_role_escalation()` a `anon, authenticated`;
  protección de contraseñas filtradas activa; `search_path` fijo en `set_tenant_id_from_jwt`; advisors sin esos avisos.

### T4.3 · Spend Cap y avisos
- **App:** SB · **Agente:** humano · **YA:** sí · **Config/Aprob.:** H11
- **Acepta si:** decisión sobre Spend Cap escrita y el correo de facturación confirmado (alguien lo lee).

### T4.4 · Rotar la clave `service_role`
- **App:** SB, EXT · **Agente:** desarrollador (lista de sitios), humano rota · **YA:** lista sí; rotar tras Fase 1 · **Config/Aprob.:** H4, APROB, CONFIG
- **Acepta si:** lista completa de sitios que la usan (dos proyectos Vercel, `media-api/.env`, PC de agenciaquin,
  cualquier otro); tras rotar, la clave vieja da 401, las dos apps escriben y leen, y `media-api` funciona.

### T4.5 · Sacar del navegador las lecturas anónimas de `messages`/`conversations`
- **App:** QC, QCOM · **Agente:** desarrollador · **YA:** sí (código) · **Config/Aprob.:** — (depende de T3.2-T3.4)
- **Acepta si:** las 3 llamadas anónimas (GET/PATCH `conversations`, GET `messages`) pasan por rutas con sesión;
  el "en vivo" usa el modelo elegido en Fase 3 sin depender de `SELECT` de `anon`; prueba en local con esos
  permisos revocados en una base de prueba o simulados.

### T4.6 · Cerrar `messages`, `conversations` y la subida anónima al bucket
- **App:** SB · **Agente:** humano · **YA:** no (tras publicar T4.5 y T2.7) · **Config/Aprob.:** H9, APROB
- **Acepta si:** `anon` sin permisos sobre las dos tablas y sin política de escritura en `storage.objects`; panel y
  landings funcionando; 48 h sin 401/403 nuevos.

### T4.7 · `_originales/` (~1 GB)
- **App:** SB · **Agente:** humano decide; desarrollador prepara copia y lista · **YA:** decidir sí; borrar no · **Config/Aprob.:** H7, APROB
- **Acepta si:** solo tras 7 días de T2.13 en verde y T2.15 terminado; si H7 = (b), copia fuera de Supabase
  comprobada (recuento y tamaño iguales); tras borrar, Storage baja ~1 GB en Usage, `validar-landings.ts` 31/31.
  Los originales del backfill de T2.15 se tratan igual, con su propia semana de espera.

### T4.8 · Limpieza menor de la base
- **App:** SB · **Agente:** desarrollador propone, humano aplica · **YA:** sí · **Config/Aprob.:** APROB
- **Acepta si:** índice duplicado de `carritos_abandonados` eliminado, `vendedor_reportes` con clave primaria,
  índices sin uso revisados uno a uno; ningún error nuevo en 48 h.

### T4.9 · Firma de Meta por cliente en quin-comercial
- **App:** QCOM · **Agente:** desarrollador · **YA:** sí · **Config/Aprob.:** H12, CONFIG
- **Acepta si:** cada cliente con app de Meta propia tiene su clave guardada (sin exponerla a `anon`) y
  `/api/whatsapp/webhook/<cliente>` rechaza firmas malas; `firma-meta.ts` cubre el caso por cliente.

### T4.10 · Auditoría final
- **Agente:** auditor · **YA:** no · **Config/Aprob.:** —
- **Acepta si:** `AUDIT-CONSUMO.md` recorre los criterios globales 1-11 de `PLAN-CONSUMO.md` y concluye APROBADO o
  REQUIERE CORRECCIONES con la lista de fallos.
