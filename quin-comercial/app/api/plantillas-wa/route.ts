import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tenantActual } from '@/lib/tenant';
import { listarPlantillas, crearPlantilla, borrarPlantilla, subirImagenEjemplo, credencialesTenant } from '@/lib/whatsapp-templates';

export const dynamic = 'force-dynamic';

/** Lista las plantillas de WhatsApp de la EMPRESA logueada (usa SUS credenciales). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'Sin empresa' }, { status: 401 });

  const creds = await credencialesTenant(tid);
  const r = await listarPlantillas(creds);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ plantillas: r.plantillas });
}

/** Crea una plantilla nueva y la manda a revisión de Meta (con las credenciales de la empresa). */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const tid = await tenantActual();
    if (!tid) return NextResponse.json({ error: 'Sin empresa' }, { status: 401 });
    const creds = await credencialesTenant(tid);

    const body = await req.json();
    const {
      nombre, categoria = 'MARKETING', idioma = 'es',
      cuerpo, ejemplos = [], pie, botones = [], imagenBase64, imagenMime,
    } = body ?? {};

    if (!nombre || !cuerpo) {
      return NextResponse.json({ error: 'Falta el nombre o el texto de la plantilla.' }, { status: 400 });
    }

    // Meta exige nombres en minúsculas, sin espacios ni tildes
    const nombreOk = String(nombre).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 60);

    // Si trae imagen de encabezado, primero se sube para obtener el "handle"
    let headerHandle: string | null = null;
    if (imagenBase64 && imagenMime) {
      const buffer = Buffer.from(String(imagenBase64).split(',').pop() ?? '', 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'La imagen no puede pesar más de 5 MB.' }, { status: 400 });
      }
      headerHandle = await subirImagenEjemplo(buffer, String(imagenMime), creds);
      if (!headerHandle) {
        return NextResponse.json(
          { error: 'No se pudo subir la imagen a Meta. Revisa que el token tenga permisos de la aplicación.' },
          { status: 400 }
        );
      }
    }

    const r = await crearPlantilla({
      nombre: nombreOk,
      categoria,
      idioma,
      cuerpo,
      ejemplos,
      pie,
      headerHandle,
      botones,
    }, creds);

    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: r.id, status: r.status, nombre: nombreOk });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

/** Borra una plantilla por nombre (con las credenciales de la empresa). */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const tid = await tenantActual();
  if (!tid) return NextResponse.json({ error: 'Sin empresa' }, { status: 401 });

  const nombre = req.nextUrl.searchParams.get('nombre');
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  const creds = await credencialesTenant(tid);
  const r = await borrarPlantilla(nombre, creds);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
