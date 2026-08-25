import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client (service role key — full access, never expose to browser)
 * Use in: API routes, webhook handlers, server components
 */
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Browser-side Supabase client — singleton to avoid multiple GoTrueClient instances
 * Use in: client components for reads and realtime subscriptions.
 *
 * Usa el token de Supabase que emite NextAuth al iniciar sesión (rol
 * 'authenticated'), en vez de la llave `anon` cruda. Así el panel entra
 * autenticado y podemos activar RLS sin exponer la base a la llave pública.
 * Si por lo que sea no hay token (no logueado o falta el secreto), cae a `anon`
 * — inofensivo mientras RLS esté apagado.
 */
let _sbToken: string | null = null;
let _sbTokenAt = 0;

async function tokenSupabaseNavegador(): Promise<string | null> {
  // Cache de 5 min para no pedir la sesión en cada consulta.
  if (_sbToken && Date.now() - _sbTokenAt < 5 * 60_000) return _sbToken;
  try {
    const r = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!r.ok) return _sbToken;
    const s = await r.json();
    _sbToken = s?.supabaseAccessToken ?? null;
    _sbTokenAt = Date.now();
    return _sbToken;
  } catch {
    return _sbToken;
  }
}

let _browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (_browserClient) return _browserClient;
  _browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { accessToken: async () => await tokenSupabaseNavegador() },
  );
  return _browserClient;
}
