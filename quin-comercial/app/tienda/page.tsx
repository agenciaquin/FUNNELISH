import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase';

/** Raíz de la tienda. Si se entra por el DOMINIO PROPIO de un cliente, muestra
 *  el embudo de ESA tienda; si es el dominio genérico, el más reciente. */
export const dynamic = 'force-dynamic';

export default async function Tienda() {
  const supabase = createServerSupabaseClient();
  const host = (await headers()).get('host')?.toLowerCase() ?? '';

  // ¿El dominio pertenece a la tienda de un cliente en particular?
  let tenantId: string | null = null;
  try {
    const { data: t } = await supabase.from('tenants').select('id').eq('dominio', host).maybeSingle();
    tenantId = t?.id ?? null;
  } catch { /* la columna dominio aún no existe */ }

  let query = supabase.from('funnels').select('slug').eq('activo', true)
    .order('creado_at', { ascending: false }).limit(1);
  if (tenantId) query = query.eq('tenant_id', tenantId);
  const { data } = await query.maybeSingle();

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
