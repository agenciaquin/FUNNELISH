import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { chat } from '@/lib/quinchat/claude';
import { CATEGORIAS_OBJ, normalizarCategoria } from '@/lib/objeciones';
import { porCadaTenant } from '@/lib/cron-tenant';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Análisis de CHATS PERDIDOS: mira las conversaciones que NO terminaron en venta
 * y clasifica por qué no compraron (precio, desconfianza, talla, envío…).
 * Guarda un registro por chat en objeciones_analisis para el tablero del panel.
 *
 * Se dispara por cron (clave secreta) o desde el panel con sesión ("Revisar ahora").
 * MULTI-TENANT: se corre por cada empresa activa, aislado a sus datos.
 */

// Estados de la conversación que SÍ son venta (no son "perdidos").
// "ANULADO EN EFFI" NO cuenta como ganada: la transportadora anuló el pedido.
const ESTADOS_GANADOS = ['VENTA REALIZADA', 'PEDIDO PROGRAMADO'];

async function autorizado(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get('authorization') === `Bearer ${secret}`) return true;
    if (req.nextUrl.searchParams.get('secret') === secret) return true;
  } else {
    return true;
  }
  const session = await getServerSession(authOptions);
  return !!session;
}

function fechaColombia(offsetDias = 0): string {
  const t = Date.now() - 5 * 3_600_000 + offsetDias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const horas = Number(req.nextUrl.searchParams.get('horas') ?? 24);
  const desdeIso = new Date(Date.now() - horas * 3_600_000).toISOString();
  // No juzgar chats aún activos: si el último mensaje es muy reciente, sigue vivo.
  const cierreIso = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const hoy = fechaColombia(0);

  let clasificados = 0;
  let analizados = 0;

  const { tenants, errores } = await porCadaTenant(async (supabase, tenant) => {
    // ── 1. Mensajes del período (de este tenant) ─────────────────────────────
    const { data: mensajes } = await supabase
      .from('messages')
      .select('conversation_id, content, role, type, created_at')
      .gte('created_at', desdeIso)
      .order('created_at', { ascending: true })
      .limit(2000);
    if (!mensajes || mensajes.length < 6) return;

    // ── 2. Armar conversaciones en texto plano ───────────────────────────────
    const porChat = new Map<string, string[]>();
    const tieneCliente = new Set<string>();
    const ultimoMsg = new Map<string, string>();
    for (const m of mensajes) {
      const id = m.conversation_id;
      ultimoMsg.set(id, m.created_at);
      if (m.type !== 'text') continue;
      const c = String(m.content ?? '').trim();
      if (!c || c.startsWith('http')) continue;
      if (m.role === 'user') tieneCliente.add(id);
      const quien = m.role === 'user' ? 'CLIENTE' : m.role === 'agent' ? 'ASESOR' : 'BOT';
      const lista = porChat.get(id) ?? [];
      if (lista.length < 30) lista.push(`${quien}: ${c}`);
      porChat.set(id, lista);
    }

    // ── 3. Estado de cada conversación ───────────────────────────────────────
    const ids = [...porChat.keys()];
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, label')
      .in('id', ids);
    const labelDe = new Map<string, string>();
    for (const c of convs ?? []) labelDe.set(String((c as any).id), String((c as any).label ?? ''));

    const esGanada = (label: string) => ESTADOS_GANADOS.some(e => label.toUpperCase().includes(e));
    const esVendedor = (label: string) => label.toUpperCase().includes('VENDEDOR');

    const candidatos = ids.filter(id => {
      const l = porChat.get(id) ?? [];
      const label = labelDe.get(id) ?? '';
      return tieneCliente.has(id)
        && l.length >= 3
        && !esGanada(label)
        && !esVendedor(label)
        && (ultimoMsg.get(id) ?? '') < cierreIso;
    }).slice(0, 40);

    if (candidatos.length === 0) return;

    const transcripciones = candidatos
      .map((id, i) => `--- CHAT ${i + 1} (${id}) ---\n${(porChat.get(id) ?? []).join('\n')}`)
      .join('\n\n')
      .slice(0, 32000);

    // ── 4. Pedirle a Claude que clasifique cada chat ─────────────────────────
    const sistema =
      `Eres analista de ventas. Vas a leer conversaciones reales de WhatsApp (venta contra entrega en Colombia) que NO terminaron en compra. Para CADA chat, di la razón MÁS probable por la que el cliente no compró, en UNA categoría:\n` +
      `- Precio: le pareció caro o no le alcanzaba.\n` +
      `- Desconfianza: miedo a que sea estafa, pidió pruebas, dudó de la marca.\n` +
      `- Talla: dudas de talla, medidas o que le quede.\n` +
      `- Envío: cobertura, costo del envío o tiempo de entrega.\n` +
      `- Indecisión: "lo pienso", lo consulta con alguien, "más tarde", sin objeción clara.\n` +
      `- Producto: quería un color o modelo que no estaba disponible.\n` +
      `- Sin respuesta: el cliente dejó de contestar sin dar motivo.\n` +
      `- Otro: cualquier otra razón clara.\n\n` +
      `IMPORTANTE: si el chat parece que TODAVÍA va a comprar (quedó en enviar datos, está confirmando, sigue interesado y activo), NO lo clasifiques: pon la categoria "EN_PROCESO".\n\n` +
      `Responde ÚNICAMENTE con un arreglo JSON, sin texto alrededor, un objeto por chat EN EL MISMO ORDEN:\n` +
      `[{"chat":1,"categoria":"Precio","detalle":"resumen corto de por qué no compró","cita":"frase textual del cliente"}]\n\n` +
      `El "detalle" en español, máximo 15 palabras. La "cita" debe ser una frase real del CLIENTE del chat. Categorías válidas: ${CATEGORIAS_OBJ.join(' | ')} | EN_PROCESO.`;

    let items: { chat?: number; categoria?: string; detalle?: string; cita?: string }[] = [];
    let crudo = '';
    try {
      const resp = await chat({
        messages: [{ role: 'user', content: `Conversaciones sin compra:\n\n${transcripciones}` }],
        tenantId: tenant.id,
        systemPrompt: sistema,
        maxTokens: 4000,
      });
      crudo = resp.message.trim();
      const limpio = crudo.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const ini = limpio.indexOf('[');
      const fin = limpio.lastIndexOf(']');
      if (ini < 0) throw new Error('sin lista');
      const json = fin > ini ? limpio.slice(ini, fin + 1) : `${limpio.slice(ini, limpio.lastIndexOf('}') + 1)}]`;
      items = JSON.parse(json);
    } catch (e: any) {
      console.error(`[Objeciones] respuesta no válida (tenant ${tenant.slug}):`, e?.message, '|', crudo.slice(0, 200));
      return;
    }

    // ── 5. Guardar (una fila por chat perdido, sin duplicar el día) ──────────
    const filas = (Array.isArray(items) ? items : [])
      .map((it, idx) => {
        const convId = candidatos[(Number(it.chat) ? Number(it.chat) - 1 : idx)] ?? candidatos[idx];
        const catCruda = String(it.categoria ?? '').trim();
        if (!convId || catCruda.toUpperCase() === 'EN_PROCESO') return null;
        return {
          fecha: hoy,
          conversation_id: convId,
          categoria: normalizarCategoria(catCruda),
          detalle: it.detalle ? String(it.detalle).slice(0, 300) : null,
          cita: it.cita ? String(it.cita).slice(0, 300) : null,
          created_at: new Date().toISOString(),
        };
      })
      .filter(Boolean) as any[];

    if (filas.length === 0) return;

    // Reemplazar lo de hoy para estos chats (re-analizar no duplica)
    const convIds = filas.map(f => f.conversation_id);
    await supabase.from('objeciones_analisis').delete().eq('fecha', hoy).in('conversation_id', convIds);
    const { error: insErr } = await supabase.from('objeciones_analisis').insert(filas);
    if (insErr) { console.error(`[Objeciones] insert tenant ${tenant.slug}:`, insErr.message); return; }

    clasificados += filas.length;
    analizados += candidatos.length;
  });

  return NextResponse.json({ status: 'ok', clasificados, analizados, tenants, errores });
}
