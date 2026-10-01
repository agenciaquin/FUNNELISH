/**
 * Las rutas REALES `app/api/promociones/pedido` y `pedido-multi` (POST) aplican el
 * mismo límite que /api/pedidos (5 por teléfono y 20 por IP cada hora, mismas
 * claves) ANTES de tocar el stock o mandar nada. Solo se prueban los caminos que
 * responden 429: el que deja pasar llamaría a WhatsApp y no se ejecuta.
 *   npx tsx pruebas/promociones-limite.ts
 * Supabase = PostgREST falso local con `rate_limits` ya llena.
 */
import { arrancarPostgrest, de } from './_postgrest-falso';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

const TEL = '3001112233';
const ahora = () => new Date().toISOString();
const llenar = (clave: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${clave}-${i}`, clave, creado_at: ahora() }));

(async () => {
  const db = await arrancarPostgrest({
    rate_limits: [],
    promociones: [{ id: 'p1', nombre: 'Camiseta', stock: { M: 5 }, variantes: {} }],
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  const uno = await import('../app/api/promociones/pedido/route');
  const multi = await import('../app/api/promociones/pedido-multi/route');
  const { NextRequest } = await import('next/server');

  const cuerpoUno = { nombre: 'Ana', telefono: `+57 ${TEL}`, producto: 'Camiseta', talla: 'M', promoId: 'p1', precio: 50000 };
  const cuerpoMulti = { nombre: 'Ana', telefono: `+57 ${TEL}`, items: [{ promoId: 'p1', producto: 'Camiseta', talla: 'M', precio: 50000 }] };
  const rutas: Array<[string, (h: Record<string, string>) => Promise<Response>]> = [
    ['pedido', h => uno.POST(new NextRequest('http://localhost:3000/api/promociones/pedido', {
      method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(cuerpoUno),
    }))],
    ['pedido-multi', h => multi.POST(new NextRequest('http://localhost:3000/api/promociones/pedido-multi', {
      method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(cuerpoMulti),
    }))],
  ];
  const otrasTablas = () => db.peticiones.filter(p => p.tabla !== 'rate_limits').map(p => `${p.metodo} ${p.tabla}`);

  try {
    for (const [n, pedir] of rutas) {
      // IP con 20 en la hora → 429 y no procesa
      db.tablas.rate_limits = llenar('pedido-ip:9.9.9.9', 20);
      db.peticiones.length = 0;
      let r = await pedir({ 'x-real-ip': '9.9.9.9' });
      caso(`${n}: IP con 20 pedidos en la hora -> 429`, r.status === 429, `status ${r.status}`);
      caso(`${n}:   ...sin tocar el stock ni otra tabla`, otrasTablas().length === 0, otrasTablas().join());

      db.peticiones.length = 0;
      r = await pedir({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' });
      caso(`${n}: x-forwarded-for cuenta la primera IP -> 429`, r.status === 429, `status ${r.status}`);

      // Teléfono con 5 en la hora (IP libre) → 429. La clave es la MISMA que
      // usa /api/pedidos: los pedidos de las landings cuentan aquí también.
      db.tablas.rate_limits = llenar(`pedido-tel:${TEL}`, 5);
      db.peticiones.length = 0;
      r = await pedir({ 'x-real-ip': '8.8.8.8' });
      const j: any = await r.json();
      caso(`${n}: teléfono con 5 pedidos en la hora -> 429`, r.status === 429 && /WhatsApp/.test(j.error ?? ''), `status ${r.status} ${JSON.stringify(j)}`);
      caso(`${n}:   ...el teléfono se normaliza (+57 y espacios) antes de contar`,
        de(db, 'rate_limits', 'HEAD').some(p => p.query.get('clave') === `eq.pedido-tel:${TEL}`), de(db, 'rate_limits').map(p => p.query.get('clave')).join());
      caso(`${n}:   ...sin tocar el stock ni otra tabla`, otrasTablas().length === 0, otrasTablas().join());
      caso(`${n}:   ...el stock sigue igual`, db.tablas.promociones[0].stock.M === 5);

      db.peticiones.length = 0;
      r = await pedir({});
      caso(`${n}: sin IP sigue el límite por teléfono -> 429`, r.status === 429 && !de(db, 'rate_limits').some(p => (p.query.get('clave') ?? '').includes('pedido-ip:')), `status ${r.status}`);
    }
  } finally {
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });
