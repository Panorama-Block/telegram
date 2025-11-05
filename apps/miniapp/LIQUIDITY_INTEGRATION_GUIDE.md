# Guia de Integração: Liquidity Provision no Chat

Este guia contém todas as modificações necessárias para integrar o fluxo de Liquidity Provision no chat.

## 1. Imports Adicionais

Adicione no topo do arquivo `src/app/chat/page.tsx`, junto com os outros imports:

```typescript
// Adicionar estes imports após os imports do swap
import { LiquidityPreviewCard } from '@/components/ui/LiquidityPreviewCard';
import { LiquiditySuccessCard } from '@/components/ui/LiquiditySuccessCard';
import type { LiquidityQuoteResponse } from '@/features/liquidity/types';
import { getLiquidityQuote, prepareLiquidityTransaction, generateMockTxHash } from '@/features/liquidity/mockApi';
```

## 2. Atualizar FEATURE_CARDS

Substitua a linha do "Liquidity Provision Management" no array `FEATURE_CARDS`:

```typescript
const FEATURE_CARDS = [
  { name: 'Portfolio View', icon: Briefcase, path: null, prompt: null, description: 'Track and manage your entire DeFi portfolio in one place' },
  // ALTERAR ESTA LINHA:
  {
    name: 'Liquidity Provision Management',
    icon: ComboChart,
    path: null,
    prompt: 'I want to add liquidity to a pool. Can you help me provide liquidity and earn fees?', // NOVO PROMPT
    description: 'Manage pool entries and exits through simple prompts optimizing routes, ranges and capital across chains'
  },
  { name: 'Liquid Staking', icon: BlockchainTechnology, path: null, prompt: null, description: 'Stake assets through direct commands with automated reward tracking and compounding cycles across various protocols.' },
  { name: 'Lending & Borrowing', icon: WalletIcon, path: null, prompt: null, description: 'Access positions across protocols through easy commands managing collateral, comparing rates and adjusting exposure.' },
  { name: 'DCA & Trigger Orders', icon: LightningIcon, path: null, prompt: null, description: 'Configure multi-token DCA plans and threshold-based execution rules directly in chat.' },
  { name: 'Liquid Swap', icon: SwapIcon, path: null, prompt: 'I would like to perform a token swap. Can you help me with the process and guide me through the steps?', description: 'Swap tokens across multiple chains with the best rates' },
];
```

## 3. Estados para Liquidity (após os estados de Swap)

Adicione após a linha `const [currentSwapMetadata, setCurrentSwapMetadata] = useState<Record<string, unknown> | null>(null);`:

```typescript
  // Liquidity states
  const [liquidityQuote, setLiquidityQuote] = useState<LiquidityQuoteResponse['quote'] | null>(null);
  const [liquidityLoading, setLiquidityLoading] = useState(false);
  const [liquidityError, setLiquidityError] = useState<string | null>(null);
  const [liquiditySuccess, setLiquiditySuccess] = useState(false);
  const [executingLiquidity, setExecutingLiquidity] = useState(false);
  const [liquidityTxHashes, setLiquidityTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const [currentLiquidityMetadata, setCurrentLiquidityMetadata] = useState<Record<string, unknown> | null>(null);
```

## 4. Handler para processar metadata de Liquidity

Adicione esta função após a função de swap (procure por funções que começam com `handle`):

