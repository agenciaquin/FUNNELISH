/**
 * Alcance de los crons en quin-comercial (`lib/cron-tenant.ts`), con el código real.
 *   npx tsx pruebas/cron-alcance.ts
 *
 * Supabase es un PostgREST FALSO local (pruebas/_postgrest-falso.ts): el cliente
 * real de supabase-js le habla por HTTP y la prueba mira qué pidió y qué cambió.
 * La sesión es un JWT real de next-auth (pruebas/_sesion-falsa.ts).
 *
 * 1) `porCadaTenant` sin filtro → todas las empresas activas; con `soloTenantId`
 *    → solo esa (y ninguna si no existe o está inactiva).
 * 2) `alcanceCron`: clave → todas; sin clave con sesión de empresa → solo la suya;
 *    sin clave y sin sesión (o sesión sin empresa) → null.
 * 3) La ruta REAL `app/api/cron/apagar-vendidos` (solo toca la base, sin IA ni
 *    WhatsApp): con sesión de t2 solo apaga el chat vendido de t2; con la clave,
 *    los de todas; sin nada, 401 sin tocar la base.
 */
import { arrancarPostgrest, de } from './_postgrest-falso';
import { instalarNextHeaders, fijarSesion } from './_sesion-falsa';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

const hace2h = new Date(Date.now() - 2 * 3600_000).toISOString();
const TENANTS = [
  { id: 't1', slug: 'uno', activo: true, wa_access_token: null, wa_phone_number_id: null, wa_phone_number_id_ventas: null },
  { id: 't2', slug: 'dos', activo: true, wa_access_token: null, wa_phone_number_id: null, wa_phone_number_id_ventas: null },
  { id: 't3', slug: 'tres', activo: true, wa_access_token: null, wa_phone_number_id: null, wa_phone_number_id_ventas: null },
  { id: 't4', slug: 'inactiva', activo: false, wa_access_token: null, wa_phone_number_id: null, wa_phone_number_id_ventas: null },
];
const CONVS = () => ['t1', 't2', 't3', 't4'].map(t => ({ id: `c-${t}`, tenant_id: t, vendido_at: hace2h, bot_enabled: true }));

