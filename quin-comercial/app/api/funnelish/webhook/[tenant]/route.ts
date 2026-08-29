import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { procesarPedidoFunnelish } from '../route';
import type { BaseLinea } from '@/lib/whatsapp-contexto';

// El envío de la confirmación puede tardar (arma foto + plantilla) → más tiempo
// del que Vercel da por defecto (igual que el webhook single-tenant).
export const maxDuration = 60;

/**
 * WEBHOOK DE PEDIDOS DE FUNNELISH POR CLIENTE (multi-tenant).
 *
 * Cada empresa cliente configura en SU Funnelish el webhook de pedidos apuntando a:
 *   https://<app-comercial>/api/funnelish/webhook/<slug-del-cliente>
 *
 * Aquí se resuelve el tenant por su `slug`, se leen SUS credenciales de WhatsApp
 * desde la tabla `tenants`, y se procesa el pedido con ellas: el pedido se guarda
 * con SU tenant_id y la confirmación sale por SU número de WhatsApp. Reutiliza
 * exactamente la misma lógica del webhook interno (`procesarPedidoFunnelish`).
 *
 * CONFIRMACIÓN: por defecto se usa el modo 'solo' → el bot envía la confirmación
 * y se APAGA (bot_enabled=false), dejando la conversación como "PENDIENTE POR
 * CONFIRMACIÓN" para que la confirme un humano. Se puede cambiar poniendo
 * `?modo=agente` en la URL (el bot sigue atendiendo tras confirmar).
 *
 * No toca el webhook single-tenant existente (`../route.ts`): es aditivo.
 */

interface TenantWA {
  id: string;
  activo: boolean;
  wa_access_token: string | null;
  wa_phone_number_id: string | null;
  wa_phone_number_id_ventas: string | null;
}

// Caché en memoria por slug (60s) para no golpear la BD en cada pedido.
const CACHE_MS = 60_000;
const cache = new Map<string, { valor: TenantWA | null; hasta: number }>();

async function cargarTenant(slug: string): Promise<TenantWA | null> {
  const ahora = Date.now();
  const hit = cache.get(slug);
  if (hit && hit.hasta > ahora) return hit.valor;

  const sb = createServerSupabaseClient();
  const { data, error } = await sb
    .from('tenants')
    .select('id, activo, wa_access_token, wa_phone_number_id, wa_phone_number_id_ventas')
    .eq('slug', slug)
    .maybeSingle();

  if (error) console.error(`[Funnelish/${slug}] error cargando tenant:`, error.message);
  const valor = (data as TenantWA | null) ?? null;
  cache.set(slug, { valor, hasta: ahora + CACHE_MS });
  return valor;
}

// GET simple: sirve para probar en el navegador que la URL responde.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  const t = await cargarTenant(tenant);
  if (!t || t.activo === false) {
    return NextResponse.json({ ok: false, error: 'Tienda no encontrada o inactiva' }, { status: 404 });
  }
  const modo = req.nextUrl.searchParams.get('modo') === 'agente' ? 'agente' : 'solo';
  return NextResponse.json({ ok: true, tenant, listo: !!(t.wa_access_token && t.wa_phone_number_id), modo });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  const t = await cargarTenant(tenant);
  if (!t || t.activo === false) {
    return NextResponse.json({ error: 'Tienda no encontrada o inactiva' }, { status: 404 });
  }
  const base: BaseLinea = {
    tenantId: t.id,
    accessToken: t.wa_access_token ?? undefined,
    phoneId: t.wa_phone_number_id ?? undefined,
    phoneIdVentas: t.wa_phone_number_id_ventas ?? undefined,
  };

  // Modo de confirmación para pedidos de Funnelish: por defecto 'solo' (el bot
  // envía la confirmación y se apaga; confirma un humano). ?modo=agente lo cambia.
  const modo = req.nextUrl.searchParams.get('modo') === 'agente' ? 'agente' : 'solo';

  // Funnelish no envía `modo_confirmacion`, así que lo inyectamos reconstruyendo
  // el pedido (mismo patrón que /api/pedidos). Si el body no es JSON válido, se
  // deja pasar tal cual para que el webhook responda su propio error.
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }
  if (body && typeof body === 'object') {
    if (!body.modo_confirmacion) body.modo_confirmacion = modo;
    const interna = new NextRequest(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return procesarPedidoFunnelish(interna, base);
  }
  return procesarPedidoFunnelish(req, base);
}
