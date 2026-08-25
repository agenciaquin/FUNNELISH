import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { procesarEntrada, verificarMeta } from '../route';
import type { BaseLinea } from '@/lib/whatsapp-contexto';

// El procesamiento espera a que el cliente termine de escribir → necesita
// más tiempo del que Vercel da por defecto (igual que el webhook single-tenant).
export const maxDuration = 60;

/**
 * WEBHOOK POR CLIENTE (multi-tenant, estilo SellerChat).
 *
 * Cada empresa cliente configura en Meta su webhook apuntando a:
 *   https://<app>/api/whatsapp/webhook/<slug-del-cliente>
 *
 * Aquí se resuelve el tenant por su `slug`, se leen SUS credenciales de
 * WhatsApp desde la tabla `tenants` y se procesan los mensajes con ellas.
 * La lógica de conversación se reutiliza del webhook principal
 * (`procesarEntrada` / `verificarMeta`), inyectando el token y el tenant_id.
 */

interface TenantWA {
  id: string;
  activo: boolean;
  wa_access_token: string | null;
  wa_phone_number_id: string | null;
  wa_phone_number_id_ventas: string | null;
  wa_verify_token: string | null;
}

// Caché en memoria por slug para no golpear la BD en cada mensaje de una ráfaga.
const CACHE_MS = 60_000;
const cache = new Map<string, { valor: TenantWA | null; hasta: number }>();

async function cargarTenant(slug: string): Promise<TenantWA | null> {
  const ahora = Date.now();
  const hit = cache.get(slug);
  if (hit && hit.hasta > ahora) return hit.valor;

  const sb = createServerSupabaseClient();
  const { data, error } = await sb
    .from('tenants')
    .select('id, activo, wa_access_token, wa_phone_number_id, wa_phone_number_id_ventas, wa_verify_token')
    .eq('slug', slug)
    .maybeSingle();

  if (error) console.error(`[Webhook/${slug}] error cargando tenant:`, error.message);
  const valor = (data as TenantWA | null) ?? null;
  cache.set(slug, { valor, hasta: ahora + CACHE_MS });
  return valor;
}

// ─── GET — verificación de Meta (handshake por cliente) ───────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  const t = await cargarTenant(tenant);
  if (!t || t.activo === false) {
    return NextResponse.json({ error: 'Tenant no encontrado o inactivo' }, { status: 404 });
  }
  // Cada cliente valida contra SU propio verify_token.
  return verificarMeta(req, t.wa_verify_token ?? undefined);
}

// ─── POST — Mensajes entrantes de ESTE cliente ────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  const t = await cargarTenant(tenant);

  // Si el cliente no existe o está inactivo, respondemos 200 para que Meta no
  // reintente indefinidamente, pero no procesamos nada.
  if (!t || t.activo === false) {
    console.warn(`[Webhook] mensaje para tenant desconocido/inactivo: "${tenant}"`);
    return NextResponse.json({ status: 'ok' });
  }

  const base: BaseLinea = {
    tenantId: t.id,
    accessToken: t.wa_access_token ?? undefined,
    phoneId: t.wa_phone_number_id ?? undefined,
    phoneIdVentas: t.wa_phone_number_id_ventas ?? undefined,
  };

  return procesarEntrada(req, base);
}
