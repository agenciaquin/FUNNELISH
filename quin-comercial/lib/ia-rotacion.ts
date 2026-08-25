// Motor de rotación (failover) + respaldo con IA de agencia.
// Prueba las llaves gratis del cliente por prioridad; si todas fallan (o no hay),
// cae a la IA de agencia (Claude). La memoria del bot (systemPrompt) se inyecta
// en CADA proveedor, así cualquier IA activa responde con el mismo cerebro.
// Nunca lanza y evita dejar mudo al bot de empresas que ya funcionan.
import { createServerSupabaseClient } from '@/lib/supabase';
import { desencriptar } from '@/lib/cripto';
import { proveedorDe, llamarProveedor, type Msg, type RateInfo, type ProveedorInfo } from '@/lib/ia-proveedores';
import { chat } from '@/lib/quinchat/claude';

const ENFRIAMIENTO_MS = 60_000; // el límite real es tokens/minuto → revive en 1 min

export interface RespuestaIA { message: string; proveedor: string }

interface OpcionesIA {
  messages: Msg[];
  systemPrompt: string;
  systemDynamic?: string;   // contexto que cambia (resumen del chat); no se cachea
  maxTokens?: number;
  conversationId?: string;  // para cobrar 1 crédito por conversación
  imagenes?: any[];         // fotos del cliente → van directo a la IA de agencia (visión)
}

export async function responderIA(
  tenantId: string | null | undefined,
  opts: OpcionesIA,
): Promise<RespuestaIA> {
  const admin = createServerSupabaseClient();
  // Respuestas de venta son cortas → 400 tokens alcanza y sale más barato.
  const maxTokens = opts.maxTokens ?? 400;
  // El systemPrompt (memoria del bot) + el resumen dinámico se inyectan a TODAS las IAs.
  const sysCompleto = opts.systemPrompt + (opts.systemDynamic ? `\n\n${opts.systemDynamic}` : '');
  const mensajes: Msg[] = [{ role: 'system', content: sysCompleto }, ...opts.messages];

  let integraciones: any[] = [];
  if (tenantId) {
    try {
      const { data } = await admin.from('ai_integraciones')
        .select('*').eq('tenant_id', tenantId).eq('activo', true).order('prioridad', { ascending: true });
      integraciones = data ?? [];
    } catch { integraciones = []; }
  }
  const tieneKeys = integraciones.length > 0;

  // ¿El mensaje trae imágenes? (URLs). Si sí, solo entran las llaves con visión.
  const hayImagenes = Array.isArray(opts.imagenes) && opts.imagenes.length > 0;
  const soportaVisionIA = (ia: any) => (ia.soporta_vision ?? proveedorDe(ia.proveedor)?.soportaVision) === true;

  {
    const ahora = Date.now();
    // Si hay imagen, filtramos a las llaves que sí leen imágenes; si no, todas.
    const candidatas = hayImagenes ? integraciones.filter(soportaVisionIA) : integraciones;
    for (const ia of candidatas) {
      if (ia.enfriada_hasta && new Date(ia.enfriada_hasta).getTime() > ahora) continue; // en enfriamiento
      const info = proveedorDe(ia.proveedor);
      if (!info) continue;
      const apiKey = desencriptar(ia.api_key_cifrada);
      if (!apiKey) continue;
      // Modelo según el tipo: imagen → modelo de visión; texto → modelo de texto.
      const modelo = hayImagenes
        ? (ia.modelo_vision || info.modeloVision || ia.modelo || info.modeloDefault)
        : (ia.modelo || info.modeloDefault);
      try {
        const { texto, rate } = await llamarProveedor(info, apiKey, modelo, mensajes, maxTokens, hayImagenes ? (opts.imagenes as any[]) : undefined);
        if (texto && texto.trim()) {
          // Guarda cuánto lleva usado / cuánto le queda a esta IA (para la barra del panel).
          registrarUsoIA(admin, ia, info, rate).catch(() => {});
          return { message: texto.trim(), proveedor: ia.proveedor };
        }
      } catch (err: any) {
        const st = err?.status;
        if (st === 429 || st === 402) {
          await admin.from('ai_integraciones').update({ estado: 'agotada', enfriada_hasta: new Date(ahora + ENFRIAMIENTO_MS).toISOString() }).eq('id', ia.id).then(() => {}, () => {});
        } else if (st === 401 || st === 403) {
          await admin.from('ai_integraciones').update({ estado: 'error' }).eq('id', ia.id).then(() => {}, () => {});
        }
        continue; // pasar a la siguiente
      }
    }
  }

  // Respaldo: IA de agencia
  const r = await respaldoAgencia(admin, tenantId, opts, maxTokens, tieneKeys);
  if (r) return r;

  return { message: '¡Gracias por escribir! En un momento te atendemos 🙌', proveedor: 'ninguno' };
}

// ⚙️ INTERRUPTOR DE COBRO. En fase de pruebas el bot de ventas es GRATIS: no se
// bloquea a nadie por saldo, pero SÍ se cuentan las conversaciones por empresa
// (para ver estadísticas). Cuando la agencia decida empezar a cobrar, cambiar
// esto a `true`: ahí vuelve el bloqueo por saldo y el descuento de créditos.
const COBRO_ACTIVO = false;

