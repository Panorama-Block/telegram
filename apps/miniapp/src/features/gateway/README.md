# Guia de Integração - Gateway History

Este guia mostra como integrar o tracking de transações no fluxo de swap.

## Arquivos Criados

```
features/gateway/
├── types.ts              # Types TypeScript
├── api.ts                # Cliente base do gateway
├── walletApi.ts          # API de wallets
├── transactionApi.ts     # API de transações
├── notificationApi.ts    # API de notificações
├── hooks.ts              # React hooks
├── swapIntegration.ts    # Helper para swap
└── index.ts              # Exports
```

## Integração no SwapWidget.tsx

A integração já está implementada em `components/SwapWidget.tsx`.

### Como funciona

1. **Import do helper**:
```tsx
import { startSwapTracking, type SwapTracker } from "@/features/gateway";
```

2. **State para o tracker**:
```tsx
const [swapTracker, setSwapTracker] = useState<SwapTracker | null>(null);
```

3. **Iniciar tracking antes do swap**:
```tsx
const tracker = await startSwapTracking({
  userId: account.address,
  walletAddress: account.address,
  chain: sellToken.network.toUpperCase(),
  action: isCrossChain ? 'bridge' : 'swap',
  fromChainId,
  fromAsset: {
    address: sellToken.address || 'native',
    symbol: sellToken.ticker,
    decimals,
  },
  fromAmount: amount,
  toChainId,
  toAsset: {
    address: buyToken.address || 'native',
    symbol: buyToken.ticker,
    decimals: buyToken.decimals || 18,
  },
  provider: 'thirdweb',
});
setSwapTracker(tracker);
```

4. **Adicionar hashes quando transações são confirmadas**:
```tsx
if (tracker) {
  tracker.addHash(receipt.transactionHash, txChainId, txAction);
}
```

5. **Marcar como confirmado/falho**:
```tsx
// Sucesso
if (tracker) {
  await tracker.markConfirmed(estimatedOutput);
}

// Falha (no catch)
if (tracker) {
  await tracker.markFailed('SWAP_FAILED', error.message);
}
```

## Usando os Hooks para Histórico

### Mostrar histórico de swaps

```tsx
import { useTransactionHistory } from '../gateway';

function SwapHistoryPage() {
  const { transactions, loading, error, refresh, loadMore, hasMore } = useTransactionHistory({
    userId: 'user-address',
    action: 'swap',
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

### Notificações

```tsx
import { useNotifications } from '../gateway';

function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications({
    userId: 'user-address',
    autoRefresh: true,
  });

  return (
    <div>
      <Bell count={unreadCount} />
      {notifications.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onRead={() => markRead(n.id)}
        />
      ))}
    </div>
  );
}
```

## Variáveis de Ambiente

Adicionar no `.env`:

```bash
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080
```

## Fluxos Suportados

1. **TON -> EVM Bridge** (Layerswap)
2. **EVM -> TON Bridge** (Layerswap)
3. **EVM -> EVM Swap/Bridge** (Thirdweb)

Todos os fluxos são automaticamente rastreados quando o usuário executa um swap no SwapWidget.
