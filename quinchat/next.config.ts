import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Streaming responses for chat
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
