# PLAN-PLATAFORMA · Hacer la plataforma manejable

**Fecha:** 30-09-2026 · **Rama:** `bloqueantes-consumo` (este documento no se publica: no toca ninguna app)
**Autor:** agente planeador. Sin código. Las tareas están en `TASKS-PLATAFORMA.md`.
**Alcance:** `quinchat/` (pedido.klixmant.shop), `quin-comercial/` (www.klixmant.shop, tienda.skioo.shop), la raíz
del repositorio (ConfirmaYa y documentos) y las cuentas externas (Vercel, Supabase, cron-job.org, Meta, Funnelish).

> `PLAN.md` y `TASKS.md` de la raíz son de ConfirmaYa y no se tocan. `PLAN-CONSUMO.md` y `TASKS-CONSUMO.md` siguen
> vigentes: **este plan los envuelve** (sección 2) y solo cambia una decisión suya (la de la Fase 0, ver A).

---

## 0 · Fuentes y huecos de lectura

| Fuente | Leída | Nota |
| --- | --- | --- |
| `CLAUDE.md` (observaciones 1-5 y LEY) | Sí | |
| `PLAN-CONSUMO.md`, `TASKS-CONSUMO.md` | Sí | Fases 0-4 y decisiones H0-H12 |
| `BLOQUEANTES-CONSUMO.md`, `AUDIT-BLOQUEANTES.md` | Sí | |
| `DISENO-LEY-IMAGENES.md`, `arreglos-supabase/README.md`, `sql/vigilancia-ley-imagenes.sql` | Sí | |
| Estructura real del repo (búsqueda de archivos) | Sí | Inventario en B |
| Código relevante: `lib/freno-bot.ts`, `lib/auth.ts`, `app/api/ajustes`, rutas `cron/*`, `vercel.json`, `package.json` de las dos apps, `lib/dominios-vercel.ts` | Sí, por búsqueda | |
| `AUDITORIA-CONSUMO-2026-09-30.md` y `NOTA-PC-AGENCIAQUIN.md` (rama `auditoria-consumo`) | **No** | La rama ya existe en este equipo (`.git/refs/heads/auditoria-consumo`), pero su contenido está dentro de los objetos de git y el planeador no tiene consola para `git show`. Se usa el resumen de `PLAN-CONSUMO.md`. T0.1 de `TASKS-CONSUMO.md` sigue siendo la primera tarea del desarrollador. |
| Estado real de GitHub Pages, de los tres proyectos Vercel y de cron-job.org | **No** | Requiere cuentas. Todo lo que dependa de eso se marca como "por comprobar" y tiene su tarea. |

---

## 1 · Situación de partida que condiciona todo

1. **Producción de quinchat corre v174 (`bff4e19`), publicada a mano con `vercel --prod`.** Ese commit no está en
   GitHub. `master` (`5a2f455`) tiene el compresor, que producción no tiene.
2. **Cualquier envío a `master` publica** `quinchat-agencia-quin` y `quinchat-comercial` (y construye el proyecto
   `quinchat`, creado por error, que atiende `quinchat-sepia.vercel.app`). Los `vercel.json` de las dos apps están
   vacíos (`{}`): no hay ningún filtro por carpeta. Hoy un cambio en un documento de la raíz republica las dos tiendas
   y **borra v174 de producción**.
3. Las dos apps tienen el mismo `name` en `package.json` (`quinchat-agencia-quin`).
4. La raíz no tiene `README.md` ni `.gitignore`. Mezcla ConfirmaYa (`index.html`, `historial.html`,
   `billetera.html`, `remarketing.html`, 8 archivos `.js`, `styles.css`, `img/`), ~50 documentos de trabajo, audios,
   PDF de libros y la identidad de marca. Dentro de las apps hay también `CORRECCIONES_V*.md` y
   `quin-comercial/_to_delete/` (6 volcados `.txt`: `tenants.txt`, `wap_check.txt`, `wh3.txt`…, posiblemente con
   datos de clientes o claves).
5. El bot se apaga con la variable `BOT_IA=off` (`lib/freno-bot.ts:21`, idéntico en las dos apps): **cambiarla exige
   republicar**. El tope es `BOT_TOPE_DIARIO` (por defecto 80), igual.
6. Acceso: tenemos la cuenta de Supabase de quinchat (`bjbjqmbuzpyjvcugbusx`) y lectura de Vercel. **No** tenemos la
   base de quin-comercial (otra cuenta). quin-comercial ya tiene rol `superadmin` (`lib/auth.ts`, `api/admin/tenants`);
   quinchat tiene dos usuarios fijos en código (`agenciaquin43@`, `gerenciaquin7@`) sin roles.

---

## 2 · Orden recomendado de los cuatro frentes y encaje con PLAN-CONSUMO

**Orden: A → B (solo raíz) → [Consumo Fase 1] + C1 → [Consumo Fase 2] + C2 → [Consumo Fase 3] + C3 → D (decisión).**
La parte barata de D (comprobador de archivos gemelos) empieza ya, porque la Fase 2 va a crear archivos que deben
ser idénticos en las dos apps.

