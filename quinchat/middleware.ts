import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

// Protege todas las rutas excepto /login, NextAuth y el webhook de WhatsApp
// (el webhook lo llama Meta directamente — no tiene sesión)
export const config = {
  matcher: [
    '/((?!login|api/auth|api/whatsapp/webhook|api/whatsapp/confirmar|api/funnelish/webhook|_next/static|_next/image|favicon.ico).*)',
  ],
};
