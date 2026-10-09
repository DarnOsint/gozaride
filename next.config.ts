import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    appDir: true,
    turboAuth: true,
  },
  images: {
    domains: ['localhost', '127.0.0.1'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.canvas = false;
      config.resolve.alias['react-dom/lib/ReactCurrentDispatcher'] = false;
      config.resolve.alias['scheduler/tracing'] = false;
    }
    return config;
  },
};

export default nextConfig;