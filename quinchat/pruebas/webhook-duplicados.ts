/**
 * Anti-duplicados del webhook de WhatsApp (línea de confirmación), con la ruta
 * REAL `app/api/whatsapp/webhook/route.ts` (POST).
 *   npx tsx pruebas/webhook-duplicados.ts
 *
 * Casos (auditoría de integracion, fallo 2):
 *  1. Texto y, durante la espera de 12 s, un pin de ubicación: el turno del texto
 *     NO se descarta (antes la ubicación dejaba una fila vacía de cliente y la
 *     espera la tomaba por "llegó otro mensaje": nadie respondía). La ubicación
 *     no deja ninguna fila.
 *  2. Reintento de Meta de un texto: se corta antes de la espera y de la IA.
 *  3. Reintento de una foto: no se vuelve a descargar ni a guardar.
 *  4. Nota de voz transcrita y foto con texto: `-audio`, `-caption` y el id
 *     normal no se pisan ni se toman por duplicado.
 *
 * Supabase = PostgREST falso local con `messages` con clave primaria `id`.
 * Ninguna llamada sale de la máquina: `fetch` hacia fuera responde con datos
 * falsos (Meta, Groq) o 503. Sin ANTHROPIC_API_KEY la IA falla antes de la red.
 * La espera de 12 s se acorta a 400 ms.
 *
 * Señal de "el turno siguió tras la espera": la consulta de la última respuesta
 * del bot (`role in (assistant,agent)` ordenada por fecha), que solo se hace
 * después de la espera y de la comprobación de "llegó otro mensaje".
 */
import { arrancarPostgrest, type Peticion } from './_postgrest-falso';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

const FROM = '573009998877';
const ESPERA_PRUEBA = 400;
const dormir = (ms: number) => new Promise(r => setTimeout(r, ms));

