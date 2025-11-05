# 🚀 Liquidity Provision - Quick Start

> **TL;DR**: Adicione liquidity provision ao chat em 5 minutos

## ✅ O que foi criado

```
📦 Arquivos criados:
├── src/features/liquidity/
│   ├── types.ts                         ✅ Tipos TypeScript
│   ├── mockApi.ts                       ✅ API mockada
│   ├── useLiquidityFlow.ts             ✅ Hook React
│   ├── INTEGRATION_EXAMPLE.tsx          ✅ Exemplo completo
│   └── README.md                        ✅ Documentação
│
├── src/components/ui/
│   ├── LiquidityPreviewCard.tsx        ✅ Preview component
│   └── LiquiditySuccessCard.tsx        ✅ Success component
│
└── LIQUIDITY_INTEGRATION_GUIDE.md       ✅ Guia detalhado
```

## 🎯 Integração em 3 Passos

### Passo 1: Importar (5 linhas)

Adicione no topo do `src/app/chat/page.tsx`:

```typescript
import { useLiquidityFlow } from '@/features/liquidity/useLiquidityFlow';
import { LiquidityPreviewCard } from '@/components/ui/LiquidityPreviewCard';
import { LiquiditySuccessCard } from '@/components/ui/LiquiditySuccessCard';
```

### Passo 2: Hook (10 linhas)

Dentro do componente `ChatPage()`, após os outros hooks:

```typescript
const liquidity = useLiquidityFlow({
  accountAddress: account?.address,
  activeConversationId,
  onAddMessage: (message) => {
    setMessagesByConversation((prev) => ({
      ...prev,
      [activeConversationId!]: [...(prev[activeConversationId!] || []), message],
    }));
  },
  getNetworkByName,
});
```

### Passo 3: Renderizar (30 linhas)

Adicione no JSX, logo após os componentes de swap:

```tsx
{/* Liquidity Preview */}
{liquidity.liquidityQuote && !liquidity.liquiditySuccess && (
  <div className="mb-4">
    <LiquidityPreviewCard
      quote={liquidity.liquidityQuote}
      onConfirm={liquidity.handleConfirmLiquidity}
      onCancel={liquidity.handleCancelLiquidity}
      isLoading={liquidity.executingLiquidity}
    />
  </div>
)}

{/* Liquidity Success */}
{liquidity.liquiditySuccess && liquidity.liquidityTxHashes.length > 0 && (
  <div className="mb-4">
    <LiquiditySuccessCard
      txHashes={liquidity.liquidityTxHashes}
      positionId="12345"
      token0Symbol={liquidity.liquidityQuote?.token0.symbol || 'ETH'}
      token1Symbol={liquidity.liquidityQuote?.token1.symbol || 'TOKEN'}
      onClose={liquidity.handleCloseLiquiditySuccess}
    />
  </div>
)}

{/* Liquidity Error */}
{liquidity.liquidityError && (
  <div className="mb-4 rounded-xl border border-pano-error/20 bg-pano-error/5 p-4">
    <p className="text-sm font-semibold text-pano-error">Liquidity Error</p>
    <p className="text-xs text-pano-text-secondary mt-1">{liquidity.liquidityError}</p>
  </div>
)}
```

## 🔗 Conectar ao Agente

Na função que processa respostas do agente, adicione:

```typescript
// Detectar metadata de liquidity
if (agentResponse.metadata) {
  const meta = agentResponse.metadata as Record<string, unknown>;

  if (meta.action === 'request_liquidity_provision') {
    await liquidity.handleLiquidityFromMetadata(meta);
  }
}
```

## 📝 Atualizar Feature Card

No array `FEATURE_CARDS`, atualize a linha de Liquidity Provision:

```typescript
{
  name: 'Liquidity Provision Management',
  icon: ComboChart,
  path: null,
  prompt: 'I want to add liquidity to a pool. Can you help me provide liquidity and earn fees?',
  description: 'Manage pool entries and exits through simple prompts optimizing routes, ranges and capital across chains'
},
```

## 🧪 Testar

Adicione um botão de teste temporário:

```tsx
<button
  onClick={() => {
    liquidity.handleLiquidityFromMetadata({
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

## 📸 Resultado

Ao clicar no card "Liquidity Provision Management" ou no botão de teste:

1. ✅ **Preview Card aparece** com:
   - Tokens depositados (ETH + 1INCH)
   - Range de preços (Min/Max/Current)
   - Fee tier (0.01%)
   - Estimated APR
   - Gas fee
   - Botões Cancel / Confirm

2. ✅ **Ao confirmar**:
   - Loading por 2 segundos
   - Success card aparece com tx hash
   - Link para explorer
   - Mensagem automática no chat

## 📚 Documentação Completa

- 📄 `LIQUIDITY_INTEGRATION_GUIDE.md` - Guia passo a passo detalhado
- 💻 `src/features/liquidity/INTEGRATION_EXAMPLE.tsx` - Código completo
- 📖 `src/features/liquidity/README.md` - Documentação técnica

## 🎨 Design System

Todos os componentes seguem o **PanoramaBlock Design System v2.0**:
- ✅ Cores: Emerald Green (#00FFC3) + Dark backgrounds
- ✅ Curvaturas: rounded-lg (8px) padrão
- ✅ Fontes: SuisseIntl
- ✅ Sombras: Glow effects + Glass morphism
- ✅ Animações: slideUp, fadeIn
- ✅ Mobile-first: Touch targets 44px+

## 🔧 Formato de Metadata do Agente

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

## 🎯 Checklist Final

- [ ] Imports adicionados
- [ ] Hook configurado
- [ ] Componentes renderizados
- [ ] Detecção de metadata implementada
- [ ] Feature card atualizado
- [ ] Testado com botão de teste
- [ ] Funciona com agente (metadata real)

## 🚀 Pronto!

Com isso você tem um **fluxo completo de liquidity provision mockado**, seguindo exatamente o mesmo padrão do swap existente, com a mesma qualidade visual e UX.

---

**Tempo estimado de integração**: 15-30 minutos

**Dificuldade**: ⭐⭐ (Fácil - Copy & Paste ready)

**Status**: ✅ Pronto para produção (mock)
