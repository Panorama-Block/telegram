# Status das Tasks do Kanban — Visão por Branch

> Gerado em: 2026-03-30
> Analisado com base nos commits de `clean-frontend` e `main` (até 25/03/2026)

---

## Resumo rápido

| # | Tarefa | Branch | Status |
|---|---|---|---|
| #467 | [miniapp] Cleanup Unused Code Paths & Dead Logic | `clean-frontend` | **Concluída** |
| #466 | [miniapp] Implement UX Error Handling & State Fallbacks | ambas | **Parcial — completa só após merge** |
| #465 | [miniapp] Align Frontend-Backend Serialization & Validation | `main` | **Concluída** |
| #468 | [miniapp] Define Versioned Shared Contract Types | `main` | **Concluída** |
| #469 | [miniapp] Demo Optimization & Request Tracing | `main` | **Concluída** |
| #470 | [backend] Separate Dev vs. Demo Environment Config | backend | **Concluída (frontend ok)** |
| #471 | [backend] Consolidate Architecture & Contract Documentation | backend | **Incerta** |

---

## Detalhamento por task

### #467 — [miniapp] Cleanup Unused Code Paths & Dead Logic
**Status: CONCLUÍDA** — branch `clean-frontend`

O commit `clean miniapp v1` executou a limpeza completa:
- Deletados: `ComingSoonOverlay.tsx`, `SwapSuccessCard.tsx`, `TokenSelector.tsx`, `AuthGuard.tsx`, `ChatContext.tsx`, `DataInput.tsx`, `GlassCard.tsx`, `NeonButton.tsx`, `TransactionSettingsContext.tsx`, `transactionUtils.ts`
- Simplificado: `agentsClient.ts`, `dashboard/page.tsx`, `SeniorAppShell.tsx`
- Resultado: ~967 linhas removidas

Nada mais a fazer nesta task.

---

### #466 — [miniapp] Implement UX Error Handling & State Fallbacks
**Status: PARCIAL — precisa do merge para fechar**

A task foi dividida involuntariamente entre as duas branches:

**O que está em `clean-frontend`:**
- `ResilienceBanner.tsx` — componente de banner para estado degradado/stale
- `isRetryableError()` em `errorMapper.ts` — classifica erros transientes vs. acionáveis pelo usuário
- `usePortfolioData.ts` — mantém dados antigos visíveis com flag `isStale` quando o erro é transiente
- `useStakingData.ts` — mesma lógica de stale data

**O que está em `main`:**
- `ErrorBoundary.tsx` redesenhado — fallback visual amigável + botão "Try again"
- `ErrorBoundary` envolvendo o root do app em `providers.tsx`
- `portfolioStale` flag em `useYieldData.ts` — suprime flicker de loading
- `dataStale` flag em `useLendingData.ts` — mesma coisa

**Ação necessária:** merge de `main` em `clean-frontend`. Após o merge, a task está 100% fechada.

---

### #465 — [miniapp] Align Frontend-Backend Serialization & Validation
**Status: CONCLUÍDA** — branch `main`

Commits R1 + H7+R3:
- Novo arquivo `shared/lib/responseSchemas.ts` — 219 linhas de schemas Zod para todos os domínios (swap, yield, staking, portfolio)
- Validação runtime nos clients: `swap/api.ts`, `yield/api.ts`, `staking/baseApi.ts`
- Qualquer resposta fora do schema loga warning mas não quebra o app

Estará em `clean-frontend` assim que o merge for feito.

---

### #468 — [miniapp] Define Versioned Shared Contract Types
**Status: CONCLUÍDA** — branch `main`

Commit R6:
- Novo arquivo `shared/contracts/v1/index.ts` — 179 linhas de contratos de resposta versionados
- Isola o contrato da API do resto do código, facilitando versionamento futuro

Estará em `clean-frontend` assim que o merge for feito.

---

### #469 — [miniapp] Demo Optimization & Request Tracing
**Status: CONCLUÍDA** — branch `main`

Commits R7 + R8:
- `shared/config/demo.ts` — configuração de demo mode (defaults de swap/staking para demo, timeouts mais largos para RPCs gratuitos)
- Ativado via `NEXT_PUBLIC_DEMO_MODE=true`
- `generateTraceId()` em `fetchWithAuth.ts` — gera UUID por request
- Header `X-Trace-Id` injetado automaticamente em todas as requests
- Propagado também em `swap/api.ts` para requests diretas fora do fetchWithAuth

Estará em `clean-frontend` assim que o merge for feito.

---

### #470 — [backend] Separate Dev vs. Demo Environment Config
**Status: CONCLUÍDA no frontend, backend presumivelmente ok**

O commit R7 referencia explicitamente `aligned with backend config/demo.ts`, indicando que o backend já tinha o `config/demo.ts` implementado quando o frontend foi alinhado. Verificar no repositório de backend se o ticket está fechado.

---

### #471 — [backend] Consolidate Architecture & Contract Documentation
**Status: INCERTA — fora do escopo frontend**

Tarefa de documentação de arquitetura no backend. Não há evidência desta task nos commits do frontend. Verificar diretamente no repositório de backend ou no ticket do kanban.

---

## Próximos passos ao retomar

1. Resolver os 3 conflitos descritos em `MERGE_REPORT.md` e fazer o merge de `main` em `clean-frontend`
2. Fechar #466 após confirmar que `ResilienceBanner` + `isRetryableError` + `ErrorBoundary` estão funcionando juntos
3. Verificar #471 no backend
4. Executar o checklist de testes em `MERGE_REPORT.md` antes de abrir PR para `main`