async function respaldoAgencia(
  admin: any,
  tenantId: string | null | undefined,
  opts: OpcionesIA,
  maxTokens: number,
  tieneKeys: boolean,
): Promise<RespuestaIA | null> {
  let modo = 'creditos'; let creditos = 0; let pruebaHasta: string | null = null;
  if (tenantId) {
    try {
      const { data: t } = await admin.from('tenants').select('ia_respaldo, creditos, prueba_hasta').eq('id', tenantId).maybeSingle();
      modo = t?.ia_respaldo ?? 'creditos';
      creditos = Number(t?.creditos ?? 0);
      pruebaHasta = t?.prueba_hasta ?? null;
    } catch { /* si faltan columnas, respaldo por defecto */ }
  }
  const enPrueba = !!pruebaHasta && new Date(pruebaHasta).getTime() > Date.now();

  // La IA de agencia responde SIEMPRE (para no dejar mudo al bot), salvo dos casos:
  //  - modo 'apagado' explícito.
  //  - el cliente YA vinculó sus llaves (tieneKeys), eligió créditos, no está en
  //    prueba y se quedó sin saldo → pausa para que recargue.
  if (modo === 'apagado') return null;
  // GRATIS mientras COBRO_ACTIVO sea false: nunca se bloquea por saldo (el bot
  // sigue atendiendo). Cuando se active el cobro, vuelve el bloqueo por créditos.
  if (COBRO_ACTIVO && tieneKeys && modo === 'creditos' && !enPrueba && creditos <= 0) return null;

  try {
    const resp = await chat({
      tenantId: tenantId ?? undefined,
      messages: opts.messages as any,
      systemPrompt: opts.systemPrompt,
      systemDynamic: opts.systemDynamic,
      maxTokens,
      imagenes: opts.imagenes,
    } as any);
    const texto = ((resp as any)?.message ?? '').trim();
    if (!texto) return null;
    // Cuenta la conversación por empresa (para estadísticas). SIEMPRE suma, aunque
    // esté gratis; si COBRO_ACTIVO está en true, además descuenta 1 del saldo.
    if (tenantId && opts.conversationId) {
      await contarConversacion(admin, tenantId, opts.conversationId);
    }
    return { message: texto, proveedor: enPrueba ? 'agencia-prueba' : 'agencia' };
  } catch { return null; }
}

// Guarda el consumo de una IA gratis: lleva nuestro propio contador del día y,
// si el proveedor reporta sus límites en las cabeceras, los guarda tal cual.
// Alimenta la barra "cuánto lleva / cuánto le queda" del panel Integrar IA.
async function registrarUsoIA(admin: any, ia: any, info: ProveedorInfo, rate: RateInfo | null) {
  try {
    const ahora = new Date();
    const hoy = ahora.toISOString().slice(0, 10);
    // Contador propio del día (se reinicia al cambiar de fecha). Sirve para todas.
    const usoHoy = (ia.uso_dia === hoy ? Number(ia.uso_hoy ?? 0) : 0) + 1;

    const patch: any = {
      estado: 'activa',
      ultimo_ok: ahora.toISOString(),
      enfriada_hasta: null,
      uso_hoy: usoHoy,
      uso_dia: hoy,
      rl_actualizado_at: ahora.toISOString(),
    };

    if (rate && (rate.limite != null || rate.restante != null)) {
      // El proveedor SÍ reporta sus límites → dato real.
      patch.rl_fuente = 'meta';
      patch.rl_unidad = rate.unidad;
      patch.rl_limite = rate.limite;
      patch.rl_restante = rate.restante;
      patch.rl_reset_at = rate.resetSeg != null ? new Date(ahora.getTime() + rate.resetSeg * 1000).toISOString() : null;
    } else if (info.limiteDiarioGratis) {
      // No reporta (ej. Gemini) → estimamos con nuestro contador vs. el tope diario aprox.
      const man = new Date(ahora); man.setHours(24, 0, 0, 0); // próxima medianoche
      patch.rl_fuente = 'contado';
      patch.rl_unidad = 'solicitudes';
      patch.rl_limite = info.limiteDiarioGratis;
      patch.rl_restante = Math.max(0, info.limiteDiarioGratis - usoHoy);
      patch.rl_reset_at = man.toISOString();
    }

    await admin.from('ai_integraciones').update(patch).eq('id', ia.id);
  } catch { /* nunca bloquear la respuesta por el registro de uso */ }
}

// Cuenta la PRIMERA vez que una conversación usa la IA de agencia:
//  - Marca la conversación como contada (para no contarla dos veces).
//  - Sube el contador acumulado de la empresa (conversaciones_usadas) → estadística.
//  - Si COBRO_ACTIVO está en true, además descuenta 1 del saldo (creditos).
async function contarConversacion(admin: any, tenantId: string, conversationId: string) {
  try {
    const { data: conv } = await admin.from('conversations')
      .select('cobrada_agencia').eq('tenant_id', tenantId).eq('id', conversationId).maybeSingle();
    if (conv?.cobrada_agencia) return;
    await admin.from('conversations').update({ cobrada_agencia: true }).eq('tenant_id', tenantId).eq('id', conversationId);

    const { data: t } = await admin.from('tenants').select('creditos, conversaciones_usadas').eq('id', tenantId).maybeSingle();
    const patch: any = { conversaciones_usadas: Number(t?.conversaciones_usadas ?? 0) + 1 };
    if (COBRO_ACTIVO) patch.creditos = Math.max(0, Number(t?.creditos ?? 0) - 1);
    await admin.from('tenants').update(patch).eq('id', tenantId);
  } catch { /* fail-open: nunca bloquear la respuesta por el conteo */ }
}
