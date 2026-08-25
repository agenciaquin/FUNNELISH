// Cifrado de secretos (API keys de los clientes) con AES-256-GCM nativo de Node.
// Sin dependencias. La clave sale de ENCRYPTION_SECRET (o NEXTAUTH_SECRET como
// respaldo, para que funcione desde ya). Formato: v1.<iv>.<tag>.<datos> en hex.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const SECRET = process.env.ENCRYPTION_SECRET || process.env.NEXTAUTH_SECRET || 'quinchat-dev-secret';
function clave(): Buffer { return scryptSync(String(SECRET), 'quinchat-ia', 32); }

export function encriptar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave(), iv);
  const enc = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return `v1.${iv.toString('hex')}.${tag.toString('hex')}.${enc.toString('hex')}`;
}

export function desencriptar(payload: string): string {
  try {
    const [v, ivh, tagh, ench] = String(payload).split('.');
    if (v !== 'v1' || !ivh || !tagh || !ench) return '';
    const d = createDecipheriv('aes-256-gcm', clave(), Buffer.from(ivh, 'hex'));
    d.setAuthTag(Buffer.from(tagh, 'hex'));
    return Buffer.concat([d.update(Buffer.from(ench, 'hex')), d.final()]).toString('utf8');
  } catch { return ''; }
}

/** Deja solo los últimos 4 caracteres visibles: ••••3f9a */
export function mascara(texto: string): string {
  const s = String(texto ?? '');
  return s.length <= 4 ? '••••' : '••••' + s.slice(-4);
}
