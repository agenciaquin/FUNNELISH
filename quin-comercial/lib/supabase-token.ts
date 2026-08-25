import { createHmac } from 'crypto';

/**
 * Firma un JWT de Supabase (HS256) para usar en el NAVEGADOR, con el tenant_id
 * de la empresa dentro. Las políticas RLS de la base filtran por ese claim, así
 * que cada usuario del panel solo ve/toca los datos de SU empresa — incluido el
 * tiempo real (que usa la llave pública y antes veía todo).
 *
 * Se firma con SUPABASE_JWT_SECRET (Supabase → Project Settings → API → JWT
 * Secret). Si ese secreto no está configurado, devuelve null (y el panel cae al
 * modo anónimo: con RLS activo eso significa "no ve nada", que es seguro).
 */
function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function mintSupabaseToken(tenantId: string | null | undefined, ttlSeconds = 60 * 60 * 24): string | null {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || !tenantId) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    role: 'authenticated',
    aud: 'authenticated',
    sub: String(tenantId),
    tenant_id: String(tenantId),
    iat: now,
    exp: now + ttlSeconds,
  };

  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = b64url(createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}
