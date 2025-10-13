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

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.coingecko.com", pathname: "/coins/images/**" },
    ],
  },

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
    config.resolve.fallback = { ...config.resolve.fallback, buffer: require.resolve("buffer/") };
    return config;
  },
};

export default nextConfig;
