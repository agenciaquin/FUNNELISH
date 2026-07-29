import { NextRequest, NextResponse } from 'next/server';
import { listarPlantillas, crearPlantilla, borrarPlantilla, subirImagenEjemplo } from '@/lib/whatsapp-templates';

/** Lista las plantillas de WhatsApp de la cuenta. */
export async function GET() {
  const r = await listarPlantillas();
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ plantillas: r.plantillas });
}

/** Crea una plantilla nueva y la manda a revisión de Meta. */
export async function POST(req: NextRequest) {
  try {
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
      headerHandle = await subirImagenEjemplo(buffer, String(imagenMime));
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
    });

    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: r.id, status: r.status, nombre: nombreOk });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error inesperado.' }, { status: 500 });
  }
}

/** Borra una plantilla por nombre. */
export async function DELETE(req: NextRequest) {
  const nombre = req.nextUrl.searchParams.get('nombre');
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  const r = await borrarPlantilla(nombre);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
