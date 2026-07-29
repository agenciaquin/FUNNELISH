import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase';

/** La raíz de la tienda lleva al primer embudo activo. */
export const dynamic = 'force-dynamic';

export default async function Tienda() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from('funnels').select('slug').eq('activo', true)
    .order('creado_at', { ascending: false }).limit(1).maybeSingle();

  if (data?.slug) redirect(`/${data.slug}`);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6 text-center">
      <div>
        <p className="text-5xl mb-3">🛍️</p>
        <p className="text-sm text-[#6B6B6B]">
          No hay productos publicados en este momento.
        </p>
      </div>
    </main>
  );
}