(async () => {
  const db = await arrancarPostgrest({
    conversations: [{ id: FROM, contact_name: 'Ana', bot_enabled: true, interaccion_bot: true, unread_count: 0, label: '' }],
    messages: [],
  });
  db.unicos.add('messages');

  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  process.env.WHATSAPP_ACCESS_TOKEN = 'falso';   // para que intente descargar (contra el fetch falso)
  process.env.GROQ_API_KEY = 'falso';            // para que transcriba (contra el fetch falso)
  for (const v of ['WHATSAPP_APP_SECRET', 'ANTHROPIC_API_KEY', 'BOT_IA', 'BOT_TOPE_DIARIO', 'WHATSAPP_PHONE_NUMBER_ID_VENTAS']) delete process.env[v];

  // ── Nada sale de la máquina ────────────────────────────────────────────────
  const fuera: string[] = [];
  const fetchOrig = globalThis.fetch;
  globalThis.fetch = (async (entrada: any, init?: any) => {
    const url = String(entrada?.url ?? entrada);
    if (url.startsWith('http://127.0.0.1')) return fetchOrig(entrada, init);
    fuera.push(url);
    const m = url.match(/graph\.facebook\.com\/v[\d.]+\/(media-[a-z0-9-]+)$/);
    if (m) {
      const audio = m[1].startsWith('media-audio');
      return new Response(JSON.stringify({ url: `https://archivo.prueba/${m[1]}`, mime_type: audio ? 'audio/ogg' : 'image/jpeg' }), { status: 200 });
    }
    if (url.startsWith('https://archivo.prueba/')) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    if (url.startsWith('https://api.groq.com/')) return new Response('quiero la talla M', { status: 200 });
    return new Response('{"error":"sin red en la prueba"}', { status: 503 });
  }) as any;

  // La espera de 12 s se acorta (solo esa).
  const stOrig = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: any, ms?: number, ...a: any[]) => stOrig(fn, ms === 12000 ? ESPERA_PRUEBA : ms, ...a)) as any;

  const silencio = { log: console.log, error: console.error, warn: console.warn };
  const callar = () => { console.error = () => {}; console.warn = () => {}; };
  const hablar = () => { console.error = silencio.error; console.warn = silencio.warn; };

  callar();
  const { POST } = await import('../app/api/whatsapp/webhook/route');
  const { NextRequest } = await import('next/server');
  hablar();

  const aviso = (msg: any) => new NextRequest('https://x/api/whatsapp/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entry: [{ changes: [{ value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: '111' },
      contacts: [{ profile: { name: 'Ana' }, wa_id: FROM }],
      messages: [{ from: FROM, timestamp: String(Math.floor(Date.now() / 1000)), ...msg }],
    } }] }] }),
  });
  // Ejecuta la ruta sin que el log de la app (IA sin clave, envíos fallidos) tape el resultado.
  const enviar = async (msg: any) => {
    const logOrig = console.log;
    console.log = () => {}; callar();
    try { return await POST(aviso(msg)).catch(() => null); }
    finally { console.log = logOrig; hablar(); }
  };
  const trasLaEspera = (p: Peticion) => p.tabla === 'messages' && p.metodo === 'GET'
    && p.query.get('role') === 'in.(assistant,agent)' && (p.query.get('order') ?? '').startsWith('created_at.desc');
  const turnosQueSiguieron = () => db.peticiones.filter(trasLaEspera).length;
  const fila = (id: string) => db.tablas.messages.filter((m: any) => m.id === id);
  const filasCliente = () => db.tablas.messages.filter((m: any) => m.role === 'user');

  try {
    // ── 1 · Texto + ubicación durante la espera ──────────────────────────────
    {
      const antes = turnosQueSiguieron();
      const texto = enviar({ id: 'wamid.T1', type: 'text', text: { body: 'Calle 10 # 5-20, Garzón' } });
      for (let i = 0; i < 100 && fila('wamid.T1').length === 0; i++) await dormir(10);
      caso('1. el texto se guarda', fila('wamid.T1').length === 1 && fila('wamid.T1')[0].content === 'Calle 10 # 5-20, Garzón');
      await enviar({ id: 'wamid.L1', type: 'location', location: { latitude: 2.19, longitude: -75.62 } });
      await texto;
      caso('1. la ubicación no deja ninguna fila', fila('wamid.L1').length === 0, JSON.stringify(fila('wamid.L1')));
      caso('1. ninguna fila de cliente vacía', !filasCliente().some((m: any) => !String(m.content ?? '').trim()));
      caso('1. el turno del texto NO se descarta tras la espera', turnosQueSiguieron() === antes + 1, `${turnosQueSiguieron() - antes} turnos`);
    }

    // ── 2 · Reintento de Meta de un texto ────────────────────────────────────
    {
      const antes = turnosQueSiguieron();
      await enviar({ id: 'wamid.T2', type: 'text', text: { body: 'talla M' } });
      const tras1 = turnosQueSiguieron();
      await enviar({ id: 'wamid.T2', type: 'text', text: { body: 'talla M' } });
      caso('2. primer aviso: el turno sigue', tras1 === antes + 1);
      caso('2. reintento: se corta antes de la espera y de la IA', turnosQueSiguieron() === tras1, `${turnosQueSiguieron() - tras1} turnos de más`);
      caso('2. reintento: una sola fila', fila('wamid.T2').length === 1);
    }

    // ── 3 · Reintento de una foto ────────────────────────────────────────────
    {
      fuera.length = 0;
      await enviar({ id: 'wamid.I1', type: 'image', image: { id: 'media-img1', mime_type: 'image/jpeg' } });
      const descargas1 = fuera.filter(u => u.includes('media-img1')).length;
      const subidas1 = db.peticiones.filter(p => p.tabla.includes('/storage/')).length;
      await enviar({ id: 'wamid.I1', type: 'image', image: { id: 'media-img1', mime_type: 'image/jpeg' } });
      const descargas2 = fuera.filter(u => u.includes('media-img1')).length;
      const subidas2 = db.peticiones.filter(p => p.tabla.includes('/storage/')).length;
      caso('3. primer aviso: descarga la foto', descargas1 > 0);
      caso('3. reintento: no la vuelve a descargar', descargas2 === descargas1, `${descargas2 - descargas1} descargas de más`);
      caso('3. reintento: no la vuelve a subir', subidas2 === subidas1, `${subidas2 - subidas1} subidas de más`);
      caso('3. una sola fila, completada (no vacía)', fila('wamid.I1').length === 1 && !!String(fila('wamid.I1')[0].content).trim());
    }

    // ── 4 · Nota de voz transcrita y foto con texto ──────────────────────────
    {
      const antes = turnosQueSiguieron();
      await enviar({ id: 'wamid.A1', type: 'audio', audio: { id: 'media-audio1', mime_type: 'audio/ogg' } });
      caso('4. nota de voz: fila del archivo con `-audio`', fila('wamid.A1-audio').length === 1);
      caso('4. nota de voz: la transcripción va con el id normal y no se toma por duplicado',
        fila('wamid.A1').length === 1 && /quiero la talla M/.test(fila('wamid.A1')[0].content), JSON.stringify(fila('wamid.A1')));
      caso('4. nota de voz: el turno sigue a la IA', turnosQueSiguieron() === antes + 1);
      const tras = turnosQueSiguieron();
      fuera.length = 0;
      await enviar({ id: 'wamid.A1', type: 'audio', audio: { id: 'media-audio1', mime_type: 'audio/ogg' } });
      caso('4. nota de voz reintentada: ni descarga, ni transcripción, ni turno',
        fuera.length === 0 && turnosQueSiguieron() === tras && fila('wamid.A1').length === 1, `${fuera.length} llamadas fuera`);

      await enviar({ id: 'wamid.I2', type: 'image', image: { id: 'media-img2', mime_type: 'image/jpeg', caption: 'esta en negro' } });
      caso('4. foto con texto: la foto y `-caption` se guardan los dos',
        fila('wamid.I2').length === 1 && fila('wamid.I2-caption').length === 1 && fila('wamid.I2-caption')[0].content === 'esta en negro');
    }
  } finally {
    globalThis.fetch = fetchOrig;
    globalThis.setTimeout = stOrig;
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });
