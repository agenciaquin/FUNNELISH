# TASKS-PLATAFORMA · Tareas ordenadas

Plan: `PLAN-PLATAFORMA.md`. Se ejecutan **junto con** `TASKS-CONSUMO.md` según la tabla de etapas de la sección 2 del
plan. Cuando una tarea de aquí sustituye o reutiliza una de consumo, se indica.

**Leyenda**
- **App:** `QC` = `quinchat/` · `QCOM` = `quin-comercial/` · `RAIZ` = raíz del repo (ConfirmaYa y documentos) · `SB` = Supabase · `EXT` = cuentas externas.
- **Agente:** desarrollador · pruebas · auditor · humano.
- **Marcas:**
  - `APROB` = necesita aprobación humana explícita antes de ejecutarse.
  - `CUENTA:<x>` = necesita acceso a esa cuenta (`Vercel`, `GitHub`, `SB-QC` = Supabase de quinchat, `SB-QCOM` = Supabase de quin-comercial (no la tenemos), `cron-job.org`, `Meta`, `Funnelish`, `Anthropic`).
  - `PUBLICA` = llegar a `master` despliega al menos una app. Solo dentro de un PR de publicación planificado.
  - `YA` = se puede hacer hoy sin v174 y sin publicar.
- Reglas comunes: nadie envía a `master` directamente ni usa `vercel --prod`; toda tarea de código termina con
  `npx tsc --noEmit -p .` y `npx next build` en verde en cada app tocada; commits pequeños en español que dicen
  `[quinchat]`, `[quin-comercial]`, `[las dos]` o `[docs]`; nada se borra sin aprobación; ningún secreto se pega en el
  repo ni en chats.

---

## FRENTE A · Destrabar

### A1 · Inventario de los despliegues de producción
- **App:** EXT · **Agente:** pruebas · **Marcas:** `YA`, `CUENTA:Vercel` (solo lectura)
- Para `quinchat-agencia-quin`, `quinchat-comercial` y `quinchat`: id del despliegue de producción actual, fecha,
  origen (`cli`/`git`), commit, `gitDirty`, rama; y los 5 despliegues de producción anteriores.
- **Acepta si:** tabla escrita en una sección nueva de `BLOQUEANTES-CONSUMO.md` (o `docs/plataforma/` si ya existe);
  queda confirmado (o desmentido, con datos) que `quinchat-agencia-quin` corre v174 `bff4e19` por CLI y si
  `quinchat-comercial` corre `origin/master` (`5a2f455`) por git. Cualquier sorpresa se anota como hueco abierto.

### A2 · Bajar la instantánea de v174
- **App:** QC · **Agente:** desarrollador · **Marcas:** `YA`, `CUENTA:Vercel` (solo lectura)
- Recorrer el árbol de archivos del despliegue de v174 **nivel a nivel** (no fiarse de un listado en profundidad,
  que ya salió truncado) y bajar cada archivo a una carpeta del scratchpad, **fuera del repo**. Excluir
  `node_modules`, `.next`, `.vercel`.
- **Acepta si:** existe la carpeta con la instantánea completa de `/src/quinchat` (y de `/src/quin-comercial` si
  viene); hay un listado con ruta, tamaño e identificador de cada archivo según la API; el número de hojas del árbol
  está anotado.

### A3 · Demostrar que la instantánea está completa
- **App:** QC · **Agente:** pruebas (auditor revisa) · **Marcas:** `YA`
- **Acepta si** se cumplen las cuatro, escritas con cifras:
  1. archivos bajados = hojas del árbol;
  2. cada archivo coincide con el identificador de contenido de la API (comprobar primero si es SHA-1 del contenido;
     si no lo es, comparar tamaño y anotar la limitación);
  3. `npm ci` y `npx next build` pasan en una copia de la instantánea;
  4. la tabla de rutas del build local coincide con la del registro de construcción de v174 en Vercel.
- Si alguna falla: **A-1 no vale**; se anota por qué y se sigue por A8 (rama de agenciaquin = T0.3 de consumo).

### A4 · Buscar secretos en la instantánea
- **App:** QC · **Agente:** desarrollador, auditor revisa · **Marcas:** `YA`
- **Acepta si:** lista de archivos `.env*` o con claves en texto encontrados (solo nombre y tipo de clave, nunca el
  valor). Si hay alguno: queda excluido de A7 y añadido a la lista de rotación de T4.4 de consumo.

