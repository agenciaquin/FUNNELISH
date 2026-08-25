import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { chat } from '@/lib/quinchat/claude';
import { bloqueAprendido } from '@/lib/quino-aprendizaje';
import { guiaSeccion, esTemaConexion } from '@/lib/quino-secciones';

export const dynamic = 'force-dynamic';

/**
 * Asistente de conexión (GRATIS para el cliente).
 * Un ayudante entrenado SOLO para guiar a conectar WhatsApp con Meta.
 * Corre en el servidor con la llave de la agencia (ANTHROPIC_API_KEY),
 * así que al cliente no le cuesta nada. Modelo Haiku = centavos por charla.
 *
 * POST { messages: [{role:'user'|'assistant', content}] } -> { reply }
 */

// Conocimiento del asistente = resumen del manual paso a paso.
const CONOCIMIENTO = `
IMPORTANTE PARA GUIAR: la persona NUNCA ha usado Meta y no sabe nada de esto. Sé
MUY detallado y explícito. NO resumas. Dile clic por clic qué ve y qué botón toca.
En las pantallas donde NO hay que hacer nada, DÍSELO claramente ("aquí no tocas nada,
solo dale Siguiente"), porque si no lo dices, la persona se queda trabada pensando
que le falta algo. Nombra los botones tal cual aparecen en Meta.

═══ LOS 6 DATOS QUE DEBE CONSEGUIR (y pegar en Ajustes → Conexión WhatsApp) ═══
1. Access Token (permanente): la "llave" del bot. Se crea con un USUARIO DEL SISTEMA
   (Configuración del negocio → Usuarios del sistema). Caducidad = "Nunca". Permisos:
   whatsapp_business_messaging, whatsapp_business_management, business_management.
   Empieza por "EAA...". OJO: el token que aparece en la barra de "Configuración de la
   API" dura solo 24 h → NO sirve para el bot. SIEMPRE usar el de Usuario del sistema.
2. Phone Number ID (principal): NO es el número de teléfono visible. Es un ID numérico
   largo (ej. 1339274919276819) que sale en WhatsApp → Configuración de la API, JUSTO
   DEBAJO del número.
3. Phone Number ID (ventas): opcional, solo si usa un SEGUNDO número.
4. Verify Token: una palabra secreta que la persona INVENTA (ej. "quinbot2026"). Debe
   quedar IDÉNTICA en Meta (al configurar el webhook) y en el panel. Sin espacios.
5. WABA ID (opcional pero útil para plantillas): ID de la cuenta de WhatsApp Business
   (WhatsApp → Configuración de la API, o en Configuración del negocio → Cuentas de WhatsApp).
6. App ID (opcional): número de la app, arriba en developers.facebook.com/apps.

═══ PASO A PASO COMPLETO (para principiante total) ═══

PASO 1 — PORTAFOLIO DE NEGOCIO (~5 min)
- Entra a business.facebook.com con el MISMO correo de Facebook con el que la persona
  maneja su negocio.
- Si le pide crear un "Portafolio de negocio" (antes "Business Manager"): dale "Crear",
  pon el nombre del negocio, el nombre de la persona y el correo. Si ya tiene uno, úsalo.

PASO 2 — CREAR LA APP en developers.facebook.com/apps (~5 min)
- Clic en "Crear app".
- Pantalla "Detalles de la app": en "Nombre de la app" escribe algo como
  "QuinChat Ventas" o el nombre del negocio (es solo un nombre interno, el cliente
  no lo ve). En "Correo de contacto" elige/escribe el correo con el que entró. Siguiente.
- Pantalla "Casos de uso": elige "Conectar con clientes a través de WhatsApp" (o el que
  mencione WhatsApp). Siguiente.
- Pantalla "Negocio": selecciona el Portafolio de negocio del Paso 1. Siguiente.
- Pantalla "Requisitos" / "Requisitos de publicación": AQUÍ NO HAY QUE HACER NADA. Suele
  decir "No se identificaron requisitos". Solo dale "Siguiente". (Muchos se traban aquí
  creyendo que falta algo: no falta nada.)
- Pantalla "Resumen": revisa y dale "Crear app" / "Listo". Ya quedó creada la app.

PASO 3 — AGREGAR WHATSAPP Y EL NÚMERO (~5 min)
- Dentro de la app, en el menú izquierdo entra a "WhatsApp" → "Configuración de la API".
- Si pide crear/elegir una cuenta de WhatsApp Business (WABA), créala o elígela → de ahí
  sale el WABA ID.
- En "De" (el número remitente), agrega el número REAL del negocio con "Agregar número de
  teléfono" (NO uses el número de prueba). Verifícalo por SMS o llamada (te llega un código).
- Cuando el número queda verificado, JUSTO DEBAJO aparece el "Identificador del número de
  teléfono" = ese es el Phone Number ID (dato 2). Cópialo.

PASO 4 — TOKEN PERMANENTE con USUARIO DEL SISTEMA (~5 min) [lo más importante]
- Ve a Configuración del negocio (business.facebook.com) → Usuarios → "Usuarios del sistema".
- "Agregar" un usuario del sistema (rol Administrador). Ponle un nombre (ej. "Bot").
- Con ese usuario seleccionado: "Agregar activos" → asígnale la App y la Cuenta de WhatsApp
  (WABA) con CONTROL TOTAL (todos los interruptores en azul). Guardar.
- "Generar token" → elige la App → Caducidad: "Nunca" → permisos: marca
  whatsapp_business_messaging y whatsapp_business_management (y business_management si aparece).
  Genera. COPIA el token (empieza por EAA...) y guárdalo YA, porque Meta solo lo muestra una vez.

PASO 5 — PEGAR LOS DATOS EN EL PANEL
- En QuinChat: Ajustes → Conexión WhatsApp. Pega el Access Token, el Phone Number ID, el
  WABA ID (si lo tienes) e INVENTA el Verify Token (dato 4). Copia también la "URL del
  Webhook" que muestra el panel (la vas a necesitar en el Paso 6). Guarda.

PASO 6 — WEBHOOK (conectar Meta con el bot)
- En la app de Meta: WhatsApp → Configuración → sección "Webhook" → "Editar".
- "URL de devolución de llamada": pega la URL del Webhook del panel (sin espacios).
- "Verificar token": pega el MISMO Verify Token que inventaste (idéntico, sin espacios).
- "Verificar y guardar".
- Luego, en "Campos del webhook", busca "messages" y dale "Suscribirse" (Subscribe).
  Sin esto, los mensajes NO llegan al bot.
- Listo: manda un WhatsApp de prueba al número y el bot debe responder.

PANTALLAS DONDE NO SE HACE NADA (avísalo siempre): "Requisitos / Requisitos de
publicación" ("No se identificaron requisitos"), y cualquier pantalla de solo lectura
tipo "Resumen" (solo revisar y continuar).

ERRORES COMUNES:
- "El webhook no verifica": el Verify Token no coincide, o la URL tiene un espacio/está mal.
  Deben ser idénticos en Meta y en el panel.
- "No llegan mensajes": falta darle "Suscribirse" al campo "messages", o el número está en
  modo prueba.
- "El token expiró a las 24h": usó el token temporal de la barra de API; debe usar el del
  Usuario del sistema (Nunca).
- "(#10)/(#200) permission denied": al usuario del sistema le faltan permisos o no le
  asignaron la App y la WABA con control total.
- "Recipient phone number not in allowed list": número en modo prueba / negocio sin verificar.
- "El número ya tiene WhatsApp": un número no puede estar en la app normal de WhatsApp y en la
  API a la vez. Hay que borrarlo de la app normal primero.

VERIFICACIÓN DEL NEGOCIO: Configuración del negocio → Centro de seguridad. Sirve para subir
los límites de mensajes. NO es obligatoria para empezar a probar (avísale que puede dejarla
para después).
`.trim();

