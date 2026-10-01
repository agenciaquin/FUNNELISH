/**
 * Crons "fail-closed": se llaman por HTTP contra el servidor local (el código real
 * compilado). Recorre TODAS las carpetas de `app/api/cron/`.
 *
 * Dos pasadas, cada una con el servidor arrancado con variables distintas.
 * NUNCA con variables de producción: sin Supabase, WhatsApp ni IA configurados,
 * un cron que pase la comprobación no puede tocar nada real (revienta al crear
 * el cliente de Supabase).
 *
 *  1) Sin CRON_SECRET:
 *     SEGUIMIENTO_IA=on NEXTAUTH_SECRET=prueba-local NEXTAUTH_URL=http://localhost:3125 npx next start -p 3125
 *     MODO=sin-clave BASE=http://localhost:3125 npx tsx pruebas/crons.ts
 *
 *  2) Con CRON_SECRET:
 *     CRON_SECRET=clave-local-de-prueba SEGUIMIENTO_IA=on NEXTAUTH_SECRET=prueba-local NEXTAUTH_URL=http://localhost:3125 npx next start -p 3125
 *     MODO=con-clave CLAVE=clave-local-de-prueba BASE=http://localhost:3125 npx tsx pruebas/crons.ts
 *
 * `SEGUIMIENTO_IA=on` hace falta porque `seguimiento-ia` devuelve "apagado" ANTES
 * de comprobar la clave; sin ella no se llegaría a la comprobación.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:3125';
const MODO = process.env.MODO;
const CLAVE = process.env.CLAVE ?? '';
const RAIZ = join(__dirname, '..');

// Crons que no tienen lógica (devuelven "desactivado" sin hacer nada).
const SIN_LOGICA = new Set(['promo-cierre']);

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error('FALLA BASE no es local: esta prueba solo corre contra localhost');
  process.exit(1);
}
for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (existsSync(join(RAIZ, f))) {
    console.error(`FALLA existe ${f}: next start lo cargaría. No se ejecuta.`);
    process.exit(1);
  }
}
if (MODO !== 'sin-clave' && MODO !== 'con-clave') {
  console.error('MODO debe ser sin-clave o con-clave');
  process.exit(1);
}
if (MODO === 'con-clave' && !CLAVE) {
  console.error('MODO=con-clave necesita CLAVE');
  process.exit(1);
}

const crons = readdirSync(join(RAIZ, 'app', 'api', 'cron'), { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(join(RAIZ, 'app', 'api', 'cron', d.name, 'route.ts')))
  .map(d => d.name)
  .sort();

async function llamar(nombre: string, opciones: { bearer?: string; query?: string }) {
  const url = new URL(`/api/cron/${nombre}`, BASE);
  if (opciones.query !== undefined) url.searchParams.set('secret', opciones.query);
  const headers: Record<string, string> = {};
  if (opciones.bearer !== undefined) headers.authorization = `Bearer ${opciones.bearer}`;
  const r = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  const texto = (await r.text()).slice(0, 90).replace(/\s+/g, ' ');
  return { status: r.status, texto };
}

let fallos = 0, total = 0;
function informar(ok: boolean, texto: string) {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${texto}`);
}

(async () => {
  console.log(`MODO=${MODO} · ${crons.length} crons: ${crons.join(', ')}\n`);

  for (const c of crons) {
    const sinLogica = SIN_LOGICA.has(c);
    const rechazos: Array<[string, { bearer?: string; query?: string }]> = MODO === 'sin-clave'
      ? [['sin nada', {}], ['Bearer undefined', { bearer: 'undefined' }], ['?secret= vacío', { query: '' }], ['?secret=undefined', { query: 'undefined' }]]
      : [['sin nada', {}], ['Bearer incorrecto', { bearer: CLAVE + 'x' }], ['?secret incorrecto', { query: 'x' + CLAVE }], ['Bearer vacío', { bearer: '' }]];

    for (const [nombre, op] of rechazos) {
      const r = await llamar(c, op);
      const ok = sinLogica ? r.status === 200 && /desactivado/.test(r.texto) : r.status === 401;
      informar(ok, `${c.padEnd(22)} ${nombre.padEnd(18)} -> ${r.status} ${sinLogica ? '(sin lógica) ' : ''}${r.texto}`);
    }

    if (MODO === 'con-clave') {
      for (const [nombre, op] of [['Bearer correcto', { bearer: CLAVE }], ['?secret correcto', { query: CLAVE }]] as const) {
        const r = await llamar(c, op);
        // Pasa la comprobación = no es 401. Lo que venga después (500 por falta de
        // Supabase, "sin-config", "apagado") ya es la lógica del cron.
        informar(r.status !== 401, `${c.padEnd(22)} ${nombre.padEnd(18)} -> ${r.status} ${r.texto}`);
      }
    }
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
