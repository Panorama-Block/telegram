import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
loadEnv();

const nextConfig: NextConfig = {
  // o app vive sob /miniapp
  basePath: "/miniapp",

  async redirects() {
    return [
      // Raiz do domínio -> /miniapp (sem duplicar basePath)
      { source: "/", destination: "/miniapp", permanent: true, basePath: false },

      // (OPCIONAL) Rotas curtas -> /miniapp/...
      { source: "/auth", destination: "/miniapp/auth", permanent: true, basePath: false },
      { source: "/auth/:path*", destination: "/miniapp/auth/:path*", permanent: true, basePath: false },
      { source: "/chat", destination: "/miniapp/chat", permanent: true, basePath: false },
      { source: "/swap", destination: "/miniapp/swap", permanent: true, basePath: false },
      { source: "/swap/:path*", destination: "/miniapp/swap/:path*", permanent: true, basePath: false },
      { source: "/newchat", destination: "/miniapp/newchat", permanent: true, basePath: false },
      { source: "/api/tonconnect-manifest", destination: "/miniapp/api/tonconnect-manifest", permanent: true, basePath: false },
    ];
  },

  async rewrites() {
    // Sempre use a variável de ambiente VITE_LENDING_API_BASE
    // Se não estiver definida, tenta usar o gateway
    const lendingBase = process.env.VITE_LENDING_API_BASE ||
                       (process.env.PUBLIC_GATEWAY_URL ? `${process.env.PUBLIC_GATEWAY_URL.replace(/\/+$/, '')}/lending` : '');

    if (!lendingBase) {
      console.warn('[Next.js] Lending API base URL not configured, proxy will not work');
      console.warn('[Next.js] Please set VITE_LENDING_API_BASE or PUBLIC_GATEWAY_URL in .env');
      return [];
    }

    console.log('[Next.js] Lending API proxy configured:', lendingBase);

    return [
      // Proxy lending API to avoid CORS issues
      // Note: source is relative to basePath, so /api/lending maps to /miniapp/api/lending
      {
        source: "/api/lending/:path*",
        destination: `${lendingBase}/:path*`,
        basePath: false, // Important: bypass basePath for API routes
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.coingecko.com", pathname: "/coins/images/**" },
    ],
    unoptimized: true,
    minimumCacheTTL: 60,
  },

  env: {
    VITE_GATEWAY_BASE: process.env.PUBLIC_GATEWAY_URL || "",
    VITE_SWAP_API_BASE: process.env.SWAP_API_BASE || "",
    VITE_AUTH_API_BASE: process.env.AUTH_API_BASE || "",
    VITE_LENDING_API_BASE: process.env.VITE_LENDING_API_BASE || "",
    VITE_THIRDWEB_CLIENT_ID: process.env.THIRDWEB_CLIENT_ID || "",
    VITE_WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID || "",
    VITE_EVM_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || "8453",
    VITE_AI_API_URL: process.env.AI_API_URL || "",
    VITE_AGENTS_API_BASE: process.env.AGENTS_API_BASE || "",
    VITE_TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || "",
    AGENTS_API_BASE: process.env.AGENTS_API_BASE || "",
    AGENTS_RESPONSE_MESSAGE_PATH: process.env.AGENTS_RESPONSE_MESSAGE_PATH || "",
    AGENTS_DEBUG_SHAPE: process.env.AGENTS_DEBUG_SHAPE || "false",
  },

  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, buffer: require.resolve("buffer/") };
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
