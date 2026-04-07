# Panorama Block - Telegram (Gateway + MiniApp)

## Overview

- Monorepo with two applications:
  - `apps/gateway`: Fastify + grammy (Telegram bot) acting as API gateway and proxy for MiniApp and Swap service.
  - `apps/miniapp`: Next.js (App Router) for onboarding, wallet management (EVM via thirdweb and TON via TonConnect), agent chat, and swap.
- Main integrations:
  - thirdweb in-app wallet authentication (SIWE) against backend `auth-service`.
  - Proxy to `liquid-swap-service` (Uniswap Trading API / Smart Router + thirdweb Bridge) on `/swap/*`.
  - Agent backend consumption (`zico_agents/new_zico`) through `AgentsClient`.

## Architecture and Modules

### Gateway (`apps/gateway`)

- Fastify server with CORS, rate limiting, and optional HTTPS (Let's Encrypt). Reference: `telegram/apps/gateway/src/server.ts:1`.
- Dynamic TonConnect manifest at `GET /miniapp/manifest.json`, using computed host/proxy origin. Reference: `telegram/apps/gateway/src/server.ts:99`.
- MiniApp routing supports two modes:
  - local proxy forwarding `/miniapp/*` to a local Next server (`NEXTJS_URL`)
  - redirect mode to `PUBLIC_WEBAPP_URL` when `NEXTJS_PROXY_ENABLED=false` for the dedicated Telegram VM rollout
  Reference: `telegram/apps/gateway/src/server.ts:147`.
- Swap proxy forwarding `/swap/*` to `SWAP_SERVICE_URL` (default `http://localhost:3302`). Reference: `telegram/apps/gateway/src/server.ts:163`.
- Telegram bot (grammy) initialized with webhook at `/telegram/webhook`; `/start` exposes WebApp button to open MiniApp. References: `telegram/apps/gateway/src/handlers/commands.ts:5`, `telegram/apps/gateway/src/server.ts:222`.
- Telegram auth bridge endpoint `POST /auth/telegram/verify` delegating signature verification to backend `auth-service`. References: `telegram/apps/gateway/src/routes/auth.ts`, `telegram/apps/gateway/src/services/authService.ts`.
- Optional swap client in `src/clients/swapClient.ts` with `quote()` and optional JWT support. Reference: `telegram/apps/gateway/src/clients/swapClient.ts:1`.

### MiniApp (`apps/miniapp`)

- Next.js 15 (App Router) with Tailwind, Zustand, and UI component modules.
- Wallets:
  - EVM: thirdweb in-app wallet + `ConnectButton` adapted for Telegram WebView and iOS fallback to browser. Reference: `telegram/apps/miniapp/src/features/wallets/evm/EvmConnectButton.tsx:1`.
  - TON: TonConnect wallet and network/balance views. Reference: `telegram/apps/miniapp/src/features/wallets/ton/TonBalanceCard.tsx:1`.
- Authentication (SIWE flow):
  - Requests payload from `POST {AUTH_API_BASE}/auth/login`, signs with thirdweb wallet, then calls `POST /auth/verify` and stores `authToken` in `localStorage`. Reference: `telegram/apps/miniapp/src/app/newchat/page.tsx:114`.
  - Supports OAuth callback redirects for WebView in `/miniapp/auth/callback`. Reference: `telegram/apps/miniapp/src/app/auth/callback/page.tsx:71`.
- Swap API client through gateway: `/swap/quote`, `/swap/tx`, `/swap/status/:hash?chainId=`. Always send `unit` (`token` or `wei`) to avoid double conversion. JWT goes in `Authorization: Bearer`. Reference: `telegram/apps/miniapp/src/features/swap/api.ts:173`.
- Agents chat: `AgentsClient` sends `message`, `conversation_id`, `user_id`, and optional `wallet_address`, and parses response via optional `AGENTS_RESPONSE_MESSAGE_PATH`. Reference: `telegram/apps/miniapp/src/clients/agentsClient.ts:1`.
- UX modules include landing animations and PWA update notification. References: `telegram/apps/miniapp/src/modules/landing/lines/index.tsx:1`, `telegram/apps/miniapp/src/components/pwa/PWAUpdateNotification.tsx:1`.

## Engineering Practices

- Environment validation with `zod` in gateway. Reference: `telegram/apps/gateway/src/env.ts:1`.
- Structured logging in proxy/webhook/auth critical paths.
- HTTPS/HTTP split handling and certificate logs in gateway.
- MiniApp keeps API clients and types modular, uses `localStorage` JWT token, and detects Telegram WebView for OAuth behavior.
- In the step-1 Azure VM rollout, the Telegram gateway runs as a dedicated edge service while the MiniApp host remains separate.

## Main Flows

### Onboarding and Authentication (EVM via thirdweb)

1. User opens MiniApp from bot button or `/miniapp` URL.
2. User connects wallet (`autoConnect` + connect button). Reference: `telegram/apps/miniapp/src/app/newchat/page.tsx:56`.
3. MiniApp requests login payload (`/auth/login`), signs with `signLoginPayload`, verifies via `/auth/verify`, stores `authToken`. Reference: `telegram/apps/miniapp/src/app/newchat/page.tsx:195`.
4. User is redirected to `/chat` after successful auth.

### Swap (gateway -> liquid-swap-service)

1. MiniApp calls `swapApi.quote/prepare/status`.
2. Gateway proxies request to `liquid-swap-service` (port 3302). Reference: `telegram/apps/gateway/src/server.ts:163`.
3. Backend selects provider (Uniswap Trading API / Smart Router / Thirdweb) and returns transaction bundle to be signed on client.

### Agents

1. MiniApp sends `POST {AGENTS_API_BASE}/chat` with `message`, `user_id`, `conversation_id`, and optional `wallet_address`.
2. Agent backend returns text and metadata (for example `requires_action`, `swap_intent_*`). Reference: `telegram/apps/miniapp/src/clients/agentsClient.ts:214`.

## Integrations

- thirdweb client: `ConnectButton`, `createThirdwebClient`, `inAppWallet`, `signLoginPayload`; requires `VITE_THIRDWEB_CLIENT_ID` or `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`. References: `telegram/apps/miniapp/src/shared/config/thirdweb.ts:1`, `telegram/apps/miniapp/src/app/newchat/page.tsx:1`.
- TonConnect: `@tonconnect/ui-react` with endpoint resolution through `@orbs-network/ton-access`. Reference: `telegram/apps/miniapp/src/features/wallets/ton/TonBalanceCard.tsx:1`.
- Auth service endpoints: `POST /auth/login`, `POST /auth/verify`, `POST /auth/validate`, etc. (backend docs).
- Swap via gateway proxy `/swap/*`. Reference: `telegram/apps/gateway/src/server.ts:166`.

## Key Environment Variables

### Gateway

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
- `PUBLIC_GATEWAY_URL`, `PUBLIC_WEBAPP_URL`
- `NEXTJS_PROXY_ENABLED`
- `SWAP_SERVICE_URL`, `AUTH_API_BASE`, `AGENTS_API_BASE`

### MiniApp

- `THIRDWEB_CLIENT_ID` (Vercel) or `VITE_THIRDWEB_CLIENT_ID`
- `VITE_AUTH_API_BASE`, optional `VITE_SWAP_API_BASE`, optional `VITE_GATEWAY_BASE`
- `AGENTS_API_BASE`, `AGENTS_RESPONSE_MESSAGE_PATH`, `AGENTS_REQUEST_TIMEOUT_MS`

## Entry File References

- Gateway: `telegram/apps/gateway/src/server.ts:1`, `telegram/apps/gateway/src/handlers/commands.ts:1`
- MiniApp: `telegram/apps/miniapp/src/app/newchat/page.tsx:1`, `telegram/apps/miniapp/src/features/swap/api.ts:1`, `telegram/apps/miniapp/src/clients/agentsClient.ts:1`

## Product Notes

- Telegram iOS WebView has Google auth limitations; app supports fallback open-in-browser flow. Reference: `telegram/apps/miniapp/src/features/wallets/evm/EvmConnectButton.tsx:35`.
- Authentication is non-custodial: backend returns transaction bundles, client signs and broadcasts.
- Agent chat is intended to guide users toward actionable swap intent metadata (`swap_intent_pending/ready`).