```typescript
  // Handle liquidity provision from agent metadata
  const handleLiquidityFromMetadata = useCallback(async (metadata: Record<string, unknown>) => {
    if (!metadata || typeof metadata !== 'object') {
      console.warn('[LIQUIDITY] Invalid metadata');
      return;
    }

    setCurrentLiquidityMetadata(metadata);
    setLiquidityLoading(true);
    setLiquidityError(null);

    try {
      // Extract liquidity parameters from metadata
      const chainName = metadata.chain as string || 'ethereum';
      const token0Symbol = metadata.token0 as string || 'ETH';
      const token1Symbol = metadata.token1 as string || '1INCH';
      const amount0 = metadata.amount0 as string || '0.278';
      const amount1 = metadata.amount1 as string || '1.19';
      const feeTier = (metadata.feeTier as number) || 100; // 0.01% default

      console.log('[LIQUIDITY] Processing provision:', {
        chainName,
        token0Symbol,
        token1Symbol,
        amount0,
        amount1,
        feeTier,
      });

      // Get network
      const network = getNetworkByName(chainName);
      if (!network) {
        throw new Error(`Network ${chainName} not supported`);
      }

      // Get quote
      const quoteResponse = await getLiquidityQuote({
        chainId: network.chainId,
        token0: token0Symbol.toUpperCase() === 'ETH' ? 'native' : '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Mock USDC address
        token1: token1Symbol.toUpperCase() === 'ETH' ? 'native' : '0x111111111117dC0aa78b770fA6A738034120C302', // Mock 1INCH address
        amount0: amount0,
        amount1: amount1,
        feeTier: feeTier,
      });

      if (!quoteResponse.success || !quoteResponse.quote) {
        throw new Error(quoteResponse.message || 'Failed to get liquidity quote');
      }

      setLiquidityQuote(quoteResponse.quote);
      console.log('[LIQUIDITY] Quote received:', quoteResponse.quote);
    } catch (error) {
      console.error('[LIQUIDITY] Error getting quote:', error);
      setLiquidityError(error instanceof Error ? error.message : 'Failed to get liquidity quote');
    } finally {
      setLiquidityLoading(false);
    }
  }, []);

  // Confirm and execute liquidity provision
  const handleConfirmLiquidity = useCallback(async () => {
    if (!liquidityQuote || !currentLiquidityMetadata || !account) {
      console.warn('[LIQUIDITY] Missing required data');
      return;
    }

    setExecutingLiquidity(true);
    setLiquidityError(null);

    try {
      console.log('[LIQUIDITY] Executing liquidity provision...');

      // Mock transaction execution
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate mock transaction hash
      const mockTxHash = generateMockTxHash();
      const txData = {
        hash: mockTxHash,
        chainId: liquidityQuote.chainId,
      };

      setLiquidityTxHashes([txData]);
      setLiquiditySuccess(true);
      setLiquidityQuote(null);

      console.log('[LIQUIDITY] Position opened successfully:', txData);

      // Add success message to chat
      const successMessage: Message = {
        role: 'assistant',
        content: `✅ Liquidity position opened successfully!\n\nYour ${liquidityQuote.token0.symbol}/${liquidityQuote.token1.symbol} position is now active and earning fees.\n\n**Transaction Hash:** \`${mockTxHash}\`\n\n**Position Details:**\n- Fee Tier: ${liquidityQuote.feeTierLabel}\n- Share of Pool: ${liquidityQuote.shareOfPool}%\n- Estimated APR: ${liquidityQuote.estimatedApr}%\n\nYou can monitor your position in the Portfolio section.`,
        timestamp: new Date(),
      };

      if (activeConversationId) {
        setMessagesByConversation((prev) => ({
          ...prev,
          [activeConversationId]: [...(prev[activeConversationId] || []), successMessage],
        }));
      }
    } catch (error) {
      console.error('[LIQUIDITY] Error executing:', error);
      setLiquidityError(error instanceof Error ? error.message : 'Failed to execute liquidity provision');
    } finally {
      setExecutingLiquidity(false);
    }
  }, [liquidityQuote, currentLiquidityMetadata, account, activeConversationId]);

  // Cancel liquidity provision
  const handleCancelLiquidity = useCallback(() => {
    setLiquidityQuote(null);
    setCurrentLiquidityMetadata(null);
    setLiquidityError(null);
  }, []);

  // Close liquidity success card
  const handleCloseLiquiditySuccess = useCallback(() => {
    setLiquiditySuccess(false);
    setLiquidityTxHashes([]);
  }, []);
