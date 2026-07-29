import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Streaming responses for chat
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  // Incluir en el bundle de Vercel las fuentes de Jimp (carpeta /fonts del repo).
  // Si no, la marca de agua del catálogo falla en producción (ENOENT .fnt).
  outputFileTracingIncludes: {
    '/api/catalogos/re-estampar': ['./fonts/**/*'],
    '/api/catalogos/[id]/colores': ['./fonts/**/*'],
    '/api/catalogos/colores/[id]': ['./fonts/**/*'],
    '/api/**': ['./fonts/**/*'],
  },
};

export default nextConfig;