(async () => {
  const db = await arrancarPostgrest({ tenants: TENANTS, conversations: CONVS() });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  delete process.env.CRON_SECRET;
  instalarNextHeaders();

  const { porCadaTenant, alcanceCron } = await import('../lib/cron-tenant');

  try {
    // ── 1. porCadaTenant ──────────────────────────────────────────────────────
    {
      const vistos: string[] = [];
      db.peticiones.length = 0;
      const r = await porCadaTenant(async (_sb, t) => { vistos.push(t.id); });
      const q = de(db, 'tenants', 'GET')[0]?.query;
      caso('sin soloTenantId: recorre t1,t2,t3 (activas)', vistos.join() === 't1,t2,t3' && r.tenants === 3, vistos.join());
      caso('sin soloTenantId: la consulta filtra activo y NO filtra id', q?.get('activo') === 'eq.true' && !q?.has('id'), q?.toString());
    }
    {
      const vistos: string[] = [];
      db.peticiones.length = 0;
      const r = await porCadaTenant(async (_sb, t) => { vistos.push(t.id); }, 't2');
      const q = de(db, 'tenants', 'GET')[0]?.query;
      caso('soloTenantId=t2: solo t2', vistos.join() === 't2' && r.tenants === 1, vistos.join());
      caso('soloTenantId=t2: la consulta lleva id=eq.t2 y activo=eq.true', q?.get('id') === 'eq.t2' && q?.get('activo') === 'eq.true', q?.toString());
    }
    {
      const vistos: string[] = [];
      const r = await porCadaTenant(async (_sb, t) => { vistos.push(t.id); }, 't4');
      caso('soloTenantId de una empresa inactiva: ninguna', vistos.length === 0 && r.tenants === 0, vistos.join());
      const r2 = await porCadaTenant(async (_sb, t) => { vistos.push(t.id); }, 'no-existe');
      caso('soloTenantId que no existe: ninguna', vistos.length === 0 && r2.tenants === 0, vistos.join());
    }
    {
      // El cliente que recibe fn filtra por la empresa (supabaseTenant)
      db.peticiones.length = 0;
      await porCadaTenant(async (sb) => { await sb.from('conversations').select('id'); }, 't2');
      const q = de(db, 'conversations', 'GET')[0]?.query;
      caso('el cliente de fn filtra tenant_id=eq.t2', q?.get('tenant_id') === 'eq.t2', q?.toString());
    }
    {
      const vistos: string[] = [];
      db.fallar = p => p.tabla === 'tenants';
      const r = await porCadaTenant(async (_sb, t) => { vistos.push(t.id); }, 't2');
      db.fallar = () => false;
      caso('si falla leer tenants: no recorre ninguna y cuenta el error', vistos.length === 0 && r.errores === 1, JSON.stringify(r));
    }

    // ── 2. alcanceCron ────────────────────────────────────────────────────────
    await fijarSesion(null);
    caso('clave correcta -> {} (todas)', JSON.stringify(await alcanceCron(true)) === '{}');
    await fijarSesion({ name: 'a', email: 'a@x.co', tenantId: 't2' });
    caso('clave correcta aunque haya sesión de t2 -> {} (todas)', JSON.stringify(await alcanceCron(true)) === '{}');
    const conSesion = await alcanceCron(false);
    caso('sin clave, sesión de t2 -> { soloTenantId: t2 }', conSesion?.soloTenantId === 't2', JSON.stringify(conSesion));
    await fijarSesion(null);
    caso('sin clave y sin sesión -> null', (await alcanceCron(false)) === null);
    await fijarSesion({ name: 'a', email: 'a@x.co' });
    caso('sin clave, sesión SIN empresa -> null', (await alcanceCron(false)) === null);

    // ── 3. Ruta real apagar-vendidos ─────────────────────────────────────────
    const ruta = await import('../app/api/cron/apagar-vendidos/route');
    const { NextRequest } = await import('next/server');
    const pedir = (h: Record<string, string> = {}, qs = '') =>
      new NextRequest(`http://localhost:3000/api/cron/apagar-vendidos${qs}`, { headers: h });
    const encendidos = () => db.tablas.conversations.filter((c: any) => c.bot_enabled).map((c: any) => c.tenant_id).sort().join();

    process.env.CRON_SECRET = 'clave-local';
    // a) sin clave y sin sesión
    await fijarSesion(null);
    db.tablas.conversations = CONVS();
    db.peticiones.length = 0;
    let r = await ruta.GET(pedir());
    caso('ruta sin clave ni sesión -> 401', r.status === 401, `status ${r.status}`);
    caso('ruta sin clave ni sesión: no toca la base', db.peticiones.length === 0, `${db.peticiones.length} peticiones`);

    // b) clave equivocada + sesión de t2 → solo t2
    await fijarSesion({ name: 'a', email: 'a@x.co', tenantId: 't2' });
    db.tablas.conversations = CONVS();
    r = await ruta.GET(pedir({ authorization: 'Bearer otra' }));
    let j: any = await r.json();
    caso('ruta con sesión de t2 -> 200, tenants=1', r.status === 200 && j.tenants === 1, JSON.stringify(j));
    caso('ruta con sesión de t2: solo se apaga el chat de t2', encendidos() === 't1,t3,t4', `siguen encendidos: ${encendidos()}`);

    // c) clave correcta (con o sin sesión) → todas las activas
    await fijarSesion(null);
    db.tablas.conversations = CONVS();
    r = await ruta.GET(pedir({ authorization: 'Bearer clave-local' }));
    j = await r.json();
    caso('ruta con clave -> 200, tenants=3', r.status === 200 && j.tenants === 3, JSON.stringify(j));
    caso('ruta con clave: se apagan t1,t2,t3 (t4 inactiva no)', encendidos() === 't4', `siguen encendidos: ${encendidos()}`);

    // d) sin CRON_SECRET en el servidor, la sesión sigue limitada a su empresa
    delete process.env.CRON_SECRET;
    await fijarSesion({ name: 'a', email: 'a@x.co', tenantId: 't3' });
    db.tablas.conversations = CONVS();
    r = await ruta.GET(pedir({ authorization: 'Bearer ' }));
    j = await r.json();
    caso('sin CRON_SECRET + sesión de t3 -> solo t3', r.status === 200 && j.tenants === 1 && encendidos() === 't1,t2,t4', `${JSON.stringify(j)} encendidos=${encendidos()}`);
    await fijarSesion(null);
    r = await ruta.GET(pedir({ authorization: 'Bearer undefined' }, '?secret=undefined'));
    caso('sin CRON_SECRET y sin sesión, con "undefined" como clave -> 401', r.status === 401, `status ${r.status}`);
  } finally {
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });
