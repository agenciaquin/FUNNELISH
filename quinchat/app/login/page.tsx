'use client';

import Image from 'next/image';
import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.ok) {
      router.push('/panel');
      router.refresh();
    } else {
      setError('Correo o contraseña incorrectos.');
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center px-4">

      {/* Logo Agencia Quin */}
      <div className="text-center mb-8">
        <Image
          src="/logo-agencia-quin.png"
          alt="Agencia Quin"
          width={180}
          height={72}
          className="object-contain mx-auto mb-3"
          priority
        />
        <p className="text-[#6B6B6B] text-xs tracking-wider uppercase font-medium">
          Panel de acceso
        </p>
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-[#E8E8E8] rounded-2xl p-8 flex flex-col gap-5 shadow-sm"
      >
        <h2 className="text-[#0D0D0D] font-semibold text-base mb-1">Iniciar sesión</h2>

        {/* Correo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider font-medium">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            required
            autoComplete="email"
            className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm text-[#0D0D0D] placeholder-[#6B6B6B]/40 focus:outline-none focus:border-[#00A89D] transition-colors"
          />
        </div>

        {/* Contraseña */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[#6B6B6B] uppercase tracking-wider font-medium">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="bg-[#FAF9F6] border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm text-[#0D0D0D] placeholder-[#6B6B6B]/40 focus:outline-none focus:border-[#00A89D] transition-colors"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-xs text-center bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Botón */}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full bg-[#00A89D] text-white font-bold text-sm py-3 rounded-xl hover:bg-[#007A72] active:bg-[#007A72] disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-1"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="mt-8 text-[#6B6B6B] text-xs">Agencia Quin · {new Date().getFullYear()}</p>
    </main>
  );
}
