import type { NextConfig } from "next";
import { config } from 'dotenv';

// Carregar variáveis de ambiente do arquivo .env
config();

const nextConfig: NextConfig = {
  basePath: '/miniapp',
  env: {
    VITE_GATEWAY_BASE: process.env.PUBLIC_GATEWAY_URL || '',
    VITE_SWAP_API_BASE: process.env.SWAP_API_BASE || '',
    VITE_THIRDWEB_CLIENT_ID: process.env.THIRDWEB_CLIENT_ID || '',
    VITE_EVM_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || '8453',
    VITE_AI_API_URL: process.env.AI_API_URL || '',
    VITE_AGENTS_API_BASE: process.env.AGENTS_API_BASE || '',
    AGENTS_RESPONSE_MESSAGE_PATH: process.env.AGENTS_RESPONSE_MESSAGE_PATH || '',
    AGENTS_DEBUG_SHAPE: process.env.AGENTS_DEBUG_SHAPE || 'false',
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve('buffer/'),
    };
    return config;
  },
};

export default nextConfig;
