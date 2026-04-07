<div align="center">
  <h1>Panorama Block — Zico MiniApp</h1>
  <p><strong>The AI-Native DeFi Operating System, built for the Telegram/TON Ecosystem.</strong></p>

  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" />
    <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?logo=react" />
    <img alt="TON" src="https://img.shields.io/badge/TON-Connect_2.0-0088cc?logo=telegram" />
    <img alt="Thirdweb" src="https://img.shields.io/badge/Thirdweb-AA_v5-purple" />
    <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss" />
  </p>
</div>

---

## Overview

**Panorama Block** is a protocol-agnostic agentic framework for Web3, where modular AI agents intelligently learn, adjust, and deploy financial actions on-chain — all accessible through a conversational interface inside Telegram.

At its core is **Zico**, an AI financial co-pilot that understands natural language and executes complex DeFi strategies across multiple chains: swaps, lending, staking, DCA, and portfolio analytics — without requiring users to navigate traditional DeFi interfaces.

> *"Fusing multi-chain data pipelines with AI reasoning frameworks to empower decentralized, composable financial automation."*

Built on cryptoeconomic research from **UCLA** and leading **Brazilian universities**, with a globally distributed team across the US, South America, and Switzerland.

---

## Purpose & Objectives

| Objective | Description |
|---|---|
| **Radical Simplicity** | Make complex DeFi operations as simple as sending a Telegram message |
| **Non-Custodial by Default** | Users always own their keys; Zico acts as an authorized agent, never a custodian |
| **Protocol Agnostic** | One interface, any chain — Ethereum, Base, Avalanche, TON, and beyond |
| **AI-First Architecture** | Zico is the primary UX layer, not a feature bolted onto a traditional DApp |
| **Academic Foundation** | Strategy logic grounded in cryptoeconomic and decentralized systems research |

---

## Telegram & TON Integration

> Telegram is not just a distribution channel — it is the primary runtime environment.

### Why TON & Telegram

With **950M+ active users**, Telegram is the dominant platform in the crypto-native world. The TON blockchain was purpose-built for this ecosystem, meaning every Telegram user is a potential Web3 participant with zero additional onboarding friction.

### Technical Architecture

```
Telegram Client
    └── Telegram Mini App (TMA)
            ├── @tma.js/sdk          → TMA lifecycle, haptics, theme tokens
            ├── @twa-dev/sdk         → initData, user metadata, WebApp API
            └── TON Connect 2.0
                    ├── @tonconnect/ui-react  → Connection UI & proof flow
                    ├── @ton/core             → Address, Cell, fromNano primitives
                    ├── @ton/ton              → TonClient RPC queries
                    └── @orbs-network/ton-access → Decentralized RPC endpoints
```

### TON Authentication Flow (TON Proof)

Zico implements **cryptographic ownership proof** — the most secure authentication standard on TON, eliminating reliance on centralized auth services:

```
1. Backend generates nonce           POST /auth/ton/payload
2. Frontend injects payload into TonConnect before connection
3. User's TON wallet signs tonProof  (Telegram Wallet / Tonkeeper / etc.)
4. Frontend submits proof            POST /auth/ton/verify
5. Backend validates Ed25519 signature → issues JWT session
6. Telegram identity linked to wallet address
7. Redirect to Zico chat interface
```

### Adaptive UI: TMA vs. Web Mode

The application automatically detects execution context and adapts:

| Context | Auth Method | OAuth Flow | TON Connect |
|---|---|---|---|
| Inside Telegram | TON Connect shown first | `redirect` mode (no popups) | Primary CTA |
| Desktop / Web | EVM wallet primary | `popup` mode | Secondary option |

### TON Balance & Network Detection

```typescript
// Auto-detects mainnet vs testnet from connected wallet chain ID
const network: NetworkHint = wallet?.account?.chain === -239
  ? 'testnet' : 'mainnet';

// Fetches balance via decentralized Orbs RPC — no centralized API keys
const endpoint = await getHttpEndpoint({ network });
const client = new TonClient({ endpoint });
const balance = fromNano(await client.getBalance(Address.parse(rawAddress)));
```

