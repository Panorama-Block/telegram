// apps/miniapp/next.config.ts
import type { NextConfig } from "next";
// opcional: Next já carrega .env; pode remover se quiser.
import { config } from "dotenv";
config();

const nextConfig: NextConfig = {
  // seu app vive sob /miniapp
  basePath: "/miniapp",

  // REDIRECTS (mudam a URL no browser)
  async redirects() {
    return [
      // raiz -> /miniapp (permanente)
      { source: "/", destination: "/miniapp", permanent: true },
      // se quiser que /auth mostre /miniapp/auth na URL, troque os rewrites abaixo por redirects:
      // { source: "/auth", destination: "/miniapp/auth", permanent: true },
      // { source: "/auth/:path*", destination: "/miniapp/auth/:path*", permanent: true },
      // { source: "/chat", destination: "/miniapp/chat", permanent: true },
      // { source: "/swap", destination: "/miniapp/swap", permanent: true },
      // { source: "/swap/:path*", destination: "/miniapp/swap/:path*", permanent: true },
      // { source: "/newchat", destination: "/miniapp/newchat", permanent: true },
      // { source: "/api/tonconnect-manifest", destination: "/miniapp/api/tonconnect-manifest", permanent: true },
    ];
  },

  // REWRITES (mantêm a URL curta; só “proxyam” para /miniapp)
  async rewrites() {
    return [
      { source: "/auth", destination: "/miniapp/auth" },
      { source: "/auth/:path*", destination: "/miniapp/auth/:path*" },
      { source: "/chat", destination: "/miniapp/chat" },
      { source: "/swap", destination: "/miniapp/swap" },
      { source: "/swap/:path*", destination: "/miniapp/swap/:path*" },
      { source: "/newchat", destination: "/miniapp/newchat" },
      { source: "/api/tonconnect-manifest", destination: "/miniapp/api/tonconnect-manifest" },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
        pathname: "/coins/images/**",
      },
    ],
  },

  // OBS: variáveis no cliente em Next devem começar com NEXT_PUBLIC_
  env: {
    VITE_GATEWAY_BASE: process.env.PUBLIC_GATEWAY_URL || "",
    VITE_SWAP_API_BASE: process.env.SWAP_API_BASE || "",
    VITE_AUTH_API_BASE: process.env.AUTH_API_BASE || "",
    VITE_THIRDWEB_CLIENT_ID: process.env.THIRDWEB_CLIENT_ID || "",
    VITE_EVM_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || "8453",
    VITE_AI_API_URL: process.env.AI_API_URL || "",
    VITE_AGENTS_API_BASE: process.env.AGENTS_API_BASE || "",
    VITE_TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME || "",
    AGENTS_API_BASE: process.env.AGENTS_API_BASE || "",
    AGENTS_RESPONSE_MESSAGE_PATH: process.env.AGENTS_RESPONSE_MESSAGE_PATH || "",
    AGENTS_DEBUG_SHAPE: process.env.AGENTS_DEBUG_SHAPE || "false",
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve("buffer/"),
    };
    return config;
  },
};

export default nextConfig;