### A5 · Filtro por carpeta en el panel de Vercel
- **App:** EXT · **Agente:** desarrollador (redacta el comando y comprueba que ninguna app importa archivos de fuera
  de su carpeta), humano (lo configura) · **Marcas:** `YA`, `CUENTA:Vercel`, `APROB`
- Comando del "Ignored Build Step" para los tres proyectos: compara la carpeta de la app entre el commit del último
  despliegue (`VERCEL_GIT_PREVIOUS_SHA`) y el actual; **construye** si no puede comparar (variable vacía o commit
  ausente en el clon superficial). No usar `HEAD^`.
- **Acepta si:** búsqueda escrita de importaciones fuera de la carpeta (`../`, alias hacia la raíz) con resultado 0 en
  las dos apps; el comando exacto queda anotado en `docs/plataforma/` (o en `BLOQUEANTES-CONSUMO.md`); el humano
  confirma que está puesto en los tres proyectos. Ningún envío a `master`.

### A6 · Probar el filtro en una rama
- **App:** EXT · **Agente:** pruebas (lee estados por API), humano (si hace falta el panel) · **Marcas:** `YA`, `CUENTA:Vercel`
- Rama `prueba-filtro-despliegue` desde `master` con tres commits enviados por separado: (a) solo un archivo de la
  raíz; (b) solo un comentario en un documento de `quin-comercial/`; (c) solo uno en `quinchat/`. Y un cuarto envío con
  (b) y (c) juntos en dos commits.
- **Acepta si:** (a) ningún proyecto construye; (b) solo `quinchat-comercial`; (c) solo `quinchat-agencia-quin`; el
  cuarto envío construye los dos (prueba de que no se miró solo el último commit). Estados anotados. Rama borrada
  después (con aprobación).

### A7 · Rama `v174-recuperada`
- **App:** QC · **Agente:** desarrollador · **Marcas:** no `YA` (tras A3 y A4 en verde), decisión 1 del plan
- Elegir como base el commit de `master` cuya `quinchat/` difiera en menos archivos de la instantánea (tabla con los
  candidatos y su número de diferencias). Encima, un único commit que deja `quinchat/` igual que la instantánea, sin
  secretos, con el id del despliegue en el mensaje.
- **Acepta si:** `git diff` entre la rama y la instantánea (sin secretos ni carpetas excluidas) es vacío; la rama está
  en GitHub; `master` intacta.

### A8 · Contraste con la rama de agenciaquin (si llega)
- **App:** QC · **Agente:** pruebas · **Marcas:** depende de T0.3 de consumo (humano, PC de agenciaquin)
- **Acepta si:** diff entre `v174-recuperada` y la rama subida por agenciaquin limitado a `quinchat/`: vacío, o cada
  diferencia explicada (trabajo posterior a v174, cambios sin guardar). Si A3 falló, esta rama sustituye a A7.

### A9 · Unión con `master`
- = **T0.4 de `TASKS-CONSUMO.md`**, usando `v174-recuperada` (o la de A8) como v174. Mismo criterio.
- Añadido: el `name` de los dos `package.json` pasa a `quinchat` y `quin-comercial` (D3) en esta misma rama, porque
  esta publicación ya despliega las dos apps.

### A10 · Revisión de la unión
- = **T0.5 de consumo**. Añadido: el auditor confirma que A3 y A4 se hicieron y que ningún secreto entró en git.

### A11 · Publicar la unión
- = **T0.6 de consumo** · **Marcas:** `PUBLICA`, `APROB`, `CUENTA:Vercel`
- Añadido: tras publicar, A1 repetida muestra los dos proyectos con origen `git` y el commit de la unión.

### A12 · Prohibir `vercel --prod` por escrito
- **App:** RAIZ · **Agente:** desarrollador · **Marcas:** `APROB` (cambia `CLAUDE.md`)
- **Acepta si:** `CLAUDE.md` tiene una observación nueva ("Solo GitHub publica", con el porqué: `78d4cac` y v174) y el
  README raíz (B5) lo repite; los agentes de `.claude/agents/` que publican o despliegan lo tienen como prohibición.

