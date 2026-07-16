import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-4">
      {/* Logo / Marca */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black tracking-widest text-brand-gold mb-2">
          QUIN<span className="text-white">CHAT</span>
        </h1>
        <p className="text-gray-500 text-sm tracking-wider uppercase">
          Asistente de ventas · KLIXMANT
        </p>
      </div>

      {/* Cards de módulos */}
      <div className="grid gap-4 w-full max-w-sm">
        <Link
          href="/quinchat"
          className="
            group relative flex items-center gap-4
            bg-[#111111] border border-[#2A2A2A] rounded-2xl p-5
            hover:border-brand-gold hover:bg-[#141414]
            transition-all duration-200
          "
        >
          <div className="w-12 h-12 rounded-xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-2xl">
            💬
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">Chat con IA</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Asistente de ventas automatizado
            </p>
          </div>
          <span className="text-gray-700 group-hover:text-brand-gold transition-colors">→</span>
        </Link>

        {/* Futuro: más módulos */}
        <div className="flex items-center gap-4 bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl p-5 opacity-40 cursor-not-allowed">
          <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center text-2xl">
            📊
          </div>
          <div className="flex-1">
            <p className="text-gray-400 font-semibold text-sm">Estadísticas</p>
            <p className="text-gray-600 text-xs mt-0.5">Próximamente</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl p-5 opacity-40 cursor-not-allowed">
          <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center text-2xl">
            📱
          </div>
          <div className="flex-1">
            <p className="text-gray-400 font-semibold text-sm">WhatsApp Bot</p>
            <p className="text-gray-600 text-xs mt-0.5">Próximamente</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-12 text-gray-700 text-xs">
        Agencia Quin · KLIXMANT · {new Date().getFullYear()}
      </p>
    </main>
  );
}
