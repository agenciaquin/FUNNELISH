/**
 * `lib/rate-limit.ts` (`permitido`) con el cliente REAL de supabase-js contra un
 * PostgREST FALSO local. No toca ninguna base.
 *   npx tsx pruebas/rate-limit.ts
 * Archivo idéntico en quinchat/pruebas y quin-comercial/pruebas.
 *
 * 1) Bloquea al superar el límite y no apunta el intento bloqueado.
 * 2) La ventana: lo viejo no cuenta (y se borra); otra clave no cuenta.
 * 3) Fail-open (documentado): si la base falla o no responde, deja pasar.
 * 4) Carrera: N peticiones SIMULTÁNEAS con la misma clave. El conteo es
 *    "contar y luego insertar" en dos peticiones: se mide cuántas pasan. Es
 *    informativo (no FALLA): el límite es aproximado bajo concurrencia.
 */
import { arrancarPostgrest, de } from './_postgrest-falso';

let fallos = 0, total = 0;
function caso(nombre: string, ok: boolean, extra = '') {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? 'ok   ' : 'FALLA'} ${nombre}${!ok && extra ? `  -> ${extra}` : ''}`);
}

(async () => {
  const db = await arrancarPostgrest({ rate_limits: [] });
  process.env.NEXT_PUBLIC_SUPABASE_URL = db.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-falsa';
  const { permitido } = await import('../lib/rate-limit');
  const filas = (clave: string) => db.tablas.rate_limits.filter((f: any) => f.clave === clave).length;

  try {
    // ── 1. Límite ─────────────────────────────────────────────────────────────
    {
      const res: boolean[] = [];
      for (let i = 0; i < 7; i++) res.push(await permitido('pedido-tel:3001112233', 5, 3600));
      caso('5 primeras pasan', res.slice(0, 5).every(Boolean), res.join());
      caso('6ª y 7ª se bloquean', res[5] === false && res[6] === false, res.join());
      caso('los bloqueados no se apuntan (quedan 5 filas)', filas('pedido-tel:3001112233') === 5, String(filas('pedido-tel:3001112233')));
      caso('otra clave no se ve afectada', await permitido('pedido-tel:3009998877', 5, 3600));
      caso('límite 1: la 1ª pasa, la 2ª no', (await permitido('uno', 1, 60)) === true && (await permitido('uno', 1, 60)) === false);
    }

    // ── 2. Ventana ────────────────────────────────────────────────────────────
    {
      const viejo = new Date(Date.now() - 2 * 3600_000).toISOString();
      db.tablas.rate_limits.push(...Array.from({ length: 30 }, (_, i) => ({ id: `v${i}`, clave: 'pedido-ip:1.2.3.4', creado_at: viejo })));
      const r = await permitido('pedido-ip:1.2.3.4', 20, 3600);
      caso('30 intentos de hace 2 h no cuentan en una ventana de 1 h', r === true);
      caso('los viejos se borran (queda 1 fila, la nueva)', filas('pedido-ip:1.2.3.4') === 1, String(filas('pedido-ip:1.2.3.4')));
      const del = de(db, 'rate_limits', 'DELETE').at(-1)?.query;
      caso('el borrado va limitado a esa clave', del?.get('clave') === 'eq.pedido-ip:1.2.3.4' && !!del?.get('creado_at')?.startsWith('lt.'), del?.toString());
    }

    // ── 3. Fail-open ──────────────────────────────────────────────────────────
    {
      db.tablas.rate_limits = Array.from({ length: 50 }, (_, i) => ({ id: `b${i}`, clave: 'lleno', creado_at: new Date().toISOString() }));
      caso('control: con 50 en la ventana y límite 5, bloquea', (await permitido('lleno', 5, 3600)) === false);

      db.fallar = p => p.tabla === 'rate_limits';
      caso('la base responde 500 en todo -> deja pasar', (await permitido('lleno', 5, 3600)) === true);
      db.fallar = p => p.tabla === 'rate_limits' && (p.metodo === 'HEAD' || p.metodo === 'GET');
      caso('solo falla el conteo -> deja pasar', (await permitido('lleno', 5, 3600)) === true);
      db.fallar = () => false;

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:1';   // nada escuchando
      caso('la base no responde -> deja pasar', (await permitido('lleno', 5, 3600)) === true);
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;                   // createClient lanza
      caso('sin NEXT_PUBLIC_SUPABASE_URL -> deja pasar', (await permitido('lleno', 5, 3600)) === true);
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    }

    // ── 4. Carrera (informativo) ──────────────────────────────────────────────
    {
      db.tablas.rate_limits = [];
      db.demoraMs = 30;
      const r = await Promise.all(Array.from({ length: 10 }, () => permitido('carrera', 5, 3600)));
      db.demoraMs = 0;
      const pasan = r.filter(Boolean).length;
      console.log(`info  10 peticiones simultáneas, límite 5: pasan ${pasan} (filas apuntadas ${filas('carrera')}). ${pasan > 5 ? 'El conteo NO es atómico: se puede superar el límite en paralelo.' : 'No se reprodujo la carrera.'}`);
    }
  } finally {
    await db.cerrar();
  }

  console.log(`\n${total - fallos}/${total} ok`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLA excepción:', e); process.exit(1); });
