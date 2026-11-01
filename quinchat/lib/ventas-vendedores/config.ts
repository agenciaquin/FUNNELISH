import { createServerSupabaseClient } from '@/lib/supabase';
import { esVendedor, normalizarTel } from '@/lib/vendedores';

/**
 * MÓDULO "VENTAS VENDEDORES" (prueba) — interruptor único.
 *
 * Todo el módulo vive en lib/ventas-vendedores, app/api/ventas-vendedores,
 * components/panel/ventas-vendedores y las tablas vv_*. Con `activo: false`
 * el webhook ni siquiera entra al módulo y los vendedores vuelven al flujo de
 * reporte de siempre. Nada más de QuinChat depende de esto.
 */
export interface AjustesVV {
  activo: boolean;
  /** Números (57 + 10 dígitos) que usan el módulo aunque no estén en la lista de vendedores. */
  numeros_prueba: string[];
  /** true = TODOS los vendedores de lib/vendedores.ts entran al módulo. false = solo los de prueba. */
  todos_vendedores: boolean;
  /** 'simulacion' arma la solicitud a Effi y la guarda, sin enviarla. 'real' la envía. */
  envio_effi: 'simulacion' | 'real';
}

export const AJUSTES_VV_DEFECTO: AjustesVV = {
  activo: false, numeros_prueba: [], todos_vendedores: false, envio_effi: 'simulacion',
};

let cache: { valor: AjustesVV; leido: number } | null = null;

export async function ajustesVV(fresco = false): Promise<AjustesVV> {
  if (!fresco && cache && Date.now() - cache.leido < 30_000) return cache.valor;
  let valor = AJUSTES_VV_DEFECTO;
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.from('ajustes_bot').select('valor').eq('clave', 'ventas_vendedores').maybeSingle();
    const v = (data?.valor ?? {}) as Partial<AjustesVV>;
    valor = {
      activo: v.activo === true,
      numeros_prueba: Array.isArray(v.numeros_prueba) ? v.numeros_prueba.map(n => normalizarTel(String(n))).filter(Boolean) : [],
      todos_vendedores: v.todos_vendedores === true,
      envio_effi: v.envio_effi === 'real' ? 'real' : 'simulacion',
    };
  } catch { /* si falla, el módulo queda apagado */ }
  cache = { valor, leido: Date.now() };
  return valor;
}

export async function guardarAjustesVV(parcial: Partial<AjustesVV>): Promise<AjustesVV> {
  const actual = await ajustesVV(true);
  const nuevo: AjustesVV = { ...actual, ...parcial };
  nuevo.numeros_prueba = (nuevo.numeros_prueba ?? []).map(n => normalizarTel(String(n))).filter(n => /^57\d{10}$/.test(n));
  const supabase = createServerSupabaseClient();
  await supabase.from('ajustes_bot').upsert(
    { clave: 'ventas_vendedores', valor: nuevo, actualizado_at: new Date().toISOString() },
    { onConflict: 'clave' },
  );
  cache = null;
  return nuevo;
}

/** ¿Este número entra al módulo? (interruptor encendido + número habilitado). */
export async function moduloAtiende(telefono: string | null | undefined): Promise<{ si: boolean; esPrueba: boolean }> {
  const tel = normalizarTel(telefono);
  if (!tel) return { si: false, esPrueba: false };
  const a = await ajustesVV();
  if (!a.activo) return { si: false, esPrueba: false };
  const esPrueba = a.numeros_prueba.includes(tel);
  if (esPrueba) return { si: true, esPrueba: true };
  if (a.todos_vendedores && esVendedor(tel)) return { si: true, esPrueba: false };
  return { si: false, esPrueba: false };
}
