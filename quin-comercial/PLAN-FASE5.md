# FASE 5 — Filtrar todo por `tenant_id` · Mapa + Patrón (para validar)

> Objetivo: que ningún cliente vea ni toque datos de otro. La base usa
> `service_role` (que **ignora RLS**), así que el aislamiento se hace **en código**:
> cada lectura filtra por `tenant_id` y cada inserción lo escribe. RLS quedará como
> segunda capa (defensa) para las rutas públicas que usan la llave `anon`.

## 1. Mapa: 66 archivos tocan la BD, 21 tablas

Tablas por nº de accesos: clientes_funnelish (79), messages (75), conversations (63),
funnels (15), catalogo_colores (15), faq_bot (14), memoria_bot (13), catalogos_bot (10),
vendedor_preguntas (8), vendedor_reportes (7), push_subscriptions (6), campanas_gasto (6),
configuracion (5), plantillas (4), etiquetas (4), effi_guias (4), disparadores (4),
contactos (4), objeciones_analisis (3), ajustes (2), usuarios (1, ya scoped en login).

### Los 66 archivos caen en 4 CONTEXTOS (según de dónde sale el tenant):

**A) Rutas del PANEL (con sesión) — tenant = `await tenantActual()` (sesión, Fase 3)**
ajustes, configuracion, contactos[/id], etiquetas[/id], disparadores[/id], plantillas[/id],
faq, memoria, catalogos[/id + colores + re-estampar], funnels[/diagnostico/probar-capi],
campanas[/dias/importar], pedidos[/lista/detalle/accion], ventas[/lista/contacto/papelera/registrar],
vendedores/ranking, objeciones/resumen, seguimiento[/campanas/effi/lista],
conversations/[id], plantillas-wa[/enviar], push/subscribe, quinchat (chat web interno).

**B) BOT / webhook de WhatsApp — tenant = `tenantActualId()` (AsyncLocalStorage, Fase 4)**
app/api/whatsapp/webhook/route.ts, lib/quinchat/ventas.ts, lib/quinchat/registro-venta.ts,
y las libs que llama el bot: lib/faq.ts, lib/memoria.ts, lib/funnels.ts, lib/product-catalog (por catálogo).
→ Ya corre dentro del contexto async del tenant (Fase 4). Solo falta que sus queries filtren.

**C) FLUJO PÚBLICO (páginas de venta + pedido) — tenant = del FUNNEL (por slug)**
app/p/[slug], app/tienda, app/api/pedidos, app/api/funnelish/webhook, lib/funnels.obtenerFunnel.
→ El visitante es anónimo; el tenant se deduce del **embudo** que está viendo
(`funnels` ya tiene `tenant_id`). Todo lo que se cree para ese pedido hereda ese `tenant_id`.

