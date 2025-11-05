# 🌊 Liquidity Provision Feature

Implementação completa do fluxo de **Liquidity Provision** para o chat da Panorama Block.

## 📁 Estrutura de Arquivos

```
src/features/liquidity/
├── types.ts                    # Tipos TypeScript
├── mockApi.ts                  # API mockada para testes
├── useLiquidityFlow.ts         # Hook React customizado
├── INTEGRATION_EXAMPLE.tsx     # Exemplo completo de integração
└── README.md                   # Este arquivo

src/components/ui/
├── LiquidityPreviewCard.tsx    # Card de preview da posição
└── LiquiditySuccessCard.tsx    # Card de sucesso
```

## 🚀 Quick Start

### 1. Importar o hook e componentes

```typescript
// No topo do seu chat/page.tsx
import { useLiquidityFlow } from '@/features/liquidity/useLiquidityFlow';
import { LiquidityPreviewCard } from '@/components/ui/LiquidityPreviewCard';
import { LiquiditySuccessCard } from '@/components/ui/LiquiditySuccessCard';
```

### 2. Usar o hook

```typescript
// Dentro do seu componente ChatPage
const liquidity = useLiquidityFlow({
  accountAddress: account?.address,
  activeConversationId,
  onAddMessage: (message) => {
    // Adicionar mensagem ao chat
    setMessagesByConversation((prev) => ({
      ...prev,
      [activeConversationId!]: [...(prev[activeConversationId!] || []), message],
    }));
  },
  getNetworkByName,
});
```

### 3. Detectar metadata do agente

```typescript
// Na função que processa respostas do agente
if (agentResponse.metadata) {
  const meta = agentResponse.metadata as Record<string, unknown>;

  if (meta.action === 'request_liquidity_provision') {
    await liquidity.handleLiquidityFromMetadata(meta);
  }
}
```

### 4. Renderizar os componentes

```tsx
{/* Preview Card */}
{liquidity.liquidityQuote && !liquidity.liquiditySuccess && (
  <LiquidityPreviewCard
    quote={liquidity.liquidityQuote}
    onConfirm={liquidity.handleConfirmLiquidity}
    onCancel={liquidity.handleCancelLiquidity}
    isLoading={liquidity.executingLiquidity}
  />
)}

{/* Success Card */}
{liquidity.liquiditySuccess && liquidity.liquidityTxHashes.length > 0 && (
  <LiquiditySuccessCard
    txHashes={liquidity.liquidityTxHashes}
    positionId="12345"
    token0Symbol={liquidity.liquidityQuote?.token0.symbol || 'ETH'}
    token1Symbol={liquidity.liquidityQuote?.token1.symbol || 'TOKEN'}
    onClose={liquidity.handleCloseLiquiditySuccess}
  />
)}
```

## 📊 Formato de Metadata do Agente

O agente deve retornar metadata no seguinte formato:

```json
{
  "action": "request_liquidity_provision",
  "chain": "ethereum",
  "token0": "ETH",
  "token1": "1INCH",
  "amount0": "0.278",
  "amount1": "1.19",
  "feeTier": 100
}
```

### Fee Tiers

| Valor  | Percentual | Descrição                    |
|--------|------------|------------------------------|
| 100    | 0.01%      | Muito estável (stablecoins)  |
| 500    | 0.05%      | Estável                      |
| 3000   | 0.3%       | **Padrão** (maioria dos pares) |
| 10000  | 1%         | Exótico (alta volatilidade)  |

## 🎨 Componentes UI

### LiquidityPreviewCard

Preview interativo da posição de liquidez antes de confirmar.

**Props:**
- `quote`: Dados do quote da API
- `onConfirm`: Callback para confirmar
- `onCancel`: Callback para cancelar
- `isLoading`: Estado de loading durante execução

**Features:**
- ✅ Exibe tokens depositados
- ✅ Mostra range de preços (Min/Max/Current)
- ✅ Fee tier com badge
- ✅ Estimated APR
- ✅ Gas fee
- ✅ Share of pool
- ✅ Botões de ação

### LiquiditySuccessCard

Card de sucesso após abrir a posição.

**Props:**
- `txHashes`: Array de transaction hashes
- `positionId`: ID da posição criada
- `token0Symbol`: Símbolo do token 0
- `token1Symbol`: Símbolo do token 1
- `onClose`: Callback para fechar

**Features:**
- ✅ Exibe transaction hash com link para explorer
- ✅ Position ID
- ✅ Próximos passos (orientações)
- ✅ Suporte a múltiplas chains

## 🔧 Hook API

### useLiquidityFlow

Hook que encapsula toda a lógica de liquidity provision.

