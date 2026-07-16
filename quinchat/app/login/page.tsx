'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const USERS = [
  { value: 'agencia-quin', label: 'Agencia Quin' },
  { value: 'gerencia',     label: 'Gerencia' },
  { value: 'generico-quin', label: 'Genérico Quin' },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('agencia-quin');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Usuario o contraseña incorrectos.');
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-widest text-brand-gold mb-1">
          QUIN<span className="text-white">CHAT</span>
        </h1>
        <p className="text-gray-600 text-xs tracking-wider uppercase">
          Agencia Quin · Panel de acceso
        </p>
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#111111] border border-[#2A2A2A] rounded-2xl p-8 flex flex-col gap-5"
      >
        <h2 className="text-white font-semibold text-base mb-1">Iniciar sesión</h2>

        {/* Usuario */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500 uppercase tracking-wider">Usuario</label>
          <select
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="
              bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3
              text-sm text-white focus:outline-none focus:border-brand-gold
              transition-colors appearance-none cursor-pointer
            "
          >
            {USERS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Contraseña */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500 uppercase tracking-wider">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="
              bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3
              text-sm text-white placeholder-gray-700
              focus:outline-none focus:border-brand-gold transition-colors
            "
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs text-center bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Botón */}
        <button
          type="submit"
          disabled={loading || !password}
          className="
            w-full bg-brand-gold text-brand-black font-bold text-sm py-3 rounded-xl
            hover:bg-brand-gold-light active:bg-brand-gold-dark
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors mt-1
          "
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <p className="mt-8 text-gray-700 text-xs">KLIXMANT · {new Date().getFullYear()}</p>
    </main>
  );
}
