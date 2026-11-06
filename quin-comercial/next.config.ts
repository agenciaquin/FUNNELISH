import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Librerías de lectura de documentos: se cargan en runtime (no se empaquetan),
  // así pdf-parse no entra en su modo debug ni rompe el bundle.
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    }];
  },
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
    // `sharp` (compresión de fotos) necesita también `libvips`, que en Linux va en
    // un paquete aparte de `@img/` y el rastreo de Next no lo sigue. Sin esto:
    // ERR_DLOPEN_FAILED en producción (pasó en quinchat el 31-08-2026).
    '/api/**': ['./fonts/**/*', './node_modules/@img/**/*'],
  },
};

export default nextConfig;
