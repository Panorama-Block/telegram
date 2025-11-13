# DCA (Dollar Cost Averaging) - Frontend Integration

## 📋 Visão Geral

Sistema de compras recorrentes automatizadas de criptomoedas usando Account Abstraction.

## 🎯 Funcionalidades

- ✅ Criação de smart wallets com session keys
- ✅ Configuração de estratégias DCA (daily/weekly/monthly)
- ✅ Swaps automatizados via Uniswap V3
- ✅ Histórico de execuções
- ✅ Gerenciamento de estratégias (pause/resume/delete)

## 📂 Estrutura de Arquivos

```
src/features/dca/
├── api.ts                 # Cliente API para backend DCA
└── README.md              # Esta documentação

src/app/dca/
└── page.tsx              # Página principal DCA
```

## 🔌 API Client (`api.ts`)

### Importação

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
} from '@/features/dca/api';
```

### Métodos Disponíveis

#### 1. Smart Accounts

```typescript
// Criar smart account
const result = await createSmartAccount({
  userId: userWalletAddress,
  name: "My DCA Wallet",
  permissions: {
    approvedTargets: ["*"],      // "*" permite qualquer contrato
    nativeTokenLimit: "0.1",     // Máx ETH por transação
    durationDays: 30             // Validade do session key
  }
});
// Returns: { smartAccountAddress, sessionKeyAddress, expiresAt }

// Listar smart accounts do usuário
const accounts = await getUserAccounts(userWalletAddress);
// Returns: SmartAccount[]

// Buscar smart account específica
const account = await getSmartAccount(smartAccountAddress);
// Returns: SmartAccount

// Deletar smart account
await deleteSmartAccount(smartAccountAddress, userId);
```

#### 2. Estratégias DCA

```typescript
// Criar estratégia
const result = await createStrategy({
  smartAccountId: smartAccount.address,
  fromToken: "0x0000000000000000000000000000000000000000", // ETH
  toToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",   // USDC
  fromChainId: 1,
  toChainId: 1,
  amount: "0.01",
  interval: "daily" // "daily" | "weekly" | "monthly"
});
// Returns: { strategyId, nextExecution }

// Listar estratégias de uma smart account
const strategies = await getAccountStrategies(smartAccountAddress);
// Returns: DCAStrategy[]

// Ativar/desativar estratégia
await toggleStrategy(strategyId, true); // true = ativo, false = pausado

// Deletar estratégia
await deleteStrategy(strategyId);
```

#### 3. Histórico

```typescript
// Buscar histórico de execuções
const history = await getExecutionHistory(smartAccountAddress, 50);
// Returns: ExecutionHistory[]
```

### Tipos TypeScript

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
  interval: 'daily' | 'weekly' | 'monthly';
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
  status: 'success' | 'failed';
  error?: string;
}
```

## 🎨 Página DCA (`/app/dca/page.tsx`)

### Estados do Componente

```typescript
const [smartAccounts, setSmartAccounts] = useState<SmartAccount[]>([]);
const [strategies, setStrategies] = useState<DCAStrategy[]>([]);
const [history, setHistory] = useState<ExecutionHistory[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [showCreateModal, setShowCreateModal] = useState(false);
```

### Fluxo de Uso

1. **Usuário sem Smart Wallet**
   - Mostra tela transparente com botão "Create Smart Wallet"
   - Redireciona para `/account`

2. **Usuário com Smart Wallet**
   - Mostra lista de estratégias ativas/inativas
   - Botão "Create Recurring Buy"
   - Cards com histórico de execuções

3. **Criar Estratégia**
   - Modal com formulário:
     - Seletor de smart wallet
     - Token de origem (com ícone)
     - Token de destino (com ícone)
     - Amount
     - Interval (daily/weekly/monthly)
   - Submit → chama API → atualiza lista

### Componentes UI

```typescript
// Modal de criação
<CreateDCAModal
  isOpen={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onConfirm={handleCreateStrategy}
  loading={loading}
  smartAccounts={smartAccounts}
/>

// Token selector (matching /swap design)
<button onClick={() => setShowFromSelector(true)}>
  <Image src={token.icon} />
  <span>{token.symbol}</span>
</button>

// Token modal popup
{showFromSelector && (
  <TokenSelectorModal
    onSelect={handleTokenSelect}
    onClose={() => setShowFromSelector(false)}
  />
)}
```

### Navegação

```typescript
// Navbar com Explore dropdown
<nav>
  <Link href="/swap">Swap</Link>
  <Link href="/lending">Lending</Link>
  <Link href="/staking">Staking</Link>
  <Link href="/dca">DCA</Link> {/* ← Nova entrada */}
  <Link href="/account">Account</Link>
</nav>
```

## 🔄 Data Flow

```
User Input (Modal)
    ↓
handleCreateStrategy()
    ↓
createStrategy() API call
    ↓
Backend creates strategy + schedules in Redis
    ↓
loadSmartAccounts() refresh
    ↓
UI updates with new strategy
    ↓
Cron job executes at scheduled time
    ↓
getExecutionHistory() shows result
```

## 🎨 Design System

### Cores

- Background: `bg-[#202020]/85` (modal), `bg-[#2A2A2A]/80` (cards)
- Texto: `text-white`, `text-gray-400`
- Accent: `text-cyan-400`, `bg-cyan-400/20`
- Borders: `border-white/10`

### Tipografia

- Títulos: `text-3xl font-bold`
- Input values: `text-3xl font-light`
- Labels: `text-xs text-gray-400`
- Buttons: `text-sm font-medium`

### Layout

- Modal: `rounded-[25px]` (matching /swap)
- Cards: `rounded-xl`
- Buttons: `rounded-lg`
- Max width: `max-w-md` (modals), `max-w-2xl` (content)

## ⚙️ Environment Variables

```bash
# .env
DCA_API_BASE=http://localhost:3004
NEXT_PUBLIC_DCA_API_BASE=http://localhost:3004
```

## 🧪 Testing

### Criar Estratégia de Teste

```typescript
// Console do navegador
const testStrategy = {
  smartAccountId: "0x...",
  fromToken: "0x0000000000000000000000000000000000000000",
  toToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  fromChainId: 1,
  toChainId: 1,
  amount: "0.001", // Valor baixo para testes
  interval: "daily"
};

const result = await createStrategy(testStrategy);
console.log("Created:", result);
```

### Verificar Logs no Console

O modal de criação loga os dados completos:

```javascript
console.log('\n=== DCA RECURRING BUY - REQUEST TO BACKEND ===');
console.log('API Request Data:', JSON.stringify(dcaStrategyRequest, null, 2));
console.log('\n=== ADDITIONAL METADATA ===');
console.log('Smart Wallet:', dcaMetadata.smartWallet);
console.log('Quote Details:', dcaMetadata.quoteParams);
console.log('Timing:', dcaMetadata.timing);
```

## ⚠️ Cuidados Importantes

### 1. Smart Account Precisa de ETH

A smart account precisa ter saldo suficiente:
- ETH para o swap (amount)
- ETH para gas (~0.01-0.05 ETH por transação)

### 2. Session Keys Expiram

- Validade padrão: 30 dias
- Estratégias são pausadas automaticamente se session key expirar
- Usuário precisa criar nova smart account

### 3. Intervals

- `daily`: Executa a cada 24 horas
- `weekly`: Executa a cada 7 dias
- `monthly`: Executa a cada 30 dias

### 4. Tokens Suportados

- ETH nativo: `0x0000000000000000000000000000000000000000`
- Tokens ERC20: Endereço do contrato
- Apenas tokens com liquidez no Uniswap V3

## 🐛 Debugging

### Verificar Estado no Backend

```bash
# Listar todas as estratégias
curl http://localhost:3004/dca/debug/all-strategies | jq

# Ver fila de execução
curl http://localhost:3004/dca/debug/scheduled | jq

# Ver histórico
curl http://localhost:3004/dca/debug/all-history | jq

# Executar manualmente (testing)
curl -X POST http://localhost:3004/dca/debug/execute/{strategyId}
```

### Erros Comuns

**"Failed to fetch"**
- Backend não está rodando
- URL incorreta no .env
- CORS não configurado

**"Smart account not found"**
- Smart account não existe
- Endereço incorreto
- Banco de dados limpo

**"Session key expired"**
- Smart account precisa ser recriada
- Prazo de 30 dias passou

## 📱 Responsividade

A página DCA é totalmente responsiva:

```typescript
// Mobile-first
<div className="p-4 md:p-6">
  <h1 className="text-2xl md:text-4xl">DCA</h1>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Cards */}
  </div>
</div>
```

## 🎯 UX Best Practices

1. **Loading States**: Mostrar spinners durante operações assíncronas
2. **Error Messages**: Mensagens claras e acionáveis
3. **Success Feedback**: Toast notifications após criar estratégia
4. **Empty States**: Tela bonita quando não há estratégias
5. **Confirmations**: Confirmar antes de deletar estratégia

## 🔗 Links Úteis

- Backend Docs: `/panorama-block-backend/dca-service/DCA_DOCUMENTATION.md`
- Thirdweb Docs: https://portal.thirdweb.com
- Uniswap V3 Docs: https://docs.uniswap.org/contracts/v3

---

**Última atualização**: 2025-11-11
**Versão**: 1.0.0
