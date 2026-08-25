// Conexión de dominios propios con la API de Vercel (estilo Funnelish).
// Cuando un cliente conecta su dominio, lo agregamos al proyecto en Vercel y
// consultamos si ya está verificado (DNS correcto).
//
// Requiere estas variables de entorno (las pone la agencia una sola vez):
//   VERCEL_TOKEN       → token de API de Vercel (vercel.com/account/tokens)
//   VERCEL_PROJECT_ID  → id del proyecto comercial (Project → Settings → General)
//   VERCEL_TEAM_ID     → (opcional) si el proyecto está en un equipo
//
// Si faltan las variables, todo degrada con gracia: el dominio se guarda y queda
// "pendiente" para que la agencia lo agregue a mano.

const API = 'https://api.vercel.com';

function creds() {
  const token = String(process.env.VERCEL_TOKEN ?? '').trim();
  const projectId = String(process.env.VERCEL_PROJECT_ID ?? '').trim();
  const teamId = String(process.env.VERCEL_TEAM_ID ?? '').trim();
  return { token, projectId, teamId, listo: !!(token && projectId) };
}
const q = (teamId: string) => (teamId ? `?teamId=${teamId}` : '');

export interface EstadoDominio {
  ok: boolean;              // ¿se pudo operar con Vercel?
  verificado: boolean;      // ¿el DNS ya apunta bien?
  instruccion: { tipo: string; nombre: string; valor: string } | null; // qué poner en el DNS
  error?: string;
  automatico: boolean;      // ¿se agregó vía API, o queda manual?
  // Motivo legible del estado, para decirle la VERDAD al cliente en el panel:
  //  'activo'          → DNS correcto, dominio sirviendo (o emitiendo el candado HTTPS)
  //  'dns_pendiente'   → el dominio está en el proyecto pero el DNS aún no apunta bien
  //  'no_agregado'     → el dominio NO está en el proyecto de Vercel (hay que agregarlo)
  //  'sin_credenciales'→ falta conectar la API de Vercel del lado de la plataforma
  //  'error'           → Vercel respondió con un error
  motivo: string;
}

/** Registro DNS recomendado para que el cliente lo ponga en Hostinger. */
export function instruccionDNS(dominio: string): { tipo: string; nombre: string; valor: string } {
  const esRaiz = dominio.split('.').length <= 2; // mitienda.com (raíz) vs www.mitienda.com
  return esRaiz
    ? { tipo: 'A', nombre: '@', valor: '76.76.21.21' }           // dominio raíz → A
    : { tipo: 'CNAME', nombre: dominio.split('.')[0], valor: 'cname.vercel-dns.com' }; // subdominio → CNAME
}

/** Agrega el dominio al proyecto de Vercel. Devuelve el estado. */
export async function conectarDominio(dominio: string): Promise<EstadoDominio> {
  const dns = instruccionDNS(dominio);
  const { token, projectId, teamId, listo } = creds();
  if (!listo) {
    // Sin credenciales: se guarda y queda pendiente para agregar a mano.
    return { ok: false, verificado: false, instruccion: dns, automatico: false, motivo: 'sin_credenciales', error: 'sin_credenciales' };
  }
  try {
    const res = await fetch(`${API}/v10/projects/${projectId}/domains${q(teamId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: dominio }),
    });
    // 409 = ya estaba agregado; lo tratamos como OK y consultamos su estado.
    if (!res.ok && res.status !== 409) {
      const t = await res.text().catch(() => '');
      return { ok: false, verificado: false, instruccion: dns, automatico: true, motivo: 'error', error: `Vercel ${res.status}: ${t.slice(0, 200)}` };
    }
    const estado = await verificarDominio(dominio);
    return { ...estado, instruccion: dns, automatico: true };
  } catch (e: any) {
    return { ok: false, verificado: false, instruccion: dns, automatico: true, motivo: 'error', error: String(e?.message ?? e).slice(0, 200) };
  }
}

/** Consulta si el dominio ya está verificado (DNS correcto) en Vercel. */
export async function verificarDominio(dominio: string): Promise<EstadoDominio> {
  const dns = instruccionDNS(dominio);
  const { token, projectId, teamId, listo } = creds();
  if (!listo) return { ok: false, verificado: false, instruccion: dns, automatico: false, motivo: 'sin_credenciales', error: 'sin_credenciales' };
  try {
    // 1) ¿El dominio está agregado al proyecto? (si no, el navegador nunca lo sirve)
    const resDom = await fetch(`${API}/v9/projects/${projectId}/domains/${dominio}${q(teamId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resDom.status === 404) {
      // No está en el proyecto → por eso el link no carga aunque el DNS esté bien.
      return { ok: true, verificado: false, instruccion: dns, automatico: true, motivo: 'no_agregado' };
    }
    if (!resDom.ok) {
      return { ok: false, verificado: false, instruccion: dns, automatico: true, motivo: 'error', error: `Vercel ${resDom.status}` };
    }
    // 2) ¿El DNS ya apunta bien? (misconfigured=false)
    const resCfg = await fetch(`${API}/v9/projects/${projectId}/domains/${dominio}/config${q(teamId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resCfg.ok) return { ok: false, verificado: false, instruccion: dns, automatico: true, motivo: 'error', error: `Vercel ${resCfg.status}` };
    const data = await resCfg.json();
    const verificado = data?.misconfigured === false;
    return {
      ok: true, verificado, instruccion: dns, automatico: true,
      motivo: verificado ? 'activo' : 'dns_pendiente',
    };
  } catch (e: any) {
    return { ok: false, verificado: false, instruccion: dns, automatico: true, motivo: 'error', error: String(e?.message ?? e).slice(0, 200) };
  }
}

/** Quita el dominio del proyecto de Vercel (al desconectarlo). */
export async function desconectarDominio(dominio: string): Promise<void> {
  const { token, projectId, teamId, listo } = creds();
  if (!listo) return;
  try {
    await fetch(`${API}/v9/projects/${projectId}/domains/${dominio}${q(teamId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* no bloquear */ }
}
