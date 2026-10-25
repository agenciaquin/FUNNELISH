// Animaciones de QUIN LIVE SHOPPING (se inyectan en LiveShell, no tocan globals.css).
export const ESTILOS_LIVE = `
@keyframes live-float { 0%{opacity:0;transform:translate(0,0) scale(.6)} 12%{opacity:1} 100%{opacity:0;transform:translate(var(--dx),-230px) scale(1.25)} }
@keyframes live-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
@keyframes live-sheet { from{transform:translateY(100%)} to{transform:none} }
@keyframes live-pop { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:none} }
.live-in{animation:live-in .35s ease-out both}
.live-pop{animation:live-pop .3s ease-out both}
.live-sheet{animation:live-sheet .3s ease-out both}
.live-fade-up{-webkit-mask-image:linear-gradient(to top,#000 55%,transparent);mask-image:linear-gradient(to top,#000 55%,transparent)}
@media (prefers-reduced-motion: reduce){.live-in,.live-pop,.live-sheet{animation:none}}
`;
