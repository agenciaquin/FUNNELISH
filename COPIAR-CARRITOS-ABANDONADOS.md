# 🛒 Carritos abandonados — paquete completo para copiar a otro proyecto

Pega este mensaje en el chat del otro proyecto. Trae el **código real** ya funcionando: cuando alguien empieza el checkout (escribe nombre + WhatsApp válido) pero no termina, se guarda como carrito abandonado para poder escribirle y recuperar la venta. Incluye SQL, API, panel y un cron opcional.

Esta versión es **single-tenant** (una sola empresa). Si tu otro proyecto es multi-empresa, agrega `tenant_id` a la tabla, al upsert y a los filtros.

Dependencias que asume: `@/lib/supabase` → `createServerSupabaseClient()` (Supabase con service role). El cron además usa `@/lib/whatsapp` → `sendTextMessage()`. Tablas que cruza: `clientes_funnelish(telefono, confirmado)` para excluir a los que ya compraron.

---

## 1) SQL — corre esto en Supabase → SQL Editor

```sql
create table if not exists carritos_abandonados (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  nombre        text,
  telefono      text not null,
  producto      text,
  talla         text,
  valor         numeric,
  recuperado    boolean not null default false,
  recuperado_at timestamptz,
  notificado_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists carritos_abandonados_uniq on carritos_abandonados (slug, telefono);
create index if not exists carritos_abandonados_idx on carritos_abandonados (recuperado, created_at desc);

-- Importante: sin esto el server da "permission denied".
grant all on table carritos_abandonados to service_role;
```

---

