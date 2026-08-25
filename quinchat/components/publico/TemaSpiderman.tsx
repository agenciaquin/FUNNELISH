'use client';

/**
 * Temática Spider-Man para UN embudo específico (se renderiza solo si el slug lo
 * pide). Es una capa decorativa: telarañas en las esquinas, arañas colgando de
 * su hilo y arañas caminando por la pantalla. No bloquea los clics del botón
 * (pointer-events: none). No afecta a ningún otro embudo.
 */

function Telarana({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g stroke="#111827" strokeWidth="1" fill="none" opacity="0.55">
        <line x1="0" y1="0" x2="100" y2="0" />
        <line x1="0" y1="0" x2="100" y2="38" />
        <line x1="0" y1="0" x2="72" y2="72" />
        <line x1="0" y1="0" x2="38" y2="100" />
        <line x1="0" y1="0" x2="0" y2="100" />
        <path d="M22 0 Q16 16 0 22" />
        <path d="M46 0 Q33 33 0 46" />
        <path d="M70 0 Q50 50 0 70" />
        <path d="M94 0 Q66 66 0 94" />
      </g>
    </svg>
  );
}

export default function TemaSpiderman() {
  return (
    <div className="spidey-capa" aria-hidden="true">
      <style>{`
        .spidey-capa{position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden;
          display:flex;justify-content:center;}
        .spidey-inner{position:relative;width:100%;max-width:32rem;height:100%;}
        .spidey-web{position:absolute;top:0;width:96px;height:96px;}
        .spidey-web.izq{left:0;}
        .spidey-web.der{right:0;transform:scaleX(-1);}
        /* Araña colgando de un hilo, sube y baja */
        .spidey-cuelga{position:absolute;top:0;display:flex;flex-direction:column;
          align-items:center;transform-origin:top center;animation:spideyDangle 4s ease-in-out infinite;}
        .spidey-hilo{width:1.5px;background:#111827;opacity:.5;}
        .spidey-bicho{font-size:26px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4));
          animation:spideyPatas .5s ease-in-out infinite alternate;}
        @keyframes spideyDangle{0%,100%{transform:translateY(0)}50%{transform:translateY(26px)}}
        @keyframes spideyPatas{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}
        /* Araña caminando de lado a lado */
        .spidey-camina{position:absolute;font-size:24px;line-height:1;
          filter:drop-shadow(0 1px 1px rgba(0,0,0,.4));}
        .spidey-camina.a{top:46%;animation:spideyCruza1 11s linear infinite;}
        .spidey-camina.b{top:72%;animation:spideyCruza2 14s linear infinite;}
        @keyframes spideyCruza1{
          0%{left:-30px;transform:scaleX(1) rotate(0)}
          49%{transform:scaleX(1) rotate(6deg)}
          50%{left:calc(100% + 10px);transform:scaleX(-1) rotate(0)}
          99%{transform:scaleX(-1) rotate(6deg)}
          100%{left:-30px;transform:scaleX(1) rotate(0)}}
        @keyframes spideyCruza2{
          0%{left:calc(100% + 10px);transform:scaleX(-1)}
          50%{left:-30px;transform:scaleX(1)}
          100%{left:calc(100% + 10px);transform:scaleX(-1)}}
      `}</style>
      <div className="spidey-inner">
        <Telarana className="spidey-web izq" />
        <Telarana className="spidey-web der" />

        {/* Arañas colgando de su hilo */}
        <div className="spidey-cuelga" style={{ left: '18%', animationDelay: '0s' }}>
          <div className="spidey-hilo" style={{ height: 70 }} />
          <span className="spidey-bicho">🕷️</span>
        </div>
        <div className="spidey-cuelga" style={{ left: '76%', animationDelay: '1.3s' }}>
          <div className="spidey-hilo" style={{ height: 110 }} />
          <span className="spidey-bicho">🕷️</span>
        </div>
        <div className="spidey-cuelga" style={{ left: '50%', animationDelay: '2.1s' }}>
          <div className="spidey-hilo" style={{ height: 40 }} />
          <span className="spidey-bicho">🕷️</span>
        </div>

        {/* Arañas caminando por la pantalla */}
        <span className="spidey-camina a">🕷️</span>
        <span className="spidey-camina b">🕷️</span>
      </div>
    </div>
  );
}
