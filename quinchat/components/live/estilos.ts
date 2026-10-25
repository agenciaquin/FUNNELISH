// Animaciones de QUIN LIVE SHOPPING (se inyectan en LiveShell, no tocan globals.css).
export const ESTILOS_LIVE = `
@keyframes live-float { 0%{opacity:0;transform:translate(0,0) scale(.5) rotate(-6deg)} 10%{opacity:1} 45%{transform:translate(calc(var(--dx) * .5),-170px) scale(1.15) rotate(6deg)} 100%{opacity:0;transform:translate(var(--dx),-340px) scale(1.3) rotate(-4deg)} }
/* Corazones: suben despacio (live-rise) y se balancean a los lados (live-sway). */
@keyframes live-rise { 0%{opacity:0;transform:translateY(0) scale(.4)} 12%{opacity:1;transform:translateY(-20px) scale(1)} 70%{opacity:.85} 100%{opacity:0;transform:translateY(var(--sube)) scale(1.08)} }
@keyframes live-sway { from{transform:translateX(calc(var(--sw) * -1))} to{transform:translateX(var(--sw))} }
@keyframes live-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
@keyframes live-sheet { from{transform:translateY(100%)} to{transform:none} }
@keyframes live-pop { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:none} }
/* Botón COMPRAR AHORA: brillo que recorre + latido suave para llamar la atención. */
@keyframes live-cta-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.035)} }
@keyframes live-cta-shine { 0%{left:-60%} 60%,100%{left:140%} }
.live-cta{position:relative;overflow:hidden;animation:live-cta-pulse 1.9s ease-in-out infinite}
.live-cta::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);animation:live-cta-shine 2.6s ease-in-out infinite}
.live-in{animation:live-in .35s ease-out both}
.live-pop{animation:live-pop .3s ease-out both}
.live-sheet{animation:live-sheet .3s ease-out both}
.live-fade-up{-webkit-mask-image:linear-gradient(to top,#000 55%,transparent);mask-image:linear-gradient(to top,#000 55%,transparent)}
@media (prefers-reduced-motion: reduce){.live-in,.live-pop,.live-sheet,.live-cta{animation:none}.live-cta::after{display:none}}
`;
