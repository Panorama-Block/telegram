'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useActiveAccount } from 'thirdweb/react';
import {
  createSmartAccount,
  getUserAccounts,
  deleteSmartAccount,
  type SmartAccount,
  type CreateAccountRequest,
  DCAApiError,
} from '@/features/dca/api';
import DepositModal from '@/features/dca/DepositModal';
import WithdrawModal from '@/features/dca/WithdrawModal';
import { Sidebar } from '@/shared/ui/Sidebar';
import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/lib/utils';

type SubAccount = SmartAccount;

interface SubAccountConfig {
  name: string;
  approvedTargets: string[];
  nativeTokenLimit: string;
  durationDays: number;
}

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: SubAccountConfig) => void;
  loading: boolean;
}

type StatTone = 'default' | 'success' | 'warning' | 'danger';

function StatTile({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
  tone?: StatTone;
}) {
  const toneStyles: Record<StatTone, string> = {
    default: 'border-pano-border bg-pano-surface text-pano-text-primary',
    success: 'border-pano-primary/50 bg-pano-primary-muted/30 text-pano-primary',
    warning: 'border-pano-warning/40 bg-pano-warning/10 text-pano-warning',
    danger: 'border-pano-error/40 bg-pano-error/10 text-pano-error',
  };

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 transition-colors shadow-sm shadow-black/10',
        toneStyles[tone],
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-pano-text-muted">
        {label}
      </p>
      <p className={cn('mt-1 text-xl font-semibold', tone !== 'default' && 'text-current')}>
        {value}
      </p>
      {helper && (
        <p className="mt-1 text-[11px] text-pano-text-muted">{helper}</p>
      )}
    </div>
  );
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getDaysRemaining(timestamp: number) {
  const diff = timestamp * 1000 - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ConfigModal({
  isOpen,
  onClose,
  onConfirm,
  loading,
}: ConfigModalProps) {
  const [config, setConfig] = useState<SubAccountConfig>({
    name: '',
    approvedTargets: ['*'],
    nativeTokenLimit: '0.1',
    durationDays: 30,
  });
  const [customTargets, setCustomTargets] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfig({
        name: '',
        approvedTargets: ['*'],
        nativeTokenLimit: '0.1',
        durationDays: 30,
      });
      setCustomTargets('');
      setShowAdvanced(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!config.name.trim()) {
      return;
    }
    onConfirm(config);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Card
          variant="glass"
          size="lg"
          className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-pano-surface border border-pano-border/60 shadow-lg shadow-black/40"
        >
          <CardHeader className="flex flex-col gap-4 border-b border-pano-border/40 pb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl text-pano-text-primary">
                Criar smart wallet derivada
              </CardTitle>
              <CardDescription className="text-pano-text-secondary">
                Defina limites e permissões para a nova carteira controlada por session key.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-xs text-pano-text-muted">
                ⚡ Account Abstraction
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated p-2 text-pano-text-muted hover:text-pano-text-primary transition-colors"
                aria-label="Fechar modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 pt-6">
            <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-pano-text-primary">
                    Nome da smart wallet
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    placeholder="Ex: Automação ETH semanal"
                    disabled={loading}
                    className="w-full rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary placeholder-pano-text-muted focus:outline-none focus:ring-2 focus:ring-pano-primary/60 focus:border-transparent transition-shadow"
                  />
                  <p className="text-xs text-pano-text-muted">
                    Dê um nome que facilite identificar a finalidade dessa smart wallet.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-pano-text-primary">
                      Duração da session key
                    </label>
                    <select
                      value={config.durationDays}
                      onChange={(e) =>
                        setConfig({ ...config, durationDays: Number(e.target.value) })
                      }
                      disabled={loading}
                      className="w-full rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/60 focus:border-transparent transition-shadow"
                    >
                      <option value={1}>1 dia</option>
                      <option value={7}>7 dias</option>
                      <option value={30}>30 dias</option>
                      <option value={90}>90 dias</option>
                      <option value={180}>180 dias</option>
                      <option value={365}>365 dias</option>
                    </select>
                    <p className="text-xs text-pano-text-muted">
                      Após esse período a chave expira automaticamente para sua segurança.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-pano-text-primary">
                      Limite por transação (ETH)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={config.nativeTokenLimit}
                      onChange={(e) => setConfig({ ...config, nativeTokenLimit: e.target.value })}
                      disabled={loading}
                      className="w-full rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/60 focus:border-transparent transition-shadow"
                    />
                    <p className="text-xs text-pano-text-muted">
                      Valor máximo em ETH que cada transação automatizada poderá gastar.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-pano-border/40 bg-pano-surface-elevated/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-pano-text-primary">Opções avançadas</h4>
                      <p className="text-xs text-pano-text-muted">
                        Controle granular sobre contratos permitidos e regras de consumo.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdvanced((prev) => !prev)}
                      className="text-pano-text-primary"
                    >
                      {showAdvanced ? 'Ocultar' : 'Exibir'} opções
                    </Button>
                  </div>

                  {showAdvanced && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-pano-text-secondary">
                          Contratos permitidos
                        </p>
                        <div className="space-y-2 rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-3">
                          <label className="flex items-center gap-3 text-sm text-pano-text-primary">
                            <input
                              type="radio"
                              checked={config.approvedTargets[0] === '*'}
                              onChange={() => setConfig({ ...config, approvedTargets: ['*'] })}
                              disabled={loading}
                              className="text-pano-primary focus:ring-pano-primary"
                            />
                            <span>Liberar todos os contratos (recomendado)</span>
                          </label>
                          <label className="flex items-center gap-3 text-sm text-pano-text-primary">
                            <input
                              type="radio"
                              checked={config.approvedTargets[0] !== '*'}
                              onChange={() => setConfig({ ...config, approvedTargets: [] })}
                              disabled={loading}
                              className="text-pano-primary focus:ring-pano-primary"
                            />
                            <span>Restringir para contratos específicos</span>
                          </label>
                        </div>
                      </div>

                      {config.approvedTargets[0] !== '*' && (
                        <div className="space-y-2">
                          <textarea
                            value={customTargets}
                            onChange={(e) => {
                              setCustomTargets(e.target.value);
                              const targets = e.target.value
                                .split('\n')
                                .map((line) => line.trim())
                                .filter(Boolean);
                              setConfig({ ...config, approvedTargets: targets });
                            }}
                            rows={3}
                            placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&#10;0xABCD...1234"
                            disabled={loading}
                            className="w-full rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm font-mono text-pano-text-primary placeholder-pano-text-muted focus:outline-none focus:ring-2 focus:ring-pano-primary/60"
                          />
                          <p className="text-xs text-pano-text-muted">
                            Informe um endereço de contrato por linha.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Card
                  variant="glass"
                  size="sm"
                  className="bg-pano-surface-elevated border border-pano-border/50 shadow-inner"
                >
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-pano-text-primary">
                      Resumo das permissões
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between text-pano-text-secondary">
                      <span>Validade</span>
                      <span className="font-medium text-pano-text-primary">
                        {config.durationDays} dias
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-pano-text-secondary">
                      <span>Limite por transação</span>
                      <span className="font-medium text-pano-text-primary">
                        {config.nativeTokenLimit} ETH
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-pano-text-secondary">
                      <span>Contratos liberados</span>
                      <span className="font-medium text-pano-text-primary">
                        {config.approvedTargets[0] === '*'
                          ? 'Todos'
                          : `${config.approvedTargets.length} contrato(s)`}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3 rounded-xl border border-pano-border-subtle bg-pano-surface px-4 py-4 text-sm text-pano-text-secondary">
                  <p className="font-medium text-pano-text-primary">Como funciona a smart wallet?</p>
                  <ul className="space-y-2 text-xs leading-relaxed text-pano-text-muted">
                    <li>• O backend gera a session key de forma segura.</li>
                    <li>• A session key assina transações dentro dos limites definidos.</li>
                    <li>• Você pode revogar ou deletar a smart wallet a qualquer momento.</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-pano-border/40 pt-6 md:flex-row md:justify-end">
            <Button
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={loading}
              className="w-full md:w-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              loading={loading}
              disabled={!config.name.trim()}
              className="w-full md:w-auto"
            >
              Criar smart wallet
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}

export default function AccountPage() {
  const account = useActiveAccount();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SubAccount | null>(null);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const renderCreateTile = (compact?: boolean) => (
    <button
      onClick={() => setShowConfigModal(true)}
      disabled={loading || !account}
      className={cn(
        'group flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-pano-border-subtle bg-pano-surface/70 text-pano-text-secondary transition-all hover:border-pano-primary/60 hover:bg-pano-primary/5 hover:text-pano-text-primary disabled:opacity-50',
        compact ? 'py-6' : 'py-8',
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-pano-border-subtle bg-pano-surface-elevated text-2xl transition-colors group-hover:border-pano-primary/60 group-hover:bg-pano-primary/20">
        +
      </span>
      <span className="text-sm font-medium">
        Criar smart wallet
      </span>
      <span className="text-[11px] text-pano-text-muted">
        Session key segura com limites personalizados
      </span>
    </button>
  );

  const loadAccounts = useCallback(async () => {
    if (!account?.address) {
      setSubAccounts([]);
      setInitializing(false);
      return;
    }

    setInitializing(true);
    try {
      const accounts = await getUserAccounts(account.address);
      setSubAccounts(accounts);
    } catch (err) {
      console.error('[AccountPage] Failed to load accounts:', err);
      setError(
        err instanceof DCAApiError
          ? err.message
          : 'Não foi possível carregar suas smart wallets.',
      );
    } finally {
      setInitializing(false);
    }
  }, [account?.address]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 6000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const activeAccounts = useMemo(
    () =>
      subAccounts.filter(
        (wallet) => getDaysRemaining(wallet.permissions.endTimestamp) > 0,
      ),
    [subAccounts],
  );

  const expiringSoonCount = useMemo(
    () =>
      subAccounts.filter((wallet) => {
        const days = getDaysRemaining(wallet.permissions.endTimestamp);
        return days > 0 && days <= 3;
      }).length,
    [subAccounts],
  );

  const handleCreateSubAccount = async (config: SubAccountConfig) => {
    if (!account?.address) {
      setError('Conecte sua carteira para criar smart wallets.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const request: CreateAccountRequest = {
        userId: account.address,
        name: config.name,
        permissions: {
          approvedTargets: config.approvedTargets,
          nativeTokenLimit: config.nativeTokenLimit,
          durationDays: config.durationDays,
        },
      };

      await createSmartAccount(request);
      setSuccess(`Smart wallet "${config.name}" criada com sucesso!`);
      setShowConfigModal(false);
      await loadAccounts();
    } catch (err) {
      console.error('[AccountPage] Error creating smart account:', err);
      if (err instanceof DCAApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível criar a smart wallet. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubAccount = async (address: string) => {
    if (!account?.address) return;

    const confirmed = window.confirm(
      'Tem certeza que deseja remover esta smart wallet? Essa ação revoga a session key imediatamente.',
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      await deleteSmartAccount(address, account.address);
      setSuccess('Smart wallet removida com sucesso.');
      setSelectedAccount(null);
      await loadAccounts();
    } catch (err) {
      console.error('[AccountPage] Error deleting smart account:', err);
      if (err instanceof DCAApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível remover a smart wallet. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const openDeposit = (wallet: SubAccount) => {
    setSelectedAccount(wallet);
    setDepositModalOpen(true);
  };

  const openWithdraw = (wallet: SubAccount) => {
    setSelectedAccount(wallet);
    setWithdrawModalOpen(true);
  };

  const closeFinancialModals = () => {
    setDepositModalOpen(false);
    setWithdrawModalOpen(false);
    setSelectedAccount(null);
  };

  return (
    <div className="min-h-screen bg-pano-bg-primary text-pano-text-primary flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col md:ml-64">
        <header className="sticky top-0 z-30 border-b border-pano-border bg-pano-surface/80 backdrop-blur-md">
        </header>

        <main className="flex-1 overflow-y-auto">
          <Container size="xl" className="py-6 space-y-6">
            <div className="flex flex-col gap-4 md:hidden">
              {account && subAccounts.length === 0 && renderCreateTile(false)}
            </div>

            <Card
              variant="default"
              size="md"
              className="bg-pano-surface border border-pano-border/60 shadow-md shadow-black/20"
            >
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg md:text-xl text-pano-text-primary">
                    Visão geral das smart wallets
                  </CardTitle>
                  <CardDescription className="text-pano-text-secondary">
                    Monitore e gerencie carteiras derivadas com session keys seguras.
                  </CardDescription>
                </div>
                <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-xs text-pano-text-muted font-mono truncate max-w-full md:max-w-sm">
                  {account?.address ?? 'Carteira principal desconectada'}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile
                    label="Total de smart wallets"
                    value={initializing ? '—' : subAccounts.length}
                    helper={
                      initializing
                        ? 'Carregando...'
                        : subAccounts.length === 0
                        ? 'Crie sua primeira smart wallet para começar.'
                        : `${activeAccounts.length} ativas agora`
                    }
                  />
                  <StatTile
                    label="Ativas"
                    value={initializing ? '—' : activeAccounts.length}
                    helper="Session keys válidas dentro do período definido."
                    tone="success"
                  />
                  <StatTile
                    label="Expiram em até 3 dias"
                    value={initializing ? '—' : expiringSoonCount}
                    helper="Renove ou crie novas session keys antes do vencimento."
                    tone={expiringSoonCount > 0 ? 'warning' : 'default'}
                  />
                </div>
              </CardContent>
            </Card>

            {error && (
              <Card className="border border-pano-error/40 bg-pano-error/10 text-pano-error">
                <CardContent className="flex items-start gap-3 text-sm">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="font-medium text-pano-error">Algo deu errado</p>
                    <p className="text-pano-text-primary/80">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {success && (
              <Card className="border border-pano-success/40 bg-pano-success/10 text-pano-success">
                <CardContent className="flex items-start gap-3 text-sm">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="font-medium text-pano-success">Tudo certo!</p>
                    <p className="text-pano-text-primary/80">{success}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!account && (
              <Card className="border border-pano-border/60 bg-pano-surface-elevated">
                <CardHeader>
                  <CardTitle className="text-pano-text-primary">
                    Conecte sua carteira principal
                  </CardTitle>
                  <CardDescription className="text-pano-text-secondary">
                    É necessário conectar uma carteira para criar e administrar smart wallets derivadas.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            <Card className="border border-pano-border/60 bg-pano-surface shadow-md shadow-black/20">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg md:text-xl text-pano-text-primary">
                    Smart wallets derivadas
                  </CardTitle>
                  <CardDescription className="text-pano-text-secondary">
                    Controle granular de permissões, limites e validade das suas automações.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs text-pano-text-muted">
                  {initializing ? 'Carregando...' : `${subAccounts.length} wallet(s) encontradas`}
                </div>
              </CardHeader>
              <CardContent>
                {initializing ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-pano-border-subtle bg-pano-surface-elevated p-4 animate-pulse space-y-3"
                      >
                        <div className="h-5 w-32 rounded bg-pano-border/40" />
                        <div className="h-4 w-full rounded bg-pano-border/30" />
                        <div className="h-4 w-2/3 rounded bg-pano-border/30" />
                        <div className="flex gap-2 pt-2">
                          <div className="h-9 w-20 rounded bg-pano-border/30" />
                          <div className="h-9 w-20 rounded bg-pano-border/20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : subAccounts.length === 0 ? (
                  account ? (
                    <div className="mx-auto w-full max-w-md">
                      {renderCreateTile(false)}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-pano-text-muted">
                      Conecte sua carteira para criar smart wallets.
                    </div>
                  )
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {account && (
                      <div className="h-full" key="create-tile">
                        {renderCreateTile(true)}
                      </div>
                    )}
                    {subAccounts.map((wallet) => {
                      const expiresInDays = getDaysRemaining(wallet.permissions.endTimestamp);
                      const expired = expiresInDays <= 0;
                      const expiryLabel = expired
                        ? `Expirada em ${formatDate(wallet.permissions.endTimestamp)}`
                        : `Expira em ${formatDate(wallet.permissions.endTimestamp)} (${expiresInDays} dia${expiresInDays === 1 ? '' : 's'})`;

                      return (
                        <Card
                          key={wallet.address}
                          variant="interactive"
                          size="sm"
                          className="h-full bg-pano-surface-elevated border border-pano-border-subtle"
                        >
                          <CardHeader className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-lg text-pano-text-primary">
                                {wallet.name}
                              </CardTitle>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                                  expired
                                    ? 'bg-pano-error/20 text-pano-error border border-pano-error/50'
                                    : 'bg-pano-primary/10 text-pano-primary border border-pano-primary/50',
                                )}
                              >
                                {expired ? 'Expirada' : 'Ativa'}
                              </span>
                            </div>
                            <CardDescription className="font-mono text-xs text-pano-text-muted break-all">
                              {wallet.address}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-pano-text-secondary">
                            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-3 py-2">
                              <span className="text-xs text-pano-text-muted">Session key</span>
                              <p className="font-mono text-[11px] text-pano-text-primary break-all">
                                {wallet.sessionKeyAddress}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-pano-text-muted">Limite por TX</span>
                                <span className="font-medium text-pano-text-primary">
                                  {wallet.permissions.nativeTokenLimitPerTransaction} ETH
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-pano-text-muted">Expiração</span>
                                <span className="font-medium text-pano-text-primary">
                                  {expiryLabel}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                          <CardFooter className="flex flex-wrap gap-2 pt-3">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1"
                              onClick={() => openDeposit(wallet)}
                            >
                              Depositar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 text-pano-text-primary"
                              onClick={() => openWithdraw(wallet)}
                            >
                              Sacar
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              className="w-full"
                              onClick={() => handleDeleteSubAccount(wallet.address)}
                              loading={loading}
                            >
                              Remover
                            </Button>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          </Container>
        </main>
      </div>

      <ConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onConfirm={handleCreateSubAccount}
        loading={loading}
      />

      {selectedAccount && (
        <DepositModal
          isOpen={depositModalOpen}
          onClose={closeFinancialModals}
          smartAccountAddress={selectedAccount.address}
          smartAccountName={selectedAccount.name}
        />
      )}

      {selectedAccount && (
        <WithdrawModal
          isOpen={withdrawModalOpen}
          onClose={closeFinancialModals}
          smartAccountAddress={selectedAccount.address}
          smartAccountName={selectedAccount.name}
        />
      )}
    </div>
  );
}
