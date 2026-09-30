/**
 * `lib/imagen-propia.ts` contra intentos de suplantar un dominio propio.
 * Complementa pruebas/imagen-propia.ts. Código real, sin red.
 *   npx tsx pruebas/imagen-propia-suplantacion.ts
 * Archivo idéntico en quinchat/pruebas y quin-comercial/pruebas.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co';
process.env.R2_PUBLIC_URL = 'https://pub-123.r2.dev/';

import { imagenPropia } from '../lib/imagen-propia';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}
const HOST = 'pedido.klixmant.shop';
const rechaza = (u: string, h = HOST) => caso(`rechaza ${JSON.stringify(u)}${h !== HOST ? ` [host ${h}]` : ''}`, imagenPropia(u, h) === undefined, String(imagenPropia(u, h)));
const acepta = (u: string, h = HOST) => caso(`acepta  ${JSON.stringify(u)}${h !== HOST ? ` [host ${h}]` : ''}`, imagenPropia(u, h) === u.trim(), String(imagenPropia(u, h)));

// ── Dominio en otro sitio de la URL ──────────────────────────────────────────
rechaza('https://supabase.co.evil.com/a.jpg');
rechaza('https://abcxyz.supabase.co.evil.com/a.jpg');
rechaza('https://evil.com/?x=abcxyz.supabase.co');
rechaza('https://evil.com/abcxyz.supabase.co/a.jpg');
rechaza('https://evil.com#abcxyz.supabase.co');
rechaza('https://evilabcxyz.supabase.co/a.jpg');
rechaza('https://evil-www.klixmant.shop.evil.com/a.jpg');
rechaza('https://klixmant.shop.evil.com/a.jpg');
rechaza('https://abcxyz.supabase.co./a.jpg');                 // punto final: otro host
rechaza('https://evil.com\\@abcxyz.supabase.co/a.jpg');       // barra invertida = barra en https
rechaza('https://evil.com%2F@abcxyz.supabase.co/a.jpg'.replace('%2F@', '%2F%40'));
rechaza('https://abcxyz.supabase.co%2F@evil.com/a.jpg');
rechaza('https://abcxyz.supabase.co:pass@evil.com/a.jpg');

// ── Protocolos ───────────────────────────────────────────────────────────────
rechaza('http://abcxyz.supabase.co/a.jpg');
rechaza('http://www.klixmant.shop/a.jpg');
rechaza('http://pedido.klixmant.shop/a.jpg', 'www.klixmant.shop');
rechaza('javascript:alert(1)');
rechaza('JavaScript://abcxyz.supabase.co/%0aalert(1)');
rechaza('ftp://abcxyz.supabase.co/a.jpg');
rechaza('file:///etc/passwd');
rechaza('data:image/png;base64,AAAA');
rechaza('//abcxyz.supabase.co/a.jpg');
rechaza('blob:https://abcxyz.supabase.co/uuid');

// ── Subdominios y puertos ────────────────────────────────────────────────────
rechaza('https://x.abcxyz.supabase.co/a.jpg');
rechaza('https://evil.www.klixmant.shop/a.jpg');
rechaza('https://abcxyz.supabase.co:8443/a.jpg');
rechaza('https://www.klixmant.shop:444/a.jpg');
acepta('https://abcxyz.supabase.co:443/a.jpg');               // 443 es el mismo sitio

// ── Mayúsculas y espacios ────────────────────────────────────────────────────
acepta('HTTPS://ABCXYZ.SUPABASE.CO/storage/v1/object/public/a.jpg');
acepta('https://WWW.KLIXMANT.SHOP/a.jpg');
acepta('https://www.mitienda.com/a.jpg', 'WWW.MiTienda.com');
rechaza('https://www.mitienda.com.evil.com/a.jpg', 'www.mitienda.com');

// ── Host de la petición vacío o raro ─────────────────────────────────────────
rechaza('https://evil.com/a.jpg', '');
rechaza('http://evil.com/a.jpg', '');
rechaza('https://evil.com/a.jpg', ' ');

// ── Credenciales en la URL ───────────────────────────────────────────────────
// El host es propio, así que se acepta y se devuelve TAL CUAL (con usuario:clave).
// No abre un dominio ajeno; se deja como informativo.
for (const u of ['https://user@abcxyz.supabase.co/a.jpg', 'https://user:pass@www.klixmant.shop/a.jpg']) {
  console.log(`info  ${JSON.stringify(u)} -> ${JSON.stringify(imagenPropia(u, HOST))}`);
}

console.log(`\n${total - fallos}/${total} ok`);
process.exit(fallos ? 1 : 0);
