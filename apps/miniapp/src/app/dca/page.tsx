'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/shared/ui/Sidebar';
import { useActiveAccount } from 'thirdweb/react';
import { createThirdwebClient } from 'thirdweb';
import { THIRDWEB_CLIENT_ID } from '@/shared/config/thirdweb';
import {
  createSmartAccount,
  getUserAccounts,
  deleteSmartAccount,
  type SmartAccount,
  type CreateAccountRequest,
  DCAApiError
} from '@/features/dca/api';
import SignMessageTest from '@/features/dca/SignMessageTest';
import DepositModal from '@/features/dca/DepositModal';
import SmartAccountDetails from '@/features/dca/SmartAccountDetails';
import { useSessionKey } from '@/features/dca/useSessionKey';

// Use the SmartAccount type from API
type SubAccount = SmartAccount;

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: SubAccountConfig) => void;
  loading: boolean;
}

interface SubAccountConfig {
  name: string;
  approvedTargets: string[];
  nativeTokenLimit: string;
  durationDays: number;
}

function ConfigModal({ isOpen, onClose, onConfirm, loading }: ConfigModalProps) {
  const [config, setConfig] = useState<SubAccountConfig>({
    name: '',
    approvedTargets: ['*'],
    nativeTokenLimit: '0.1',
    durationDays: 30,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customTargets, setCustomTargets] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!config.name.trim()) {
      alert('Por favor, insira um nome para a subconta.');
      return;
    }
    onConfirm(config);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-[#0d1117] border border-cyan-500/30 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-[#0d1117] border-b border-cyan-500/20 p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">🔐 Configurar Smart Account</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Educational Section */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-5">
              <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
                <span>💡</span>
                <span>O que você está criando?</span>
              </h3>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  Você está criando uma <strong className="text-white">Smart Account</strong> (Conta Inteligente) com
                  <strong className="text-cyan-400"> Session Keys</strong> (Chaves de Sessão).
                </p>
                <div className="bg-[#0d1117]/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🎮</div>
                    <div>
                      <strong className="text-white">Experiência sem fricção:</strong> Execute transações automaticamente
                      sem aprovar cada uma manualmente.
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🔒</div>
                    <div>
                      <strong className="text-white">Segurança controlada:</strong> Você define limites de gastos,
                      contratos permitidos e tempo de validade.
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚡</div>
                    <div>
                      <strong className="text-white">DCA Automático:</strong> A subconta poderá executar compras
                      programadas sem sua intervenção.
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🛡️</div>
                    <div>
                      <strong className="text-white">Proteção total:</strong> Sua carteira principal permanece segura.
                      As session keys têm permissões limitadas e temporárias.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  📝 Nome da Subconta *
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="Ex: DCA ETH Semanal"
                  className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-400 mt-1">Identificação da sua subconta DCA</p>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  ⏰ Duração da Session Key
                </label>
                <select
                  value={config.durationDays}
                  onChange={(e) => setConfig({ ...config, durationDays: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-500"
                  disabled={loading}
                >
                  <option value={1}>1 dia</option>
                  <option value={7}>7 dias (1 semana)</option>
                  <option value={30}>30 dias (1 mês)</option>
                  <option value={90}>90 dias (3 meses)</option>
                  <option value={180}>180 dias (6 meses)</option>
                  <option value={365}>365 dias (1 ano)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Após este período, a session key expira automaticamente e você precisará criar uma nova
                </p>
              </div>

              {/* Native Token Limit */}
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  💰 Limite de ETH por Transação
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={config.nativeTokenLimit}
                    onChange={(e) => setConfig({ ...config, nativeTokenLimit: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-500"
                    disabled={loading}
                  />
                  <div className="px-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-lg text-gray-400 font-mono">
                    ETH
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Valor máximo de ETH que pode ser usado em cada transação automática
                </p>
              </div>

              {/* Advanced Options */}
              <div className="border-t border-gray-700 pt-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Opções Avançadas
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        🎯 Contratos Permitidos
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                          <input
                            type="radio"
                            checked={config.approvedTargets[0] === '*'}
                            onChange={() => setConfig({ ...config, approvedTargets: ['*'] })}
                            className="text-cyan-500"
                            disabled={loading}
                          />
                          <span>Todos os contratos (Recomendado para DCA)</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                          <input
                            type="radio"
                            checked={config.approvedTargets[0] !== '*'}
                            onChange={() => setConfig({ ...config, approvedTargets: [] })}
                            className="text-cyan-500"
                            disabled={loading}
                          />
                          <span>Contratos específicos</span>
                        </label>
                      </div>
                      {config.approvedTargets[0] !== '*' && (
                        <div className="mt-2">
                          <textarea
                            value={customTargets}
                            onChange={(e) => {
                              setCustomTargets(e.target.value);
                              const targets = e.target.value.split('\n').filter(t => t.trim());
                              setConfig({ ...config, approvedTargets: targets });
                            }}
                            placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb&#10;0x..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-lg bg-gray-800/50 border border-cyan-500/30 text-white text-xs font-mono placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                            disabled={loading}
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Um endereço de contrato por linha
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-800/30 border border-cyan-500/20 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-white mb-3">📋 Resumo das Permissões</h4>
              <div className="space-y-2 text-xs text-gray-300">
                <div className="flex justify-between">
                  <span>Validade:</span>
                  <span className="text-cyan-400 font-semibold">{config.durationDays} dias</span>
                </div>
                <div className="flex justify-between">
                  <span>Limite por transação:</span>
                  <span className="text-cyan-400 font-semibold">{config.nativeTokenLimit} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span>Contratos permitidos:</span>
                  <span className="text-cyan-400 font-semibold">
                    {config.approvedTargets[0] === '*' ? 'Todos' : `${config.approvedTargets.length} específico(s)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-semibold border border-gray-600 text-gray-300 hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !config.name.trim()}
                className="flex-1 py-3 rounded-xl font-semibold bg-cyan-500 text-black hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Criando Smart Account...' : 'Criar Smart Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DCAPage() {
  const account = useActiveAccount();
  const clientId = THIRDWEB_CLIENT_ID || undefined;
  const client = useMemo(() => (clientId ? createThirdwebClient({ clientId }) : null), [clientId]);
  const { saveSessionKey } = useSessionKey();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SubAccount | null>(null);
  const [expandedAccountAddress, setExpandedAccountAddress] = useState<string | null>(null);

  // Load subaccounts from backend API on mount
  useEffect(() => {
    const loadAccounts = async () => {
      if (!account?.address) {
        setSubAccounts([]);
        return;
      }

      try {
        setLoading(true);
        const accounts = await getUserAccounts(account.address);
        setSubAccounts(accounts);
      } catch (e: any) {
        console.error('Error loading subaccounts:', e);
        if (e instanceof DCAApiError) {
          setError(`Erro ao carregar contas: ${e.message}`);
        } else {
          setError('Erro ao conectar com o servidor. Verifique se o DCA service está rodando.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
  }, [account?.address]);

  const handleCreateSubAccount = async (config: SubAccountConfig) => {
    if (!account) {
      setError('Por favor, conecte sua carteira primeiro.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('Creating smart account with Account Abstraction...');
      console.log('Main account:', account.address);
      console.log('Config:', config);

      // Prepare request for backend API
      const request: CreateAccountRequest = {
        userId: account.address,
        name: config.name.trim(),
        permissions: {
          approvedTargets: config.approvedTargets,
          nativeTokenLimit: config.nativeTokenLimit,
          durationDays: config.durationDays,
        },
      };

      // Call backend API to create smart account
      const result = await createSmartAccount(request);

      console.log('Smart account created:', result);

      // 🔑 Save session key automatically!
      saveSessionKey({
        privateKey: result.sessionKeyPrivateKey,
        address: result.sessionKeyAddress,
        smartAccountAddress: result.smartAccountAddress,
        expiresAt: new Date(result.expiresAt).getTime(),
      });

      console.log('✅ Session key saved! You can now sign transactions automatically.');

      // Reload accounts from backend
      const accounts = await getUserAccounts(account.address);
      setSubAccounts(accounts);

      setSuccess(`✅ Smart Account "${config.name}" criada com sucesso! Session key salva e pronta para uso automático (válida por ${config.durationDays} dias).`);
      setShowConfigModal(false);
    } catch (e: any) {
      console.error('Error creating smart account:', e);
      if (e instanceof DCAApiError) {
        setError(`Erro ao criar smart account: ${e.message}`);
      } else {
        setError(e.message || 'Erro ao criar smart account. Verifique se o DCA service está rodando.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubAccount = async (address: string) => {
    if (!account) return;

    if (confirm('Tem certeza que deseja remover esta smart account? Esta ação não pode ser desfeita.')) {
      try {
        setLoading(true);
        await deleteSmartAccount(address, account.address);

        // Reload accounts from backend
        const accounts = await getUserAccounts(account.address);
        setSubAccounts(accounts);

        setSuccess('Smart account removida com sucesso!');
      } catch (e: any) {
        console.error('Error deleting smart account:', e);
        if (e instanceof DCAApiError) {
          setError(`Erro ao remover smart account: ${e.message}`);
        } else {
          setError('Erro ao remover smart account. Tente novamente.');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('pt-BR');
  };

  const isSessionKeyExpired = (endTimestamp: number) => {
    return Date.now() / 1000 > endTimestamp;
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-64 overflow-x-hidden">
        {/* Top Bar */}
        <div className="border-b border-cyan-500/20 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-400 hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="text-xl font-bold">DCA - Dollar Cost Averaging</h1>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* DCA Interface */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="w-full max-w-4xl mx-auto space-y-6">
            {/* Info Card */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-5">
              <h2 className="text-lg font-semibold text-cyan-400 mb-2">🎯 DCA com Account Abstraction</h2>
              <p className="text-sm text-gray-300 mb-3">
                Dollar Cost Averaging (DCA) é uma estratégia de investimento onde você compra uma quantidade fixa
                de um ativo em intervalos regulares. Com Account Abstraction, você pode automatizar completamente
                esse processo.
              </p>
              <div className="bg-[#0d1117]/50 rounded-lg p-3 text-xs text-gray-400">
                <strong className="text-cyan-400">Como funciona:</strong> Você cria uma Smart Account com Session Keys que
                permitem executar transações automaticamente dentro dos limites que você define. Sem necessidade de
                aprovar cada transação manualmente!
              </div>
            </div>

            {/* Create Button */}
            {account && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold mb-2">Criar Smart Account DCA</h2>
                    <p className="text-sm text-gray-400">
                      Configure uma subconta inteligente para executar compras automáticas
                    </p>
                  </div>
                </div>

                {/* Account Info */}
                <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">Carteira Principal Conectada:</div>
                  <div className="text-sm font-mono text-white break-all">
                    {account.address}
                  </div>
                </div>

                <button
                  onClick={() => setShowConfigModal(true)}
                  disabled={loading}
                  className="w-full py-4 rounded-xl font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                >
                  ➕ Nova Smart Account
                </button>
              </div>
            )}

            {!account && (
              <div className="bg-[#1a1a1a] border border-yellow-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">⚠️</span>
                  <h2 className="text-xl font-bold text-yellow-400">Carteira não conectada</h2>
                </div>
                <p className="text-sm text-gray-300">
                  Conecte sua carteira para criar smart accounts e começar a usar DCA automático.
                </p>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <span className="text-xl">❌</span>
                  <div className="text-sm text-red-400">{error}</div>
                </div>
              </div>
            )}

            {success && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-3">
                  <span className="text-xl">✅</span>
                  <div className="text-sm text-green-400">{success}</div>
                </div>
              </div>
            )}

            {/* Subaccounts List */}
            {subAccounts.length > 0 && (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-4">🏦 Minhas Smart Accounts</h2>

                <div className="space-y-4">
                  {subAccounts.filter(acc => acc.permissions).map((subAccount) => {
                    const expired = isSessionKeyExpired(subAccount.permissions.endTimestamp);

                    return (
                      <div
                        key={subAccount.address}
                        className={`p-5 rounded-xl border transition-all ${
                          expired
                            ? 'bg-red-500/5 border-red-500/30'
                            : 'bg-gray-800/50 border-cyan-500/20 hover:border-cyan-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-base font-semibold text-white">{subAccount.name}</h3>
                              {expired && (
                                <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-400 rounded-full">
                                  Expirada
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-gray-400 break-all mb-1">
                              Smart Account: {subAccount.address}
                            </div>
                            {subAccount.sessionKeyAddress && (
                              <div className="text-xs font-mono text-gray-500 break-all">
                                Session Key: {subAccount.sessionKeyAddress}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleDeleteSubAccount(subAccount.address)}
                            className="ml-4 p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        {/* Permissions Details */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-[#0d1117]/50 rounded-lg p-3">
                            <div className="text-gray-400 mb-1">Limite por TX</div>
                            <div className="text-cyan-400 font-semibold">
                              {subAccount.permissions.nativeTokenLimitPerTransaction} ETH
                            </div>
                          </div>
                          <div className="bg-[#0d1117]/50 rounded-lg p-3">
                            <div className="text-gray-400 mb-1">Contratos</div>
                            <div className="text-cyan-400 font-semibold">
                              {subAccount.permissions.approvedTargets[0] === '*'
                                ? 'Todos'
                                : `${subAccount.permissions.approvedTargets.length}`}
                            </div>
                          </div>
                          <div className="bg-[#0d1117]/50 rounded-lg p-3">
                            <div className="text-gray-400 mb-1">Válido de</div>
                            <div className="text-white font-mono">
                              {formatTimestamp(subAccount.permissions.startTimestamp)}
                            </div>
                          </div>
                          <div className="bg-[#0d1117]/50 rounded-lg p-3">
                            <div className="text-gray-400 mb-1">Válido até</div>
                            <div className={`font-mono ${expired ? 'text-red-400' : 'text-white'}`}>
                              {formatTimestamp(subAccount.permissions.endTimestamp)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 text-xs text-gray-500">
                          Criada em: {new Date(subAccount.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedAccount(subAccount);
                              setDepositModalOpen(true);
                            }}
                            disabled={expired}
                            className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            💰 Depositar
                          </button>
                          <button
                            onClick={() => {
                              setExpandedAccountAddress(
                                expandedAccountAddress === subAccount.address
                                  ? null
                                  : subAccount.address
                              );
                            }}
                            className="px-4 py-3 rounded-xl font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-all"
                          >
                            {expandedAccountAddress === subAccount.address ? '▼ Ocultar' : '📊 Detalhes'}
                          </button>
                        </div>

                        {/* Expanded Details */}
                        {expandedAccountAddress === subAccount.address && (
                          <div className="mt-4 p-4 bg-[#0d1117] rounded-xl border border-cyan-500/20">
                            <SmartAccountDetails
                              smartAccountAddress={subAccount.address}
                              smartAccountName={subAccount.name}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sign Message Test */}
            <SignMessageTest />

            {/* Educational Section */}
            <div className="bg-[#1a1a1a] border border-cyan-500/30 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-3 text-cyan-400">📚 Entenda seus Poderes</h2>
              <div className="space-y-4 text-sm text-gray-300">
                <div className="flex items-start gap-3 p-3 bg-cyan-500/5 rounded-lg">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <strong className="text-white">Smart Account (ERC-4337):</strong> Uma carteira programável que
                    vive na blockchain. Você mantém controle total, mas pode delegar permissões específicas.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-purple-500/5 rounded-lg">
                  <span className="text-2xl">🔑</span>
                  <div>
                    <strong className="text-white">Session Keys:</strong> Chaves temporárias com permissões limitadas.
                    Como dar uma procuração específica que expira automaticamente.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-500/5 rounded-lg">
                  <span className="text-2xl">⚙️</span>
                  <div>
                    <strong className="text-white">Permissões Granulares:</strong> Controle exato sobre o que a
                    session key pode fazer: quanto gastar, quais contratos usar, e por quanto tempo.
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <strong className="text-white">Automação DCA:</strong> Com a smart account configurada, você
                    poderá criar estratégias que executam compras automaticamente, sem sua presença.
                  </div>
                </div>
              </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-3 text-gray-300">🚀 Próximos Recursos</h2>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>Configurar estratégias DCA automáticas para cada smart account</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>Escolher intervalos: diário, semanal, quinzenal, mensal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>Selecionar pares de tokens para compra automática</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>Dashboard com histórico de compras e performance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-0.5">•</span>
                  <span>Renovação automática de session keys antes da expiração</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Config Modal */}
      <ConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onConfirm={handleCreateSubAccount}
        loading={loading}
      />

      {/* Deposit Modal */}
      {selectedAccount && (
        <DepositModal
          isOpen={depositModalOpen}
          onClose={() => setDepositModalOpen(false)}
          smartAccountAddress={selectedAccount.address}
          smartAccountName={selectedAccount.name}
        />
      )}
    </div>
  );
}