## 2) API — crea `app/api/funnels/carrito/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// POST (PÚBLICO): el cliente escribió nombre + teléfono pero aún no compra.
export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 200 }); }

  const slug = String(b?.slug ?? '').trim().toLowerCase();
  const telefono = String(b?.telefono ?? '').replace(/\D/g, '').replace(/^57/, '').slice(-10);
  if (!slug || !/^3\d{9}$/.test(telefono)) return NextResponse.json({ ok: false }, { status: 200 });

  try {
    const admin = createServerSupabaseClient();
    await admin.from('carritos_abandonados').upsert({
      slug, telefono,
      nombre:   b?.nombre   ? String(b.nombre).slice(0, 120)   : null,
      producto: b?.producto ? String(b.producto).slice(0, 200) : null,
      talla:    b?.talla    ? String(b.talla).slice(0, 120)    : null,
      valor:    Number(b?.valor) > 0 ? Number(b.valor) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slug,telefono' });
  } catch { /* nunca romper la página del cliente */ }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// GET: lista carritos abandonados no recuperados que NO terminaron comprando.
export async function GET(req: NextRequest) {
  const verRecuperados = req.nextUrl.searchParams.get('recuperados') === '1';
  const admin = createServerSupabaseClient();

  const { data: carritos, error } = await admin
    .from('carritos_abandonados')
    .select('id, slug, nombre, telefono, producto, talla, valor, recuperado, created_at')
    .eq('recuperado', verRecuperados)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = carritos ?? [];
  const tels = [...new Set(lista.map((c: any) => String(c.telefono)))];
  const compraron = new Set<string>();
  if (tels.length && !verRecuperados) {
    try {
      const { data: peds } = await admin.from('clientes_funnelish')
        .select('telefono').eq('confirmado', true).in('telefono', tels);
      for (const p of peds ?? []) compraron.add(String((p as any).telefono));
    } catch { /* si falla, se muestran todos */ }
  }

  const abiertos = verRecuperados ? lista : lista.filter((c: any) => !compraron.has(String(c.telefono)));
  return NextResponse.json({ carritos: abiertos, total: abiertos.length });
}

// PATCH: marca un carrito como recuperado o lo reabre.
export async function PATCH(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'body inválido' }, { status: 400 }); }
  const id = String(b?.id ?? '');
  if (!id) return NextResponse.json({ error: 'falta id' }, { status: 400 });
  const recuperado = b?.recuperado !== false;

  const admin = createServerSupabaseClient();
  const { error } = await admin.from('carritos_abandonados')
    .update({ recuperado, recuperado_at: recuperado ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

---

## 3) Panel — crea `components/panel/CarritosAbandonados.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface Carrito {
  id: string;
  slug: string;
  nombre: string | null;
  telefono: string;
  producto: string | null;
  talla: string | null;
  valor: number | null;
  created_at: string;
}

const pesos = (n: number | null) => (n ? `$${Math.round(n).toLocaleString('es-CO')}` : '—');

function cuandoFue(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export default function CarritosAbandonados({ onClose }: { onClose: () => void }) {
  const [carritos, setCarritos] = useState<Carrito[]>([]);
  const [loading, setLoading]   = useState(true);
  const [verRecuperados, setVerRecuperados] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/funnels/carrito${verRecuperados ? '?recuperados=1' : ''}`, { cache: 'no-store' });
      const d = await r.json();
      setCarritos(d.carritos ?? []);
    } catch { setCarritos([]); }
    finally { setLoading(false); }
  }, [verRecuperados]);

  useEffect(() => { cargar(); }, [cargar]);

  async function marcar(id: string, recuperado: boolean) {
    setMarcando(id);
    try {
      await fetch('/api/funnels/carrito', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, recuperado }),
      });
      setCarritos(cs => cs.filter(c => c.id !== id));
    } catch { /* ignorar */ }
    finally { setMarcando(null); }
  }

  const totalValor = carritos.reduce((s, c) => s + (c.valor ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E8E8E8] flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-bold text-[#0D0D0D]">🛒 Carritos abandonados</h3>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">
              Clientes que escribieron su nombre y WhatsApp pero no completaron la compra. ¡Llámalos para recuperar la venta!
            </p>
          </div>
          <button onClick={onClose} className="text-[#6B6B6B] hover:text-[#0D0D0D] text-xl leading-none">×</button>
        </div>

        <div className="px-6 pt-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <button onClick={() => setVerRecuperados(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!verRecuperados ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
              Por recuperar
            </button>
            <button onClick={() => setVerRecuperados(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${verRecuperados ? 'border-[#00A89D] bg-[#00A89D]/10 text-[#00847A] font-semibold' : 'border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]'}`}>
              Recuperados
            </button>
          </div>
          {!verRecuperados && carritos.length > 0 && (
            <span className="text-[11px] text-[#6B6B6B]">
              <b className="text-[#0D0D0D]">{carritos.length}</b> carritos · <b className="text-[#00847A]">{pesos(totalValor)}</b> por recuperar
            </span>
          )}
        </div>

        <div className="px-6 py-4">
          {loading ? (
            <div className="text-center text-[#9A9A9A] text-sm py-10">Cargando…</div>
          ) : carritos.length === 0 ? (
            <div className="text-center text-[#9A9A9A] text-sm py-10">
              {verRecuperados ? 'Aún no has marcado carritos como recuperados.' : '🎉 No hay carritos abandonados. ¡Todos completaron su compra!'}
            </div>
          ) : (
            <div className="space-y-2">
              {carritos.map(c => {
                const tel = c.telefono.replace(/\D/g, '').replace(/^57/, '');
                const msg = encodeURIComponent(`¡Hola ${c.nombre?.split(' ')[0] ?? ''}! 😊 Vi que estabas por pedir ${c.producto ?? 'tu buzo'}${c.talla ? ` (${c.talla})` : ''}. ¿Te ayudo a completarlo? 🚚`);
                return (
                  <div key={c.id} className="rounded-xl border border-[#EFEFEF] p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0D0D0D] truncate">{c.nombre || 'Sin nombre'}</span>
                        <span className="text-[10px] text-[#9A9A9A] shrink-0">· {cuandoFue(c.created_at)}</span>
                      </div>
                      <div className="text-[12px] text-[#6B6B6B] truncate">
                        {c.producto || '—'}{c.talla ? ` · ${c.talla}` : ''} · {pesos(c.valor)}
                      </div>
                      <div className="text-[12px] text-[#00847A] font-mono">{tel}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a href={`https://wa.me/57${tel}?text=${msg}`} target="_blank" rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:opacity-90">
                        WhatsApp
                      </a>
                      <a href={`tel:+57${tel}`}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5]">
                        📞
                      </a>
                      <button onClick={() => marcar(c.id, !verRecuperados)} disabled={marcando === c.id}
                        title={verRecuperados ? 'Reabrir' : 'Marcar como recuperado'}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] text-[#6B6B6B] text-xs font-medium hover:bg-[#F5F5F5] disabled:opacity-50">
                        {marcando === c.id ? '…' : verRecuperados ? '↩' : '✓'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 4) Capturar el carrito desde la página de venta

En tu formulario de pedido, pega este `useEffect` (ajusta los nombres de tus variables de estado: `datos.nombre`, `datos.whatsapp`, `funnel.slug`, etc.):

```tsx
// Apenas hay nombre + WhatsApp válido, guarda el carrito (aunque no compre).
// Con retardo (dejó de escribir) y se actualiza mientras llena el formulario.
useEffect(() => {
  const tel = datos.whatsapp.replace(/\D/g, '').replace(/^57/, '');
  if (!datos.nombre.trim() || !/^3\d{9}$/.test(tel)) return;   // celular colombiano
  const t = setTimeout(() => {
    fetch('/api/funnels/carrito', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({
        slug: funnel.slug,
        telefono: tel,
        nombre: `${datos.nombre} ${datos.apellidos}`.trim(),
        producto: variante?.nombre ?? funnel.producto,
        talla: elecciones.filter(Boolean).join(' / '),
        valor: variante?.precio ?? funnel.precio,
      }),
    }).catch(() => {});
  }, 1500);
  return () => clearTimeout(t);
}, [datos.nombre, datos.apellidos, datos.whatsapp, variante, elecciones, funnel.slug, funnel.producto, funnel.precio]);
```

## 5) Montar el panel en tu menú

```tsx
import CarritosAbandonados from '@/components/panel/CarritosAbandonados';
// ...
const [carritosOpen, setCarritosOpen] = useState(false);
<button onClick={() => setCarritosOpen(true)}>🛒 Carritos abandonados</button>
{carritosOpen && <CarritosAbandonados onClose={() => setCarritosOpen(false)} />}
```

---

## 6) Cron opcional — aviso automático al dueño

Crea `app/api/cron/carrito-recuperacion/route.ts`. Busca carritos de 15 min a 24 h no recuperados/no comprados/no avisados y le manda al dueño un enlace `wa.me` con el mensaje ya escrito para el cliente. Prográmalo cada 15–30 min apuntando a `/api/cron/carrito-recuperacion?secret=TU_CRON_SECRET`. Si no lo quieres, no copies este archivo — el panel funciona sin él.

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendTextMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Número que recibe el aviso para recuperar la venta.
const SOPORTE = '573187051499'; // cámbialo por tu número

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}`
      || req.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });

  const admin = createServerSupabaseClient();
  const ahora = Date.now();
  const hasta = new Date(ahora - 15 * 60_000).toISOString();
  const desde = new Date(ahora - 24 * 3600_000).toISOString();

  const { data: carritos, error } = await admin
    .from('carritos_abandonados')
    .select('id, slug, nombre, telefono, producto, talla')
    .eq('recuperado', false)
    .is('notificado_at', null)
    .gte('created_at', desde)
    .lte('created_at', hasta)
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let avisados = 0;
  for (const c of carritos ?? []) {
    const tel = String((c as any).telefono).replace(/\D/g, '').replace(/^57/, '');

    try {
      const { data: ped } = await admin.from('clientes_funnelish')
        .select('id').eq('telefono', tel).eq('confirmado', true).maybeSingle();
      if (ped) {
        await admin.from('carritos_abandonados').update({ notificado_at: new Date().toISOString() }).eq('id', (c as any).id);
        continue;
      }
    } catch { /* si falla, sigue */ }

    const nombre = String((c as any).nombre ?? '').split(' ')[0] || '';
    const producto = String((c as any).producto ?? 'tu pedido');
    const talla = (c as any).talla ? ` (${(c as any).talla})` : '';
    const msgCliente = `Hola ${nombre} 😊 Vimos que tu pedido de ${producto}${talla} quedó incompleto. ¿Deseas seguir con la compra por este chat? 🚚 Te ayudo a terminarlo en 1 minuto.`;
    const enlace = `https://wa.me/57${tel}?text=${encodeURIComponent(msgCliente)}`;
    const aviso =
      `🛒 *CARRITO ABANDONADO — recuperar venta*\n` +
      `Cliente: ${(c as any).nombre ?? '—'}\n` +
      `Teléfono: ${tel}\n` +
      `Producto: ${producto}${talla}\n\n` +
      `👉 Escríbele con un toque (ya lleva el mensaje listo):\n${enlace}`;

    try {
      await sendTextMessage(SOPORTE, aviso);
      await admin.from('carritos_abandonados').update({ notificado_at: new Date().toISOString() }).eq('id', (c as any).id);
      avisados++;
    } catch (e) {
      console.error('[Carrito] no se pudo avisar:', e);
    }
  }

  return NextResponse.json({ ok: true, revisados: carritos?.length ?? 0, avisados });
}
```

---

## 7) Verificar
Corre `npx tsc --noEmit` y despliega. Prueba: entra a un embudo, escribe nombre + un WhatsApp válido y NO completes la compra; en el panel → 🛒 Carritos abandonados debe aparecer ese cliente con botón de WhatsApp. Cuando de verdad compre (pedido confirmado), desaparece solo de la lista.
