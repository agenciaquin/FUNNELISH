import { createServerSupabaseClient } from '@/lib/supabase';
import PromosLista from '@/components/publico/PromosLista';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Promociones · Klixmant',
  description: '🔥 Promos por tiempo limitado — pago contra entrega en toda Colombia.',
};

export default async function PromosPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('promociones')
    .select('id, nombre, referencia, categoria, destacado, anclado, descripcion, foto, fotos, precio, precio_antes, precio_dos, precio_tres, tallas, stock, colores, variantes')
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('creado_at', { ascending: false });

  const promos = (data ?? []) as any[];

  // Modo vendedor: /promos?v=<codigo>. Si el código existe y está activo, el
  // catálogo oculta "COMPRAR AQUÍ" y "COMPRAR POR WHATSAPP" va a SU número.
  // Token del "principal" (tu número): habilita "marcar vendido" en el enlace principal.
  let adminToken: string | null = null;
  {
    const { data: prin } = await supabase.from('vendedores_promo').select('token').eq('codigo', '__principal__').maybeSingle();
    adminToken = prin?.token ?? null;
  }

  const codigo = (await searchParams)?.v?.trim();
  let sellerWa: string | null = null;
  let sellerNombre: string | null = null;
  let sellerCodigo: string | null = null;
  let sellerToken: string | null = null;
  if (codigo) {
    const { data: vend } = await supabase
      .from('vendedores_promo')
      .select('nombre, celular, activo, token')
      .eq('codigo', codigo)
      .maybeSingle();
    if (vend && vend.activo && /^\d{10}$/.test(String(vend.celular))) {
      sellerWa = `57${vend.celular}`;
      sellerNombre = vend.nombre;
      sellerCodigo = codigo;
      sellerToken = vend.token ?? null;
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(120% 80% at 50% 0%, #0f2a26 0%, #081413 55%, #050d0c 100%)' }}>
      {/* Encabezado de marca */}
      <header style={{ background: 'linear-gradient(135deg,#0B1B1A,#0f3a34)', color: '#fff', padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid rgba(34,211,197,.22)' }}>
        <div style={{ fontWeight: 800, letterSpacing: '.18em', fontSize: 9, color: '#22D3C5', textTransform: 'uppercase' }}>Klixmant · Promociones</div>
        <h1 style={{ fontWeight: 900, fontSize: 'clamp(15px,4.6vw,22px)', margin: '2px 0 0', color: '#fff', whiteSpace: 'nowrap' }}>🔥 Ofertas por tiempo limitado</h1>
      </header>

      {promos.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#7f938f', padding: '48px 16px', fontSize: 14 }}>
          Pronto tendremos nuevas promociones aquí. ¡Vuelve pronto! 😊
        </p>
      ) : (
        <PromosLista promos={promos} sellerWa={sellerWa} sellerNombre={sellerNombre} sellerCodigo={sellerCodigo} sellerToken={sellerToken} adminToken={adminToken} />
      )}

      <footer style={{ textAlign: 'center', color: '#6d817d', fontSize: 12, padding: '24px 16px' }}>
        Klixmant SAS · Pago contra entrega en toda Colombia
      </footer>
    </main>
  );
}