Por qué este orden:
- **A va primero porque todo lo demás lo necesita.** Mientras publicar sea destructivo, nada de B, C, D ni del plan
  de consumo llega a producción. Y dos piezas de A **no requieren ningún envío a `master`** (leer el despliegue de
  v174 por la API de Vercel y configurar el "Ignored Build Step" en el panel de Vercel), así que se pueden hacer hoy.
- **B (raíz) va justo después del filtro por carpeta**, y puede ir incluso *antes* de unir v174: si el filtro está
  verificado, mover documentos de la raíz a `docs/` no dispara ningún despliegue de las apps. Es la primera prueba
  real de que el filtro funciona en `master`. Los movimientos **dentro** de las apps esperan a una publicación
  planificada.
- **C se parte en tres** para ir detrás de lo que vigila: C1 (interruptor del bot y topes en tabla) acompaña la
  Fase 1 de consumo, porque el dueño quiere reactivar el bot sin republicar; C2 (vigilancia de la LEY) no tiene
  sentido hasta que la LEY esté publicada; C3 (consumo, crons, errores) sirve de línea base para la Fase 3.
- **D (unificar) va al final** y como decisión con datos, no como obra: es el cambio más caro y arriesgado, y ninguna
  de las urgencias actuales lo necesita.

Cómo queda la línea de tiempo combinada:

| Etapa | Plataforma | Consumo (`TASKS-CONSUMO.md`) | ¿Publica? |
| --- | --- | --- | --- |
| 1 · Ya, sin envíos a `master` | A1-A6 (leer y bajar v174, filtro por carpeta en el panel, probarlo en una rama), B1-B3 (inventario), D1 (comprobador de gemelos, en rama) | T0.1, T0.2, T1.1-T1.3, T1.5; código de Fase 2 en rama | No |
| 2 · Unión | A7-A11 (rama `v174-recuperada`, unión, publicación con alguien mirando), más A15 y D3 dentro del mismo PR | **sustituye T0.3** y hace T0.4-T0.6 | Sí, las dos apps |
| 3 · Orden | A12-A14, A16 (solo GitHub publica), B4-B9 (raíz, README, flujo de ramas, plantilla de PR) | — | No (si A6 salió en verde) |
| 4 · Bloqueantes + interruptor | C1-C6 | Fase 1 (T1.4-T1.9) | Sí |
| 5 · LEY + vigilancia | C7-C9, D2 | Fase 2 | Sí |
| 6 · Consumo | C10-C16 | Fase 3 (C10 da la línea base de T3.1) | Sí |
| 7 · Decisión | D4-D6, B10-B11 (movimientos dentro de las apps, en una publicación planificada) | Fase 4 | Según decisión |

**Cambio respecto a `PLAN-CONSUMO.md`:** la Fase 0 decía "no reconstruir v174 a partir del despliegue de Vercel". Este
plan propone hacerlo **si y solo si** la descarga se demuestra completa y byte a byte igual a lo desplegado (A3-A4).
No es adivinar: es copiar lo que Vercel construyó. Necesita aprobación del dueño (decisión 1).

---

## Frente A · Destrabar sin depender del PC de agenciaquin

**Objetivo:** que `master` contenga lo que corre en producción, que publicar deje de ser destructivo, que un cambio en
una app no republique la otra, y que GitHub sea la única vía a producción.

### Opciones evaluadas

| # | Opción | Pros | Contras | Veredicto |
| --- | --- | --- | --- | --- |
| A-1 | **Recuperar v174 del propio despliegue de Vercel.** Los despliegues hechos por CLI guardan los archivos subidos; la API permite listar el árbol (`/v6/deployments/{id}/files`) y bajar cada archivo por su id. El listado ya mostró `/src/quinchat` y `/src/quin-comercial`, pero truncado en profundidad | No depende de nadie. Es **exactamente** lo que se construyó, incluidos cambios sin guardar (`gitDirty`), que una rama de git no traería | Sin historial (una sola instantánea). Hay que demostrar que está completo: el listado truncado no prueba nada. Puede contener archivos que no deben ir a git (un `.env`: la CLI solo excluye por defecto `.env.local` y `.env.*.local`). No se conoce el padre de `bff4e19` | **Recomendada**, con verificación de completitud |
| A-2 | Que agenciaquin suba su rama | Historial real, autoría | Depende de una persona y un PC; ya lleva días bloqueado; puede traer trabajo posterior a v174 sin publicar; si v174 se desplegó con cambios sin guardar, su commit no es lo desplegado | **Complemento**: si llega, se compara con A-1 (diff vacío = doble confirmación) |
| A-3 | **Desacoplar despliegues por carpeta** ("Ignored Build Step" en el panel de Vercel, o `ignoreCommand` en `vercel.json` de cada app) | Un cambio en una app no republica la otra; los cambios de documentos de la raíz no publican nada. Configurarlo **en el panel no requiere envío** | Con `git diff HEAD^ HEAD` solo se mira el último commit: un envío de varios commits puede saltarse un despliegue que tocaba. Poner `ignoreCommand` en `vercel.json` es un commit **dentro** de la app, que la publica. **No protege v174**: el primer cambio en `quinchat/` la borraría igual | **Recomendada ya**, en el panel; comparar contra el último despliegue, no contra `HEAD^` |
| A-4 | Prohibir `vercel --prod`; GitHub como única vía | Evita que se repita el desfase (ya pasó dos veces: `78d4cac` con `gitDirty` y v174) | Vercel no tiene un interruptor claro para "solo producción desde git"; hay que combinar regla escrita, roles del equipo en Vercel (por comprobar si algún rol impide `--prod`) y una alarma | **Recomendada tras la unión** |