**D) CRON (todo el sistema) — deben recorrer TODOS los tenants**
app/api/cron/* (remarketing, ventas-seguimiento, mantener-chat, vendedores, objeciones,
apagar-vendidos, seguimiento-ia, meta-alertas, capi, promo-cierre, registros-funnel, aprendizaje).
→ Como envían WhatsApp (token por tenant), cada cron debe procesar **por tenant**:
recorrer tenants activos y, para cada uno, correr su lógica dentro de su contexto
(`conLinea({tenantId, accessToken, phoneId})`) filtrando por ese `tenant_id`.

## 2. Patrón propuesto (consistente y difícil de olvidar)

**a) Un solo helper para “de quién es este request”.** En `lib/tenant.ts`:
```ts
// Bot/cron (AsyncLocalStorage) tiene prioridad; si no, sesión del panel.
export async function tenantActivo(): Promise<string | null> {
  return tenantActualId() ?? await tenantActual();
}
```
- Panel y libs del bot llaman `tenantActivo()`.
- Flujo público y cron **pasan el `tenant_id` explícito** (del funnel / del loop de tenants).

**b) Helpers de consulta que obligan el filtro** (en `lib/db.ts`), para que sea difícil
olvidarlo y fácil de auditar:
```ts
// lectura: siempre scoped
export function delTenant(sb, tabla: string, tid: string) {
  return sb.from(tabla).eq('tenant_id', tid);   // .select()/.update()/.delete() encadenan
}
// inserción: inyecta tenant_id
export async function insertarDelTenant(sb, tabla: string, tid: string, filas) {
  const arr = (Array.isArray(filas) ? filas : [filas]).map(f => ({ ...f, tenant_id: tid }));
  return sb.from(tabla).insert(arr);
}
```
Regla: en las tablas con `tenant_id`, **toda** query pasa por estos helpers (o incluye
`.eq('tenant_id', …)` a mano). Las que NO llevan tenant (catálogos globales de Colombia,
`usuarios`, `tenants`) se dejan explícitamente marcadas.

**c) Rechazo seguro:** si en panel no hay tenant en sesión → 401. Si en bot/cron no hay
tenant resuelto → no se procesa (se loguea). Nunca “sin filtro = todo”.

**d) Segunda capa (RLS):** activar políticas por `tenant_id` en las tablas que lee el
navegador con la llave `anon` (páginas públicas + realtime del panel), y dar los grants
`anon`/`authenticated` que hoy faltan. El código (service_role) sigue siendo la 1ª capa.

## 3. Migración de datos (antes de encender el filtro)

Las filas que ya existen en confirma-ya tienen `tenant_id = NULL` (la columna se agregó
en Fase 2). Al encender el filtro **desaparecerían**. Hay que decidir por tabla:
- Asignarlas al tenant `demo` (backfill `update … set tenant_id = <demo> where tenant_id is null`), **o**
- Borrarlas (si eran datos de prueba / de Klixmant que no van en la base comercial).

## 4. Orden de ejecución propuesto (sub-bloques, validando cada uno)

1. **Infra del patrón**: `tenantActivo()` + `lib/db.ts` + backfill de datos. (pequeño, base de todo)
2. **Rutas del panel (contexto A)**: ~35 rutas. El grueso, pero mecánico y de bajo riesgo.
3. **Bot (contexto B)**: webhook + ventas.ts + libs. Cuidado especial (mucha query).
4. **Flujo público (contexto C)**: pedidos/funnelish/páginas de venta.
5. **Cron (contexto D)**: recorrer tenants. El más delicado por los envíos.
6. **RLS + grants anon/authenticated** (2ª capa) y verificación anti-fugas (probar con 2 tenants).

## 5. Decisiones que necesito de ti (antes de codear)

1. **Páginas públicas / slug del embudo:** ¿los `slug` serán únicos entre todos los
   clientes (más simple, sin cambiar URLs), o cada cliente tendrá su propio dominio/subdominio
   (estilo SellerChat, más aislado pero más trabajo)?
2. **Webhook de Funnelish:** ¿lo hacemos por-tenant como el de WhatsApp
   (`/api/funnelish/webhook/[tenant]`), o deducimos el tenant del embudo del pedido?
3. **Datos existentes en confirma-ya:** ¿los asignamos al tenant `demo` o los borramos?
4. **Cron:** ¿ok con que cada cron recorra todos los tenants activos en cada corrida?

---

## PROGRESO — sub-bloque 5 (CRON) ✅ COMPLETO

Todos los cron son ahora multi-tenant (recorren tenants activos vía `porCadaTenant`
en `lib/cron-tenant.ts`, que aísla datos con `supabaseTenant(tid)` y fija el contexto
de línea de WhatsApp del tenant). Sin `klixmant` ni números hardcodeados.

Normales (tenant-aware):
- apagar-vendidos, registros-funnel, capi, objeciones, aprendizaje

Regla "24h sin plantillas de pago" (seguimiento/remarketing):
- remarketing: quitada la plantilla de pago; solo manda texto GRATIS si el cliente
  escribió hace <24h; si la ventana cerró → etiqueta HUMANO (no gasta). 1 recordatorio.
- ventas-seguimiento: línea de ventas por tenant; guarda ventana 24h (último entrante).
- seguimiento-ia: ya respetaba 24h; ahora multi-tenant + persona genérica. OFF por
  defecto (SEGUIMIENTO_IA=on para activar).
- promo-cierre: ya mandaba texto gratis en ventana 20–23.5h; multi-tenant + texto de
  producto genérico.
- mantener-chat: APAGADO por defecto (su keepalive obliga plantilla de pago). Se activa
  con MANTENER_CHAT=on y MANTENER_CHAT_NUMEROS=coma,separados. Sin números hardcodeados.

Omitidos a propósito (NO tocar): vendedores, meta-alertas.
  ⚠️ Estos dos siguen con lógica Klixmant hardcodeada. Antes de comercializar hay que
  QUITARLOS del schedule (vercel.json) o desactivarlos, para que no corran con datos
  de Klixmant en la base comercial.

## PENDIENTE — sub-bloque 6 (cierre de Fase 5)
- RLS + grants para anon/authenticated (2ª capa de defensa).
- Clave compuesta conversations (tenant_id, id): hoy `id` = teléfono es PK global →
  dos tenants con el mismo teléfono de cliente colisionan.
- Prueba anti-fugas con 2 tenants.
- LUEGO: desplegar todo junto (vercel --prod) y verificar (nada de Fase 5 está desplegado aún).

---

## PROGRESO — sub-bloque 6 (cierre Fase 5) — EN CURSO

### Clave compuesta conversations ✅ HECHO Y VERIFICADO
- Migración `sql/mt-03-conversations-pk.sql` corrida en confirma-ya.
- PK de conversations = (tenant_id, id); FK de messages compuesto. Verificado.
- Código ajustado: los `onConflict: 'id'` de conversations → `'tenant_id,id'`
  (ventas.ts, funnelish/webhook, whatsapp/confirmar, whatsapp/webhook, cron/vendedores).

### Escritores sin tenant arreglados ✅ HECHO (commit al device)
- `app/api/whatsapp/confirmar` ahora exige slug de empresa (tenant) y escribe con su tenant_id.
- `app/api/whatsapp/send`, `send-media`, `send-media-url`: usaban cliente sin tenant y
  token del entorno → ahora usan la empresa de la sesión, su token/línea y cliente aislado.
- Helper nuevo `credsTenant(tid)` en lib/tenant.ts.
- (plantillas-wa/enviar ya estaba bien: escribe con tenant_id.)

### RLS por empresa (token JWT en el navegador) — CÓDIGO LISTO, FALTA DESPLEGAR + SQL
- Problema: el navegador usa la llave 'anon' para tiempo real/lecturas → hoy ve TODAS las empresas.
- Solución (opción A): el panel firma un JWT de Supabase con tenant_id y el navegador lo usa.
  - `lib/supabase-token.ts` (mint HS256 con SUPABASE_JWT_SECRET, sin dependencias).
  - `lib/supabase.ts`: initBrowserSupabase(token) + actualizarTokenNavegador().
  - `app/panel/page.tsx`: firma el token y lo pasa a WhatsAppPanel.
  - `components/panel/WhatsAppPanel.tsx`: initBrowserSupabase(sbToken).
  - `app/api/supabase-token/route.ts`: endpoint para refrescar el token.
  - `sql/mt-04-rls.sql`: enable RLS + policy por tenant + grants + revoke anon + trigger tenant_id.

### PASOS PARA CERRAR (en ESTE orden, si no se rompe el panel):
1. En Supabase (confirma-ya) → Settings → API → copiar el **JWT Secret**.
2. En Vercel (quinchat-comercial) → Environment Variables → agregar **SUPABASE_JWT_SECRET** = ese valor.
3. Desplegar: `vercel --prod` (proyecto no está en Git).
4. Abrir el panel y verificar que SÍ se ven los chats (ya va con token).
5. Recién ahí, correr `sql/mt-04-rls.sql` en el SQL Editor.
6. Prueba anti-fugas con 2 tenants (crear empresa demo2 y confirmar aislamiento).

### Omitidos a propósito (recordatorio): crons vendedores y meta-alertas — quitar de vercel.json.

---

## ✅ FASE 5 COMPLETA Y VERIFICADA (bloque 6 cerrado)

- Clave compuesta conversations (tenant_id, id): aplicada (mt-03) y verificada.
- Token por empresa (JWT HS256 con tenant_id) desplegado; /api/supabase-token devuelve JWT válido.
- SUPABASE_JWT_SECRET puesto en Vercel (legacy JWT secret — NO revocar).
- RLS aplicado (mt-04): policy por tenant + grants + revoke anon + trigger tenant_id.
- PRUEBA ANTI-FUGAS OK: con 2 empresas (demo y demo2), el panel de demo ve SOLO
  "Cliente DEMO" y NO "SECRETO Demo2". Aislamiento probado end-to-end.
- Nota: legacy JWT secret está deprecado (proyecto usa ECC), pero sigue activo
  (anon/service_role dependen de él). Si algún día se migra a llaves nuevas,
  revisar lib/supabase-token.ts.
- Datos de prueba (demo2 + conversaciones test) quedaron en la base; hay SQL de
  limpieza opcional.

## SIGUIENTE BLOQUE (en curso): PROMPT DEL BOT POR EMPRESA
Objetivo: que lib/quinchat/systemPrompt.ts deje de estar hardcodeado a Klixmant
(persona Josué, buzos de motos, precios, cuentas bancarias) y use la info de CADA
empresa. Es lo que falta para vender el producto a un cliente distinto.

---

## ✅ BLOQUE: PROMPT DEL BOT POR EMPRESA — CÓDIGO LISTO
- lib/quinchat/prompt-tenant.ts: cargarPromptEmpresa() lee bot_config('system_prompt')
  por empresa; andamiaje genérico (ANDAMIAJE_CONFIRMADO/SIN_PEDIDO/PEDIDO_ACTIVO);
  PLANTILLA_DEFAULT = marca de buzos GENÉRICA (basada en Klixmant, sin nombre ni
  cuentas/teléfonos reales, con [[corchetes]] editables).
- webhook: los 3 prompts (sysConf, sysNoPedido, sysPrompt) usan el prompt de la
  empresa + andamiaje; quitado EMPRESA_FAQ; tenantId real (tidBot) en las 3 llamadas.
  (Quedan 2 'klixmant': supervisor de vendedores y clasificador de imágenes — menores.)
- EntrenamientoPanel: onConflict 'tenant_id,key'; precarga PLANTILLA_DEFAULT si no hay
  prompt guardado (el cliente edita la plantilla buzos desde cero).
- sql/mt-05-bot-config.sql: clave única (tenant_id, key) en bot_config.

### PASOS PARA CERRAR:
1. Correr sql/mt-05-bot-config.sql en confirma-ya.
2. vercel --prod (valida el build del webhook nuevo).
3. Panel → Entrenamiento: ver la plantilla buzos, editarla y guardar (se guarda por empresa).
   El bot usará ese prompt. Empresa nueva sin configurar → usa la plantilla buzos por defecto.

### PENDIENTE FUTURO (no bloquea):
- Fase 6: formulario de onboarding que rellena la plantilla + alta de clientes.
- 'chat único' (ocultar Chat WhatsApp; Chat Funnel vende+confirma).
- Los 2 'klixmant' restantes en el webhook (vendedores/clasificador).

---

## FASE 6 (alta de clientes) — EN CURSO

### Seguridad verificada: tenants y usuarios NO son legibles por anon/authenticated
(solo service_role). No hay fuga de tokens ni contraseñas. La config de WhatsApp
DEBE pasar por el servidor (el navegador no puede tocar `tenants`).

### 6a — Ajustes de WhatsApp por empresa ✅ CÓDIGO LISTO (commit)
- app/api/tenant/whatsapp/route.ts: GET/POST server-side (service_role), guardado
  por la empresa de la sesión. El access token nunca se devuelve (solo enmascarado);
  solo se actualiza si mandan uno nuevo.
- components/panel/AjustesWhatsAppPanel.tsx: formulario (phone ids, verify token,
  waba/app id, access token write-only, URL del webhook para pegar en Meta).
- Sidebar + WhatsAppPanel: nueva sección "Conexión WhatsApp" (key 'wa_config') en Herramientas.
- Falta: desplegar (vercel --prod) y probar en el panel.

### 6b — PENDIENTE: super-admin crea empresa + usuario
Para dar de alta un cliente nuevo sin SQL: rol super-admin + API cross-tenant
(service_role) para crear tenant + su usuario de login. (Hoy se crea por SQL.)

### 6b — Super-admin: crear empresas + usuarios ✅ CÓDIGO LISTO (commit)
- app/api/admin/tenants/route.ts: GET (lista empresas) + POST (crea empresa + su
  usuario de login). Guardado por rol 'superadmin' en el servidor. Slug/correo únicos;
  revierte la empresa si falla el usuario.
- components/panel/EmpresasPanel.tsx: lista de empresas + formulario "Nueva empresa"
  (nombre, slug auto, correo+contraseña del cliente).
- Sidebar/WhatsAppPanel/page: sección "Empresas" (key 'empresas') SOLO visible si
  el usuario es superadmin (rol viene de la sesión → prop).
- AjustesWhatsAppPanel: autocomplete off en los campos (evita que Chrome meta el correo).

### PARA ACTIVAR 6b:
1. Hacer super-admin al usuario admin (SQL):
   update usuarios set rol='superadmin' where tenant_id='6942f93b-c94e-4e5b-be76-6036c80cb863';
2. vercel --prod.
3. Cerrar sesión y volver a entrar (para que la sesión tome el rol nuevo).
4. Aparecerá "Empresas" en el menú → crear una empresa de prueba con su usuario.

### FASE 6 = alta de clientes COMPLETA (6a WhatsApp por empresa + 6b crear empresas/usuarios).

---

## ✅ FASE 6 COMPLETA Y VERIFICADA
- 6a Conexión WhatsApp por empresa: pantalla carga datos reales (Demo Quin, verify
  token, token enmascarado, URL webhook por slug). ✓
- 6b Empresas (super-admin): usuario demo@quin.com = superadmin; sección "Empresas"
  visible; lista empresas OK; **CREAR empresa OK** (se creó "QUINO AGENCY" / quino-agency
  + usuario gerenciaquin7@gmail.com desde el panel). ✓
- Login: el correo del admin es demo@quin.com (NO el gmail).

## ESTADO GLOBAL: plataforma comercial multi-empresa FUNCIONAL
Fase 5 (aislamiento) + bot por empresa + Fase 6 (WhatsApp por empresa + alta de clientes).

## CABOS SUELTOS (opcionales, sin prisa):
- "chat único": ocultar Chat WhatsApp; Chat Funnel vende + confirma.
- Quitar crons vendedores/meta-alertas de cron-job.org.
- Contraseñas en texto plano (usuarios) → hashear. Los 2 'klixmant' internos del webhook.
- Borrar datos de prueba: empresa "Demo 2" (demo2) y conversaciones test (Cliente DEMO, SECRETO Demo2).
- Endurecer contraseña de demo@quin.com (Chrome avisó que es débil/filtrada).

---

## MENÚ REORGANIZADO (estilo Funnelish) — FASE 1 LISTA (código)
- Sidebar reescrito: de ~22 ítems a **6 grupos**: Empresas(admin), Chats, Embudos,
  Bot, Marketing, Ajustes. Cada grupo expone sus pestañas (export GRUPOS + grupoDeSeccion).
- PanelTabs.tsx: barra de pestañas arriba del contenido (muestra las pestañas del grupo activo).
- Grupo Embudos con pestañas: **Plantillas · Embudos · Ventas · Estadísticas** (lo que pidió el user).
- Píxeles Meta/TikTok por embudo: YA EXISTÍAN en el editor de EmbudosPanel (pixel_meta,
  pixel_meta_token, pixel_tiktok, pixel_tiktok_token). Solo falta hacerlos más visibles (desplegable).
- PlantillasEmbudoPanel.tsx: placeholder (Fase 2 = crear plantillas admin + clonar por cliente).
- Falta: vercel --prod + revisar el menú nuevo.

## PENDIENTE FASE 2 (plantillas de embudo):
- Modelo CLONAR: admin crea embudos-plantilla; cliente los clona a sus embudos y edita la copia.
- Requiere: marcar funnels como plantilla (del tenant agencia) + lectura cross-tenant de plantillas
  + botón "Usar esta plantilla" que copia el embudo al tenant del cliente.
