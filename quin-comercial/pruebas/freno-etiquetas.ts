/**
 * Freno del bot: al llegar al tope, HUMANO se AÑADE a las etiquetas sin borrar
 * VENTA REALIZADA / PEDIDO PROGRAMADO ni duplicarse. Código real (`lib/freno-bot.ts`,
 * `lib/panel/types.ts`) y cliente real de supabase-js contra un PostgREST FALSO
 * local: se mira la fila que queda en la "base", no las llamadas.
 *   npx tsx pruebas/freno-etiquetas.ts
 * Archivo idéntico en quinchat/pruebas y quin-comercial/pruebas.
 */
import { arrancarPostgrest } from './_postgrest-falso';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

const CHAT = '573001112233';
const OTRO = '573009998877';
const mensajes = (n: number, conv = CHAT) => Array.from({ length: n }, (_, i) => ({
  id: `${conv}-m${i}`, conversation_id: conv, role: 'assistant',
  created_at: new Date(Date.now() - 60_000 * (i + 1)).toISOString(),
}));

(async () => {
  const db = await arrancarPostgrest({});
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  delete process.env.BOT_IA;
  delete process.env.BOT_TOPE_DIARIO;
  const warn = console.warn; console.warn = () => {};

  const { createServerSupabaseClient } = await import('../lib/supabase');
  const { botPuedeResponder } = await import('../lib/freno-bot');
  const sb = createServerSupabaseClient();

  async function correr(label: string | null, n: number) {
    db.tablas.conversations = [
      { id: CHAT, label, bot_enabled: true },
      { id: OTRO, label: 'VENTA REALIZADA', bot_enabled: true },
    ];
    // 200 mensajes viejos (>24 h) y del cliente no cuentan
    db.tablas.messages = [
      ...mensajes(n),
      ...Array.from({ length: 200 }, (_, i) => ({ id: `v${i}`, conversation_id: CHAT, role: 'assistant', created_at: new Date(Date.now() - 30 * 3600_000).toISOString() })),
      ...Array.from({ length: 200 }, (_, i) => ({ id: `u${i}`, conversation_id: CHAT, role: 'user', created_at: new Date().toISOString() })),
      ...mensajes(500, OTRO),
    ];
    const r = await botPuedeResponder(sb, CHAT);
    const fila = db.tablas.conversations.find((c: any) => c.id === CHAT);
    const otra = db.tablas.conversations.find((c: any) => c.id === OTRO);
    return { r, fila, otra };
  }

  try {
    for (const [antes, esperado] of [
      ['VENTA REALIZADA | PEDIDO PROGRAMADO', 'VENTA REALIZADA | PEDIDO PROGRAMADO | HUMANO'],
      ['VENTA REALIZADA | PEDIDO PROGRAMADO | HUMANO', 'VENTA REALIZADA | PEDIDO PROGRAMADO | HUMANO'],
      ['HUMANO | VENTA REALIZADA', 'HUMANO | VENTA REALIZADA'],
      ['VENTA REALIZADA|PEDIDO PROGRAMADO', 'VENTA REALIZADA | PEDIDO PROGRAMADO | HUMANO'],
      ['  VENTA REALIZADA  |  | PEDIDO PROGRAMADO ', 'VENTA REALIZADA | PEDIDO PROGRAMADO | HUMANO'],
      [null, 'HUMANO'],
      ['', 'HUMANO'],
    ] as Array<[string | null, string]>) {
      const { r, fila, otra } = await correr(antes, 80);
      caso(`tope (80) con label ${JSON.stringify(antes)} -> '${esperado}', bot apagado`,
        r === false && fila.label === esperado && fila.bot_enabled === false, JSON.stringify(fila));
      caso(`  ...y la otra conversación no se toca`, otra.label === 'VENTA REALIZADA' && otra.bot_enabled === true, JSON.stringify(otra));
    }
    {
      const { r, fila } = await correr('VENTA REALIZADA | PEDIDO PROGRAMADO', 79);
      caso('79 mensajes del bot en 24 h (con 200 viejos y 200 del cliente) -> responde y no toca la fila',
        r === true && fila.label === 'VENTA REALIZADA | PEDIDO PROGRAMADO' && fila.bot_enabled === true, JSON.stringify(fila));
    }
    {
      // Si leer `label` falla: apaga el bot, no toca la lista.
      db.fallar = p => p.tabla === 'conversations' && p.metodo === 'GET';
      const { r, fila } = await correr('VENTA REALIZADA | PEDIDO PROGRAMADO', 80);
      db.fallar = () => false;
      caso('no se puede leer label -> bot apagado y label intacto',
        r === false && fila.bot_enabled === false && fila.label === 'VENTA REALIZADA | PEDIDO PROGRAMADO', JSON.stringify(fila));
    }
    {
      // Informativo: la deduplicación distingue mayúsculas (joinLabels usa Set).
      const { fila } = await correr('VENTA REALIZADA | humano', 80);
      console.log(`info  label 'VENTA REALIZADA | humano' queda '${fila.label}' (dedupe sensible a mayúsculas)`);
    }
  } finally {
    console.warn = warn;
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });
