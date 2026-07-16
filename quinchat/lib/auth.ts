// =====================================================
// QUINCHAT — Configuración de NextAuth
// Usuarios definidos con contraseñas en variables de entorno
// =====================================================

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const USERS = [
  {
    id: '1',
    name: 'Agencia Quin',
    username: 'agencia-quin',
    passwordEnv: 'USER_AGENCIA_QUIN_PASSWORD',
  },
  {
    id: '2',
    name: 'Gerencia',
    username: 'gerencia',
    passwordEnv: 'USER_GERENCIA_PASSWORD',
  },
  {
    id: '3',
    name: 'Genérico Quin',
    username: 'generico-quin',
    passwordEnv: 'USER_GENERICO_QUIN_PASSWORD',
  },
];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = USERS.find(
          (u) => u.username === credentials.username.toLowerCase().trim()
        );
        if (!user) return null;

        const expectedPassword = process.env[user.passwordEnv];
        if (!expectedPassword) {
          console.error(`[AUTH] Contraseña no configurada para ${user.username}`);
          return null;
        }

        if (credentials.password !== expectedPassword) return null;

        return { id: user.id, name: user.name };
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
      if (user) token.name = user.name;
      return token;
    },
    async session({ session, token }) {
      if (token?.name) session.user = { name: token.name as string };
      return session;
    },
  },
};
