import { sendTextMessage, sendImageByUrl } from '@/lib/whatsapp';
import { lineaTalla } from '@/lib/formato-pedido';

// Números a los que llega el registro de cada venta (se envía a todos al tiempo).
export const ADMINS_VENTAS = ['573167648391', '573187051499'];

/** Desglose del cobro cuando el cliente abonó (oficina / zona sin contra entrega). */
export function lineasDeCobro(pedido: any): string {
  const abono = Number(pedido?.abono ?? 0);
  const valorNum = Number(String(pedido?.valor ?? '').replace(/[^\d]/g, '')) || 0;
  if (!abono || !valorNum) return `Valor: ${pedido?.valor ?? '—'}`;

  const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`;
  const recibido = pedido?.abono_recibido === true;
  return (
    `Total: ${pesos(valorNum)}\n` +
    `Abono: ${pesos(abono)} ${recibido ? '✅ recibido' : '⏳ pendiente'}\n` +
    `*COBRAR: ${pesos(valorNum - abono)}*`
  );
}

/** Envío REAL de la ficha (lo llama el cron tras el período de gracia). */
export async function mandarFichaVenta(supabase: any, pedido: any, tel10: string, from: string) {
  if (!pedido) return;
  const registro =
    `📊 *VENTA CONFIRMADA — FUNNEL*\n` +
    `Nombre: ${pedido.nombre ?? '—'}\n` +
    `Teléfono: ${pedido.telefono ?? tel10}\n` +
    `Dirección: ${pedido.direccion ?? '—'}\n` +
    `Ciudad: ${pedido.ciudad ?? '—'}\n` +
    `Departamento: ${pedido.departamento ?? '—'}\n` +
    `Correo: ${pedido.correo ?? '—'}\n` +
    `${lineaTalla(pedido.talla)}\n` +
    `Producto: ${pedido.producto ?? '—'}\n` +
    lineasDeCobro(pedido);

  // Foto del PRODUCTO. FUENTE PRINCIPAL: la foto pegada al pedido (`foto_producto`),
  // que se actualiza junto con el nombre del producto cada vez que cambia el color.
  // Así la ficha SIEMPRE coincide con el "Producto" del pedido y nunca sale el color
  // viejo ni la foto de otra prenda. Solo si el pedido no tiene foto se cae al
  // método anterior (la última imagen que el bot envió en el chat).
  let urls: string[] = [];
  const fotoPedido = String(pedido.foto_producto ?? '').trim();
  if (fotoPedido.startsWith('http')) {
    urls = [fotoPedido];
  } else {
    try {
      const { data: imgs } = await supabase
        .from('messages').select('content, created_at')
        .eq('conversation_id', from).eq('type', 'image').eq('role', 'assistant')
        .order('created_at', { ascending: false }).limit(8);
      const lista = (imgs ?? []).filter((m: any) => typeof m.content === 'string' && m.content.startsWith('http'));
      if (lista.length > 0) {
        // El envío más reciente y todo lo mandado en los 2 minutos anteriores (misma tanda)
        const tope = new Date(lista[0].created_at).getTime();
        const mismaTanda = lista.filter((m: any) => tope - new Date(m.created_at).getTime() <= 120_000);
        urls = ([...new Set(mismaTanda.map((m: any) => m.content))] as string[]).slice(0, 2);
      }
    } catch { /* ignorar */ }
  }

  // Se envía a TODOS los números de registro de ventas al tiempo.
  for (const admin of ADMINS_VENTAS) {
    if (urls.length > 0) {
      // Foto + texto JUNTOS: el registro va como pie (caption) de la primera imagen
      try { await sendImageByUrl(admin, urls[0], registro); } catch { /* ignorar */ }
      for (const u of urls.slice(1)) {
        try { await sendImageByUrl(admin, u, ''); } catch { /* ignorar */ }
      }
    } else {
      try { await sendTextMessage(admin, registro); } catch { /* ignorar */ }
    }
  }
}