### A13 · Roles en el equipo de Vercel
- **App:** EXT · **Agente:** humano · **Marcas:** `CUENTA:Vercel`, `APROB`
- **Acepta si:** queda escrito quién tiene qué rol y si ese rol puede hacer despliegues de producción por CLI
  (comprobado en la documentación de Vercel o con una prueba en un proyecto de ensayo, no supuesto). Si se puede
  restringir, se restringe a quien decida el dueño.

### A14 · Proteger `master` en GitHub
- **App:** EXT · **Agente:** humano · **Marcas:** `CUENTA:GitHub`, `APROB`, tras A11 y B9
- **Acepta si:** `master` exige PR (y, si se quiere, que las construcciones de Vercel estén en verde); un envío
  directo de prueba es rechazado.

### A15 · Versionar el filtro en `vercel.json`
- **App:** QC, QCOM · **Agente:** desarrollador · **Marcas:** `PUBLICA` (solo dentro del PR de la unión o de otro que ya publique)
- **Acepta si:** el `ignoreCommand` de cada `vercel.json` es el mismo comando de A5; el panel de Vercel ya no tiene
  un valor distinto que lo contradiga; A6 repetida con la rama nueva da el mismo resultado.

### A16 · Proyecto `quinchat` (quinchat-sepia)
- **App:** EXT · **Agente:** humano · **Marcas:** `CUENTA:Vercel`, `APROB`
- **Acepta si:** el proyecto está desconectado de GitHub o borrado; se comprobó antes que ningún dominio o
  integración apunta a `quinchat-sepia.vercel.app` (Meta, Funnelish, cron-job.org).

---

## FRENTE B · Ordenar el repositorio

### B1 · Comprobar GitHub Pages
- **App:** RAIZ · **Agente:** humano · **Marcas:** `YA`, `CUENTA:GitHub`
- **Acepta si:** queda escrito si Pages está activo, desde qué rama y carpeta, qué URL tiene ConfirmaYa, si el repo es
  público o privado, y si una URL como `<pages>/CLAUDE.md` o `<pages>/arreglos-supabase/README.md` responde (si
  responde, el repo entero es público: se escala al dueño el mismo día).

### B2 · Inventario de la raíz y de las ramas
- **App:** RAIZ · **Agente:** desarrollador · **Marcas:** `YA`
- **Acepta si:** tabla de lo que está en git en la raíz (`git ls-files`, sin `quinchat/` ni `quin-comercial/`), con
  tamaño y destino propuesto según la estructura del plan; lista de ramas remotas (`dev`, `optimizacion-imagenes`,
  `prueba-compresion-servidor`, `auditoria-consumo`, `bloqueantes-consumo`) con último commit, si están fusionadas y
  propuesta (conservar / borrar).

### B3 · Revisar `_to_delete/` y archivos basura
- **App:** QCOM · **Agente:** desarrollador, auditor revisa · **Marcas:** `YA`
- `quin-comercial/_to_delete/*.txt` y `quin-comercial/components/panel/.fuse_hidden*`.
- **Acepta si:** por cada archivo, qué tipo de dato contiene (claves, teléfonos, datos de clientes, nada sensible) sin
  copiar valores; si hay claves, entran en la lista de rotación (T4.4 de consumo) y se avisa al dueño. Propuesta de
  borrado escrita. **No se borra en esta tarea.**

### B4 · `.gitignore` en la raíz
- **App:** RAIZ · **Agente:** desarrollador · **Marcas:** `YA` si A6 está en verde (no publica)
- **Acepta si:** ignora `node_modules/`, `.next/`, `.vercel/`, `.env*` (salvo ejemplos), `*.tgz`, `*.log`; `git status`
  tras crearlo no muestra archivos nuevos rastreados ni deja de rastrear nada que ya estaba en git.

### B5 · README raíz
- **App:** RAIZ · **Agente:** desarrollador · **Marcas:** `YA` si A6 está en verde
- **Acepta si:** explica qué es cada carpeta y su dominio/proyecto Vercel (tabla de la observación 3), el flujo de B9,
  la marcha atrás, lo prohibido (`vercel --prod`, envío directo, mover archivos dentro de las apps fuera de un PR de
  publicación), dónde están `CLAUDE.md` y `docs/plataforma/`, y qué es ConfirmaYa y dónde se sirve (con lo que diga B1).

