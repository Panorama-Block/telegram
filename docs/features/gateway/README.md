# Integration Guide - Gateway History

This guide explains how to integrate transaction tracking into the swap flow.

## Created Files

```text
features/gateway/
├── types.ts              # TypeScript types
├── api.ts                # Base gateway client
├── walletApi.ts          # Wallet API
├── transactionApi.ts     # Transaction API
├── notificationApi.ts    # Notification API
├── hooks.ts              # React hooks
├── swapIntegration.ts    # Swap helper
└── index.ts              # Exports
```

## SwapWidget.tsx Integration

The integration is already implemented in `components/SwapWidget.tsx`.

### How it works

1. Import helper:
```tsx
import { startSwapTracking, type SwapTracker } from "@/features/gateway";
```

2. Add tracker state:
```tsx
const [swapTracker, setSwapTracker] = useState<SwapTracker | null>(null);
```

3. Start tracking before swap:
```tsx
const tracker = await startSwapTracking({
  userId: account.address,
  walletAddress: account.address,
  chain: sellToken.network.toUpperCase(),
  action: isCrossChain ? "bridge" : "swap",
  fromChainId,
  fromAsset: {
    address: sellToken.address || "native",
    symbol: sellToken.ticker,
    decimals,
  },
  fromAmount: amount,
  toChainId,
  toAsset: {
    address: buyToken.address || "native",
    symbol: buyToken.ticker,
    decimals: buyToken.decimals || 18,
  },
  provider: "thirdweb",
});
setSwapTracker(tracker);
```

4. Add hashes when transactions confirm:
```tsx
if (tracker) {
  tracker.addHash(receipt.transactionHash, txChainId, txAction);
}
```

5. Mark as confirmed or failed:
```tsx
// Success
if (tracker) {
  await tracker.markConfirmed(estimatedOutput);
}

// Failure (inside catch)
if (tracker) {
  await tracker.markFailed("SWAP_FAILED", error.message);
}
```

## Using History Hooks

### Display swap history

```tsx
import { useTransactionHistory } from "../gateway";

function SwapHistoryPage() {
  const { transactions, loading, error, refresh, loadMore, hasMore } = useTransactionHistory({
    userId: "user-address",
    action: "swap",
    limit: 20,
  });

  if (loading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {transactions.map((tx) => (
        <TransactionCard key={tx.id} transaction={tx} />
      ))}
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  );
}
```

### Notifications

```tsx
import { useNotifications } from "../gateway";

function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications({
    userId: "user-address",
    autoRefresh: true,
  });

  return (
    <div>
      <Bell count={unreadCount} />
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} onRead={() => markRead(n.id)} />
      ))}
    </div>
  );
}
```

## Environment Variable

Add to `.env`:

```bash
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080
```

## Supported Flows

1. `TON -> EVM` bridge (Layerswap)
2. `EVM -> TON` bridge (Layerswap)
3. `EVM -> EVM` swap/bridge (Thirdweb)

All supported flows are automatically tracked when users execute swaps in `SwapWidget`.
