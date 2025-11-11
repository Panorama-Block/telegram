'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useActiveAccount, useActiveWalletChain } from 'thirdweb/react';
import { createThirdwebClient, defineChain, eth_getBalance, getRpcClient, getContract, type Address } from 'thirdweb';
import { balanceOf } from 'thirdweb/extensions/erc20';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import { withdrawFromSmartAccount, withdrawTokenFromSmartAccount, DCAApiError } from './api';
import { Button } from '@/components/ui/button';
import { networks } from '@/features/swap/tokens';

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

  // ERC20 token states
  const [selectedToken, setSelectedToken] = useState<'ETH' | string>('ETH');
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [isFetchingTokens, setIsFetchingTokens] = useState(false);

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

  // Fetch token balances (ERC20)
  const fetchTokenBalances = useCallback(async () => {
    if (!smartAccountAddress) return;
    setIsFetchingTokens(true);
    try {
      const chain = defineChain(selectedChainId);
      const network = networks.find(n => n.chainId === selectedChainId);
      if (!network) return;

      const balances: Record<string, string> = {};

      // Fetch balance for each token in the network
      await Promise.all(
        network.tokens.map(async (token) => {
          try {
            if (token.address === '0x0000000000000000000000000000000000000000' ||
                token.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
              // Skip native token (handled separately)
              return;
            }

            const contract = getContract({
              client,
              chain,
              address: token.address,
            });

            const balance = await balanceOf({
              contract,
              address: smartAccountAddress as Address,
            });

            const balanceFormatted = (Number(balance) / Math.pow(10, token.decimals || 18)).toFixed(6);
            if (parseFloat(balanceFormatted) > 0) {
              balances[token.address] = balanceFormatted;
            }
          } catch (err) {
            console.error(`Error fetching balance for ${token.symbol}:`, err);
          }
        })
      );

      setTokenBalances(balances);
      console.log('🪙 Token Balances:', balances);
    } catch (err) {
      console.error('Error fetching token balances:', err);
    } finally {
      setIsFetchingTokens(false);
    }
  }, [client, smartAccountAddress, selectedChainId]);

  const fetchSessionBalance = useCallback(async () => {
    if (!smartAccountAddress) return;
    setIsFetchingBalance(true);
    setBalanceError(null);
    try {
      const rpcClient = getRpcClient({
        client,
        chain: defineChain(selectedChainId),
      });
      // IMPORTANT: Fetch balance from SMART ACCOUNT, not session key!
      // The smart account (contract) holds the funds, session key only signs
      const balanceWei = await eth_getBalance(rpcClient, {
        address: smartAccountAddress as Address,
      });
      const balance = Number(balanceWei) / 1e18;
      if (Number.isFinite(balance)) {
        setAvailableBalance(balance.toFixed(6));
      } else {
        setAvailableBalance('0.000000');
      }
      console.log('💰 Smart Account Balance:', balance.toFixed(6), 'ETH');
      console.log('Smart Account Address:', smartAccountAddress);
      console.log('Session Key (signer):', sessionKeyAddress);
    } catch (err) {
      console.error('Error fetching smart account balance:', err);
      setAvailableBalance('0.000000');
      setBalanceError('Não foi possível carregar o saldo. Atualize para tentar novamente.');
    } finally {
      setIsFetchingBalance(false);
    }
  }, [client, smartAccountAddress, sessionKeyAddress, selectedChainId]);

  useEffect(() => {
    if (isOpen && smartAccountAddress) {
      void fetchSessionBalance();
      void fetchTokenBalances();
    }
  }, [isOpen, smartAccountAddress, fetchSessionBalance, fetchTokenBalances]);

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

    // Check balance based on token type
    const currentBalance = selectedToken === 'ETH' ? availableBalance : tokenBalances[selectedToken];
    const numericBalance = parseFloat(currentBalance || '0');

    if (!Number.isFinite(numericBalance) || numericBalance <= 0) {
      setError('Saldo indisponível para saque no momento.');
      return;
    }

    if (parsedAmount > numericBalance) {
      setError(`Saldo insuficiente. Disponível: ${numericBalance.toFixed(6)}`);
      return;
    }

    // For ETH, recommend leaving some for gas
    if (selectedToken === 'ETH' && parsedAmount >= numericBalance) {
      const recommended = Math.max(numericBalance - 0.001, 0);
      setError(`Saldo insuficiente após taxas. Saque até ${recommended.toFixed(6)} ETH para deixar margem de gas.`);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let result;
      let tokenSymbol = 'ETH';

      if (selectedToken === 'ETH') {
        // Withdraw ETH
        result = await withdrawFromSmartAccount({
          smartAccountAddress,
          userId: account.address,
          amount,
          chainId: selectedChainId,
        });
      } else {
        // Withdraw ERC20 token
        const network = networks.find(n => n.chainId === selectedChainId);
        const token = network?.tokens.find(t => t.address === selectedToken);

        if (!token) {
          setError('Token não encontrado.');
          return;
        }

        tokenSymbol = token.symbol;

        result = await withdrawTokenFromSmartAccount({
          smartAccountAddress,
          userId: account.address,
          tokenAddress: selectedToken,
          amount,
          decimals: token.decimals || 18,
          chainId: selectedChainId,
        });
      }

      if (result.success) {
        setSuccess(`✅ ${amount} ${tokenSymbol} enviados para ${account.address}`);
        setAmount('');
        void fetchSessionBalance();
        void fetchTokenBalances();
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
              <div className="space-y-1 mb-2">
                <p className="text-sm font-medium text-pano-text-primary">Account Abstraction</p>
                <p className="text-xs text-pano-text-muted">
                  O saldo está na smart account. A session key apenas assina a transação.
                </p>
              </div>
              <div className="grid gap-2 text-xs text-pano-text-muted">
                <div className="flex items-center justify-between gap-3">
                  <span>Nome</span>
                  <span className="font-mono text-pano-text-primary">{smartAccountName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Smart Account (origem)</span>
                  <span className="font-mono text-pano-text-primary">
                    {smartAccountAddress
                      ? `${smartAccountAddress.slice(0, 6)}...${smartAccountAddress.slice(-4)}`
                      : 'Carregando...'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Session Key (assinante)</span>
                  <span className="font-mono text-pano-text-primary">
                    {sessionKeyAddress
                      ? `${sessionKeyAddress.slice(0, 6)}...${sessionKeyAddress.slice(-4)}`
                      : 'Carregando...'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Destino (sua wallet)</span>
                  <span className="font-mono text-pano-text-primary">
                    {account?.address
                      ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                      : 'Conecte sua carteira'}
                  </span>
                </div>
              </div>
            </div>

            {/* Token Selection */}
            <div className="rounded-lg border border-pano-border-subtle bg-pano-surface px-4 py-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-pano-text-primary mb-2">Tokens Disponíveis</p>
                {isFetchingTokens ? (
                  <div className="flex items-center justify-center py-4 text-sm text-pano-text-muted">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-pano-primary border-t-transparent mr-2" />
                    Carregando tokens...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* ETH Native */}
                    <button
                      type="button"
                      onClick={() => setSelectedToken('ETH')}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        selectedToken === 'ETH'
                          ? 'border-pano-primary bg-pano-primary/10'
                          : 'border-pano-border-subtle hover:border-pano-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-pano-surface-elevated flex items-center justify-center text-sm font-medium">
                          Ξ
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-pano-text-primary">ETH</p>
                          <p className="text-xs text-pano-text-muted">Ethereum</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-pano-text-primary">{availableBalance}</p>
                        <p className="text-xs text-pano-text-muted">Disponível</p>
                      </div>
                    </button>

                    {/* ERC20 Tokens */}
                    {Object.entries(tokenBalances).map(([tokenAddress, balance]) => {
                      const network = networks.find(n => n.chainId === selectedChainId);
                      const token = network?.tokens.find(t => t.address === tokenAddress);
                      if (!token) return null;

                      return (
                        <button
                          key={tokenAddress}
                          type="button"
                          onClick={() => setSelectedToken(tokenAddress)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            selectedToken === tokenAddress
                              ? 'border-pano-primary bg-pano-primary/10'
                              : 'border-pano-border-subtle hover:border-pano-border'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-pano-surface-elevated flex items-center justify-center">
                              {token.icon ? (
                                <img src={token.icon} alt={token.symbol} className="w-6 h-6 rounded-full" />
                              ) : (
                                <span className="text-xs font-medium">{token.symbol.slice(0, 2)}</span>
                              )}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-pano-text-primary">{token.symbol}</p>
                              <p className="text-xs text-pano-text-muted">{token.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-pano-text-primary">{balance}</p>
                            <p className="text-xs text-pano-text-muted">Disponível</p>
                          </div>
                        </button>
                      );
                    })}

                    {!isFetchingTokens && Object.keys(tokenBalances).length === 0 && (
                      <div className="text-center py-4 text-sm text-pano-text-muted">
                        Nenhum token ERC20 encontrado nesta smart account
                      </div>
                    )}
                  </div>
                )}
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
                    {selectedToken === 'ETH' ? 'ETH' : networks.find(n => n.chainId === selectedChainId)?.tokens.find(t => t.address === selectedToken)?.symbol || 'TOKEN'}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-xs text-pano-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <span>Saldo disponível</span>
                  <div className="flex items-center gap-2 text-pano-text-primary">
                    {(isFetchingBalance || isFetchingTokens) ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border border-pano-primary border-t-transparent" />
                        Verificando...
                      </span>
                    ) : (
                      <>
                        <span className="font-medium">
                          {selectedToken === 'ETH'
                            ? `${availableBalance} ETH`
                            : `${tokenBalances[selectedToken] || '0.000000'} ${networks.find(n => n.chainId === selectedChainId)?.tokens.find(t => t.address === selectedToken)?.symbol || 'TOKEN'}`
                          }
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void fetchSessionBalance();
                            void fetchTokenBalances();
                          }}
                          className="text-pano-text-muted hover:text-pano-primary transition-colors"
                          disabled={isFetchingBalance || isFetchingTokens}
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
                ) : selectedToken === 'ETH' ? (
                  <p className="mt-1 text-[11px] text-pano-text-muted">
                    Recomenda-se deixar ~0.001 ETH para cobrir eventuais taxas de gas.
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-pano-text-muted">
                    Saldo do token na smart account.
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
              <p className="font-medium text-pano-text-primary mb-1">Como funciona o saque?</p>
              <ul className="space-y-1">
                <li>• A transação SAI da smart account (contrato que guarda os fundos)</li>
                <li>• A session key apenas ASSINA a transação no backend</li>
                <li>• O saldo vem da smart account, não da session key</li>
              </ul>
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
