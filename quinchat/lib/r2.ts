// =====================================================================
// Cloudflare R2 (almacenamiento de media, S3-compatible).
//
// Se usa para subir y servir los VIDEOS/imágenes de los embudos desde R2
// (ancho de banda gratis) en vez de Supabase Storage. Firma peticiones con
// SigV4 usando el crypto de Node — sin dependencias del SDK de AWS.
//
// Variables de entorno (Vercel):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
// Si faltan, r2Configurado() = false y la app sigue usando Supabase (no se rompe).
// =====================================================================

import crypto from 'crypto';

const ACCOUNT = process.env.R2_ACCOUNT_ID || '';
const ACCESS  = process.env.R2_ACCESS_KEY_ID || '';
const SECRET  = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET  = process.env.R2_BUCKET || '';
const PUBLIC  = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

/** ¿Están todas las variables de R2? Si no, la app usa Supabase. */
export function r2Configurado(): boolean {
  return !!(ACCOUNT && ACCESS && SECRET && BUCKET && PUBLIC);
}

const host = () => `${ACCOUNT}.r2.cloudflarestorage.com`;
const sha256hex = (s: crypto.BinaryLike) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (key: crypto.BinaryLike, s: string) => crypto.createHmac('sha256', key).update(s, 'utf8').digest();
// Codifica cada segmento de la ruta (sin tocar las "/").
const encodePath = (key: string) => key.split('/').map(encodeURIComponent).join('/');

/** URL pública del objeto (para <img>/<video> y para guardar en la base). */
export function r2PublicUrl(key: string): string {
  return `${PUBLIC}/${encodePath(key)}`;
}

/**
 * URL PREFIRMADA para SUBIR (PUT) directo desde el navegador o el servidor.
 * Válida por `expiresSec` segundos. El que sube solo hace un PUT con el archivo.
 */
export function r2PresignPut(key: string, expiresSec = 3600): string {
  const region  = 'auto';
  const service = 's3';
  const amzdate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const datestamp = amzdate.slice(0, 8);
  const scope = `${datestamp}/${region}/${service}/aws4_request`;

  const canonicalUri = '/' + BUCKET + '/' + encodePath(key);
  const signedHeaders = 'host';

  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${ACCESS}/${scope}`,
    'X-Amz-Date': amzdate,
    'X-Amz-Expires': String(expiresSec),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuery = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');

  const canonicalHeaders = `host:${host()}\n`;
  const canonicalRequest = [
    'PUT', canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256', amzdate, scope, sha256hex(canonicalRequest),
  ].join('\n');

  const kDate    = hmac('AWS4' + SECRET, datestamp);
  const kRegion  = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `https://${host()}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Sube un buffer a R2 desde el SERVIDOR (para archivos que caben en la función). */
export async function r2Subir(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const url = r2PresignPut(key, 600);
  const res = await fetch(url, { method: 'PUT', body: new Uint8Array(buffer), headers: { 'Content-Type': contentType } });
  if (!res.ok) throw new Error(`R2 subida falló (${res.status})`);
  return r2PublicUrl(key);
}