---

## The Zico Agent

Zico is not a chatbot. It is a **multi-agent financial execution framework** with a conversational interface.

### Dual Operation Modes

```
┌─────────────────────────────────────────────────────────────┐
│                        ZICO AGENT                          │
├──────────────────────────┬──────────────────────────────────┤
│   INTERFACE MODE         │   NATIVE MODE                   │
│   (Web Mini App /chat)   │   (Telegram Bot Direct)         │
├──────────────────────────┼──────────────────────────────────┤
│ Rich UI components        │ Pure conversational             │
│ Charts & visualizations   │ No UI required                  │
│ Transaction review panels │ Natural language intents        │
│ Portfolio widgets         │ Background execution            │
│ Inline confirmations      │ Push notifications for results  │
└──────────────────────────┴──────────────────────────────────┘
```

### Specialized Agent Portfolio

| Agent | Domain | Example Capabilities |
|---|---|---|
| **Chain Watcher** | On-chain intelligence | Compare borrow APYs across protocols; monitor liquidity flows |
| **(Re)Stake Agent** | Liquid Staking & Restaking | Rebalance LST portfolios; auto-restake on Renzo, EigenLayer |
| **Swap Agent** | Cross-chain token exchange | Find optimal routes across Base, Avalanche, Ethereum |
| **DCA Agent** | Automated accumulation | Weekly recurring buys; double allocation on >7% dips |
| **Cross Trader Agent** | Limit orders & risk management | Set entry/exit/stop-loss strategies across chains |
| **Portfolio Scanner** | Performance analytics | Calculate yield, fees, IL across protocols and time ranges |
| **Report Agent** | Data visualization | Generate charts for LP APY, staking returns, allocation |

### Intent-Based Execution Examples

```
User: "DCA $100 per week into ETH on Base"
Zico: Creates a DCA schedule using Session Keys on the user's Smart Account
      → Executes weekly, no signature required per transaction

User: "Convert 50% of my LST portfolio into ezETH and restake on Renzo"
Zico: Reads portfolio state → calculates optimal split → executes via batched tx

User: "Compare borrow APY of USDC between Aave and Morpho on Ethereum"
Zico: Queries both protocols in real-time → returns structured comparison
```

---

## Products

### Zico Chat
The primary interface. All navigation flows through Zico — the dashboard itself redirects to `/chat`. Natural language is the interaction paradigm.

### Smart Wallets (Account Abstraction)
ERC-4337 Smart Accounts powered by **Thirdweb AA**:

| Feature | Description |
|---|---|
| **Gasless Transactions** | Paymaster-sponsored txs — zero gas friction for end users |
| **Session Keys** | Zico can execute pre-authorized operations without per-tx popups |
| **Passkey Access** | FaceID / TouchID via device Secure Enclave |
| **Social Recovery** | Recover wallet via trusted guardian addresses |
| **Multi-Sig Ready** | Require N-of-M signatures for high-value operations |

> Networks: Base Mainnet (primary), Avalanche (expansion)

### DCA Automation
Automated dollar-cost averaging powered by Smart Account Session Keys. Deposit once, set your strategy, let Zico execute — fully non-custodial.

### DeFi Lending
Full supply/borrow flow with dedicated microservice backend. Supports Aave-compatible protocols with real-time APY data.

### TON Wallet & Balance
Direct TON blockchain integration via decentralized RPC. Connect Telegram Wallet or any TON-compatible wallet to view balances and initiate transactions.

### Portfolio Intelligence
Cross-chain portfolio aggregation with net worth tracking, 24h PnL, allocation breakdown, per-asset APY visibility, and direct action triggers per position.

---

## Technology Stack

### Frontend
```json
{
  "framework": "Next.js 15 (App Router)",
  "runtime": "React 19",
  "styling": "Tailwind CSS v4 + custom design tokens",
  "animation": "Framer Motion 12",
  "ui_components": "Radix UI (headless, accessible)",
  "charts": "Recharts 3",
  "agent_flows": "@xyflow/react 12",
  "state": "Zustand 5",
  "forms": "react-hook-form + Zod"
}
```

