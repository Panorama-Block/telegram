import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
loadEnv();

function normalizeDevServiceBase(raw: string | undefined, devFallback: string, isDev: boolean): string {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!isDev) return trimmed;
  if (!trimmed) return devFallback;

  const lower = trimmed.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return trimmed;

  // In local dev we run services in Docker and access them via host-mapped ports (localhost).
  // If someone accidentally configures docker-internal hostnames, the proxy will hang/timeout.
  const dockerInternalHosts = [
    "auth_service",
    "lido_service",
    "lending_service",
    "liquid_swap_service",
    "bridge_service",
    "engine_postgres",
    "engine",
    "redis",
  ];

  if (dockerInternalHosts.some((h) => lower.includes(h))) return devFallback;
  return trimmed;
}

function normalizeLendingDevBase(raw: string | undefined, isDev: boolean): string {
  const normalized = normalizeDevServiceBase(raw, "http://localhost:3007", isDev);
  if (!isDev) return normalized;

  const remapped = normalized.replace(
    /^((?:https?:\/\/)(?:localhost|127\.0\.0\.1)):3006(?=\/|$)/i,
    "$1:3007",
  );

  if (remapped !== normalized) {
    console.warn("[Next.js] Lending API URL points to localhost:3006 (container port). Remapping to host port 3007.");
  }

  return remapped;
}

const nextConfig: NextConfig = {
  // o app vive sob /miniapp
  basePath: "/miniapp",

  // Ignore ESLint warnings during production builds (Vercel)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Ignore TypeScript errors during production builds
  typescript: {
    ignoreBuildErrors: true,
  },

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
    const isDev = process.env.NODE_ENV !== "production";

    // Prefer host-mapped localhost ports during local dev (Docker service names are not reachable from the browser/Next proxy).
    const lendingBaseRaw = isDev
      ? (
          process.env.LENDING_SERVICE_URL ||
          process.env.VITE_LENDING_API_BASE ||
          process.env.NEXT_PUBLIC_LENDING_API_URL ||
          ""
        )
      : (
          process.env.LENDING_SERVICE_URL ||
          process.env.VITE_LENDING_API_BASE ||
          process.env.NEXT_PUBLIC_LENDING_API_URL ||
          (process.env.PUBLIC_GATEWAY_URL ? process.env.PUBLIC_GATEWAY_URL.replace(/\/+$/, "") : "") ||
          ""
        );
    // Local Docker mapping for lending-service is host 3007 -> container 3006.
    // If 3006 is used here, the miniapp can end up proxying to itself and return 404 on /benqi/*.
    const lendingBase = normalizeLendingDevBase(lendingBaseRaw, isDev);

    const stakingBaseRaw =
      process.env.VITE_STAKING_API_URL ||
      process.env.NEXT_PUBLIC_STAKING_API_URL ||
      "";
    const stakingBase = normalizeDevServiceBase(stakingBaseRaw, "http://localhost:3004", isDev);

    const swapBaseRaw =
      process.env.VITE_SWAP_API_BASE ||
      process.env.NEXT_PUBLIC_SWAP_API_BASE ||
      process.env.SWAP_API_BASE ||
      "";
    const swapBase = normalizeDevServiceBase(swapBaseRaw, "http://localhost:3002", isDev);

    const rewrites = [];

    // Gateway proxy — evita CORS ao chamar o DB Gateway direto do browser
    const gatewayBase = (
      process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8080'
    ).replace(/\/+$/, '');
    console.log('[Next.js] Gateway proxy configured:', gatewayBase);
    rewrites.push({
      source: '/api/gateway/:path*',
      destination: `${gatewayBase}/:path*`,
      basePath: false,
    });

    if (!lendingBase) {
      console.warn('[Next.js] Lending API base URL not configured, proxy will not work');
      console.warn('[Next.js] Please set VITE_LENDING_API_BASE or NEXT_PUBLIC_LENDING_API_URL in .env');
    } else {
      console.log('[Next.js] Lending API proxy configured:', lendingBase);
      rewrites.push({
        source: "/api/lending/:path*",
        destination: `${lendingBase}/:path*`,
        basePath: false,
      });
      // Some environments still hit the basePath-prefixed version; keep both.
      rewrites.push({
        source: "/miniapp/api/lending/:path*",
        destination: `${lendingBase}/:path*`,
        basePath: false,
      });
    }

    if (!stakingBase) {
      console.warn('[Next.js] Staking API base URL not configured, proxy will not work');
      console.warn('[Next.js] Please set VITE_STAKING_API_URL or NEXT_PUBLIC_STAKING_API_URL in .env');
    } else {
      console.log('[Next.js] Staking API proxy configured:', stakingBase);
      rewrites.push({
        source: "/api/staking/:path*",
        destination: `${stakingBase}/:path*`,
        basePath: false,
      });
      rewrites.push({
        source: "/miniapp/api/staking/:path*",
        destination: `${stakingBase}/:path*`,
        basePath: false,
      });
    }

    if (!swapBase) {
      console.warn('[Next.js] Swap API base URL not configured, proxy will not work');
      console.warn('[Next.js] Please set SWAP_API_BASE or NEXT_PUBLIC_SWAP_API_BASE in .env');
    } else {
      const trimmed = swapBase.replace(/\/+$/, '');
      const swapWithPath = trimmed.endsWith('/swap') ? trimmed : `${trimmed}/swap`;
      console.log('[Next.js] Swap API proxy configured:', swapWithPath);
      rewrites.push({
        source: "/api/swap/:path*",
        destination: `${swapWithPath}/:path*`,
        basePath: false,
      });
      rewrites.push({
        source: "/miniapp/api/swap/:path*",
        destination: `${swapWithPath}/:path*`,
        basePath: false,
      });
    }

    return rewrites;
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
    VITE_THIRDWEB_CLIENT_ID:
      process.env.VITE_THIRDWEB_CLIENT_ID ||
      process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
      process.env.THIRDWEB_CLIENT_ID ||
      "",
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID:
      process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
      process.env.VITE_THIRDWEB_CLIENT_ID ||
      process.env.THIRDWEB_CLIENT_ID ||
      "",
    VITE_WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID || "",
    VITE_EVM_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || "8453",
    VITE_AI_API_URL: process.env.AI_API_URL || "",
    VITE_AGENTS_API_BASE: process.env.AGENTS_API_BASE || "",
    NEXT_PUBLIC_AGENTS_API_BASE: process.env.AGENTS_API_BASE || "",
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
