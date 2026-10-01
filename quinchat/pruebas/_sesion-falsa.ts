/**
 * Sesión de next-auth para llamar a los handlers REALES fuera de Next.
 *
 * `getServerSession(authOptions)` (sin req/res) lee `headers()` y `cookies()` de
 * `next/headers`, que fuera de una petición de Next revientan. Aquí se sustituye
 * SOLO ese módulo del framework por uno que devuelve las cabeceras/cookies que
 * fija la prueba. next-auth, `lib/auth.ts` y la ruta son los de verdad: la cookie
 * es un JWT de sesión firmado con `NEXTAUTH_SECRET` por el propio `next-auth/jwt`,
 * igual que el que emite el login.
 *
 * Llamar a `instalarNextHeaders()` ANTES de importar rutas o `lib/auth`.
 */
import Module from 'node:module';
import { encode } from 'next-auth/jwt';

let cookiesActuales: { name: string; value: string }[] = [];

export function instalarNextHeaders(): void {
  process.env.NEXTAUTH_SECRET ??= 'prueba-local';
  process.env.NEXTAUTH_URL ??= 'http://localhost:3000';
  const ruta = require.resolve('next/headers');
  const m = new Module(ruta);
  m.filename = ruta;
  m.loaded = true;
  m.exports = {
    headers: async () => new Headers({ host: 'localhost:3000' }),
    cookies: async () => ({
      getAll: () => cookiesActuales,
      get: (n: string) => cookiesActuales.find(c => c.name === n),
    }),
  };
  require.cache[ruta] = m;
}

/** Sin sesión (`null`) o con una sesión cuyo JWT lleva `token` (p. ej. `{ name, email, tenantId }`). */
export async function fijarSesion(token: Record<string, any> | null): Promise<void> {
  if (!token) { cookiesActuales = []; return; }
  const jwt = await encode({ token, secret: process.env.NEXTAUTH_SECRET! });
  cookiesActuales = [{ name: 'next-auth.session-token', value: jwt }];
}
