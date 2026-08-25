# CONTINUACIÓN — QuinChat Comercial (multi-tenant)

## Qué estamos construyendo
Versión **comercial multi-tenant** de QuinChat para vender/rentar a otros negocios, estilo **SellerChat**. Cada cliente trae SUS propias credenciales de WhatsApp → **NO se necesita Meta Tech Provider** (confirmado viendo el panel de SellerChat).

## Infraestructura ya montada
- **Base comercial:** Supabase **confirma-ya** (ref `glmnuqfnxwaibckufgtr`, URL `https://glmnuqfnxwaibckufgtr.supabase.co`), org **Pro**. Ya tiene: esquema completo de quinchat clonado + tablas `tenants` y `usuarios` + columna `tenant_id` en todas las tablas de datos + bucket Storage **`chat-media`** (público).
  - ⚠️ NO tocar la base de Klixmant producción (ref `bjbjqmbuzpyjvcugbusx`).
  - Usar las llaves **Legacy** (anon / service_role JWT), NO las sb_publishable/sb_secret.
  - ⚠️ **OJO grants:** al clonar el esquema, los roles del API (anon/authenticated/service_role) quedaron SIN permisos DML en varias tablas. Ya se corrigió para `service_role` (ver Fase 3). Falta revisar `anon`/`authenticated` para páginas públicas y realtime (Fase 5).
- **App comercial:** Vercel **quinchat-comercial** → `https://quinchat-comercial.vercel.app`. Código en `C:\Users\Josue\OneDrive\Documentos\PROYECTO IA CONFIRMA YA\FUNNELISH\quin-comercial`. Desplegar con `vercel --prod` desde esa carpeta (el proyecto en Vercel NO está conectado a Git).
- **Vars en Vercel (quinchat-comercial):** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (de confirma-ya, ya verificadas OK), NEXTAUTH_SECRET.
  - **FALTAN por agregar:** ANTHROPIC_API_KEY, GROQ_API_KEY, QUINCHAT_MODEL=`claude-haiku-4-5-20251001`, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET. (WhatsApp ya no va en env: es por-tenant.)
  - ⚠️ `.env.local` local todavía apunta a Klixmant prod (bjbjqmbuzpyjvcugbusx). Corregir a confirma-ya para dev local.

## Fases del multi-tenant
1. ✅ Tablas `tenants` + `usuarios` (SQL: `sql/mt-01-tenants.sql`). Tenant demo: slug `demo`.
2. ✅ Columna `tenant_id` en todas las tablas (SQL: `sql/mt-02-tenant-id.sql`).
3. ✅ **RESUELTO (2026-07-29) — Login por empresa.**
   - `lib/auth.ts` valida contra `usuarios` y mete `tenantId`/`rol` en la sesión; `lib/tenant.ts` expone `tenantActual()`.
   - **Causa raíz del bug "Correo o contraseña incorrectos":** el log de Vercel mostraba `[AUTH] error DB: permission denied for table usuarios`. En confirma-ya el rol **`service_role` NO tenía SELECT** sobre `usuarios` (grants no clonados). La URL y la llave service_role en Vercel SÍ estaban bien.
   - **Fix (SQL Editor confirma-ya):** `grant all privileges on all tables/sequences/functions in schema public to service_role;` + `alter default privileges in schema public grant all ... to service_role;`. No se dio SELECT a `anon` (protege las contraseñas en texto plano).
   - **Verificado:** login demo@quin.com / demo123 → 200, sesión con `tenantId` y `rol: admin`, `/panel` carga. No hizo falta redeploy (grant es a nivel de BD).
4. ✅ **Webhook por cliente (2026-07-29).** Nueva ruta `app/api/whatsapp/webhook/[tenant]/route.ts`: resuelve el tenant por `slug` en `tenants` (caché 60s) y procesa con SUS credenciales.
   - Se aprovechó el `AsyncLocalStorage` existente (`lib/whatsapp-contexto.ts`): ahora lleva `accessToken`/`tenantId`/`phoneIdVentas`; nuevos `tokenActual()`/`tenantActualId()`. `lib/whatsapp.ts` envía con `tokenActual()`. El webhook principal se refactorizó exponiendo `verificarMeta()` y `procesarEntrada(req, base?)` reutilizables (el single-tenant sigue con env).
   - Cada cliente apunta su webhook en Meta a `…/api/whatsapp/webhook/<su-slug>`.
   - Verificado en prod: GET verify OK→200/challenge, token malo→403, tenant inexistente→404, POST no rompe. (Al tenant `demo` se le puso `wa_verify_token='demo-verify-123'` para pruebas.)
   - Pendiente Fase 5/6: rutas de envío manual del panel (`api/whatsapp/send*`, `registrar`) y `lib/whatsapp-templates.ts` aún usan env → darles contexto de tenant.
5. ⏳ Filtrar TODAS las consultas por `tenant_id` (panel + bot). La fase más larga; cuidar que no haya fugas entre clientes. Aquí también resolver grants + RLS de `anon`/`authenticated` (páginas públicas y realtime del panel).
6. ⏳ Pantalla de alta de clientes + Ajustes WhatsApp (URL de webhook única por tenant, estilo SellerChat).

## Notas de negocio
- Camino A (copia por cliente) ya probado; B = este multi-tenant. B es más rentable desde ~5 clientes (base única).
- Confirmación sin depender solo del chat: OTP en la página + cola "Por confirmar" + WhatsApp como add-on premium.

## Seguridad (pendiente histórico)
- El token de Meta y la Groq key quedaron expuestos en chats previos → **regenerarlos**.
- Passwords de `usuarios` en texto plano → cifrar (hash) en fase futura.