### Web3 & Blockchain
```json
{
  "ton_connect": "@tonconnect/ui-react 2.0.9",
  "ton_core": "@ton/core + @ton/ton + @orbs-network/ton-access",
  "telegram_sdk": "@tma.js/sdk + @twa-dev/sdk",
  "evm_aa": "thirdweb 5.x (Account Abstraction, ERC-4337)",
  "chains": ["TON Mainnet", "TON Testnet", "Base Mainnet", "Avalanche", "Ethereum"]
}
```

### Infrastructure
```
Telegram Gateway:   Azure VM (dedicated gateway/bot/webhook edge in step 1)
MiniApp Hosting:    Existing host remains unchanged in step 1
Backend Services:   Existing backend VM + managed PostgreSQL on Azure
Auth:               Dual-path — TON Proof (Ed25519) + EVM SIWE (Thirdweb)
PWA:                Service Worker + offline indicator + install prompts
Testing:            Vitest + Testing Library + MSW (API mocking)
```

---

## Roadmap

### Phase 1 — Telegram Launch *(Active)*
- Launch AI DeFi agents on Telegram for swaps, lending, staking, and yield
- Unified Yield Discovery across Uniswap V2, V3, and V4 pools
- Deploy Telegram Mini App with secure TON wallet gateway

### Phase 2 — Cross-Chain Strategies
- Expand integrations across major DeFi ecosystems
- Composable yield strategies executed via natural language prompts
- Strategy templates for retail users

### Phase 3 — AI Strategy Orchestration
- Multi-agent execution for advanced coordinated DeFi strategies
- Intelligent routing optimizing yield, fees, and liquidity simultaneously
- Automated portfolio rebalancing and cross-chain allocation

### Phase 4 — Infrastructure & Institutional
- B2B infrastructure layer for companies and institutions
- Non-custodial wallet infrastructure for enterprise blockchain access
- Policy engine for controlled and compliant on-chain operations

---

## Getting Started

### Prerequisites
- Node.js >= 18
- Thirdweb Client ID
- Backend Auth API endpoint

### Environment Variables

```env
# Thirdweb
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id

# Auth Backend
VITE_AUTH_API_BASE=https://your-auth-api.com

# DeFi Services
LENDING_SERVICE_URL=https://your-lending-service.com
LIDO_SERVICE_URL=https://your-lido-service.com
```

### Development

```bash
# Install dependencies
npm install

# Start development server (default port 7777)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Application Routes

| Route | Description |
|---|---|
| `/miniapp` | Landing page (public marketing) |
| `/miniapp/newchat` | Auth gateway — TON Connect or EVM wallet |
| `/miniapp/chat` | Main Zico chat interface |
| `/miniapp/portfolio` | Multi-chain portfolio view |
| `/miniapp/smart-wallets` | Account Abstraction wallet management |
| `/miniapp/lending` | DeFi lending interface |

### TON Connect Setup
Configure `public/tonconnect-manifest.json` with your deployment URL, then register your Mini App via [@BotFather](https://t.me/BotFather) pointing to `https://your-domain.com/miniapp`.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEGRAM CLIENT                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 ZICO MINI APP                            │  │
│  │  /landing → /newchat → /chat → [portfolio|lending|...]  │  │
│  │                                                          │  │
│  │  TON Connect 2.0          Thirdweb ConnectButton        │  │
│  │  (TON Proof Auth)         (EVM + Smart Wallets)         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Auth Service    Zico AI Engine   DeFi Services
        (TON + EVM)     (Agent Router)   (Lending, Lido)
              │               │               │
              └───────────────┼───────────────┘
                              ▼
              ┌───────────────────────────────┐
              │        BLOCKCHAINS            │
              │  TON · Base · Avalanche · ETH │
              └───────────────────────────────┘
```

---

<div align="center">
  <sub>Built with rigorous cryptoeconomic research · Globally distributed team · US · Brazil · Switzerland</sub>
</div>
