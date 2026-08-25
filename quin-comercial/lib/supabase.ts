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
 * Use in: client components for reads and realtime subscriptions
 */
let _browserClient: SupabaseClient | null = null;
let _browserToken: string | null = null;

/**
 * Inicializa (o reusa) el cliente del navegador con el TOKEN de la empresa
 * (un JWT de Supabase que lleva el tenant_id). Con ese token, las lecturas,
 * escrituras y el tiempo real quedan aislados por empresa gracias a RLS.
 *
 * Lo llama el panel al montar, ANTES de que cualquier componente use el cliente.
 * Si token es null (falta SUPABASE_JWT_SECRET), cae al cliente anónimo.
 */
export function initBrowserSupabase(token: string | null): SupabaseClient {
  if (_browserClient && token === _browserToken) return _browserClient;
  _browserToken = token;
  _browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : undefined
  );
  if (token) {
    try { _browserClient.realtime.setAuth(token); } catch { /* realtime opcional */ }
  }
  return _browserClient;
}

/**
 * Actualiza el token del cliente ya creado (para refrescarlo antes de que expire)
 * sin recrear el cliente ni perder las suscripciones de tiempo real.
 */
export function actualizarTokenNavegador(token: string | null): void {
  _browserToken = token;
  if (_browserClient && token) {
    try { _browserClient.realtime.setAuth(token); } catch { /* */ }
  }
}

export function createBrowserSupabaseClient(): SupabaseClient {
  if (_browserClient) return _browserClient;
  _browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return _browserClient;
}