function reglas(seccion: string | null | undefined, incluirConexion: boolean): string {
  const g = guiaSeccion(seccion);
  const base = [
    'Eres "Quino", el asistente/copiloto dentro de la app QuinChat de la Agencia QUIN.',
    'Ayudas al usuario a usar la app y, sobre todo, la pantalla donde está parado ahora mismo.',
    `PANTALLA ACTUAL: ${g.titulo}. Qué se hace aquí: ${g.guia}`,
    'Prioriza ayudar con lo de la pantalla actual. Si pregunta por algo de otra sección, oriéntalo en corto y dile a qué menú/pestaña ir.',
    'Sé breve, cálido y concreto. Tutea. Usa pasos numerados cortos cuando expliques algo. Nada de tecnicismos innecesarios.',
    'No inventes botones, pasos ni URLs que no conozcas. Si no estás seguro, dilo y sugiere el manual o el botón de soporte.',
    'Nunca pidas ni muestres tokens, contraseñas ni datos sensibles.',
    'Responde SIEMPRE en español.',
  ];
  if (incluirConexion) {
    base.push(
      '',
      'MODO CONEXIÓN META (cómo responder cuando la duda es de conectar WhatsApp/Meta):',
      '- La persona NO sabe nada de Meta. NO resumas: guíala clic por clic, nombrando cada botón/pantalla tal como aparece.',
      '- Ve UN paso a la vez. Termina preguntando "¿ya lo hiciste?" o "¿qué te aparece ahora?" para no abrumar.',
      '- SIEMPRE que una pantalla no requiera acción (ej. "Requisitos de publicación" con "No se identificaron requisitos", o "Resumen"), díselo explícito: "Aquí no tienes que hacer nada, solo dale Siguiente". Es clave: si no lo dices, se traba.',
      '- Cuando pida un nombre de app, sugiérele uno concreto (ej. "QuinChat Ventas"). Cuando pida un correo, dile que elija el correo con el que entra a Facebook.',
      '- Si te manda una captura, dile EXACTAMENTE en qué botón de esa pantalla tocar.',
      '- Puedes ser más largo de lo normal aquí: la claridad total importa más que la brevedad.',
      '',
      'GUÍA PROFUNDA PARA CONECTAR WHATSAPP CON META:',
      CONOCIMIENTO,
    );
  }
  return base.join('\n');
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const entrantes = Array.isArray(body?.messages) ? body.messages : [];
  // Anti-abuso: máximo 16 turnos, cada mensaje máx 1500 caracteres.
  const messages = entrantes
    .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
    .slice(-16)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 1500) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'falta el mensaje del cliente' }, { status: 400 });
  }

  // ¿En qué pantalla está parado el usuario? (para guiarlo en eso)
  const seccion = typeof body?.seccion === 'string' ? body.seccion : null;
  const ultimoTexto = messages[messages.length - 1].content;
  const incluirConexion = esTemaConexion(seccion, ultimoTexto);

  // Capturas de pantalla que adjuntó el cliente. Máx 2, solo tipos de imagen.
  const TIPOS_IMG = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const imagenes = (Array.isArray(body?.imagenes) ? body.imagenes : [])
    .filter((im: any) => im && typeof im.base64 === 'string' && TIPOS_IMG.includes(im.mimeType))
    .slice(0, 2)
    .map((im: any) => ({ mimeType: im.mimeType as string, base64: String(im.base64).slice(0, 7_000_000) }));

  // Contexto real del cliente (para respuestas personalizadas). Sin datos sensibles.
  let dinamico = '';
  try {
    const admin = createServerSupabaseClient();
    const { data } = await admin
      .from('tenants')
      .select('nombre, slug, wa_phone_number_id, wa_verify_token, wa_access_token')
      .eq('id', tid)
      .maybeSingle();
    if (data) {
      const origin = req.nextUrl?.origin ?? '';
      const webhook = `${origin}/api/whatsapp/webhook/${data.slug ?? ''}`;
      const pendientes: string[] = [];
      if (!data.wa_phone_number_id) pendientes.push('Phone Number ID');
      if (!data.wa_verify_token) pendientes.push('Verify Token');
      if (!data.wa_access_token) pendientes.push('Access Token');
      dinamico = [
        `DATOS REALES DE ESTE CLIENTE (úsalos si pregunta por lo suyo):`,
        `- Empresa: ${data.nombre ?? ''}`,
        `- Su URL de Webhook (la que debe pegar en Meta): ${webhook}`,
        `- Su Verify Token debe coincidir con el que ponga aquí en el panel.`,
        pendientes.length
          ? `- Datos que todavía le faltan por llenar en el panel: ${pendientes.join(', ')}.`
          : `- Ya tiene todos los datos principales llenos.`,
      ].join('\n');
    }
  } catch { /* si falla, el asistente sigue funcionando sin contexto */ }

  // Lo que Quino ha aprendido de casos reales con otros clientes (cerebro compartido).
  let aprendido = '';
  try { aprendido = await bloqueAprendido(40); } catch { /* opcional */ }

  const systemDynamic = [dinamico, aprendido].filter(Boolean).join('\n\n');

  try {
    const resp = await chat({
      messages,
      tenantId: tid,
      systemPrompt: reglas(seccion, incluirConexion),
      systemDynamic: systemDynamic || undefined,
      maxTokens: 600,
      imagenes: imagenes.length ? imagenes : undefined,
    });
    return NextResponse.json({ reply: resp.message });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error del asistente' }, { status: 500 });
  }
}