### B6 · Mover los documentos de la raíz
- **App:** RAIZ · **Agente:** desarrollador · **Marcas:** `APROB` (de la estructura), requiere A6 en verde y B1 hecho
- Solo `git mv`, en un PR `[docs]`. Se mueven: `CORRECCIONES*.md` y `CORRECCIONES_PLAN.md` → `archivo/correcciones/`;
  `AUDIT_PLAN.md`, `REVERTIR_CHECKOUT_EDITABLE.md` → `archivo/varios/`; embudos, quinchat, guías y prompts → `docs/…`
  según el plan. **No** se mueven: archivos de ConfirmaYa, `CLAUDE.md`, `arreglos-supabase/`, y los documentos de
  consumo/plataforma mientras `bloqueantes-consumo` no esté fusionada.
- **Acepta si:** tras fusionar, ningún proyecto Vercel publica (estado "cancelado por Ignored Build Step" o sin
  despliegue); ConfirmaYa funciona en su URL; `git log --follow` de un archivo movido conserva su historia.

### B7 · Corregir referencias rotas
- **App:** RAIZ · **Agente:** desarrollador · **Marcas:** en el mismo PR que B6
- **Acepta si:** búsqueda de cada nombre movido en todo el repo (salvo `node_modules`) sin referencias a la ruta vieja,
  o cada una corregida.

### B8 · Libros, audios e identidad de marca
- **App:** RAIZ · **Agente:** humano decide; desarrollador mueve · **Marcas:** `APROB` (decisión 7 del plan)
- **Acepta si:** decisión escrita: fuera del repo (con enlace en el README) o a `recursos/`. Si es fuera: copia
  comprobada en el destino (número de archivos y tamaño iguales) **antes** de quitarlos del repo. Queda anotado que
  siguen en el historial de git.

### B9 · Flujo de ramas y plantilla de PR
- **App:** RAIZ · **Agente:** desarrollador · **Marcas:** `YA` si A6 está en verde
- `.github/pull_request_template.md` con: qué app toca, pruebas corridas (con cifras), comprobador de gemelos (D1),
  qué configurar antes de fusionar, quién mira tras publicar.
- **Acepta si:** la plantilla existe, el README la enlaza y el flujo de 5 pasos del plan está escrito.

### B10 · Documentos dentro de las apps
- **App:** QC, QCOM · **Agente:** desarrollador · **Marcas:** `PUBLICA` (solo dentro de un PR que ya publica esas apps)
- `CORRECCIONES_V70…V81.md`, `PROMPT_JOSUE.md`, `CONTINUACION-PROYECTO.md`, `PLAN-FASE5.md` → `docs/quinchat/` y
  `docs/quin-comercial/`. `SETUP_WHATSAPP.md` y `AGENTS.md` se quedan.
- **Acepta si:** `next build` sin cambios en las dos apps; ninguna ruta del código apunta a los documentos movidos.

### B11 · Documentos de plataforma y consumo, y ramas viejas
- **App:** RAIZ · **Agente:** desarrollador; humano aprueba el borrado de ramas · **Marcas:** tras fusionar `bloqueantes-consumo`; `APROB` para borrar ramas
- **Acepta si:** `PLAN-/TASKS-CONSUMO`, `BLOQUEANTES-CONSUMO`, `AUDIT-BLOQUEANTES`, `DISENO-LEY-IMAGENES`,
  `PLAN-/TASKS-PLATAFORMA` están en `docs/plataforma/` con referencias corregidas; las ramas aprobadas en B2 están
  borradas.

### B12 · (Si se decide) ConfirmaYa a su propio repositorio
- **App:** RAIZ · **Agente:** humano (crea el repo y Pages), desarrollador (copia) · **Marcas:** `APROB`, `CUENTA:GitHub` (decisión 3)
- **Acepta si:** ConfirmaYa funciona en la nueva URL con los mismos archivos; Josué y Mallerlis avisados; Pages del
  repo FUNNELISH desactivado; solo entonces se quitan los archivos de ConfirmaYa de este repo (en otro PR `[docs]`,
  con aprobación).

---

## FRENTE C · Panel de control

Rama `control-plataforma` desde la rama unida (tras A11). C1 y el diseño de C7/C10-C13 se pueden escribir `YA` en
una rama desde `bloqueantes-consumo`, sin fusionar.