### Recomendación

**A-1 + A-3 ahora, A-2 como contraste si llega, A-4 al cerrar la unión.** En orden:

1. **Leer sin tocar (Vercel, solo lectura).** Identificar el despliegue de producción actual de los tres proyectos:
   id, fecha, origen (`cli` o `git`), commit y marca `gitDirty`. Confirmar que `quinchat-comercial` corre
   `origin/master` y no otra instantánea hecha a mano.
2. **Bajar v174 completa** a una carpeta de trabajo fuera del repo (scratchpad), recorriendo el árbol nivel a nivel
   (no fiarse de un listado en profundidad). Excluir `node_modules`, `.next`, `.vercel`.
3. **Demostrar que está completa:** (a) número de archivos bajados = número de hojas del árbol; (b) cada archivo
   coincide con el identificador de contenido que da la API (por comprobar si es SHA-1 del contenido; si no, comparar
   tamaños); (c) `npm ci` + `next build` en local pasan; (d) la tabla de rutas de ese build coincide con la tabla de
   rutas del registro de construcción de v174 en Vercel. Si cualquiera falla: A-1 no vale y se vuelve a A-2.
4. **Buscar secretos** en la instantánea (`.env*`, claves en texto). Si hay: no se copian al repo; se anota que la
   instantánea en Vercel los contiene y se incluye en la rotación de claves (H4 de consumo).
5. **Rama `v174-recuperada`:** se elige como base el commit de `master` cuya carpeta `quinchat/` se parezca más a la
   instantánea (menos archivos distintos); encima, un solo commit que deja `quinchat/` igual que la instantánea
   (sin secretos) y dice en el mensaje de qué despliegue viene. Así la unión con `master` es de tres vías y los
   conflictos son reales, no inventados.
6. **Unión** = T0.4-T0.6 de consumo, sin cambios: lista de T0.2, compresor, `@img/**`, pruebas, auditor, publicación
   con alguien mirando, marcha atrás al despliegue de v174 desde el panel.
7. **Filtro por carpeta en el panel** (antes de la unión, sin envío): en los tres proyectos, "Ignored Build Step" con
   un comando que compare la carpeta de la app entre el commit del **último despliegue** y el actual (Vercel expone
   `VERCEL_GIT_PREVIOUS_SHA`) y **construya si no puede comparar** (sin commit anterior, o el commit no está en el
   clon superficial). Se prueba con una rama que no sea `master` (las vistas previas también lo respetan): un commit
   que solo toca la raíz no debe construir ningún proyecto; uno que toca `quin-comercial/` solo construye
   `quinchat-comercial`. Más adelante el mismo comando se versiona en `vercel.json`, **dentro de un PR que ya iba a
   publicar esa app** (nunca en un commit suelto): el candidato es el PR de la unión.
8. **Proyecto `quinchat` (sepia):** desconectarlo de GitHub o borrarlo (aprobación). Construye en cada envío sin
   servir a nadie y confunde.
9. **Solo GitHub publica:** regla en `CLAUDE.md`; protección de `master` en GitHub (PR obligatorio); revisar roles del
   equipo de Vercel (quién puede `--prod`); y una alarma en el panel de control (C) que avise si el despliegue de
   producción tiene origen `cli` o su commit no está en `master`.

### Riesgos
- **Instantánea incompleta que parece completa** (el riesgo principal de A-1). Mitigación: las cuatro comprobaciones
  del punto 3 son obligatorias y las revisa el auditor.
- **Secretos en la instantánea.** Mitigación: punto 4; nunca se añade un `.env` al repo.
- **El filtro por carpeta se salta un despliegue necesario** (p. ej. un cambio en un archivo fuera de la carpeta del
  que la app dependa). Hoy ninguna app debería importar nada de fuera de su carpeta (se comprueba en A5); si D
  introduce una carpeta compartida, el comando tiene que incluirla.
- **Publicar la unión trae de golpe todo lo que `master` lleva por delante** (compresor, bloqueantes si ya están).
  Mitigación: igual que consumo, publicar con alguien mirando y la marcha atrás anotada.
- **Observación 2:** las vistas previas piden sesión; la prueba del filtro se ve en el estado del despliegue
  ("cancelado por Ignored Build Step"), no ejercitando rutas.

### Cómo se verifica
- Descarga: las cuatro comprobaciones del punto 3, escritas con cifras.
- Unión: los criterios de T0.6 de consumo.
- Filtro: salida de la API (o capturas) con el estado de los despliegues de la rama de prueba.
- Solo GitHub: el despliegue de producción de los dos proyectos tiene origen `git` y su commit es de `master`;
  la protección de `master` rechaza un envío directo.

