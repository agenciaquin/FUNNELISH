'use client';

import { useState, useEffect } from 'react';

/** Titular que va cambiando entre varias frases, para que la página no se vea quieta. */
export default function FrasesRotativas({
  frases, segundos = 5,
}: { frases: string[]; segundos?: number }) {
  const [i, setI] = useState(0);
  const [entrando, setEntrando] = useState(true);

  useEffect(() => {
    if (frases.length < 2) return;
    const t = setInterval(() => {
      setEntrando(false);                       // se desvanece
      setTimeout(() => {
        setI(prev => (prev + 1) % frases.length);
        setEntrando(true);                      // entra la siguiente
      }, 320);
    }, segundos * 1000);
    return () => clearInterval(t);
  }, [frases.length, segundos]);

  if (frases.length === 0) return null;

  return (
    <div className="bg-[#FFF3CD] py-2 px-3 overflow-hidden">
      <h1
        className={`text-center font-extrabold text-[17px] text-[#0D0D0D] transition-all duration-300 ${
          entrando ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        {frases[i]}
      </h1>
    </div>
  );
}
