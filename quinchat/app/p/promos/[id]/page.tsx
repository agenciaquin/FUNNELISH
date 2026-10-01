import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';
import { COOKIE_PROMO_PRINCIPAL } from '@/lib/promo-principal';
import PromoProducto from '@/components/publico/PromoProducto';

export const dynamic = 'force-dynamic';

const CAMPOS = 'id, nombre, referencia, categoria, destacado, anclado, descripcion, foto, fotos, precio, precio_antes, precio_dos, precio_tres, tallas, stock, colores, variantes';

async function getPromo(id: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('promociones').select(CAMPOS).eq('id', id).eq('activo', true).maybeSingle();
  return data as any;
}

async function getSeller(codigo?: string) {
  const vacio = { sellerWa: null as string | null, sellerNombre: null as string | null, sellerCodigo: null as string | null, token: null as string | null };
  // `__principal__` no es un vendedor: su token no entra nunca por ?v= (va por cookie).
  if (!codigo || codigo === '__principal__') return vacio;
  const supabase = createServerSupabaseClient();
  const { data: v } = await supabase.from('vendedores_promo').select('nombre, celular, activo, token').eq('codigo', codigo).neq('codigo', '__principal__').maybeSingle();
  if (v && v.activo && /^\d{10}$/.test(String(v.celular))) {
    return { sellerWa: `57${v.celular}`, sellerNombre: v.nombre as string, sellerCodigo: codigo, token: (v.token as string) ?? null };
  }
  return vacio;
}

async function getPrincipalToken(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('vendedores_promo').select('token').eq('codigo', '__principal__').maybeSingle();
  return (data?.token as string) ?? null;
}

const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

// Metadatos para que WhatsApp/redes muestren la TARJETA con la foto del producto.
export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; color?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const p = await getPromo(id);
  if (!p) return { title: 'Producto · Klixmant' };
  const color = sp?.color?.trim();
  const foto: string = (color && p.fotos && p.fotos[color]) || p.foto || '';
  const titulo = p.nombre as string;
  const descripcion = `${pesos(p.precio)} · Pago contra entrega en toda Colombia 🚚`;
  return {
    title: `${titulo} · Klixmant`,
    description: descripcion,
    openGraph: {
      title: titulo,
      description: descripcion,
      type: 'website',
      images: foto ? [{ url: foto, width: 800, height: 800, alt: titulo }] : [],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: titulo,
      description: descripcion,
      images: foto ? [foto] : [],
    },
  };
}

export default async function ProductoPromoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string; color?: string; k?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const p = await getPromo(id);
  const { sellerWa, sellerNombre, sellerCodigo, token } = await getSeller(sp?.v?.trim());
  const kParam = sp?.k?.trim() || '';

  // El botón "Marcar vendido" aparece si:
  //  · con ?v= → el link trae el token del vendedor (descuenta y venta va a su WhatsApp).
  //  · sin ?v= (enlace principal) → el teléfono tiene la cookie del principal
  //    (tu número). Su token NO se pasa a la página: /vender lo lee de la cookie.
  let canSell = false;
  let ventaCodigo: string | null = null;
  let ventaToken: string | null = null;
  if (sellerCodigo && token && kParam && kParam === token) {
    canSell = true; ventaCodigo = sellerCodigo; ventaToken = kParam;
  } else if (!sellerCodigo) {
    const enCookie = (await cookies()).get(COOKIE_PROMO_PRINCIPAL)?.value ?? '';
    const prinToken = enCookie ? await getPrincipalToken() : null;
    if (prinToken && enCookie === prinToken) { canSell = true; ventaCodigo = '__principal__'; }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(120% 80% at 50% 0%, #0f2a26 0%, #081413 55%, #050d0c 100%)' }}>
      <header style={{ background: 'linear-gradient(135deg,#0B1B1A,#0f3a34)', color: '#fff', padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid rgba(34,211,197,.22)' }}>
        <div style={{ fontWeight: 800, letterSpacing: '.18em', fontSize: 9, color: '#22D3C5', textTransform: 'uppercase' }}>Klixmant · Promociones</div>
      </header>

      {p ? (
        <PromoProducto promo={p} sellerWa={sellerWa} sellerNombre={sellerNombre} sellerCodigo={sellerCodigo} ventaCodigo={ventaCodigo} ventaToken={ventaToken} canSell={canSell} initialColor={sp?.color?.trim() || null} />
      ) : (
        <p style={{ textAlign: 'center', color: '#7f938f', padding: '48px 16px', fontSize: 14 }}>
          Este producto ya no está disponible. <a href={`/promos${sp?.v ? `?v=${sp.v}` : ''}`} style={{ color: '#22D3C5' }}>Ver catálogo</a>
        </p>
      )}

      <footer style={{ textAlign: 'center', color: '#6d817d', fontSize: 12, padding: '24px 16px' }}>
        Klixmant SAS · Pago contra entrega en toda Colombia
      </footer>
    </main>
  );
}