**Esfuerzo:** medio (descarga y verificación, 1-2 días; filtro, horas; unión, lo que diga consumo).

---

## Frente B · Ordenar el repositorio

**Objetivo:** que cualquiera abra el repo y sepa qué es cada cosa, dónde escribir un documento nuevo y cómo llega un
cambio a producción, sin romper ConfirmaYa ni publicar por accidente.

### Hechos que condicionan
- **ConfirmaYa usa rutas relativas** (`styles.css`, `app.js`, `catalogo.js`, `img/…`, `historial.html`,
  `billetera.html`, `remarketing.html`). Si GitHub Pages sirve la raíz de `master`, **mover cualquiera de esos archivos
  rompe ConfirmaYa**. No se ha podido comprobar si Pages está activo ni desde qué rama/carpeta (B1).
- **Si Pages sirve la raíz de `master`, publica todo el repositorio**: los `.md` (Jekyll los convierte en páginas),
  los PDF de libros, los audios, `arreglos-supabase/` con hallazgos de seguridad, `_to_delete/`. Aunque el repo sea
  privado, el sitio de Pages es público (salvo planes Enterprise). Esto es más grave que el desorden y hay que
  confirmarlo primero.
- GitHub Pages solo admite como origen la raíz o `/docs` de una rama. **Crear `docs/` en la raíz es seguro solo si
  Pages no está configurado en `/docs`.**
- Mover algo dentro de `quinchat/` o `quin-comercial/` publica esa app, incluso con el filtro por carpeta.

### Opciones para ConfirmaYa
| Opción | Pros | Contras |
| --- | --- | --- |
| Dejar ConfirmaYa en la raíz y ordenar alrededor | Cero riesgo para ConfirmaYa | Si Pages está activo, sigue publicando todo el repo |
| Pages desde una rama `gh-pages` que solo contenga ConfirmaYa | Deja de publicar documentos; ConfirmaYa sigue igual | Hay que mantener esa rama (copiar al cambiar ConfirmaYa) |
| **ConfirmaYa a su propio repositorio** (con su Pages) | Separa de verdad una herramienta HTML de dos apps Next | Cambia la URL que usan Josué y Mallerlis; hay que avisar |

**Recomendación:** comprobar Pages (B1). Si está activo desde `master`, **ConfirmaYa a su propio repo** (decisión
del dueño) y, mientras tanto, no mover nada suyo. Si Pages no está activo, dejar ConfirmaYa en la raíz y ordenar el
resto. En los dos casos, sus archivos (`PLAN.md`, `TASKS.md`, `AUDIT.md`, `PROMPT_CONFIRMAYA.md`) se quedan donde
están hasta la separación, porque los agentes de `.claude/agents/` los esperan en la raíz.

### Estructura propuesta (solo `git mv`, nada se borra sin aprobación)

```
/                              README.md (nuevo), CLAUDE.md, .gitignore (nuevo)
                               ConfirmaYa: index.html, historial.html, billetera.html, remarketing.html,
                               styles.css, app.js, catalogo.js, historial.js, billetera.js, remarketing.js,
                               generar-catalogo.js, upload-audios.js, img/, PLAN.md, TASKS.md, AUDIT.md,
                               PROMPT_CONFIRMAYA.md   (se queda hasta decidir su separación)
quinchat/                      app (sin mover nada hasta una publicación planificada)
quin-comercial/                app (idem)
arreglos-supabase/             se queda (autónomo, tiene su README)
scripts/                       comprobador de gemelos (D1)
.github/                       plantilla de PR (B9)
docs/
  plataforma/                  PLAN-PLATAFORMA, TASKS-PLATAFORMA, PLAN-CONSUMO, TASKS-CONSUMO,
                               BLOQUEANTES-CONSUMO, AUDIT-BLOQUEANTES, DISENO-LEY-IMAGENES
                               (cuando `bloqueantes-consumo` esté fusionada; antes, se quedan)
  embudos/                     ESTRUCTURA_COMPLETA_EMBUDOS, SOLO_ESTRUCTURA_EMBUDOS, EMBUDO_MEJORAS_COMPLETO.md/.html
  quinchat/                    MEMORIA_QUINCHAT, PAQUETE_REPLICACION_QUINCHAT, PLAN_BOT_VENTAS,
                               HISTORIAL_Y_ESTRUCTURA, INFORME_COMPLETO_PROYECTO
  guias/                       COPIAR-CARRITOS-ABANDONADOS, COPIAR-VARIABLES-POLOS
  prompts/                     PROMPTS_BLOQUES_UNO_POR_UNO, PROMPT_EDITAR_CHECKOUT_EN_TELEFONO,
                               PROMPT_PRODUCTOS_DEL_CHECKOUT
archivo/
  correcciones/                CORRECCIONES.md, CORRECCIONES_PLAN.md, CORRECCIONES_V7…V70.md (raíz)
  varios/                      AUDIT_PLAN.md, REVERTIR_CHECKOUT_EDITABLE.md
recursos/  (o fuera del repo)  AUDIOS/, IDENTIDAD DE MARCA/, LIBROS DE VENTAS/
```

