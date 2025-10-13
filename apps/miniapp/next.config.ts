import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
loadEnv();

const nextConfig: NextConfig = {
  // Seu app vive sob /miniapp
  basePath: "/miniapp",

  // Redirects: mudam a URL no navegador
  async redirects() {
    return [
      // 1) raiz do domínio -> /miniapp (sem duplicar o basePath)
      { source: "/", destination: "/miniapp", permanent: true, basePath: false },

      // OPCIONAL: se quiser que /auth mostre /miniapp/auth na URL
      // { source: "/auth", destination: "/miniapp/auth", permanent: true, basePath: false },
      // { source: "/chat", destination: "/miniapp/chat", permanent: true, basePath: false },
      // { source: "/swap", destination: "/miniapp/swap", permanent: true, basePath: false },
      // { source: "/newchat", destination: "/miniapp/newchat", permanent: true, basePath: false },
    ];
  },

  // Rewrites: mantêm URL curta, servindo do /miniapp por trás
  async rewrites() {
    return [
      { source: "/auth", destination: "/miniapp/auth", basePath: false },
      { source: "/auth/:path*", destination: "/miniapp/auth/:path*", basePath: false },
      { source: "/chat", destination: "/miniapp/chat", basePath: false },
      { source: "/swap", destination: "/miniapp/swap", basePath: false },
      { source: "/swap/:path*", destination: "/miniapp/swap/:path*", basePath: false },
      { source: "/newchat", destination: "/miniapp/newchat", basePath: false },
      { source: "/api/tonconnect-manifest", destination: "/miniapp/api/tonconnect-manifest", basePath: false },
    ];
  },

  images: {
    remotePatterns: [{ protocol: "https", hostname: "assets.coingecko.com", pathname: "/coins/images/**" }],
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