### C1 · Diseño de datos (SQL sin aplicar)
- **App:** SB · **Archivos:** `quinchat/sql/control-plataforma.sql`, `quin-comercial/sql/control-plataforma.sql` · **Agente:** desarrollador · **Marcas:** `YA`
- Tablas `config_plataforma` (clave, valor, en QCOM también ámbito global/cliente), `config_cambios` (quién, cuándo,
  clave, antes, después), `cron_ejecuciones`, `consumo_ia`, `eventos_sistema`; todas sin permisos para `anon`, con
  `GRANT` explícito a `service_role` (trampa de `pg_default_acl`), índices por fecha y su script de vuelta atrás.
- **Acepta si:** los dos archivos existen, se explican en su cabecera, y el auditor confirma que ninguna tabla queda
  abierta a `anon` ni `authenticated`.

### C2 · Aplicar el SQL
- **App:** SB · **Agente:** humano · **Marcas:** `APROB`, `CUENTA:SB-QC`; en QCOM `CUENTA:SB-QCOM` (no la tenemos)
- **Acepta si:** tablas creadas; consulta de permisos confirma que `anon` no tiene acceso; en QCOM, o aplicado por quien
  tenga la cuenta, o anotado como hueco abierto (C en QCOM queda en interruptor por variable).

### C3 · El freno lee la tabla
- **App:** QC, QCOM · **Archivos:** `lib/freno-bot.ts` (gemelo) · **Agente:** desarrollador · **Marcas:** `YA` (código)
- Apagado si `BOT_IA=off` **o** la tabla dice apagado (en QCOM: global o del cliente). Caché en memoria ≈30 s. Si la
  tabla no se lee: último valor conocido; si no hay, la variable (según decisión 4). Tope diario y tope global por
  hora desde la tabla, con valor por defecto si no es número (T1.1 de consumo).
- **Acepta si:** `pruebas/freno-bot.ts` amplía casos (tabla apagada, variable apagada, tabla caída con y sin valor
  previo, caché que expira, tope global) y pasa en las dos apps; archivo idéntico en las dos (D1).

### C4 · Quién es administrador y rutas de Control
- **App:** QC, QCOM · **Archivos:** `lib/auth.ts` (QC), `app/api/control/*` · **Agente:** desarrollador · **Marcas:** `YA` (código), decisión 5
- QC: lista de administradores comprobada en el servidor. QCOM: `rol === 'superadmin'` para lo global; cliente solo su
  propio interruptor si el dueño lo decide. `GET/PUT /api/control/bot` guarda en `config_cambios`.
- **Acepta si:** prueba nueva `pruebas/control-acceso.ts`: sin sesión → redirige/401; sesión no administradora → 403;
  administrador → 200; un cliente de QCOM no puede cambiar el global ni otro cliente.

### C5 · Sección Control: interruptor y topes
- **App:** QC, QCOM · **Archivos:** `components/panel/ControlPanel.tsx` (gemelo), `Sidebar.tsx` · **Agente:** desarrollador · **Marcas:** `YA` (código)
- **Acepta si:** solo aparece a administradores; muestra estado, "efectivo en ≤ 30 s", último cambio y quién; pide
  confirmación para apagar; **no tiene ningún intervalo de sondeo** (búsqueda de `setInterval` en el componente = 0).

### C6 · Verificar el interruptor en producción
- **App:** QC, QCOM · **Agente:** humano (acciones) + pruebas (registros) · **Marcas:** `PUBLICA` (con la Fase 1 de consumo o justo después), `APROB`, `CUENTA:Meta` (número de prueba)
- **Acepta si:** apagado desde el panel, un WhatsApp de prueba no recibe IA en ≤ 30 s sin republicar; encendido, responde
  una sola vez; `config_cambios` tiene las dos filas; `BOT_IA=off` sigue apagándolo aunque la tabla diga encendido.
  Sustituye la forma de T1.9 de consumo (reactivar el bot) si el dueño lo prefiere.

### C7 · Función SQL de vigilancia de la LEY
- **App:** SB · **Archivos:** `arreglos-supabase/sql/vigilancia-ley-imagenes.sql` (base), `quinchat/sql/control-ley.sql` · **Agente:** desarrollador; humano aplica · **Marcas:** `YA` (redactar), `APROB` + `CUENTA:SB-QC` (aplicar)
- Solo lectura, parámetro "desde", todos los buckets (consulta 1 de `DISENO-LEY-IMAGENES.md`) y peso medio;
  `EXECUTE` solo para `service_role`.
- **Acepta si:** la función existe, `anon` no puede ejecutarla, y su resultado coincide con la consulta a mano.

