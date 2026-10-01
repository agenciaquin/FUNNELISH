/**
 * ¿QUÉ RUTAS DE LA API SON ALCANZABLES SIN SESIÓN?
 *
 * `quinchat/middleware.ts` trata dos dominios de forma distinta:
 *
 *   · el panel   → todo protegido salvo una lista corta de rutas públicas
 *   · la tienda  → deja pasar `/api/` ENTERO sin pedir sesión
 *
 * Esto recorre todas las rutas de `app/api/` y comprueba, dominio por dominio,
 * cuáles responden y cuáles mandan al login. Sirve para tener el "antes" y para
 * demostrar el "después" cuando se corrija el middleware.
 *
 *
 * CÓMO EVITA EJECUTAR NADA
 * ------------------------
 * Sondear con GET sería peligroso: `/api/cron/remarketing` **enviaría mensajes
 * de remarketing de verdad**. Así que cada ruta se sondea con un método HTTP que
 * ese archivo NO exporta.
 *
 * El middleware corre ANTES que el handler, así que la respuesta distingue
 * perfectamente los dos casos sin que el handler llegue a ejecutarse:
 *
 *   · redirección al login → el middleware la protegió
 *   · 405 u otra cosa      → el middleware la dejó pasar, y el handler solo
 *                            respondió "ese método no existe"
 *
 *   npx tsx auditar-rutas-api.ts [urlTienda] [urlPanel]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TIENDA = process.argv[2] ?? 'https://pedido.klixmant.shop';
const PANEL = process.argv[3] ?? 'https://quinchat-agencia-quin.vercel.app';
const RAIZ = join(process.cwd(), '..', '..', 'quinchat', 'app', 'api');

const TODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

interface Ruta { url: string; metodos: string[]; sonda: string }

function recorrer(dir: string, prefijo = '/api'): Ruta[] {
  const salida: Ruta[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      // Un segmento dinámico se rellena con algo inofensivo: nunca se ejecuta.
      const seg = /^\[.*\]$/.test(entrada) ? '_sonda' : entrada;
      salida.push(...recorrer(ruta, `${prefijo}/${seg}`));
    } else if (entrada === 'route.ts' || entrada === 'route.js') {
      const src = readFileSync(ruta, 'utf8');
      const metodos = TODOS.filter((m) => new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(src));
      const sonda = TODOS.find((m) => !metodos.includes(m));
      if (sonda) salida.push({ url: prefijo, metodos, sonda });
    }
  }
  return salida;
}

const rutas = recorrer(RAIZ).sort((a, b) => a.url.localeCompare(b.url));
console.log(`\nRutas de API encontradas: ${rutas.length}`);
console.log(`Tienda: ${TIENDA}`);
console.log(`Panel : ${PANEL}\n`);

const alLogin = (estado: number, destino: string) =>
  [301, 302, 303, 307, 308].includes(estado) || /\/login/.test(destino);

async function sondear(base: string, r: Ruta) {
  try {
    const res = await fetch(base + r.url, { method: r.sonda, redirect: 'manual' });
    const destino = res.headers.get('location') ?? '';
    return { protegida: alLogin(res.status, destino), estado: res.status };
  } catch (e) {
    return { protegida: null, estado: 0, error: (e as Error).message };
  }
}

const abiertas: Ruta[] = [];
const protegidas: string[] = [];

for (const r of rutas) {
  const t = await sondear(TIENDA, r);
  const p = await sondear(PANEL, r);
  const marca = t.protegida ? 'protegida' : 'ABIERTA  ';
  if (t.protegida) protegidas.push(r.url); else abiertas.push(r);
  console.log(`  ${marca}  ${r.url.padEnd(38)} tienda=${String(t.estado).padEnd(3)} panel=${p.estado}  [${r.metodos.join(',') || 'sin metodos'}]`);
  await new Promise((s) => setTimeout(s, 120)); // sin prisa, para no provocar 429
}

console.log(`\n${'='.repeat(72)}`);
console.log(`Alcanzables SIN sesion en la tienda : ${abiertas.length} de ${rutas.length}`);
console.log(`Protegidas                          : ${protegidas.length}`);

if (abiertas.length) {
  const sensibles = abiertas.filter((r) =>
    /ajustes|configuracion|contactos|ventas|pedidos\/|conversations|whatsapp\/send|plantillas-wa\/enviar|upload|imagen|memoria|catalogos|campanas|remarketing|metas|seguimiento/.test(r.url));
  if (sensibles.length) {
    console.log(`\nDe esas, las que mas importan (${sensibles.length}):`);
    for (const r of sensibles) console.log(`  · ${r.url}   [${r.metodos.join(',')}]`);
  }
}

console.log('\nNota: cada ruta se sondeo con un metodo que NO exporta, asi que');
console.log('ningun handler llego a ejecutarse. Solo se midio quien deja pasar.\n');
