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
    // `sharp` necesita DOS piezas: el binario `.node` y la libreria `libvips`
    // que este carga. En Windows libvips va dentro del propio `.node`; en Linux
    // va en un paquete aparte, y el rastreo de Next no la sigue. Sin esto la
    // subida revienta en produccion con:
    //
    //   ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.6: cannot open shared object file
    //
    // Comprobado el 31-08-2026 en produccion, con la ruta de catalogos.
    // Se incluye todo `@img/` porque en la maquina de compilacion solo esta
    // instalada la variante de su plataforma.
    '/api/**': ['./fonts/**/*', './node_modules/@img/**/*'],
  },
};

export default nextConfig;