```

## 5. Detectar metadata de liquidity no processamento de mensagens

Encontre a função que processa mensagens do agente (procure por `handleSendMessage` ou similar) e adicione a detecção de metadata de liquidity:

```typescript
// Dentro da função que processa a resposta do agente, adicione:

// Check if message contains liquidity metadata
if (agentMsg.metadata && typeof agentMsg.metadata === 'object') {
  const meta = agentMsg.metadata as Record<string, unknown>;

  // Detectar intent de liquidity
  if (meta.action === 'request_liquidity_provision' || meta.intent === 'add_liquidity') {
    console.log('[LIQUIDITY] Detected liquidity intent in metadata');
    await handleLiquidityFromMetadata(meta);
  }
}
```

## 6. Renderizar componentes de Liquidity no JSX

Encontre a seção onde o SwapSuccessCard é renderizado e adicione os componentes de liquidity logo após:

```tsx
{/* Liquidity Preview Card */}
{liquidityQuote && !liquiditySuccess && (
  <div className="mb-4">
    <LiquidityPreviewCard
      quote={liquidityQuote}
      onConfirm={handleConfirmLiquidity}
      onCancel={handleCancelLiquidity}
      isLoading={executingLiquidity}
    />
  </div>
)}

{/* Liquidity Success Card */}
{liquiditySuccess && liquidityTxHashes.length > 0 && liquidityQuote && (
  <div className="mb-4">
    <LiquiditySuccessCard
      txHashes={liquidityTxHashes}
      positionId="12345"
      token0Symbol={liquidityQuote.token0.symbol}
      token1Symbol={liquidityQuote.token1.symbol}
      onClose={handleCloseLiquiditySuccess}
    />
  </div>
)}

{/* Liquidity Error */}
{liquidityError && (
  <div className="mb-4 rounded-xl border border-pano-error/20 bg-pano-error/5 p-4">
    <p className="text-sm font-semibold text-pano-error">Liquidity Error</p>
    <p className="text-xs text-pano-text-secondary mt-1">{liquidityError}</p>
  </div>
)}
```

## 7. Teste Manual

Para testar o fluxo, você pode simular uma resposta do agente com metadata:

```typescript
// No handleSendMessage ou similar, adicione um case de teste:
if (inputMessage.toLowerCase().includes('add liquidity') || inputMessage.toLowerCase().includes('provide liquidity')) {
  // Simular resposta do agente
  const mockAgentResponse: Message = {
    role: 'assistant',
    content: 'I can help you add liquidity to earn fees! Let me prepare a position preview for you.',
    timestamp: new Date(),
    metadata: {
      action: 'request_liquidity_provision',
      chain: 'ethereum',
      token0: 'ETH',
      token1: '1INCH',
      amount0: '0.278',
      amount1: '1.19',
      feeTier: 100, // 0.01%
    },
  };

  // Processar esta mensagem
  await handleLiquidityFromMetadata(mockAgentResponse.metadata);
}
```

## 8. Estrutura Final

Após todas as modificações, o fluxo será:

1. **Usuário clica no card "Liquidity Provision Management"** → Envia prompt
2. **Agente responde** com metadata de liquidity provision
3. **Frontend detecta metadata** → Chama `handleLiquidityFromMetadata`
4. **Mock API retorna quote** → Renderiza `LiquidityPreviewCard`
5. **Usuário clica "Confirm"** → Executa mock transaction
6. **Renderiza `LiquiditySuccessCard`** com tx hash

## Arquivos Criados

✅ `/src/features/liquidity/types.ts` - Tipos TypeScript
✅ `/src/features/liquidity/mockApi.ts` - API mockada
✅ `/src/components/ui/LiquidityPreviewCard.tsx` - Componente de preview
✅ `/src/components/ui/LiquiditySuccessCard.tsx` - Componente de sucesso

## Próximos Passos

1. Aplicar as modificações no `chat/page.tsx` seguindo este guia
2. Testar o fluxo completo
3. Ajustar estilos conforme necessário
4. Integrar com API real quando disponível