### C8 · Bloque LEY en Control
- **App:** QC (QCOM cuando exista C7 allí) · **Agente:** desarrollador · **Marcas:** tras Fase 2 de consumo publicada
- **Acepta si:** muestra imágenes sin marca desde la hora de publicación de T2.12 (debe ser 0), peso medio de 7 días y
  enlace al SQL completo; en rojo si > 0.

### C9 · Verificar el bloque LEY
- **Agente:** pruebas · **Acepta si:** en T2.13 de consumo (a la hora, 24 h y 7 días) el número del panel es el mismo que
  el de la consulta a mano.

### C10 · Registro de consumo de IA
- **App:** QC, QCOM · **Archivos:** `lib/quinchat/claude.ts`, `lib/ia-proveedores.ts` (QCOM), llamadas de M5 y crons · **Agente:** desarrollador · **Marcas:** `YA` (código)
- **Acepta si:** cada llamada a Anthropic guarda modelo, tokens de entrada/salida, origen y cliente en `consumo_ia` sin
  bloquear la respuesta si la escritura falla; prueba con cliente simulado; búsqueda de llamadas a la API de Anthropic
  fuera de los puntos registrados = 0 (o lista cerrada justificada). Sirve de línea base para T3.1 de consumo.

### C11 · Registro de ejecuciones de crons
- **App:** QC, QCOM · **Archivos:** `app/api/cron/*/route.ts` (14 en QC, 13 en QCOM), ayudante común gemelo · **Agente:** desarrollador · **Marcas:** `YA` (código)
- **Acepta si:** cada cron escribe inicio, fin, resultado, duración y nº de elementos; las llamadas rechazadas por falta
  de `CRON_SECRET` también dejan fila (resultado "401"); `pruebas/crons.ts` sigue con sus cifras o mejores.

### C12 · Eventos del sistema
- **App:** QC, QCOM · **Archivos:** ayudante único gemelo, puntos clave (`[LEY-IMAGEN]`, webhook rechazado, freno activado, cron fallido, 429) · **Agente:** desarrollador · **Marcas:** `YA` (código)
- **Acepta si:** ningún evento guarda teléfonos, nombres ni textos de mensajes (prueba que lo busca); purga de más de 30
  días en un cron existente (no uno nuevo); los `console.*` actuales se mantienen (los registros de Vercel siguen siendo
  la fuente de detalle).

### C13 · Funciones SQL de consumo de Supabase
- **App:** SB · **Agente:** desarrollador redacta, humano aplica · **Marcas:** `YA` (redactar), `APROB`, `CUENTA:SB-QC` (y `SB-QCOM`)
- **Acepta si:** tamaño de base, peso de storage por bucket/carpeta y top 10 de `pg_stat_statements`, solo lectura,
  `EXECUTE` solo `service_role`; el panel indica que egress y Realtime se miran en Usage (con enlace).

### C14 · Estado de producción desde Vercel y alarma
- **App:** QC (y QCOM) · **Agente:** desarrollador; humano crea el token · **Marcas:** `APROB` (decisión 6), `CUENTA:Vercel`
- **Acepta si:** el bloque muestra commit, origen y fecha del despliegue de producción de los dos proyectos, y se pone en
  rojo si el origen no es `git` o el commit no está en `master`; el token es propio de esta función (no el
  `VERCEL_TOKEN` de dominios) y está anotado su alcance.

### C15 · Sección Control: consumo, crons y errores
- **App:** QC, QCOM · **Archivos:** `components/panel/ControlPanel.tsx` · **Agente:** desarrollador
- **Acepta si:** semáforo por cron (rojo si falló o lleva > 2 intervalos sin correr), consumo de IA por día/origen/cliente
  con coste estimado, bloque Supabase, bloque Vercel, últimos 50 eventos; todo con botón "Actualizar", sin sondeo.

### C16 · Revisión de C y verificación
- **Agente:** pruebas → auditor → humano publica · **Marcas:** `PUBLICA`, `APROB`
- **Acepta si:** a las 24 h de publicar, cada cron de cron-job.org tiene fila; parar uno a propósito lo pone en rojo; la
  suma diaria de `consumo_ia` cuadra ±10 % con el panel de Anthropic (`CUENTA:Anthropic`); `control-acceso.ts` en
  verde; el consumo añadido por las tablas nuevas se compara con la línea base de T3.1 y se anota.

