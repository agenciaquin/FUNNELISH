/**
 * La ruta REAL `app/api/pedidos` (POST) aplica el límite ANTES de procesar el
 * pedido. Solo se prueban los caminos que responden 429: el que deja pasar
 * llamaría a WhatsApp/Meta y no se ejecuta.
 *   npx tsx pruebas/pedidos-limite.ts
 * Supabase = PostgREST falso local con `rate_limits` ya llena.
 * Archivo idéntico en quinchat/pruebas y quin-comercial/pruebas.
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
  const db = await arrancarPostgrest({ rate_limits: [] });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  const ruta = await import('../app/api/pedidos/route');
  const { NextRequest } = await import('next/server');
  const pedido = (h: Record<string, string>) => new NextRequest('http://localhost:3000/api/pedidos', {
    method: 'POST', headers: { 'content-type': 'application/json', ...h },
    body: JSON.stringify({
      nombre: 'Ana', apellidos: 'P', whatsapp: `+57 ${TEL}`, direccion: 'Cl 1', barrio: 'B',
      municipio: 'Bogotá', departamento: 'Cundinamarca', slug: 'prueba', variante: 'X', talla: 'M', precio: 1,
      imagen: 'https://evil.example/a.jpg',
    }),
  });
  const otrasTablas = () => db.peticiones.filter(p => p.tabla !== 'rate_limits').map(p => `${p.metodo} ${p.tabla}`);

  try {
    // IP con 20 en la hora → 429 y no procesa
    db.tablas.rate_limits = llenar('pedido-ip:9.9.9.9', 20);
    db.peticiones.length = 0;
    let r = await ruta.POST(pedido({ 'x-real-ip': '9.9.9.9' }));
    caso('IP con 20 pedidos en la hora -> 429', r.status === 429, `status ${r.status}`);
    caso('  ...sin tocar otra tabla que rate_limits', otrasTablas().length === 0, otrasTablas().join());

    // x-forwarded-for (primera IP) cuando no hay x-real-ip
    db.peticiones.length = 0;
    r = await ruta.POST(pedido({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }));
    caso('x-forwarded-for: cuenta la primera IP -> 429', r.status === 429, `status ${r.status}`);

    // Teléfono con 5 en la hora (IP libre) → 429
    db.tablas.rate_limits = llenar(`pedido-tel:${TEL}`, 5);
    db.peticiones.length = 0;
    r = await ruta.POST(pedido({ 'x-real-ip': '8.8.8.8' }));
    const j: any = await r.json();
    caso('teléfono con 5 pedidos en la hora -> 429', r.status === 429 && /WhatsApp/.test(j.error ?? ''), `status ${r.status} ${JSON.stringify(j)}`);
    caso('  ...el teléfono se normaliza (+57 y espacios) antes de contar',
      de(db, 'rate_limits', 'HEAD').some(p => p.query.get('clave') === `eq.pedido-tel:${TEL}`), de(db, 'rate_limits').map(p => p.query.get('clave')).join());
    caso('  ...sin tocar otra tabla que rate_limits', otrasTablas().length === 0, otrasTablas().join());

    // Sin IP (local): el límite por IP se salta, el de teléfono sigue
    db.peticiones.length = 0;
    r = await ruta.POST(pedido({}));
    caso('sin IP: sigue el límite por teléfono -> 429', r.status === 429 && !de(db, 'rate_limits').some(p => (p.query.get('clave') ?? '').includes('pedido-ip:')), `status ${r.status}`);
  } finally {
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });
