'use client';

/**
 * Spider-Man colgando de un hilo de telaraña justo debajo del botón de compra,
 * como si lo estuviera sujetando. Se balancea suavemente. Solo se usa en el
 * embudo con temática Spider-Man. Es decorativo: no bloquea clics.
 */
export default function SpidermanJala() {
  return (
    <div className="spidey-jala" aria-hidden="true">
      <style>{`
        .spidey-jala{position:relative;display:flex;justify-content:center;
          margin:-2px 0 6px;pointer-events:none;user-select:none;overflow:hidden;padding-top:8px;}
        .spidey-jala-péndulo{position:relative;transform-origin:top center;
          animation:spideyColumpio 4.5s ease-in-out infinite;display:flex;flex-direction:column;align-items:center;}
        .spidey-jala-hilo{width:2px;height:26px;background:#111827;opacity:.55;}
        .spidey-jala-img{width:150px;height:auto;margin-top:-4px;
          filter:drop-shadow(0 6px 8px rgba(0,0,0,.35));
          animation:spideyFlota 3s ease-in-out infinite;}
        @keyframes spideyColumpio{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
        @keyframes spideyFlota{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
      `}</style>
      <div className="spidey-jala-péndulo">
        <div className="spidey-jala-hilo" />
        <img src="/spiderman-jala.png" alt="" className="spidey-jala-img" />
      </div>
    </div>
  );
}
