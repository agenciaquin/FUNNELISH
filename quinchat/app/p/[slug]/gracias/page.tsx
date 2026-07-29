import { notFound } from 'next/navigation';
import { obtenerFunnel } from '@/lib/funnels';
import ResumenGracias from '@/components/publico/ResumenGracias';
import { numeroDelBot } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Pedido recibido — Klixmant' };

export default async function PaginaGracias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await obtenerFunnel(slug);
  if (!f) notFound();

  // Siempre el número del bot: nunca uno escrito a mano en el embudo
  const whatsappBot = await numeroDelBot();

  return (
    <main className="min-h-screen bg-white max-w-lg mx-auto px-5 py-8 text-center">
      <div className="text-5xl mb-3">✅</div>

      <h1 className="text-2xl font-extrabold text-[#0D8A3E] mb-3">
        ¡GRACIAS POR TU COMPRA!
      </h1>

      <p className="text-[15px] text-[#0D0D0D] leading-relaxed mb-5">
        Tu pedido quedó registrado. <strong>Te escribiremos por WhatsApp</strong> para
        confirmar tus datos y enviarte la guía de transporte.
      </p>

      {/* Resumen de lo comprado + botón para escribirle al bot */}
      <ResumenGracias whatsapp={whatsappBot} />

      <div className="bg-[#FFF3CD] rounded-xl px-4 py-3 mb-4">
        <p className="font-extrabold text-[#C1121F] text-lg mb-1">INFORMACIÓN IMPORTANTE</p>
        <p className="text-[13px] leading-snug">
          Revisa tu WhatsApp en los próximos minutos y <strong>confirma tu pedido</strong> para
          que podamos despacharlo. 👆
        </p>
      </div>

      <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
        El envío se realiza en <strong>3 a 6 días hábiles</strong>.<br />
        Pagas cuando recibes tu pedido. 🚚
      </p>

      <p className="text-[11px] text-[#9A9A9A] mt-8">
        Klixmant SAS · Pago contra entrega en toda Colombia
      </p>
    </main>
  );
}
