import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { createServerSupabaseClient } from '@/lib/supabase';
import { conectarDominio, verificarDominio, desconectarDominio, instruccionDNS } from '@/lib/dominios-vercel';

export const dynamic = 'force-dynamic';

const limpiar = (d: string) => String(d ?? '').trim().toLowerCase()
  .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\s+/g, '');

/** Traduce el motivo técnico a un mensaje claro para el dueño de la tienda. */
function mensajePorMotivo(motivo: string): string {
  switch (motivo) {
    case 'activo':
      return 'DNS correcto ✅ Si acabas de configurarlo, el candado de seguridad (HTTPS) puede tardar unos minutos en activarse.';
    case 'dns_pendiente':
      return 'El dominio ya está conectado a la plataforma; falta que el DNS de tu proveedor apunte bien. Agrega el registro de abajo y espera unos minutos.';
    case 'no_agregado':
      return 'Estamos terminando de conectar tu dominio a la plataforma. Toca Verificar de nuevo en un momento.';
    case 'sin_credenciales':
      return 'Tu dominio quedó guardado. Falta un paso del lado de la plataforma para activarlo (ya avisamos a soporte). No es nada de tu parte.';
    case 'error':
      return 'La plataforma no pudo conectar tu dominio con Vercel (la API respondió con un error). Suele ser un tema de credenciales del lado de la agencia (token o equipo de Vercel). Ya lo revisamos; no es nada de tu parte.';
    default:
      return '';
  }
}

/** GET → dominio actual + estado + instrucción DNS. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const admin = createServerSupabaseClient();
  let dominio = '';
  let estado = '';
  try {
    const { data } = await admin.from('tenants').select('dominio, dominio_estado').eq('id', tid).maybeSingle();
    dominio = String(data?.dominio ?? '').trim();
    estado = String(data?.dominio_estado ?? '').trim();
  } catch { /* columna aún no existe */ }

  // Si hay dominio, consultamos su estado en vivo con Vercel.
  let verificado = estado === 'activo';
  let instruccion = dominio ? instruccionDNS(dominio) : null;
  let motivo = '';
  let detalle = '';   // detalle técnico del error de Vercel (para diagnosticar)
  if (dominio) {
    let est = await verificarDominio(dominio);
    // AUTO-REPARACIÓN: si el dominio NO está en el proyecto de Vercel (por un fallo
    // al conectarlo la primera vez), lo volvemos a agregar aquí mismo. Así el cliente
    // nunca queda atascado en "pendiente" sin que Verificar haga nada.
    if (est.motivo === 'no_agregado') {
      est = await conectarDominio(dominio);
    }
    motivo = est.motivo ?? '';
    detalle = est.error ?? '';
    if (est.ok) {
      verificado = est.verificado;
      instruccion = est.instruccion;
      const nuevoEstado = verificado ? 'activo' : 'pendiente';
      if (nuevoEstado !== estado) {
        try { await admin.from('tenants').update({ dominio_estado: nuevoEstado }).eq('id', tid); } catch {}
        estado = nuevoEstado;
      }
    }
  }

  return NextResponse.json({
    dominio, estado, verificado, instruccion, motivo,
    detalle: detalle || undefined,   // ej. "Vercel 403: ..." para diagnosticar
    aviso: dominio ? mensajePorMotivo(motivo) : null,
  });
}

/** POST → guarda el dominio y lo conecta a Vercel. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dominio = limpiar(body?.dominio);
  if (!dominio || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio)) {
    return NextResponse.json({ error: 'Escribe un dominio válido, ej: www.mitienda.com' }, { status: 400 });
  }

  // ¿Ese dominio ya lo tiene otra empresa?
  const admin = createServerSupabaseClient();
  try {
    const { data: dup } = await admin.from('tenants').select('id').eq('dominio', dominio).maybeSingle();
    if (dup && dup.id !== tid) return NextResponse.json({ error: 'Ese dominio ya está en uso por otra tienda.' }, { status: 409 });
  } catch { /* columna aún no existe → se creará al guardar */ }

  const est = await conectarDominio(dominio);
  const estado = est.verificado ? 'activo' : 'pendiente';

  try {
    await admin.from('tenants').update({ dominio, dominio_estado: estado }).eq('id', tid);
  } catch (e: any) {
    return NextResponse.json({ error: 'No se pudo guardar el dominio: ' + String(e?.message ?? e) }, { status: 500 });
  }

  return NextResponse.json({
    ok: true, dominio, estado, verificado: est.verificado,
    instruccion: est.instruccion,
    automatico: est.automatico,
    aviso: est.automatico ? null : 'El dominio quedó guardado. La agencia lo terminará de activar (falta conectar la API de Vercel).',
  });
}

/** DELETE → desconecta el dominio. */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'sin empresa' }, { status: 401 });

  const admin = createServerSupabaseClient();
  try {
    const { data } = await admin.from('tenants').select('dominio').eq('id', tid).maybeSingle();
    if (data?.dominio) await desconectarDominio(String(data.dominio));
    await admin.from('tenants').update({ dominio: null, dominio_estado: null }).eq('id', tid);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
