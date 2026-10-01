/**
 * Filtro de fotos de `/api/pedidos` (`lib/imagen-propia.ts`). No toca nada.
 *   npx tsx pruebas/imagen-propia.ts
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co';
process.env.R2_PUBLIC_URL = 'https://pub-123.r2.dev/';

import { imagenPropia } from '../lib/imagen-propia';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean) {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}`);
}

const HOST = 'pedido.klixmant.shop';
const acepta = (u: unknown, h = HOST) => imagenPropia(u, h) === (typeof u === 'string' ? u.trim() : u);
const rechaza = (u: unknown, h = HOST) => imagenPropia(u, h) === undefined;

caso('Supabase Storage', acepta('https://abcxyz.supabase.co/storage/v1/object/public/funnels/a.jpg'));
caso('R2 público', acepta('https://pub-123.r2.dev/funnels/a.jpg'));
caso('tienda www.klixmant.shop', acepta('https://www.klixmant.shop/img/a.jpg'));
caso('tienda tienda.skioo.shop', acepta('https://tienda.skioo.shop/img/a.jpg'));
caso('mismo dominio que recibe el pedido', acepta('https://www.mitienda.com/a.jpg', 'www.mitienda.com'));
caso('espacios alrededor', imagenPropia('  https://abcxyz.supabase.co/a.jpg ', HOST) === 'https://abcxyz.supabase.co/a.jpg');
caso('http del mismo dominio (desarrollo)', acepta('http://localhost:3125/a.jpg', 'localhost:3125'));

caso('dominio ajeno', rechaza('https://evil.example/a.jpg'));
caso('subdominio parecido', rechaza('https://abcxyz.supabase.co.evil.example/a.jpg'));
caso('otro proyecto de Supabase', rechaza('https://otro.supabase.co/a.jpg'));
caso('usuario@host engañoso', rechaza('https://abcxyz.supabase.co@evil.example/a.jpg'));
caso('http de un dominio propio que no es el de la petición', rechaza('http://abcxyz.supabase.co/a.jpg'));
caso('ruta relativa', rechaza('/img/a.jpg'));
caso('data:', rechaza('data:image/png;base64,AAAA'));
caso('javascript:', rechaza('javascript:alert(1)'));
caso('no es texto', rechaza({ url: 'https://abcxyz.supabase.co/a.jpg' }) && rechaza(undefined) && rechaza(42));
caso('vacío', rechaza(''));

console.log(`\n${total - fallos}/${total} ok`);
process.exit(fallos ? 1 : 0);
