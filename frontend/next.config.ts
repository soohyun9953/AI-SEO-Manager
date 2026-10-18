import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: process.env.LOCAL_BACKEND === 'false'
            ? 'https://ai-seo-manager-u3w9.vercel.app/api/:path*'
            : 'http://127.0.0.1:8002/api/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
