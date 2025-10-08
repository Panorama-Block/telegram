import type { NextConfig } from "next";
import path from 'path';
import { config } from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env
config();

const nextConfig: NextConfig = {
  basePath: '/miniapp',
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
    ],
  },
  env: {
    VITE_GATEWAY_BASE: process.env.PUBLIC_GATEWAY_URL || '',
    VITE_SWAP_API_BASE: process.env.SWAP_API_BASE || '',
    VITE_AUTH_API_BASE: process.env.AUTH_API_BASE || '',
    VITE_THIRDWEB_CLIENT_ID: process.env.THIRDWEB_CLIENT_ID || '',
    VITE_EVM_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || '8453',
    VITE_AI_API_URL: process.env.AI_API_URL || '',
    VITE_AGENTS_API_BASE: process.env.AGENTS_API_BASE || '',
    AGENTS_API_BASE: process.env.AGENTS_API_BASE || '',
    AGENTS_RESPONSE_MESSAGE_PATH: process.env.AGENTS_RESPONSE_MESSAGE_PATH || '',
    AGENTS_DEBUG_SHAPE: process.env.AGENTS_DEBUG_SHAPE || 'false',
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
      process: require.resolve('process/browser'),
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      'thirdweb/dist/esm/react/web/wallets/shared/locale/getConnectLocale.js': path.resolve(
        __dirname,
        './src/shared/thirdweb/getConnectLocale.ts',
      ),
    };

    // Ignore problematic packages
    config.externals = config.externals || [];
    config.externals.push({
      'pino-pretty': 'pino-pretty',
    });

    // Optimize chunks to prevent build issues
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
    };

    return config;
  },
};

export default nextConfig;
