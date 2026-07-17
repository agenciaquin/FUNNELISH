// =====================================================
// QUINCHAT — Configuración de NextAuth
// Login con correo electrónico + contraseña
// =====================================================

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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
      if (user) { token.name = user.name; token.email = user.email; }
      return token;
    },
    async session({ session, token }) {
      if (token?.name) session.user = { name: token.name as string, email: token.email as string };
      return session;
    },
  },
};
