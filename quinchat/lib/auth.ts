// =====================================================
// QUINCHAT — Configuración de NextAuth
// Login con correo electrónico + contraseña
// =====================================================

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SignJWT } from 'jose';

/**
 * Firma un JWT que Supabase reconoce como usuario 'authenticated'. Va firmado con
 * el JWT SECRET del proyecto de Supabase (variable SUPABASE_JWT_SECRET). Con esto,
 * el navegador entra a Supabase como 'authenticated' en vez de 'anon', para poder
 * activar RLS sin romper el panel. Si no está el secreto, devuelve null (y el
 * navegador sigue como antes — no rompe nada mientras RLS esté apagado).
 */
async function firmarTokenSupabase(userId: string, email: string): Promise<string | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  try {
    return await new SignJWT({ role: 'authenticated', email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(new TextEncoder().encode(secret));
  } catch (e) {
    console.error('[AUTH] no se pudo firmar el token de Supabase:', e);
    return null;
  }
}

const USERS = [
  {
    id: '1',
    name: 'Agencia Quin',
    email: 'agenciaquin43@gmail.com',
    passwordEnv: 'USER_AGENCIA_QUIN_PASSWORD',
  },
  {
    id: '2',
    name: 'Gerencia',
    email: 'gerenciaquin7@gmail.com',
    passwordEnv: 'USER_GERENCIA_PASSWORD',
  },
];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email:    { label: 'Correo',     type: 'email'    },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = USERS.find(
          u => u.email === credentials.email.toLowerCase().trim()
        );
        if (!user) return null;

        const expectedPassword = process.env[user.passwordEnv];
        if (!expectedPassword) {
          console.error(`[AUTH] Contraseña no configurada para ${user.email}`);
          return null;
        }

        if (credentials.password !== expectedPassword) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.name = user.name; token.email = user.email; (token as any).uid = user.id; }
      // Genera/renueva el token de Supabase (dura 8h; se re-firma cuando le falta <1h).
      const ahora = Math.floor(Date.now() / 1000);
      const exp = (token as any).sbExp as number | undefined;
      if (!(token as any).sbToken || !exp || exp - ahora < 3600) {
        const uid = String((token as any).uid ?? token.sub ?? '1');
        const t = await firmarTokenSupabase(uid, String(token.email ?? ''));
        if (t) { (token as any).sbToken = t; (token as any).sbExp = ahora + 8 * 3600; }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.name) session.user = { name: token.name as string, email: token.email as string };
      // El navegador usará este token para entrar a Supabase como 'authenticated'.
      (session as any).supabaseAccessToken = (token as any).sbToken ?? null;
      return session;
    },
  },
};
