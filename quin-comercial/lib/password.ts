// =====================================================
// Contraseñas seguras (hash) — sin dependencias externas.
// Usa scrypt del módulo `crypto` nativo de Node (disponible en Vercel).
// Formato guardado:  scrypt$<salt_hex>$<hash_hex>
// Compatible hacia atrás: las contraseñas viejas en texto plano siguen
// funcionando y se re-cifran solas en el primer login exitoso.
// =====================================================

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/** Genera un hash seguro para guardar en la base de datos. */
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pw), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/**
 * Verifica una contraseña contra lo guardado.
 * - ok:     ¿coincide?
 * - legacy: ¿estaba en texto plano? (para re-cifrarla tras login)
 */
export function verifyPassword(pw: string, stored: string): { ok: boolean; legacy: boolean } {
  const s = String(stored ?? '');
  if (s.startsWith('scrypt$')) {
    try {
      const [, salt, hash] = s.split('$');
      const h = scryptSync(String(pw), salt, 64);
      const hb = Buffer.from(hash, 'hex');
      const ok = h.length === hb.length && timingSafeEqual(h, hb);
      return { ok, legacy: false };
    } catch {
      return { ok: false, legacy: false };
    }
  }
  // Legado: contraseña en texto plano (se re-cifra al primer login exitoso).
  return { ok: pw === s, legacy: true };
}

/** ¿El valor guardado ya está cifrado? */
export function isHashed(stored: string): boolean {
  return String(stored ?? '').startsWith('scrypt$');
}
