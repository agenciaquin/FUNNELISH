/**
 * Sondeo del middleware REAL (el que compila `next build`) contra un servidor local.
 *
 *   npx next build
 *   NEXTAUTH_SECRET=prueba-local NEXTAUTH_URL=http://localhost:3124 npx next start -p 3124
 *   BASE=http://localhost:3124 npx tsx pruebas/middleware-api.ts
 *
 * Recorre TODAS las rutas `app/api/**\/route.ts`, y a cada una le manda un método
 * que la ruta NO exporta: si el middleware la deja pasar, Next responde 405 sin
 * ejecutar nada; si la protege, responde 307 a /login. Así no se ejecuta lógica.
 *
 * La lista "esperada" es la especificación (BLOQUEANTES-CONSUMO.md), no una copia
 * de `esApiPublica`: lo que se prueba es lo que hace el middleware compilado.
 */
import { request } from 'node:http';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:3124';
const RAIZ = join(__dirname, '..');

// ── Especificación ────────────────────────────────────────────────────────────
const HOSTS_TIENDA = ['www.klixmant.shop', 'tienda.skioo.shop'];
const HOSTS_PANEL = ['localhost', 'quinchat-comercial.vercel.app'];

function esperadaPublica(ruta: string): boolean {
  if (['/api/pedidos', '/api/funnels/evento', '/api/funnels/carrito', '/api/registro'].includes(ruta)) return true;
  const prefijos = ['/api/whatsapp/webhook', '/api/whatsapp/confirmar', '/api/funnelish/webhook', '/api/recargas/webhook', '/api/cron', '/api/auth'];
  return prefijos.some(p => ruta === p || ruta.startsWith(p + '/'));
}

// Casos límite que no son rutas del árbol pero no deben abrir nada.
const EXTRA: Array<{ ruta: string; publica: boolean; nota: string }> = [
  { ruta: '/api/pedidos/lista', publica: false, nota: '/api/pedidos NO abre /lista' },
  { ruta: '/api/pedidos/', publica: true, nota: 'barra final' },
  { ruta: '/api/pedidos-x', publica: false, nota: 'prefijo parecido' },
  { ruta: '/api/cronx/algo', publica: false, nota: 'prefijo parecido a /api/cron/' },
  { ruta: '/api/whatsapp/webhookx', publica: false, nota: 'prefijo parecido a webhook' },
  { ruta: '/api/whatsapp/confirmarx', publica: false, nota: 'prefijo parecido a confirmar' },
  { ruta: '/api/cron/../pedidos/lista', publica: false, nota: 'recorrido ../ sin normalizar' },
  { ruta: '/api/cron/%2e%2e/pedidos/lista', publica: false, nota: 'recorrido %2e%2e' },
  { ruta: '/api//pedidos/lista', publica: false, nota: 'doble barra' },
  { ruta: '/API/pedidos/lista', publica: false, nota: 'mayúsculas' },
];

// ── Utilidades ────────────────────────────────────────────────────────────────
const METODOS = ['PUT', 'PATCH', 'DELETE', 'POST', 'GET'];

function rutasApi(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...rutasApi(p));
    else if (n === 'route.ts') out.push(p);
  }
  return out;
}

function exportados(src: string): Set<string> {
  const s = new Set<string>();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) s.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const parte of m[1].split(',')) {
      const nombre = parte.trim().split(/\s+as\s+/).pop()!.trim();
      if (METODOS.includes(nombre) || nombre === 'HEAD' || nombre === 'OPTIONS') s.add(nombre);
    }
  }
  return s;
}

function urlDeArchivo(f: string): string {
  const rel = relative(join(RAIZ, 'app'), f).split(sep).slice(0, -1);
  return '/' + rel.map(seg =>
    seg.startsWith('[...') ? 'session' : seg.startsWith('[') ? 'prueba-x1' : seg,
  ).join('/');
}