**States retornados:**
```typescript
{
  liquidityQuote: LiquidityQuoteResponse['quote'] | null,
  liquidityLoading: boolean,
  liquidityError: string | null,
  liquiditySuccess: boolean,
  executingLiquidity: boolean,
  liquidityTxHashes: Array<{ hash: string; chainId: number }>,
  currentLiquidityMetadata: Record<string, unknown> | null,
}
```

**Handlers retornados:**
```typescript
{
  handleLiquidityFromMetadata: (metadata) => Promise<void>,
  handleConfirmLiquidity: () => Promise<void>,
  handleCancelLiquidity: () => void,
  handleCloseLiquiditySuccess: () => void,
  resetLiquidityFlow: () => void,
}
```

## 🧪 Mock API

Atualmente usando API mockada para testes. Funções disponíveis:

```typescript
import {
  getLiquidityQuote,
  prepareLiquidityTransaction,
  getLiquidityPositionStatus,
  generateMockTxHash,
} from '@/features/liquidity/mockApi';
```

### getLiquidityQuote

Retorna um quote mockado com todos os dados necessários.

```typescript
const quote = await getLiquidityQuote({
  chainId: 1,
  token0: 'native', // ou endereço do token
  token1: '0x...',
  amount0: '0.5',
  amount1: '1500',
  feeTier: 3000, // opcional, padrão: 3000 (0.3%)
});
```

### Delays simulados
- `getLiquidityQuote`: 1200ms
- `prepareLiquidityTransaction`: 800ms
- `getLiquidityPositionStatus`: 1500ms

## 🎬 Fluxo Completo

```
1. Usuário → Clica "Liquidity Provision Management"
   ↓
2. Chat → Envia prompt automático
   ↓
3. Agente → Responde com metadata
   ↓
4. Frontend → Detecta metadata.action === 'request_liquidity_provision'
   ↓
5. Hook → Chama handleLiquidityFromMetadata()
   ↓
6. API Mock → getLiquidityQuote() (1.2s delay)
   ↓
7. UI → Renderiza LiquidityPreviewCard
   ↓
8. Usuário → Clica "Confirm Open Position"
   ↓
9. Hook → handleConfirmLiquidity() (2s delay)
   ↓
10. UI → Renderiza LiquiditySuccessCard com tx hash
    ↓
11. Usuário → Pode fechar o card ou ver no explorer
```

## 🔄 Atualizar FEATURE_CARDS

```typescript
const FEATURE_CARDS = [
  // ... outros cards
  {
    name: 'Liquidity Provision Management',
    icon: ComboChart,
    path: null,
    prompt: 'I want to add liquidity to a pool. Can you help me provide liquidity and earn fees?',
    description: 'Manage pool entries and exits through simple prompts optimizing routes, ranges and capital across chains'
  },
  // ... outros cards
];
```

## 🎯 Exemplo de Teste Rápido

Para testar rapidamente sem o agente:

```typescript
// Adicionar um botão temporário
<button
  onClick={async () => {
    await liquidity.handleLiquidityFromMetadata({
      action: 'request_liquidity_provision',
      chain: 'ethereum',
      token0: 'ETH',
      token1: '1INCH',
      amount0: '0.278',
      amount1: '1.19',
      feeTier: 100,
    });
  }}
  className="px-4 py-2 bg-pano-primary text-black rounded-lg"
>
  🧪 Test Liquidity
</button>
```

## 🚧 Próximos Passos (Integração Real)

1. **Substituir Mock API** por chamadas reais ao backend
2. **Integrar Thirdweb** para transações on-chain reais
3. **Adicionar seletor de tokens** interativo
4. **Range de preços customizável** (concentrated liquidity)
5. **Multi-step transactions** (approve + add liquidity)
6. **Status polling** para aguardar confirmação on-chain

## 📚 Arquivos de Referência

- 📄 `INTEGRATION_GUIDE.md` - Guia detalhado passo a passo
- 💻 `INTEGRATION_EXAMPLE.tsx` - Código exemplo completo
- 🎨 Design system em `src/app/globals.css`

## 🆘 Troubleshooting

**Erro: "Network not supported"**
→ Verifique se a função `getNetworkByName()` está retornando o chainId correto

**Quote não aparece**
→ Verifique o console para logs com `[LIQUIDITY]`
→ Confirme que a metadata tem `action: 'request_liquidity_provision'`

**Card não renderiza**
→ Verifique se `liquidity.liquidityQuote` não é null
→ Confirme que os componentes estão importados corretamente

## 📞 Suporte

Para dúvidas ou problemas, consulte:
1. `INTEGRATION_GUIDE.md` - Guia completo
2. `INTEGRATION_EXAMPLE.tsx` - Código exemplo
3. Console do browser - Procure por logs `[LIQUIDITY]`

---

**Status**: ✅ Pronto para integração
**Versão**: 1.0.0
**Última atualização**: 2025-01-05
