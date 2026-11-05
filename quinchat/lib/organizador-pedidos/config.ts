import { createServerSupabaseClient } from '@/lib/supabase';

/**
 * ORGANIZADOR DE PEDIDOS — interruptor único (ajustes_bot clave `organizador_pedidos`).
 *
 * Un vendedor habilitado le reenvía al bot los datos de un pedido en desorden
 * (fotos + pedazos de texto) y el bot le devuelve UNA foto (collage) con el
 * pedido ordenado en el texto. Todo vive en lib/organizador-pedidos.
 * Apagar: `activo: false` → el webhook ni entra y el número vuelve a su flujo de siempre.
 */
export interface AjustesOrganizador { activo: boolean; numeros: string[] }

const DEFECTO: AjustesOrganizador = { activo: false, numeros: [] };
let cache: { valor: AjustesOrganizador; leido: number } | null = null;

const tel = (t: string) => {
  const d = String(t ?? '').replace(/\D/g, '');
  return d.length === 10 ? `57${d}` : d;
};

export async function ajustesOrganizador(): Promise<AjustesOrganizador> {
  if (cache && Date.now() - cache.leido < 30_000) return cache.valor;
  let valor = DEFECTO;
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'organizador_pedidos').maybeSingle();
    const v = (data?.valor ?? {}) as Partial<AjustesOrganizador>;
    valor = {
      activo: v.activo === true,
      numeros: Array.isArray(v.numeros) ? v.numeros.map(n => tel(String(n))).filter(n => /^57\d{10}$/.test(n)) : [],
    };
  } catch { /* si falla, queda apagado */ }
  cache = { valor, leido: Date.now() };
  return valor;
}

export async function organizadorAtiende(telefono: string | null | undefined): Promise<boolean> {
  if (!telefono) return false;
  const a = await ajustesOrganizador();
  return a.activo && a.numeros.includes(tel(telefono));
}
