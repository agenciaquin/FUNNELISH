import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase';
import { normalizarConfig } from '@/lib/mi-pagina';
import { cargarDatosPagina } from '@/lib/mi-pagina-servidor';
import PaginaWeb from '@/components/publico/PaginaWeb';
import { validarDescuento } from '@/lib/descuento-tienda';

/**
 * «Mi Página» pública: pedido.klixmant.shop/web/<slug>  (el middleware de la tienda la reescribe a /p/web/<slug>).
 * ?borrador=1 → vista previa del editor (solo con sesión del panel): muestra el BORRADOR y todos los catálogos.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ borrador?: string; d?: string }> };

async function leer(slug: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('mi_pagina').select('slug, nombre, publicada, borrador, publicado')
    .eq('slug', String(slug ?? '').toLowerCase()).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const p = await leer(slug);
  const cfg = p?.publicado ? normalizarConfig(p.publicado) : null;
  if (!cfg) return { title: 'Página no disponible' };
  return {
    title: `${cfg.marca.nombre}${cfg.banner.titulo ? ` · ${cfg.banner.titulo} ${cfg.banner.titulo2}`.trimEnd() : ''}`,
    description: cfg.banner.subtitulo || cfg.contacto.texto || undefined,
    openGraph: cfg.banner.imagen ? { images: [cfg.banner.imagen] } : undefined,
  };
}

export default async function MiPaginaPublica({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const p = await leer(slug);
  if (!p) notFound();

  if (sp?.borrador === '1') {
    const sesion = await getServerSession(authOptions);
    if (!sesion) notFound();
    const cfg = normalizarConfig(p.borrador);
    const datos = await cargarDatosPagina(cfg, true);
    return <PaginaWeb config={cfg} datos={datos} preview />;
  }

  if (!p.publicada || !p.publicado) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white px-6 text-center">
        <div><p className="text-5xl mb-3">🛍️</p><p className="text-sm text-[#6B6B6B]">Esta página no está disponible en este momento.</p></div>
      </main>
    );
  }
  const cfg = normalizarConfig(p.publicado);
  const datos = await cargarDatosPagina(cfg, false);
  // Descuento del cliente (botón «Ver la tienda» de la plantilla): SOLO con un código válido. Sin código, precios normales.
  const desc = sp?.d ? await validarDescuento(createServerSupabaseClient(), sp.d) : null;
  if (desc) {
    for (const e of Object.values(datos.embudos)) {
      if (e.precio == null) continue;
      e.precio_antes = Math.max(Number(e.precio_antes) || 0, Number(e.precio)) || null;
      e.precio = Math.max(0, Number(e.precio) - desc.monto);
    }
  }
  return <PaginaWeb config={cfg} datos={datos} descuento={desc ? { codigo: desc.codigo, monto: desc.monto, nombre: desc.nombre } : null} />;
}
