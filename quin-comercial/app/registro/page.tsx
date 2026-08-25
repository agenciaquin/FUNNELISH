'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre]     = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      const r = await fetch('/api/registro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, email, password }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'No se pudo crear la cuenta.'); setLoading(false); return; }
      // Entra automáticamente
      const res = await signIn('credentials', { email, password, redirect: false });
      setLoading(false);
      if (res?.ok) { router.push('/panel'); router.refresh(); }
      else { router.push('/login'); }
    } catch { setError('Error de conexión.'); setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <Image src="/logo-agencia-quin.png" alt="Agencia Quin" width={180} height={72} className="object-contain mx-auto mb-3" priority />
        <p className="text-[#6B6B6B] text-xs tracking-wider uppercase font-medium">Crea tu cuenta</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-[#E8E8E8] rounded-2xl p-8 flex flex-col gap-5 shadow-sm">
        <h2 className="text-[#0D0D0D] font-semibold text-base mb-1">Registrarme</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider font-medium">Nombre de tu negocio</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Buzos La 33" required autoComplete="organization"
            className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm text-[#0D0D0D] placeholder-[#6B6B6B]/40 focus:outline-none focus:border-[#00A89D] transition-colors" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider font-medium">Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required autoComplete="email"
            className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm text-[#0D0D0D] placeholder-[#6B6B6B]/40 focus:outline-none focus:border-[#00A89D] transition-colors" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider font-medium">Contraseña (mín. 8)</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password"
            className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm text-[#0D0D0D] placeholder-[#6B6B6B]/40 focus:outline-none focus:border-[#00A89D] transition-colors" />
        </div>

        {error && <p className="text-red-500 text-xs text-center bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={loading || !nombre || !email || password.length < 8}
          className="w-full bg-[#00A89D] text-white font-bold text-sm py-3 rounded-xl hover:bg-[#007A72] disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-1">
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        <p className="text-center text-xs text-[#6B6B6B]">¿Ya tienes cuenta? <Link href="/login" className="text-[#00A89D] font-semibold">Inicia sesión</Link></p>
      </form>

      <p className="mt-8 text-[#6B6B6B] text-xs">Agencia Quin · {new Date().getFullYear()}</p>
    </main>
  );
}
