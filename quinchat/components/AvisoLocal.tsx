'use client';

import { useEffect, useState } from 'react';
import { ESCRITURA_LOCAL_ABIERTA, esHostLocal } from '@/lib/freno-local';

/** Aviso fijo en localhost: dice si lo que se hace aquí llega a la base real o no. */
export default function AvisoLocal({ servidorFrenado }: { servidorFrenado: boolean }) {
  const [local, setLocal] = useState(false);
  useEffect(() => setLocal(esHostLocal(window.location.host)), []);
  if (!local) return null;

  const protegido = !ESCRITURA_LOCAL_ABIERTA && servidorFrenado;
  const texto = protegido
    ? 'LOCAL · PROTEGIDO — se leen datos reales, pero nada se guarda'
    : ESCRITURA_LOCAL_ABIERTA
      ? 'LOCAL · ESCRITURA ABIERTA — todo lo que hagas se guarda en la base REAL'
      : 'LOCAL · SERVIDOR SIN FRENO — falta QUINCHAT_LOCAL=1 en .env.local';

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2147483647, pointerEvents: 'none',
        padding: '4px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#fff',
        background: protegido ? '#00847A' : '#C62828',
      }}
    >
      {texto}
    </div>
  );
}