### C17 · (Opcional) Fuentes externas
- **Agente:** humano decide · **Marcas:** `APROB`, `CUENTA:cron-job.org`, `CUENTA:Anthropic`, `CUENTA:Meta`
- **Acepta si:** decisión escrita sobre usar la API de cron-job.org (ver llamadas que nunca llegan), la API de uso y coste
  de Anthropic (clave de administrador) y la analítica de costes de WhatsApp; cada clave con su alcance mínimo.

---

## FRENTE D · Unificar (o no)

### D1 · Comprobador de archivos gemelos e informe de divergencia
- **App:** RAIZ (script), QC, QCOM (lectura) · **Archivos:** `scripts/comprobar-gemelos.mjs`, `scripts/gemelos.json` · **Agente:** desarrollador · **Marcas:** `YA` (en rama; en la raíz no publica si A6 está en verde)
- Sin dependencias (Node puro). Lista inicial: `lib/freno-bot.ts`, `lib/firma-meta.ts`, `lib/imagen-propia.ts`,
  `lib/rate-limit.ts` y los que el desarrollador compruebe hoy idénticos; con modo "informe" que clasifica todo
  `lib/`, `app/api/` y `components/` en idénticos / distintos / solo en una app.
- **Acepta si:** falla (código de salida ≠ 0 y lista) cuando se altera un gemelo en una sola app (prueba provocada);
  pasa en la rama actual; el informe se guarda con fecha en `docs/plataforma/divergencia-<fecha>.md`.

### D2 · Gemelos de la LEY y de Control
- **Agente:** desarrollador · **Marcas:** con la Fase 2 de consumo y con C
- **Acepta si:** `lib/subir-archivo.ts`, `lib/subir-desde-navegador.ts`, `lib/optimizar-imagen-servidor.ts`,
  `lib/imagen-comprimir.ts`, `lib/r2.ts`, `components/panel/ControlPanel.tsx` y los ayudantes de C están en
  `gemelos.json`; T2.11 de consumo y C16 exigen D1 en verde.

### D3 · Nombres distintos en `package.json`
- **App:** QC, QCOM · **Agente:** desarrollador · **Marcas:** `PUBLICA` (dentro de A9)
- **Acepta si:** `quinchat` y `quin-comercial`; `npm ci` y `next build` en verde; los proyectos Vercel construyen igual.

### D4 · Informe de divergencia trimestral
- **Agente:** pruebas · **Marcas:** tras la Fase 4 de consumo
- **Acepta si:** informe nuevo con la misma clasificación que D1 y el recuento de PR `[las dos]` / total del trimestre.

### D5 · Acceso a la base de quin-comercial
- **Agente:** humano · **Marcas:** `CUENTA:SB-QCOM`, `APROB` (decisión 8)
- **Acepta si:** la agencia tiene acceso de administración a esa base (o está trasladada a una cuenta suya), con
  respaldo comprobado; se anota quién más tiene acceso.

### D6 · Decisión sobre unificar
- **Agente:** humano, con informe del auditor · **Marcas:** `APROB`
- **Acepta si:** decisión escrita contra los criterios del plan (> 80 % igual o parametrizable, acceso a la base de
  quin-comercial, > 50 % de PR `[las dos]`, ventana de baja venta). Si es "sí", se encarga un plan propio
  (`PLAN-UNIFICACION.md`) con migración de datos, dominios, webhooks de Meta, cron-job.org y Funnelish, ensayo en copia
  de la base y marcha atrás. Si es "no", se decide si pasar a D7.

### D7 · (Si se decide) Carpeta `compartido/` con copia sincronizada
- **Agente:** desarrollador · **Marcas:** `PUBLICA` (dentro de un PR que ya publique las dos apps)
- **Acepta si:** los gemelos viven en `compartido/`, un script los copia a cada app, D1 compara contra `compartido/`, y
  ninguna app importa nada de fuera de su carpeta (el filtro de A5 sigue siendo válido).

---

## CIERRE

### P1 · Auditoría del plan de plataforma
- **Agente:** auditor · **Marcas:** tras C16 y D6
- **Acepta si:** `AUDIT-PLATAFORMA.md` recorre los criterios globales 1-10 de `PLAN-PLATAFORMA.md` y concluye
  **APROBADO** o **REQUIERE CORRECCIONES** con la lista de fallos.
