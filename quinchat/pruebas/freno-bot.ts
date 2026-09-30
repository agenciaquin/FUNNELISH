/**
 * Freno del bot (`lib/freno-bot.ts`) con un cliente de Supabase FALSO que anota
 * cada llamada. No toca ninguna base.
 *   npx tsx pruebas/freno-bot.ts
 */
import { botIaApagado, botPuedeResponder } from '../lib/freno-bot';

type Llamada = { tabla: string; ops: Array<[string, any[]]> };

function supabaseFalso(respuestaConteo: { count: number | null; error: any }) {
  const llamadas: Llamada[] = [];
  const from = (tabla: string) => {
    const l: Llamada = { tabla, ops: [] };
    llamadas.push(l);
    const b: any = {};
    for (const op of ['select', 'eq', 'gte', 'update', 'insert', 'upsert', 'delete', 'in', 'lt']) {
      b[op] = (...args: any[]) => { l.ops.push([op, args]); return b; };
    }
    b.then = (ok: any, mal: any) => {
      const res = tabla === 'messages' ? respuestaConteo : { data: null, error: null };
      return Promise.resolve(res).then(ok, mal);
    };
    return b;
  };
  return { cliente: { from }, llamadas };
}

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${extra ? ' · ' + extra : ''}`);
}

const op = (l: Llamada | undefined, nombre: string) => l?.ops.filter(o => o[0] === nombre).map(o => o[1]) ?? [];
const huboUpdate = (ll: Llamada[]) => ll.some(l => l.tabla === 'conversations' && op(l, 'update').length > 0);

function entorno(botIa?: string, tope?: string) {
  if (botIa === undefined) delete process.env.BOT_IA; else process.env.BOT_IA = botIa;
  if (tope === undefined) delete process.env.BOT_TOPE_DIARIO; else process.env.BOT_TOPE_DIARIO = tope;
}

(async () => {
  const warn = console.warn;
  console.warn = () => {};
  const CHAT = '573001112233';

  // ── BOT_IA ──────────────────────────────────────────────────────────────────
  for (const v of ['off', 'OFF', ' off ']) {
    entorno(v);
    const f = supabaseFalso({ count: 0, error: null });
    const r = await botPuedeResponder(f.cliente, CHAT);
    caso(`BOT_IA='${v}' -> false sin consultar`, r === false && f.llamadas.length === 0 && botIaApagado());
  }
  for (const v of [undefined, '', 'on', 'apagado']) {
    entorno(v);
    caso(`BOT_IA=${v === undefined ? '(sin variable)' : `'${v}'`} no apaga`, botIaApagado() === false);
  }

  // ── Por debajo del tope (40 por defecto) ────────────────────────────────────
  entorno(undefined, undefined);
  {
    const antes = Date.now();
    const f = supabaseFalso({ count: 39, error: null });
    const r = await botPuedeResponder(f.cliente, CHAT);
    caso('count 39 < 40 -> true', r === true);
    caso('count < tope no apaga el chat', !huboUpdate(f.llamadas));
    const m = f.llamadas.find(l => l.tabla === 'messages');
    const sel = op(m, 'select')[0];
    const eqs = op(m, 'eq');
    const gte = op(m, 'gte')[0];
    caso('cuenta en messages con count exact y head',
      !!m && sel?.[1]?.count === 'exact' && sel?.[1]?.head === true);
    caso('filtra por conversation_id y role=assistant',
      eqs.some(e => e[0] === 'conversation_id' && e[1] === CHAT) && eqs.some(e => e[0] === 'role' && e[1] === 'assistant'));
    const desde = gte ? Date.parse(gte[1]) : NaN;
    caso('ventana de 24 h en created_at',
      gte?.[0] === 'created_at' && Math.abs(antes - 24 * 3600_000 - desde) < 5_000, `desde ${gte?.[1]}`);
  }

  // ── En el tope o por encima ─────────────────────────────────────────────────
  for (const n of [40, 100]) {
    const f = supabaseFalso({ count: n, error: null });
    const r = await botPuedeResponder(f.cliente, CHAT);
    const conv = f.llamadas.find(l => l.tabla === 'conversations');
    const upd = op(conv, 'update')[0]?.[0];
    const eq = op(conv, 'eq')[0];
    caso(`count ${n} >= 40 -> false`, r === false);
    caso(`count ${n}: update bot_enabled=false, label=HUMANO en ese chat`,
      upd?.bot_enabled === false && upd?.label === 'HUMANO' && eq?.[0] === 'id' && eq?.[1] === CHAT,
      JSON.stringify({ upd, eq }));
  }

  // ── Errores al contar: deja responder ───────────────────────────────────────
  {
    const f = supabaseFalso({ count: null, error: { message: 'fallo de red' } });
    caso('error al contar -> true', (await botPuedeResponder(f.cliente, CHAT)) === true && !huboUpdate(f.llamadas));
    const g = supabaseFalso({ count: null, error: null });
    caso('count null -> true', (await botPuedeResponder(g.cliente, CHAT)) === true && !huboUpdate(g.llamadas));
  }

  // ── BOT_TOPE_DIARIO ─────────────────────────────────────────────────────────
  {
    entorno(undefined, '0');
    const f = supabaseFalso({ count: 9999, error: null });
    caso('BOT_TOPE_DIARIO=0 -> true sin consultar', (await botPuedeResponder(f.cliente, CHAT)) === true && f.llamadas.length === 0);
    entorno(undefined, '5');
    const g = supabaseFalso({ count: 5, error: null });
    caso('BOT_TOPE_DIARIO=5 y count 5 -> false', (await botPuedeResponder(g.cliente, CHAT)) === false && huboUpdate(g.llamadas));
    const h = supabaseFalso({ count: 4, error: null });
    caso('BOT_TOPE_DIARIO=5 y count 4 -> true', (await botPuedeResponder(h.cliente, CHAT)) === true);
    entorno('off', '5');
    const i = supabaseFalso({ count: 0, error: null });
    caso('BOT_IA=off manda sobre el tope', (await botPuedeResponder(i.cliente, CHAT)) === false && i.llamadas.length === 0);
  }

  entorno(undefined, undefined);
  console.warn = warn;
  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