- **`recursos/` o fuera del repo:** los PDF de libros (probablemente con derechos de autor) y los audios de clientes no
  deberían estar en un repositorio de código, y menos si Pages publica la raíz. Recomendación: sacarlos a una unidad
  compartida (Drive) y dejar en el README el enlace. Borrarlos del repo es decisión del dueño; aun borrados, siguen en
  el historial de git (limpiar el historial es otra decisión, más cara).
- **Dentro de las apps** (en una publicación planificada, B10): `CORRECCIONES_V70…V81.md`, `PROMPT_JOSUE.md`,
  `CONTINUACION-PROYECTO.md`, `PLAN-FASE5.md` → `docs/quinchat/` y `docs/quin-comercial/`; `SETUP_WHATSAPP.md` y
  `AGENTS.md` se quedan (son de la app). `components/panel/.fuse_hidden*` → archivo basura, a la lista de borrado.
- **`quin-comercial/_to_delete/`:** antes de nada, revisar si contiene claves o datos de clientes (B3). Si los tiene,
  rotar lo expuesto; después, borrar con aprobación. Ya está en `.vercelignore`, así que no llega a producción, pero sí
  está en GitHub.

### README raíz (contenido mínimo)
Qué es cada carpeta y a qué dominio/proyecto Vercel va; la tabla de la observación 3; cómo llega un cambio a
producción (flujo de abajo); dónde está la marcha atrás; enlace a `CLAUDE.md` (reglas y LEY) y a `docs/plataforma/`;
qué NO se hace (`vercel --prod`, envíos directos a `master`, mover archivos dentro de las apps fuera de un PR de
publicación).

### Flujo de ramas → PR → publicación
1. `master` = producción de las dos apps. Nadie envía directo (protección en GitHub, PR obligatorio).
2. Ramas cortas desde `master`: `fix/…`, `feat/…`, `docs/…`, `chore/…`. En el título del PR: **`[quinchat]`,
   `[quin-comercial]`, `[las dos]` o `[docs]`**.
3. Antes de pedir revisión: `tsc` y `next build` de cada app tocada, sus pruebas, y el comprobador de gemelos (D).
4. Vercel construye la vista previa del PR (solo la app tocada, gracias al filtro). La vista previa pide sesión: vale
   para ver que construye, no para probar rutas (observación 2).
5. Fusionar = publicar. Se fusiona con alguien disponible durante la hora siguiente, mirando registros de construcción
   y de ejecución. Marcha atrás: despliegue anterior desde el panel de Vercel.
6. Ramas viejas (`dev`, `optimizacion-imagenes`, `prueba-compresion-servidor`, `auditoria-consumo` cuando se lea):
   lista con su estado y borrado con aprobación.

### Riesgos
- Romper ConfirmaYa al mover sus archivos (por eso no se mueven).
- Publicar las apps al ordenar (por eso lo de la raíz va solo con A6 en verde y lo de dentro de las apps, en PR de
  publicación).
- Enlaces rotos entre documentos que se citan por ruta (`BLOQUEANTES-CONSUMO.md` cita `NOTA-PC-AGENCIAQUIN.md`,
  `CLAUDE.md` cita `quinchat/next.config.ts`…): se buscan y corrigen en el mismo PR.
- Documentos que las ramas abiertas también tocan: mover `PLAN-CONSUMO.md` y compañía **después** de fusionar
  `bloqueantes-consumo`, o habrá conflictos.

### Cómo se verifica
Tras fusionar el PR de la raíz: los proyectos Vercel **no** muestran despliegue nuevo de producción (o aparece
"cancelado por Ignored Build Step"); ConfirmaYa abre y funciona en su URL (si Pages está activo); `git ls-files` en la
raíz solo muestra lo que el README describe; búsqueda de rutas rotas sin resultados.

**Esfuerzo:** pequeño (raíz) + pequeño (dentro de las apps) + medio si ConfirmaYa se separa.

---

## Frente C · Panel de control

**Objetivo:** manejar sin tocar código ni republicar: encender/apagar el bot, topes, estado de crons, consumo,
vigilancia de la LEY y errores recientes. Solo para administradores.

### ¿Dentro del panel existente o aparte?

| Opción | Pros | Contras |
| --- | --- | --- |
| **Sección "Control" dentro del panel de cada app** (`components/panel/`) | Reutiliza sesión, middleware (`/api/` ya pide sesión), despliegue y base; cada app lee **su** base, que es lo único posible con quin-comercial (no tenemos su cuenta) | Dos copias de la sección (una por app) |
| App aparte "consola" | Una sola vista para las dos apps | Otro proyecto Vercel, otra sesión, necesita credenciales de **las dos** bases (la de quin-comercial no la tenemos) y más superficie de ataque con claves poderosas juntas |
| Paneles de terceros (Supabase, Vercel, cron-job.org) | Cero código | Cuatro sitios, cuatro sesiones, y no permiten apagar el bot |

**Recomendación:** sección **Control** dentro de cada panel, con el mismo componente y las mismas rutas en las dos
apps (archivos gemelos, vigilados por D). Una vista unificada se reconsidera en D.

### Quién es administrador
- **quinchat:** hoy dos usuarios fijos sin rol. Añadir la lista de administradores (p. ej. variable `ADMIN_EMAILS`, o un
  campo `admin` en la lista de usuarios) y comprobarlo **en el servidor**, en cada ruta de Control. Decisión del dueño:
  quiénes son (decisión 5).
- **quin-comercial:** `rol === 'superadmin'` ya existe. Control global solo para `superadmin`. Opcional: que cada
  cliente (`rol: 'cliente'`) pueda apagar **su** bot, nunca el de otros ni el global.

### Qué contiene y de dónde sale cada dato

| Bloque | Fuente | ¿Legible? | Decisión técnica |
| --- | --- | --- | --- |
| **Interruptor del bot** | Tabla nueva `config_plataforma` (clave/valor, una fila por ajuste; en quin-comercial, global + por cliente) | Sí | `freno-bot.ts` lee la tabla con una caché corta en memoria (≈30 s). **`BOT_IA=off` sigue mandando** como freno de emergencia: basta con que una de las dos diga "apagado". Si la tabla no se puede leer: se usa el último valor conocido; si no hay, la variable de entorno. Cada cambio queda registrado (quién, cuándo, valor anterior). No se reutiliza la tabla `ajustes`: su `PUT` acepta cualquier campo del cuerpo sin comprobar rol |
| **Topes** | Misma tabla: tope diario por chat (hoy `BOT_TOPE_DIARIO`), y un **tope global por hora** (riesgo 1 de la auditoría) | Sí | Mismas reglas: valor no numérico → valor por defecto y aviso (T1.1 de consumo) |
| **Estado de crons** | Tabla nueva `cron_ejecuciones`: cada cron registra inicio, fin, resultado, duración y nº de elementos | Sí | Es la fuente fiable. Semáforo: rojo si la última ejecución falló o si lleva más del doble de su intervalo sin correr. **Opcional:** la API de cron-job.org (clave de API de esa cuenta) para ver también las llamadas que nunca llegan a la app |
| **Consumo de IA (Anthropic)** | Tabla nueva `consumo_ia`: cada llamada guarda modelo, tokens de entrada/salida, origen (bot, M5, crons) y cliente | Sí | Es lo único que da consumo **por origen y por cliente**. La API de uso y coste de Anthropic (clave de administrador de organización) sirve para cuadrar el total; por comprobar que la cuenta la tiene. Groq: gratis, solo contar |
| **Consumo Supabase** | Funciones SQL de solo lectura (tamaño de la base, peso de `storage.objects` por carpeta, top de `pg_stat_statements`) llamadas desde el servidor | Parcial | El **egress y los mensajes Realtime no se leen por SQL**: enlace al panel de Usage. La API de gestión de Supabase pide un token personal con poder sobre **toda la cuenta**: no se pone en Vercel. En quin-comercial, lo mismo sobre su propia base (sus funciones las crea quien tenga esa cuenta) |
| **Consumo Vercel** | API de Vercel: despliegue de producción (commit, origen `git`/`cli`, fecha) | Parcial | Uso y facturación no tienen una API estable: enlace al panel + aviso de gasto de Vercel (Spend Management) por correo. La alarma "producción no viene de `master`" (A-4) sale de aquí. Ojo: quin-comercial ya guarda `VERCEL_TOKEN` para dominios (`lib/dominios-vercel.ts`); es un token con poder de equipo, no de solo lectura: **no reutilizarlo sin decidirlo** (decisión 6) |
| **Vigilancia de la LEY** | `vigilancia-ley-imagenes.sql` convertido en función SQL de solo lectura (más la consulta 1 de `DISENO-LEY-IMAGENES.md`, que mira todos los buckets) | Sí, en quinchat | Muestra "imágenes sin marca desde la publicación" (debe ser 0) y peso medio de entrada. En quin-comercial, solo cuando alguien con acceso cree la función |
| **Errores recientes** | Tabla nueva `eventos_sistema` escrita por un ayudante único en puntos clave: `[LEY-IMAGEN] sin comprimir`, `[Webhook] aviso rechazado`, freno del bot activado, cron fallido, 429 de Supabase | Sí | Sin datos personales (ni teléfonos ni textos). Purga automática a 30 días. Enlace a los registros de ejecución de Vercel para el detalle (observación 2: ahí se vio el fallo real) |

### Reglas de diseño del panel
- **No sondea.** Carga al abrir la sección y con un botón "Actualizar". Nada de intervalos: la Fase 3 de consumo está
  quitando precisamente eso.
- **Todo por rutas de servidor** (`/api/control/*`), con sesión y comprobación de administrador. Las funciones SQL
  solo se conceden a `service_role`, nunca a `anon` (la Fase 4 de consumo está cerrando `anon`).
- Las tablas nuevas nacen cerradas a `anon` y con su `GRANT` explícito a `service_role` (trampa de `pg_default_acl`
  del README de arreglos-supabase).
- SQL que escribe en producción (crear tablas y funciones): con aprobación.

### Riesgos
- **Interruptor que falla abierto o cerrado sin querer.** Si la base cae y el valor por defecto es "encendido", el bot
  responde con el tope como único freno; si es "apagado", se para la venta. Decisión del dueño (decisión 4); la
  recomendación es "último valor conocido, y si no hay, la variable".
- **Caché y varias instancias:** apagar puede tardar hasta lo que dure la caché en todas las funciones. Se dice en la
  pantalla ("efectivo en ≤ 30 s") y se prueba.
- **Más escrituras en la base** (una fila por llamada a IA, por cron, por evento): pequeño, pero se mide contra la línea
  base de consumo y se purga.
- **Claves poderosas en Vercel** (Vercel, cron-job.org, Anthropic admin): cada una es una decisión, con el mínimo
  alcance posible.
- **quin-comercial sin acceso a su base:** las tablas y funciones de allí las tiene que crear quien tenga la cuenta.
  Sin eso, C en quin-comercial se queda en interruptor y topes por variable.

### Cómo se verifica
- Interruptor: con el bot apagado desde el panel, un WhatsApp de prueba no recibe respuesta de IA en ≤ 30 s, sin
  republicar; al encenderlo, vuelve a responder una sola vez; el cambio aparece en el registro con quién y cuándo.
- Crons: tras 24 h, cada cron de cron-job.org tiene su fila en `cron_ejecuciones`; parar uno a propósito pone su
  semáforo en rojo.
- Consumo IA: la suma de `consumo_ia` de un día cuadra (±10 %) con el panel de Anthropic.
- LEY: el bloque da el mismo número que la consulta ejecutada a mano en el editor SQL.
- Seguridad: una sesión sin rol de administrador recibe 403 en todas las rutas `/api/control/*` (prueba automática).

**Esfuerzo:** medio-grande (C1 interruptor: pequeño; crons y errores: medio; consumo: medio).

---

## Frente D · Unificar quinchat y quin-comercial

**Objetivo:** dejar de pagar dos veces cada cambio, sin poner en riesgo la venta.

### Lo que se sabe
- Mismo origen, mismo `name`; quinchat tiene 43 archivos en `lib/`, quin-comercial 62 (multi-cliente: `tenant.ts`,
  `supabase-tenant.ts`, `cron-tenant.ts`, `recargas.ts`, `dominios-vercel.ts`, `ia-rotacion.ts`…). quinchat tiene
  crons propios (`oficina-rescate`) y v174 añade el flujo de ventas que quin-comercial puede no tener. **No hay una
  medida de cuánto difieren.**
- Bases distintas; la de quin-comercial está en una cuenta que no controlamos.
- Cada commit reciente de consumo y de la LEY se escribe dos veces (`freno-bot.ts`, `firma-meta.ts`,
  `token-funnelish.ts`, `imagen-propia.ts`, `rate-limit.ts`, y en Fase 2 `subir-archivo.ts`,
  `optimizar-imagen-servidor.ts`, `imagen-comprimir.ts`, `r2.ts`).

### Opciones

| Opción | Qué supone | Coste | Riesgos |
| --- | --- | --- | --- |
| D-1 **Unificar**: quinchat pasa a ser un cliente más de quin-comercial | Migrar todas las tablas de quinchat a la base de quin-comercial con `tenant_id`; 2,5 GB de Storage (las URLs van dentro del JSON de `funnels`: o se reescriben o se mantiene el bucket viejo); `pedido.klixmant.shop` pasa al proyecto `quinchat-comercial`; URL del webhook de Meta por número/app; todas las tareas de cron-job.org; URLs de Funnelish; usuarios de NextAuth a la tabla de usuarios; variables; y portar a quin-comercial todo lo que solo tiene quinchat (v174 incluida) | **Grande** (semanas) | Pérdida o mezcla de datos entre clientes; horas de venta caídas; la empresa principal pasa a vivir en una base que hoy **no podemos auditar ni respaldar**; la LEY, la seguridad y el consumo se vuelven a verificar desde cero |
| D-1b Unificar al revés (quin-comercial a la base de quinchat) | Igual, pero migrando a todos los clientes | **Grande** | Afecta a clientes externos; mismo resto |
| D-2 **Carpeta compartida** en la raíz importada por las dos apps | Un solo archivo de verdad | Medio | Next y Vercel con código fuera de la raíz del proyecto: rastreo de archivos (`outputFileTracingRoot`), opción de Vercel de incluir archivos fuera del directorio raíz, y el filtro por carpeta de A tiene que mirarla. Es justo el tipo de fallo de la observación 1 |
| D-3 **Copia sincronizada**: fuente en `compartido/`, un script copia a cada app y se commitean las copias | Nada cambia en el build | Pequeño | Olvidar sincronizar (lo cubre D-4) |
| D-4 **Comprobador de gemelos**: lista cerrada de archivos que deben ser idénticos y un script que falla si difieren; más un informe de divergencia del resto | Detecta el problema sin cambiar nada | **Pequeño** | Ninguno técnico; exige disciplina (va en el flujo de PR de B) |

### Recomendación
**No unificar ahora. Hacer D-4 ya, D-3 cuando la lista de gemelos pase de ~10 archivos, y decidir D-1 con datos
después de la Fase 4 de consumo** (orientativamente, dentro de 2-3 meses).
- D-4 ahora porque la Fase 2 crea tres archivos que deben ser idénticos y un comprobador evita la deriva desde el
  primer día.
- Cambiar el `name` de los `package.json` (`quinchat` y `quin-comercial`): un cambio de una línea que **publica las
  dos apps**, así que va dentro de un PR que ya iba a publicarlas (la unión de v174 es el candidato natural).
- **Criterios para reabrir D-1:** el informe de divergencia dice que > 80 % de `lib/` y `app/api/` es igual o
  trivialmente parametrizable; hay acceso a la base de quin-comercial (o se decide migrarla a una cuenta nuestra);
  más de la mitad de los PR del trimestre fueron `[las dos]`; y existe una ventana de baja venta para la migración.
  Si no se cumplen, D-1 cuesta más de lo que ahorra.
- **Prerrequisito que conviene pedir ya, se unifique o no:** acceso (o traslado) de la base de quin-comercial a una
  cuenta que la agencia controle. Sin eso no se puede aplicar a quin-comercial la vigilancia de la LEY, la Fase 4 de
  seguridad ni C completo.

### Cómo se verifica
- D-4: el script falla si se modifica un gemelo en una sola app (prueba provocada) y pasa en `master`.
- Informe de divergencia: tabla por carpeta (idénticos / distintos / solo en una app) guardada con fecha.

**Esfuerzo:** pequeño (D-4 + informe); medio (D-3); grande (D-1).

---

## 3 · Criterios de aceptación globales de este plan

1. Producción de los dos proyectos corre un commit de `master`, con origen `git`; v174 está en el historial de
   `master` (recuperada y verificada, o subida por agenciaquin, o ambas y con diff vacío entre ellas).
2. Un commit que solo toca la raíz no despliega ninguna app; uno que solo toca una app despliega solo esa (probado en
   rama y confirmado en `master`).
3. `master` está protegida (PR obligatorio) y `vercel --prod` está prohibido por escrito y vigilado por la alarma de C.
4. La raíz tiene `README.md` y `.gitignore`; los documentos están en `docs/` o `archivo/` según la estructura aprobada;
   ConfirmaYa funciona igual que antes (o en su nuevo repo, si se decidió); nada se borró sin aprobación escrita.
5. Si GitHub Pages estaba publicando el repo entero, ya no lo hace.
6. El bot se enciende y apaga desde el panel en ≤ 30 s sin republicar, con registro de quién lo hizo; `BOT_IA=off`
   sigue funcionando como freno de emergencia.
7. La sección Control muestra crons, consumo de IA, vigilancia de la LEY y errores, solo a administradores (prueba de
   403 para el resto), sin sondeo automático.
8. El comprobador de gemelos pasa en `master` y forma parte del flujo de PR; existe un informe de divergencia fechado
   y una decisión escrita sobre D-1.
9. Todo lo que no se pudo probar en el destino está escrito como hueco abierto con su prueba propuesta.
10. El auditor emite **APROBADO** en `AUDIT-PLATAFORMA.md`.

---

## 4 · Decisiones para el dueño (priorizadas)

1. **Recuperar v174 desde Vercel** (A-1) en vez de esperar al PC de agenciaquin, con la condición de que se demuestre
   completa. Recomendado: **sí**. Cambia la Fase 0 de `PLAN-CONSUMO.md`.
2. **Activar ya el "Ignored Build Step"** en el panel de Vercel de los tres proyectos (no requiere envío) y
   **desconectar o borrar el proyecto `quinchat` (sepia)**. Recomendado: sí y sí.
3. **GitHub Pages / ConfirmaYa:** confirmar si Pages está activo. Si publica el repo entero: ¿ConfirmaYa a su propio
   repo (recomendado) o rama `gh-pages`? Y avisar a Josué y Mallerlis si cambia la URL.
4. **Interruptor del bot en tabla:** ¿qué pasa si la base no responde? Recomendado: último valor conocido y, si no hay,
   la variable de entorno.
5. **Quiénes son administradores** del panel de Control en quinchat, y si los clientes de quin-comercial pueden apagar
   su propio bot.
6. **Claves externas para el panel:** ¿se crea un token de Vercel, una clave de cron-job.org y una clave de
   administrador de Anthropic para Control? Recomendado: empezar sin ninguna (tablas propias) y añadir solo la de
   Vercel para la alarma de "producción no viene de `master`".
7. **Libros, audios e identidad de marca:** fuera del repo (Drive) o a `recursos/`. Borrado solo con tu visto bueno.
   Y revisar/borrar `quin-comercial/_to_delete/`.
8. **Acceso a la base de quin-comercial** (o traslado a una cuenta de la agencia). Recomendado: pedirlo ya.
9. **Unificar las apps:** no ahora; comprobador de gemelos ya; revisar con datos tras la Fase 4 de consumo.
10. **Proteger `master` en GitHub** (PR obligatorio) cuando la unión esté publicada.
