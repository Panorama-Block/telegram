Panorama Block — Telegram (Gateway + MiniApp)

Visão geral

- Monorepo com dois apps:
  - `apps/gateway`: Fastify + grammy (bot Telegram) atuando como gateway/API e proxy do MiniApp e do serviço de Swap.
  - `apps/miniapp`: Next.js (App Router) com UI/UX para onboarding, carteiras (EVM via thirdweb e TON via TonConnect), chat de agentes e swap.
- Integrações principais:
  - Autenticação via thirdweb in-app wallet (SIWE) contra `auth-service` do backend.
  - Proxy para `liquid-swap-service` (Uniswap Trading API/Smart Router + thirdweb Bridge) em `/swap/*`.
  - Consumo do backend de agentes (`zico_agents/new_zico`) via `AgentsClient`.

Arquitetura e módulos

- Gateway (`apps/gateway`)
  - Servidor Fastify com CORS, rate limiting, e HTTPS opcional (Let's Encrypt). Referência: `telegram/apps/gateway/src/server.ts:1`.
  - Servir manifest dinâmico para TonConnect: `GET /miniapp/manifest.json` calcula a `origin` a partir do host/proxy. Referência: `telegram/apps/gateway/src/server.ts:99`.
  - Proxy do MiniApp: redireciona `/miniapp/*` para o servidor Next local (`NEXTJS_URL`). Referência: `telegram/apps/gateway/src/server.ts:131`.
  - Proxy para Swap Service: encaminha `/swap/*` para `SWAP_SERVICE_URL` (padrão `http://localhost:3302`). Referência: `telegram/apps/gateway/src/server.ts:163`.
  - Bot Telegram (grammy): inicialização e webhook em `/telegram/webhook`. Comando `/start` responde com botão WebApp para abrir o MiniApp. Referências: `telegram/apps/gateway/src/handlers/commands.ts:5`, `telegram/apps/gateway/src/server.ts:222`.
  - Auth Telegram → backend: `POST /auth/telegram/verify` verifica assinatura via `auth-service`. Referências: `telegram/apps/gateway/src/routes/auth.ts`, `telegram/apps/gateway/src/services/authService.ts`.
  - Cliente de swap (opcional): `src/clients/swapClient.ts` com `quote()` e JWT opcional. Referência: `telegram/apps/gateway/src/clients/swapClient.ts:1`.

- MiniApp (`apps/miniapp`)
  - Next.js 15 (App Router) com Tailwind, Zustand e componentes de UI.
  - Carteiras:
    - EVM: thirdweb in-app wallet + `ConnectButton` com estratégias adaptadas ao WebView do Telegram e iOS (fallback abrir browser). Referência: `telegram/apps/miniapp/src/features/wallets/evm/EvmConnectButton.tsx:1`.
    - TON: TonConnect, exibe saldo e rede (mainnet/testnet). Referência: `telegram/apps/miniapp/src/features/wallets/ton/TonBalanceCard.tsx:1`.
  - Autenticação (fluxo SIWE):
    - Gera payload em `POST {AUTH_API_BASE}/auth/login` e assina com carteira (thirdweb), depois `POST /auth/verify` → salva `authToken` no `localStorage`. Referência: `telegram/apps/miniapp/src/app/newchat/page.tsx:114`.
    - Suporte a callback OAuth por redirect em WebView (`/miniapp/auth/callback`). Referência: `telegram/apps/miniapp/src/app/auth/callback/page.tsx:71`.
  - Swap API (cliente do gateway): `/swap/quote`, `/swap/tx`, `/swap/status/:hash?chainId=` com suporte a erros “user-facing”. **Sempre enviar `unit`** (`token` ou `wei`) para evitar dupla conversão. O JWT é enviado em `Authorization: Bearer`. Referência: `telegram/apps/miniapp/src/features/swap/api.ts:173`.
  - Agentes (chat): `AgentsClient` conversa com `zico_agents/new_zico`, padroniza `message`, `conversation_id`, `user_id`, `wallet_address` e extrai a resposta via `AGENTS_RESPONSE_MESSAGE_PATH` opcional. Referência: `telegram/apps/miniapp/src/clients/agentsClient.ts:1`.
  - UI/UX: componentes e animações (ex.: linhas animadas na landing) e suporte PWA (notificação de update). Referências: `telegram/apps/miniapp/src/modules/landing/lines/index.tsx:1`, `telegram/apps/miniapp/src/components/pwa/PWAUpdateNotification.tsx:1`.

Padrões de código e práticas

- Validação de ambiente com `zod` no gateway. Referência: `telegram/apps/gateway/src/env.ts:1`.
- Logging informativo em pontos críticos (proxy, webhooks, auth).
- Gateway isolando HTTPS vs HTTP e logs de certificados.
- MiniApp separa clientes de API e tipos, usa `localStorage` para token JWT, e detecta WebView Telegram para fluxos de OAuth.
- Evitar duplicidade de barras em rotas (normalização no Auth Service e no gateway onde aplicável).

Fluxos principais

- Onboarding/Autenticação (EVM via thirdweb)
  - Usuário abre o MiniApp pelo botão do bot ou URL (`/miniapp`).
  - Conecta a carteira (autoConnect + botão). Referência: `telegram/apps/miniapp/src/app/newchat/page.tsx:56`.
  - MiniApp requisita `payload` (`/auth/login`), assina com `signLoginPayload` e verifica em `/auth/verify` → salva `authToken`. Referência: `telegram/apps/miniapp/src/app/newchat/page.tsx:195`.
  - Após autenticar, redireciona para `/chat`.

- Swap (via gateway → liquid-swap-service)
  - MiniApp chama `swapApi.quote/prepare/status`; gateway repassa para `liquid-swap-service` (porta 3302). Referência: `telegram/apps/gateway/src/server.ts:163`.
  - Backend seleciona provedor (Uniswap Trading API/Smart Router/Thirdweb) e retorna bundle de transações a serem assinadas pelo cliente.

- Agentes
  - MiniApp envia `POST {AGENTS_API_BASE}/chat` com `message`, `user_id`, `conversation_id`, `wallet_address` (quando disponível). O backend de agentes responde com mensagem e metadados (ex.: `requires_action`/`swap_intent_*`). Referência: `telegram/apps/miniapp/src/clients/agentsClient.ts:214`.

Integrações

- thirdweb (cliente): `ConnectButton`, `createThirdwebClient`, `inAppWallet`, `signLoginPayload` em MiniApp, `VITE_THIRDWEB_CLIENT_ID`/`NEXT_PUBLIC_THIRDWEB_CLIENT_ID` requisitado. Referências: `telegram/apps/miniapp/src/shared/config/thirdweb.ts:1`, `telegram/apps/miniapp/src/app/newchat/page.tsx:1`.
- TonConnect: `@tonconnect/ui-react` e carga de endpoint por `@orbs-network/ton-access`. Referência: `telegram/apps/miniapp/src/features/wallets/ton/TonBalanceCard.tsx:1`.
- Auth-service: endpoints `POST /auth/login`, `POST /auth/verify`, `POST /auth/validate`, etc. (detalhado no backend).
- Uniswap/Swap: via proxy do gateway para `/swap/*` (service no backend). Referência: `telegram/apps/gateway/src/server.ts:166`.

Variáveis de ambiente (principais)

- Gateway:
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
  - `PUBLIC_GATEWAY_URL`, `PUBLIC_WEBAPP_URL`
  - `SWAP_SERVICE_URL` (proxy), `AUTH_API_BASE`, `AGENTS_API_BASE`
- MiniApp:
  - `THIRDWEB_CLIENT_ID` (Vercel) ou `VITE_THIRDWEB_CLIENT_ID`
  - `VITE_AUTH_API_BASE`, `VITE_SWAP_API_BASE` (opcional), `VITE_GATEWAY_BASE` (opcional)
  - `AGENTS_API_BASE`, `AGENTS_RESPONSE_MESSAGE_PATH`, `AGENTS_REQUEST_TIMEOUT_MS`

Referências de arquivo (pontos de entrada)

- Gateway: `telegram/apps/gateway/src/server.ts:1`, `telegram/apps/gateway/src/handlers/commands.ts:1`
- MiniApp: `telegram/apps/miniapp/src/app/newchat/page.tsx:1`, `telegram/apps/miniapp/src/features/swap/api.ts:1`, `telegram/apps/miniapp/src/clients/agentsClient.ts:1`

Notas de UX/negócio

- WebView do Telegram no iOS restringe Google auth — o app expõe opção para abrir no navegador. Referência: `telegram/apps/miniapp/src/features/wallets/evm/EvmConnectButton.tsx:35`.
- Autenticação é não-custodial: o servidor retorna bundles, o cliente assina e envia.
- Chat com agentes ideal para guiar usuário até intenção de swap (metadados `swap_intent_pending/ready`).
