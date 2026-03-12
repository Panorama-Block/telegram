# DCA (Dollar Cost Averaging) - Frontend Integration

## Overview

Automated recurring crypto purchases powered by account abstraction.

## Capabilities

- Smart wallet creation with session keys
- DCA strategy setup (`daily`, `weekly`, `monthly`)
- Automated swaps via Uniswap V3
- Execution history visualization
- Strategy lifecycle management (pause/resume/delete)

## File Structure

```text
src/features/dca/
├── api.ts                 # DCA backend API client
└── README.md              # Pointer file (docs moved)

src/app/dca/
└── page.tsx               # Main DCA page
```

## API Client (`api.ts`)

### Import

```typescript
import {
  getUserAccounts,
  createSmartAccount,
  createStrategy,
  getAccountStrategies,
  toggleStrategy,
  deleteStrategy,
  getExecutionHistory,
  type SmartAccount,
  type DCAStrategy,
  type ExecutionHistory,
} from "@/features/dca/api";
```

### Available Methods

#### Smart accounts

```typescript
const result = await createSmartAccount({
  userId: userWalletAddress,
  name: "My DCA Wallet",
  permissions: {
    approvedTargets: ["*"],
    nativeTokenLimit: "0.1",
    durationDays: 30,
  },
});
// Returns: { smartAccountAddress, sessionKeyAddress, expiresAt }

const accounts = await getUserAccounts(userWalletAddress);
// Returns: SmartAccount[]

const account = await getSmartAccount(smartAccountAddress);
// Returns: SmartAccount

await deleteSmartAccount(smartAccountAddress, userId);
```

#### DCA strategies

```typescript
const result = await createStrategy({
  smartAccountId: smartAccount.address,
  fromToken: "0x0000000000000000000000000000000000000000", // ETH
  toToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",   // USDC
  fromChainId: 1,
  toChainId: 1,
  amount: "0.01",
  interval: "daily", // "daily" | "weekly" | "monthly"
});
// Returns: { strategyId, nextExecution }

const strategies = await getAccountStrategies(smartAccountAddress);
// Returns: DCAStrategy[]

await toggleStrategy(strategyId, true); // true = active, false = paused
await deleteStrategy(strategyId);
```

#### Execution history

```typescript
const history = await getExecutionHistory(smartAccountAddress, 50);
// Returns: ExecutionHistory[]
```

### Type contracts

```typescript
interface SmartAccount {
  address: string;
  userId: string;
  name: string;
  createdAt: number;
  sessionKeyAddress: string;
  expiresAt: number;
  permissions: {
    approvedTargets: string[];
    nativeTokenLimitPerTransaction: string;
    startTimestamp: number;
    endTimestamp: number;
  };
}

interface DCAStrategy {
  smartAccountId: string;
  fromToken: string;
  toToken: string;
  fromChainId: number;
  toChainId: number;
  amount: string;
  interval: "daily" | "weekly" | "monthly";
  lastExecuted: number;
  nextExecution: number;
  isActive: boolean;
}

interface ExecutionHistory {
  timestamp: number;
  txHash: string;
  amount: string;
  fromToken: string;
  toToken: string;
  status: "success" | "failed";
  error?: string;
}
```

## `/app/dca/page.tsx` Behavior

### Component state

```typescript
const [smartAccounts, setSmartAccounts] = useState<SmartAccount[]>([]);
const [strategies, setStrategies] = useState<DCAStrategy[]>([]);
const [history, setHistory] = useState<ExecutionHistory[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [showCreateModal, setShowCreateModal] = useState(false);
```

### UX flow

1. No smart wallet: show empty state and guide user to `/account`.
2. With smart wallet: show strategy list, history, and create CTA.
3. Strategy creation: modal with smart wallet, token pair, amount, and interval.

### UI components

```typescript
<CreateDCAModal
  isOpen={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onConfirm={handleCreateStrategy}
  loading={loading}
  smartAccounts={smartAccounts}
/>
```

```typescript
<button onClick={() => setShowFromSelector(true)}>
  <Image src={token.icon} />
  <span>{token.symbol}</span>
</button>
```

```typescript
{showFromSelector && (
  <TokenSelectorModal
    onSelect={handleTokenSelect}
    onClose={() => setShowFromSelector(false)}
  />
)}
```

## Data Flow

```text
User input (modal)
  -> handleCreateStrategy()
  -> createStrategy() API call
  -> backend persists strategy + schedules in Redis
  -> loadSmartAccounts() refresh
  -> UI updates
  -> cron executes strategy on schedule
  -> getExecutionHistory() exposes results
```

## Visual System Notes

- Main surfaces: dark elevated cards (`#202020`, `#2A2A2A` family)
- Text hierarchy: strong white headings + muted gray metadata
- Accent colors: cyan highlights for active actions and values
- Border style: low-contrast translucent outlines

## Environment

Required base envs (project dependent):

- `NEXT_PUBLIC_GATEWAY_URL`
- Auth and swap endpoints (`AUTH_API_BASE`, `SWAP_API_BASE` or gateway-proxied route)
- Wallet provider envs (thirdweb/TonConnect)

## Error Handling and UX Rules

- Always show loading and error states for async actions.
- Confirm destructive actions (delete strategy) before submission.
- Refresh strategy and history state after successful mutations.
- Surface transaction hash and execution status for transparency.

## Backend Reference

- Backend DCA documentation: `/panorama-block-backend/docs/services/dca/DCA_DOCUMENTATION.md`
