'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useActiveAccount, useActiveWalletChain } from 'thirdweb/react';
import { createThirdwebClient, defineChain, eth_getBalance, getRpcClient, type Address } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { withdrawFromSmartAccount, DCAApiError } from './api';
import { Button } from '@/components/ui/button';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartAccountAddress: string;
  smartAccountName: string;
}

export default function WithdrawModal({
  isOpen,
  onClose,
  smartAccountAddress,
  smartAccountName,
}: WithdrawModalProps) {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const [isTestnet, setIsTestnet] = useState(false);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessionKeyAddress, setSessionKeyAddress] = useState<string>('');
  const [availableBalance, setAvailableBalance] = useState<string>('0.000000');
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const client = useMemo(
    () => createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID || '' }),
    []
  );
  const selectedChainId = isTestnet ? 11155111 : 1;

  useEffect(() => {
    const fetchSessionKey = async () => {
      if (!smartAccountAddress || !isOpen) return;
      try {
        const response = await fetch(`http://localhost:3004/dca/account/${smartAccountAddress}`);
        if (response.ok) {
          const data = await response.json();
          setSessionKeyAddress(data.sessionKeyAddress);
        }
      } catch (err) {
        console.error('Error fetching session key:', err);
      }
    };
    if (isOpen) {
      void fetchSessionKey();
    }
  }, [isOpen, smartAccountAddress]);

  const fetchSessionBalance = useCallback(async () => {
    if (!sessionKeyAddress) return;
    setIsFetchingBalance(true);
    setBalanceError(null);
    try {
      const rpcClient = getRpcClient({
        client,
        chain: defineChain(selectedChainId),
      });
      const balanceWei = await eth_getBalance(rpcClient, {
        address: sessionKeyAddress as Address,
      });
      const balance = Number(balanceWei) / 1e18;
      if (Number.isFinite(balance)) {
        setAvailableBalance(balance.toFixed(6));
      } else {
        setAvailableBalance('0.000000');
      }
    } catch (err) {
      console.error('Error fetching session key balance:', err);
      setAvailableBalance('0.000000');
      setBalanceError('Não foi possível carregar o saldo. Atualize para tentar novamente.');
    } finally {
      setIsFetchingBalance(false);
    }
  }, [client, sessionKeyAddress, selectedChainId]);

  useEffect(() => {
    if (isOpen && sessionKeyAddress) {
      void fetchSessionBalance();
    }
  }, [isOpen, sessionKeyAddress, fetchSessionBalance]);

  const handleWithdraw = async () => {
    if (!account) {
      setError('Por favor, conecte sua carteira.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!amount || parsedAmount <= 0) {
      setError('Digite um valor válido para sacar.');
      return;
    }
    const numericBalance = parseFloat(availableBalance);
    if (!Number.isFinite(numericBalance) || numericBalance <= 0) {
      setError('Saldo indisponível para saque no momento.');
      return;
    }
    if (parsedAmount >= numericBalance) {
      const recommended = Math.max(numericBalance - 0.001, 0);
      setError(`Saldo insuficiente após taxas. Saque até ${recommended.toFixed(6)} ETH para deixar margem de gas.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await withdrawFromSmartAccount({
        smartAccountAddress,
        userId: account.address,
        amount,
        chainId: selectedChainId,
      });

      if (result.success) {
        setSuccess(`✅ ${amount} ETH enviados para ${account.address}`);
        setAmount('');
        void fetchSessionBalance();
        setTimeout(() => onClose(), 3000);
      } else {
        setError(result.error || 'Falha ao processar saque.');
      }
    } catch (err: any) {
      console.error('Erro ao sacar:', err);
      if (err instanceof DCAApiError) {
        setError(err.message);
      } else {
        setError('Erro ao processar saque. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-pano-border/60 bg-pano-surface shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between border-b border-pano-border/40 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-pano-text-primary">Sacar fundos</h2>
              <p className="text-xs text-pano-text-muted">
                Transfira o saldo disponível da smart wallet para sua carteira principal.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated p-2 text-pano-text-muted transition-colors hover:text-pano-text-primary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{isTestnet ? '🧪' : '🌐'}</span>
                  <div>
                    <p className="text-sm font-medium text-pano-text-primary">
                      {isTestnet ? 'Modo teste (Sepolia)' : 'Modo principal (Mainnet)'}
                    </p>
                    <p className="text-xs text-pano-text-muted">
                      {isTestnet
                        ? 'Saques executados na rede de testes Sepolia.'
                        : 'Transações definitivas na rede principal Ethereum.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsTestnet(!isTestnet)}
                  className={isTestnet
                    ? 'relative inline-flex h-6 w-12 items-center rounded-full bg-pano-primary transition-colors'
                    : 'relative inline-flex h-6 w-12 items-center rounded-full bg-pano-border-subtle transition-colors'}
                >
                  <span
                    className={isTestnet
                      ? 'inline-block h-4 w-4 translate-x-6 transform rounded-full bg-black transition-transform'
                      : 'inline-block h-4 w-4 translate-x-1 transform rounded-full bg-black transition-transform'}
                  />
                </button>
              </div>
              {activeChain && activeChain.id !== selectedChainId && (
                <div className="rounded-lg border border-pano-warning/40 bg-pano-warning/10 px-3 py-2 text-[11px] text-pano-warning">
                  Sua carteira está em {activeChain.name || 'outra rede'}. Altere para {isTestnet ? 'Sepolia Testnet' : 'Ethereum Mainnet'} antes de confirmar o saque.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-4 space-y-3">
              <div className="grid gap-2 text-xs text-pano-text-muted">
                <div className="flex items-center justify-between gap-3">
                  <span>Smart wallet</span>
                  <span className="font-mono text-pano-text-primary">{smartAccountName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Session key wallet</span>
                  <span className="font-mono text-pano-text-primary">
                    {sessionKeyAddress
                      ? `${sessionKeyAddress.slice(0, 6)}...${sessionKeyAddress.slice(-4)}`
                      : 'Carregando...'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Destino</span>
                  <span className="font-mono text-pano-text-primary">
                    {account?.address || 'Conecte sua carteira'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-pano-text-primary">Valor do saque</label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.000001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/40 disabled:opacity-50"
                    placeholder="0.0"
                    disabled={loading}
                  />
                  <div className="flex items-center rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 text-sm font-medium text-pano-text-muted">
                    ETH
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-pano-text-muted">
                  Todos os saques são realizados em ETH nativo.
                </p>
              </div>

              <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-xs text-pano-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <span>Saldo disponível</span>
                  <div className="flex items-center gap-2 text-pano-text-primary">
                    {isFetchingBalance ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border border-pano-primary border-t-transparent" />
                        Verificando...
                      </span>
                    ) : (
                      <>
                        <span className="font-medium">{availableBalance} ETH</span>
                        <button
                          type="button"
                          onClick={fetchSessionBalance}
                          className="text-pano-text-muted hover:text-pano-primary transition-colors"
                          disabled={isFetchingBalance}
                          title="Atualizar saldo"
                        >
                          ↻
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {balanceError ? (
                  <p className="mt-1 text-[11px] text-pano-warning">{balanceError}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-pano-text-muted">
                    Recomenda-se deixar ~0.001 ETH para cobrir eventuais taxas de gas.
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-pano-error/40 bg-pano-error/10 px-4 py-3 text-sm text-pano-error">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-pano-success/40 bg-pano-success/10 px-4 py-3 text-sm text-pano-success">
                {success}
              </div>
            )}

            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-3 text-[11px] text-pano-text-muted">
              O saque é assinado pelo backend usando a session key autorizada.
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="md"
                fullWidth
                onClick={handleWithdraw}
                disabled={loading || !amount || parseFloat(amount) <= 0}
                loading={loading}
              >
                Sacar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
