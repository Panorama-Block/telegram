# Merge Report — `clean-frontend` ← `main`

> Gerado em: 2026-03-30
> Branch base: `clean-frontend` (2 commits à frente de `96cc5cb`)
> Branch a mergear: `main` (11 commits à frente de `clean-frontend`)
> Merge-base: `96cc5cb` (Merge PR #168)

---

## Resumo executivo

`clean-frontend` fez uma limpeza cirúrgica do frontend (remoção de componentes mortos, resiliência de dados, melhoria no error mapper) enquanto `main` adicionou uma camada técnica robusta (validação Zod, tracing de requests, contratos versionados, demo mode, ErrorBoundary redesenhado). O trabalho é **complementar** — não há sobreposição de funcionalidade, apenas divergência de implementação em 3 arquivos.

---

## Conflitos reais (arquivos modificados por ambas as branches)

### 1. `src/shared/lib/errorMapper.ts` — CONFLITO ALTO

Este é o único conflito que exige decisão manual cuidadosa. Ambas as branches expandiram o arquivo em direções diferentes.

#### O que cada branch fez

| Aspecto | `clean-frontend` | `main` |
|---|---|---|
| Detecção de erros nativos do browser | **Sim** — AbortError, TimeoutError, "failed to fetch" | **Não** — ausente |
| `isRetryableError()` | **Sim** — usada por usePortfolioData e useStakingData | **Não** — ausente |
| Status HTTP 500 | → `INTERNAL_SERVER_ERROR` | não mapeado |
| Status HTTP 502 | → `BAD_GATEWAY` | → `RPC_ERROR` |
| Status HTTP 504 | → `GATEWAY_TIMEOUT` | → `EXECUTION_TIMEOUT` |
| Códigos de staking | Não | **Sim** — POOL_NOT_FOUND, GAUGE_NOT_FOUND, NO_LP_POSITION, INSUFFICIENT_LP_BALANCE, NO_LIQUIDITY, NO_REWARDS, EXECUTOR_NOT_CONFIGURED |
| Códigos de DCA | Não | **Sim** — ORDER_NOT_FOUND, ORDER_UNAUTHORIZED, ORDER_INACTIVE |
| Códigos de queue | Não | **Sim** — QUEUE_FULL |
| Código EXECUTION_TIMEOUT | Não | **Sim** |
| Tom das mensagens | Mais casual ("Hang tight", "Retrying...") | Mais formal ("Please try again") |

#### Decisão recomendada: **montar manualmente combinando o melhor dos dois**

**Manter de `clean-frontend`:**
- Detecção de erros nativos do browser — `main` não tem isso e causa silent failures no mobile
- `isRetryableError()` inteira — código que depende dela já existe em `usePortfolioData` e `useStakingData`
- Mapeamento `502 → BAD_GATEWAY` (semanticamente correto: 502 é Bad Gateway, não erro de RPC)
- Mapeamento `504 → GATEWAY_TIMEOUT` (semanticamente correto: 504 é Gateway Timeout da infraestrutura)
- `500 → INTERNAL_SERVER_ERROR` (ausente em main, necessário)

**Manter de `main`:**
- Todos os códigos de domínio: staking, DCA, queue — `clean-frontend` não os tem e são necessários para as features ativas
- `EXECUTION_TIMEOUT` como código separado (para timeouts de execução de contrato, diferente de timeout de rede)

**Descartar de `main`:**
- `502 → RPC_ERROR` — substituir por `BAD_GATEWAY` conforme clean-frontend (mais preciso)
- `504 → EXECUTION_TIMEOUT` — substituir por `GATEWAY_TIMEOUT` (504 é infra, não execução on-chain)

**Tom das mensagens:** usar o tom de `clean-frontend` (mais apropriado para mini app mobile).

---

### 2. `src/clients/agentsClient.ts` — CONFLITO MÉDIO

#### O que cada branch fez

| Aspecto | `clean-frontend` | `main` |
|---|---|---|
| Parsing de `data.messages[]` | **Sim** — busca último `role: 'assistant'` | Não |
| Parsing de conversas (listConversations) | if/else verboso (código legado) | **Sim** — refatorado com `parseItem` + `items` normalizado |
| `buildHeaders` | method privado | **Sim** — inlinou diretamente onde usado |
| `MIME_TO_EXT` | removeu static da classe | **Sim** — moveu inline para o método |
| Debug logging em listConversations | Não | **Sim** — `this.logDebug(...)` |

#### Decisão recomendada

**Manter de `main`:**
- Refactor de `listConversations` com `parseItem` helper — código mais limpo e menos linhas
- `MIME_TO_EXT` inline no método (não como static de classe)
- Debug logging no listConversations
- `buildHeaders` inlinado

**Manter de `clean-frontend`:**
- Parsing de `data.messages[]` (busca o último `role: 'assistant'`) — `main` não tem esse fallback e pode quebrar respostas em formato de lista de mensagens

**Como aplicar:** ao resolver o conflito, o parsing de `data.messages[]` deve ser inserido antes dos outros fallbacks na ordem de extração de mensagem em `parseChatResponse`.

---

### 3. `src/app/providers.tsx` — CONFLITO BAIXO (trivial)

#### O que cada branch fez

- `clean-frontend`: trocou `if (tonConnectUI.account?.address) { console.log(...) }` por um comentário simples
- `main`: adicionou `<ErrorBoundary section="App">` envolvendo o root

**Decisão recomendada:** aceitar ambas. Manter o comentário simples de `clean-frontend` (sem o console.log de debug) e aceitar o `ErrorBoundary` wrapping de `main`. São mudanças em linhas completamente diferentes do arquivo — sem sobreposição real.

---

## Não há conflito em (informativo)

| Arquivo | Situação |
|---|---|
| `usePortfolioData.ts` | Só `clean-frontend` mudou — entra sem conflito |
| `useStakingData.ts` | Só `clean-frontend` mudou — entra sem conflito |
| `useYieldData.ts` | Só `main` mudou — entra sem conflito |
| `useLendingData.ts` | Só `main` mudou — entra sem conflito |
| `fetchWithAuth.ts` | Só `main` mudou — entra sem conflito |
| `swap/api.ts` | Só `main` mudou — entra sem conflito |
| `yield/api.ts` | Só `main` mudou — entra sem conflito |
| `shared/config/demo.ts` | Arquivo novo de `main` — entra sem conflito |
| `shared/contracts/v1/index.ts` | Arquivo novo de `main` — entra sem conflito |
| `shared/lib/responseSchemas.ts` | Arquivo novo de `main` — entra sem conflito |
| `shared/lib/ErrorBoundary.tsx` | Só `main` mudou — entra sem conflito |
| `shared/ui/ResilienceBanner.tsx` | Arquivo novo de `clean-frontend` — entra sem conflito |
| Componentes deletados em `clean-frontend` | `main` não tocou nenhum deles — deleções entram sem conflito |

---

## Checklist de testes pós-merge (local, antes de subir para produção)

Execute na ordem abaixo. Qualquer falha bloqueia o push.

### Build e tipos

- [ ] `npm run build` passa sem erros de TypeScript
- [ ] Sem warnings de Zod schema mismatch no console durante build

### Chat e agent

- [ ] Abrir chat, enviar uma mensagem e receber resposta (streaming ou não)
- [ ] Verificar que o histórico de conversas carrega na sidebar
- [ ] Abrir conversa existente e verificar que as mensagens anteriores aparecem
- [ ] Forçar resposta do backend em formato `{ messages: [...] }` (se possível) e verificar que o parser extrai corretamente o último `role: "assistant"`

### Swap

- [ ] Fluxo completo: selecionar tokens → cotar → preparar tx → executar → verificar status
- [ ] Verificar header `X-Trace-Id` presente nas requests em Network tab do DevTools
- [ ] Verificar que erros de quote retornam mensagem legível (não objeto bruto)

### Portfolio / Yield

- [ ] Página de portfolio carrega sem flicker de loading quando há cache
- [ ] `portfolioStale` flag: desconectar internet após primeiro load — verificar que dados antigos ficam visíveis com indicador de stale (não tela de erro em branco)
- [ ] `ResilienceBanner` aparece quando dados estão stale (feature de `clean-frontend`)

### Staking

- [ ] Lista de pools carrega
- [ ] Entrar em uma posição (prepare → execute)
- [ ] Sair de uma posição (prepare → execute)
- [ ] Erros de domínio (pool não encontrado, saldo insuficiente) mostram mensagem correta

### Lending

- [ ] Mercados carregam sem erro
- [ ] `dataStale` flag: simular erro de rede e verificar comportamento (dados antigos mantidos)

### Error handling

- [ ] `ErrorBoundary`: forçar um crash num componente filho e verificar que o fallback "This section ran into an issue. Please try again." aparece com botão "Try again" funcional
- [ ] `isRetryableError`: simular HTTP 502 — `usePortfolioData` deve manter dados visíveis como stale em vez de mostrar tela de erro
- [ ] Erros de browser nativos: simular `AbortError` (cancelar request via DevTools) — verificar mensagem "Request was cancelled" ao invés de erro genérico

### Validação Zod (schemas)

- [ ] Nenhum `console.error` de schema mismatch no console durante uso normal — se aparecer, o contrato do backend mudou e `responseSchemas.ts` precisa ser atualizado antes de ir para produção

### TonConnect

- [ ] Conectar carteira TON
- [ ] Recarregar página e verificar que sessão é restaurada silenciosamente (sem console.log de debug)

### Demo mode

- [ ] Iniciar com `NEXT_PUBLIC_DEMO_MODE=true` e verificar que os defaults de demo são usados (swap com ETH/USDC, staking com vAMM-WETH/USDC)
- [ ] Iniciar sem a variável e verificar comportamento normal inalterado

### Regressão geral

- [ ] Navegar por todas as rotas principais sem crash (chat, portfolio, swap, staking, lending)
- [ ] Testar no mobile (Telegram mini app) — especialmente o fluxo de auth e o comportamento do ErrorBoundary em tela pequena
