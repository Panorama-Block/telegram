# 🔑 Como Usar Session Keys com Thirdweb

## O que são Session Keys?

Session Keys são chaves temporárias com **permissões limitadas** que permitem executar transações **automaticamente**, sem necessidade de aprovação manual do usuário em cada operação.

### Vantagens:
- ✅ **Sem popups**: Transações executam automaticamente
- ✅ **Segurança**: Limites de gastos e tempo de validade
- ✅ **UX perfeita**: Ideal para DCA, jogos, automações
- ✅ **Controle total**: Você define o que a session key pode fazer

---

## Fluxo Completo

### 1️⃣ **Backend: Criar Smart Account**

Quando o usuário cria uma Smart Account no seu sistema:

```typescript
// Backend retorna após criar smart account:
{
  smartAccountAddress: "0x...",
  sessionKeyAddress: "0x...",
  sessionKeyPrivateKey: "0x...",  // ⚠️ IMPORTANTE: Retorne para o frontend!
  expiresAt: Date
}
```

**⚠️ IMPORTANTE**: A session key **PRECISA** ir para o frontend! É ela que vai assinar as transações automaticamente.

### 2️⃣ **Frontend: Salvar Session Key**

```typescript
import { useSessionKey } from '@/features/dca/useSessionKey';

// Após receber do backend:
const { saveSessionKey } = useSessionKey();

saveSessionKey({
  privateKey: resultado.sessionKeyPrivateKey,
  address: resultado.sessionKeyAddress,
  smartAccountAddress: resultado.smartAccountAddress,
  expiresAt: new Date(resultado.expiresAt).getTime(),
});
```

### 3️⃣ **Frontend: Usar para Transações Automáticas**

```typescript
import { useSessionKey } from '@/features/dca/useSessionKey';
import { createThirdwebClient } from 'thirdweb';
import { prepareTransaction, toWei } from 'thirdweb';
import { sepolia } from 'thirdweb/chains';

function MeuComponente() {
  const { executeWithSessionKey, hasSessionKey } = useSessionKey();
  const client = createThirdwebClient({ clientId: 'seu_client_id' });

  const enviarETHAutomaticamente = async () => {
    if (!hasSessionKey) {
      alert('Configure a session key primeiro!');
      return;
    }

    // Preparar transação
    const transaction = prepareTransaction({
      to: '0xDestinatário',
      value: toWei('0.01'), // 0.01 ETH
      chain: sepolia,
      client,
    });

    // Executar AUTOMATICAMENTE sem popup!
    const result = await executeWithSessionKey(client, transaction);

    console.log('✅ Transação enviada:', result.transactionHash);
    alert('ETH enviado automaticamente, sem popup! 🎉');
  };

  return (
    <button onClick={enviarETHAutomaticamente}>
      ⚡ Enviar ETH Automaticamente
    </button>
  );
}
```

### 4️⃣ **Assinar Mensagens (Auth) com Session Key**

```typescript
import { useSessionKey } from '@/features/dca/useSessionKey';
import { signMessage } from 'thirdweb/utils';
import { createThirdwebClient } from 'thirdweb';

const autenticarComSessionKey = async () => {
  const { getSessionAccount, hasSessionKey } = useSessionKey();
  const client = createThirdwebClient({ clientId: 'seu_client_id' });

  if (!hasSessionKey) {
    alert('Session key não configurada!');
    return;
  }

  // Criar account a partir da session key
  const sessionAccount = getSessionAccount(client);

  // Assinar mensagem AUTOMATICAMENTE
  const signature = await signMessage({
    message: 'Autenticando no sistema',
    account: sessionAccount,
  });

  // Enviar para backend verificar
  await fetch('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ signature }),
  });

  console.log('✅ Autenticado automaticamente!');
};
```

---

## Integração Completa (Exemplo Real)

### No componente de criação de Smart Account:

```typescript
const handleCreateSubAccount = async (config: SubAccountConfig) => {
  // 1. Criar smart account no backend
  const result = await createSmartAccount({
    userId: account.address,
    name: config.name,
    permissions: config.permissions,
  });

  // 2. Salvar session key no frontend
  const { saveSessionKey } = useSessionKey();
  saveSessionKey({
    privateKey: result.sessionKeyPrivateKey, // Vem do backend
    address: result.sessionKeyAddress,
    smartAccountAddress: result.smartAccountAddress,
    expiresAt: new Date(result.expiresAt).getTime(),
  });

  alert('✅ Smart Account criada! Agora você pode executar transações automaticamente.');
};
```

### No componente que usa DCA:

```typescript
const executarCompraDCA = async () => {
  const { executeWithSessionKey } = useSessionKey();
  const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });

  // Preparar transação de swap
  const transaction = prepareTransaction({
    to: '0xUniswapRouter',
    data: swapCalldata,
    value: toWei('0.1'),
    chain: sepolia,
    client,
  });

  // Executar AUTOMATICAMENTE!
  await executeWithSessionKey(client, transaction);

  console.log('✅ Compra DCA executada automaticamente!');
};
```

---

## ⚠️ Segurança

### ✅ O que é SEGURO:

1. **Session keys têm limites**: Você define quanto podem gastar
2. **Session keys expiram**: Tempo de validade definido
3. **Permissões granulares**: Pode restringir quais contratos acessar
4. **Carteira principal segura**: Session key não pode acessar fundos da carteira principal

### ❌ O que EVITAR:

1. ❌ **Não compartilhe session keys**: São sensíveis como qualquer chave privada
2. ❌ **Não use em sites não confiáveis**: Podem usar sua session key
3. ❌ **Não crie session keys muito permissivas**: Defina limites razoáveis
4. ❌ **Não armazene em servidores**: Session key fica no localStorage do usuário

---

## 🎯 Casos de Uso

### 1. **DCA (Dollar Cost Averaging)**
```typescript
// Comprar ETH automaticamente toda semana, sem popup!
const comprarETHSemanalmente = async () => {
  const { executeWithSessionKey } = useSessionKey();
  // ... executar swap automaticamente
};
```

### 2. **Jogos Blockchain**
```typescript
// Comprar item no jogo sem popup a cada compra
const comprarItemJogo = async (itemId: string) => {
  const { executeWithSessionKey } = useSessionKey();
  // ... executar compra automaticamente
};
```

### 3. **Automações**
```typescript
// Stake tokens automaticamente quando atingir certo valor
const stakeAutomatico = async () => {
  const { executeWithSessionKey } = useSessionKey();
  // ... fazer stake automaticamente
};
```

---

## 🚀 Testando

1. **Rode o projeto**: `npm run dev`
2. **Acesse a página DCA**: `/dca`
3. **Crie uma Smart Account**: Clique em "Nova Smart Account"
4. **Veja o demo**: Teste enviar transações automaticamente!

---

## 📚 Recursos

- [Thirdweb Session Keys Docs](https://portal.thirdweb.com/wallet/smart-wallet)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Hook useSessionKey](./src/features/dca/useSessionKey.ts)
- [Componente Demo](./src/features/dca/SessionKeyDemo.tsx)

---

## ❓ FAQ

**P: Session key é segura?**
R: Sim, desde que você defina limites apropriados (gastos máximos, contratos aprovados, tempo de validade).

**P: O que acontece se minha session key vazar?**
R: O atacante só pode gastar dentro dos limites definidos. Sua carteira principal está segura.

**P: Posso revogar uma session key?**
R: Sim, basta chamar `removeSessionKey()` no frontend e revocar no contrato da smart account.

**P: Preciso aprovar cada transação?**
R: NÃO! Esse é o ponto das session keys - transações executam automaticamente! 🎉