function pedir(metodo: string, ruta: string, host: string): Promise<{ status: number; location: string; rewrite: string }> {
  const u = new URL(BASE);
  return new Promise((ok, mal) => {
    const r = request({ hostname: u.hostname, port: u.port, method: metodo, path: ruta, headers: { host, 'content-length': '0' } }, res => {
      res.resume();
      res.on('end', () => ok({
        status: res.statusCode ?? 0,
        location: String(res.headers.location ?? ''),
        rewrite: String(res.headers['x-middleware-rewrite'] ?? ''),
      }));
    });
    r.on('error', mal);
    r.end();
  });
}

const aLogin = (r: { status: number; location: string }) =>
  (r.status === 307 || r.status === 302) && /\/login(\?|$)/.test(r.location);

let fallos = 0, total = 0;
function informar(ok: boolean, texto: string) {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${texto}`);
}

(async () => {
  const archivos = rutasApi(join(RAIZ, 'app', 'api')).sort();
  const publicas: string[] = [], protegidas: string[] = [];

  for (const f of archivos) {
    const ruta = urlDeArchivo(f);
    const exp = exportados(readFileSync(f, 'utf8'));
    const metodo = METODOS.find(m => !exp.has(m));
    if (!metodo) { informar(false, `${ruta}: exporta todos los métodos, no se puede sondear sin ejecutar`); continue; }
    const quiero = esperadaPublica(ruta);
    (quiero ? publicas : protegidas).push(ruta);

    for (const host of [...HOSTS_TIENDA, ...HOSTS_PANEL]) {
      const r = await pedir(metodo, ruta, host);
      // Pública: el middleware la deja pasar y Next responde 405 (método no exportado).
      // Protegida: 307 a /login.
      const ok = quiero ? r.status === 405 : aLogin(r);
      informar(ok, `${quiero ? 'pública  ' : 'protegida'} ${metodo.padEnd(6)} ${ruta} [${host}] -> ${r.status}${r.location ? ' ' + r.location : ''}`);
    }
  }

  for (const e of EXTRA) {
    for (const host of [...HOSTS_TIENDA, ...HOSTS_PANEL]) {
      const r = await pedir('PUT', e.ruta, host);
      // No pública = no llega a ningún manejador: login, 400, 404 (no existe / página),
      // o 308 que normaliza la dirección (la normalizada se sondea en el árbol).
      const ok = e.publica
        ? !aLogin(r)
        : aLogin(r) || r.status === 400 || r.status === 404 || (r.status === 308 && !r.location.includes('//'));
      informar(ok, `límite ${e.ruta} (${e.nota}) [${host}] -> ${r.status}${r.location ? ' ' + r.location : ''}`);
    }
  }

  // ── Páginas: las landings de la tienda se REESCRIBEN a /p/... (no van a login) ──
  for (const host of HOSTS_TIENDA) {
    for (const slug of ['colombia', 'nacional']) {
      const r = await pedir('GET', `/${slug}`, host);
      informar(r.rewrite === `/p/${slug}` && !aLogin(r),
        `tienda /${slug} se reescribe a /p/${slug} [${host}] -> ${r.status} rewrite=${r.rewrite || '(ninguna)'}`);
    }
    const raiz = await pedir('GET', '/', host);
    informar((raiz.status === 307 || raiz.status === 308) && /\/tienda$/.test(raiz.location),
      `tienda / lleva a /tienda [${host}] -> ${raiz.status} ${raiz.location}`);
    const panel = await pedir('GET', '/panel', host);
    informar(/\/tienda$/.test(panel.location), `tienda /panel lleva a /tienda [${host}] -> ${panel.status} ${panel.location}`);
  }
  for (const host of HOSTS_PANEL) {
    const r = await pedir('GET', '/colombia', host);
    informar(aLogin(r), `panel /colombia pide sesión [${host}] -> ${r.status} ${r.location}`);
    const l = await pedir('GET', '/login', host);
    informar(!aLogin(l), `panel /login es pública [${host}] -> ${l.status}`);
  }

  console.log(`\nRutas del árbol: ${archivos.length} (públicas ${publicas.length}, protegidas ${protegidas.length})`);
  console.log('Públicas:', publicas.join(', '));
  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
