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
import { Container } from '@/components/layout/Container';
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
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import zicoBlue from '../../../public/icons/zico_blue.svg';

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
                Create derived smart wallet
              </CardTitle>
              <CardDescription className="text-pano-text-secondary">
                Create a smart contract that holds funds and is controlled by a secure session key on the backend.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-3 py-2 text-xs text-pano-text-muted">
                ⚡ Account Abstraction
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-pano-border-subtle bg-pano-surface-elevated p-2 text-pano-text-muted hover:text-pano-text-primary transition-colors"
                aria-label="Close modal"
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
                    Smart wallet name
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    placeholder="E.g.: Weekly ETH automation"
                    disabled={loading}
                    className="w-full rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary placeholder-pano-text-muted focus:outline-none focus:ring-2 focus:ring-pano-primary/60 focus:border-transparent transition-shadow"
                  />
                  <p className="text-xs text-pano-text-muted">
                    Give a name that makes it easy to identify this smart wallet&apos;s purpose.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-pano-text-primary">
                      Session key duration
                    </label>
                    <select
                      value={config.durationDays}
                      onChange={(e) =>
                        setConfig({ ...config, durationDays: Number(e.target.value) })
                      }
                      disabled={loading}
                      className="w-full rounded-lg border border-pano-border-subtle bg-pano-surface-elevated px-4 py-3 text-sm text-pano-text-primary focus:outline-none focus:ring-2 focus:ring-pano-primary/60 focus:border-transparent transition-shadow"
                    >
                      <option value={1}>1 day</option>
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                      <option value={180}>180 days</option>
                      <option value={365}>365 days</option>
                    </select>
                    <p className="text-xs text-pano-text-muted">
                      After this period, the key expires automatically for your security.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-pano-text-primary">
                      Limit per transaction (ETH)
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
                      Maximum ETH value that each automated transaction can spend.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-pano-border/40 bg-pano-surface-elevated/60 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-pano-text-primary">Advanced options</h4>
                      <p className="text-xs text-pano-text-muted">
                        Granular control over allowed contracts and usage rules.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdvanced((prev) => !prev)}
                      className="text-pano-text-primary"
                    >
                      {showAdvanced ? 'Hide' : 'Show'} options
                    </Button>
                  </div>

                  {showAdvanced && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-pano-text-secondary">
                          Allowed contracts
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
                            <span>Allow all contracts (recommended)</span>
                          </label>
                          <label className="flex items-center gap-3 text-sm text-pano-text-primary">
                            <input
                              type="radio"
                              checked={config.approvedTargets[0] !== '*'}
                              onChange={() => setConfig({ ...config, approvedTargets: [] })}
                              disabled={loading}
                              className="text-pano-primary focus:ring-pano-primary"
                            />
                            <span>Restrict to specific contracts</span>
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
                            Enter one contract address per line.
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
                      Permissions summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between text-pano-text-secondary">
                      <span>Validity</span>
                      <span className="font-medium text-pano-text-primary">
                        {config.durationDays} days
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-pano-text-secondary">
                      <span>Limit per transaction</span>
                      <span className="font-medium text-pano-text-primary">
                        {config.nativeTokenLimit} ETH
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-pano-text-secondary">
                      <span>Allowed contracts</span>
                      <span className="font-medium text-pano-text-primary">
                        {config.approvedTargets[0] === '*'
                          ? 'All'
                          : `${config.approvedTargets.length} contract(s)`}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3 rounded-xl border border-pano-border-subtle bg-pano-surface px-4 py-4 text-sm text-pano-text-secondary">
                  <p className="font-medium text-pano-text-primary">How does the smart wallet work?</p>
                  <ul className="space-y-2 text-xs leading-relaxed text-pano-text-muted">
                    <li>• The smart wallet is a smart contract that holds your funds</li>
                    <li>• The backend generates a session key that can sign transactions</li>
                    <li>• The session key signs within the limits, but the balance stays in the smart wallet</li>
                    <li>• You can revoke or delete the smart wallet at any time</li>
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
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              loading={loading}
              disabled={!config.name.trim()}
              className="w-full md:w-auto"
            >
              Create smart wallet
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}

export default function AccountPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [exploreDropdownOpen, setExploreDropdownOpen] = useState(false);
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
        'group flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/20 bg-[#252525]/30 backdrop-blur-sm text-gray-400 transition-all hover:border-cyan-400/60 hover:bg-cyan-400/5 hover:text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed',
        compact ? 'py-6' : 'py-8',
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-white/20 bg-black/20 text-3xl transition-all group-hover:border-cyan-400/60 group-hover:bg-cyan-400/10 group-hover:scale-110">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-400 group-hover:text-cyan-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="text-sm font-semibold group-hover:text-cyan-400 transition-colors">
        Create Smart Wallet
      </span>
      <span className="text-[11px] text-gray-500 group-hover:text-gray-400 px-4 text-center">
        Secure session key with custom limits
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
          : 'Unable to load your smart wallets.',
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
      setError('Connect your wallet to create smart wallets.');
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
      setSuccess(`Smart wallet "${config.name}" created successfully!`);
      setShowConfigModal(false);
      await loadAccounts();
    } catch (err) {
      console.error('[AccountPage] Error creating smart account:', err);
      if (err instanceof DCAApiError) {
        setError(err.message);
      } else {
        setError('Unable to create the smart wallet. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubAccount = async (address: string) => {
    if (!account?.address) return;

    const confirmed = window.confirm(
      'Are you sure you want to remove this smart wallet? This action revokes the session key immediately.',
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      await deleteSmartAccount(address, account.address);
      setSuccess('Smart wallet removed successfully.');
      setSelectedAccount(null);
      await loadAccounts();
    } catch (err) {
      console.error('[AccountPage] Error deleting smart account:', err);
      if (err instanceof DCAApiError) {
        setError(err.message);
      } else {
        setError('Unable to remove the smart wallet. Please try again.');
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

  const getWalletAddress = () => {
    if (typeof window === 'undefined') return undefined;
    const authPayload = localStorage.getItem('authPayload');
    if (authPayload) {
      try {
        const payload = JSON.parse(authPayload);
        return payload.address?.toLowerCase();
      } catch (error) {
        console.error('Error parsing authPayload:', error);
      }
    }
    return undefined;
  };

  return (
    <>
      <div className="h-screen text-white flex flex-col overflow-hidden relative">
        {/* Animated Background */}
        <AnimatedBackground />

      {/* Top Navbar - Same as swap */}
      <header className="flex-shrink-0 bg-black/40 backdrop-blur-md border-b-2 border-white/15 px-6 py-3 z-50">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <Image src={zicoBlue} alt="Panorama Block" width={28} height={28} />
            <span className="text-white font-semibold text-sm tracking-wide hidden md:inline">PANORAMA BLOCK</span>
          </div>

          {/* Right: Explore + Docs + Notifications + Wallet Address */}
          <div className="flex items-center gap-3">
            {/* Navigation Menu */}
            <nav className="flex items-center gap-6 text-sm mr-3">
              {/* Explore Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExploreDropdownOpen(!exploreDropdownOpen)}
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  Explore
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {exploreDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setExploreDropdownOpen(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-48 bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl z-20">
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/chat');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="#4BC3C5" fill="none" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Chat
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/swap');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="#4BC3C5" fill="none" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                          Swap
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/lending');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Lending
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/staking');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Staking
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/dca');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          DCA
                        </button>
                        <button
                          onClick={() => {
                            setExploreDropdownOpen(false);
                            router.push('/account');
                          }}
                          className="flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full text-left bg-gray-800/50"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Account
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Docs Link */}
              <a
                href="https://docs.panoramablock.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Docs
              </a>
            </nav>

            {/* Notifications Icon */}
            <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* Wallet Address Display */}
            {(account?.address || getWalletAddress()) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/30">
                <div className="w-2 h-2 rounded-full bg-[#00FFC3]"></div>
                <span className="text-white text-xs font-mono">
                  {account?.address
                    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                    : getWalletAddress()
                      ? `${getWalletAddress()!.slice(0, 6)}...${getWalletAddress()!.slice(-4)}`
                      : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <Container size="xl" className="py-8 space-y-6">
          {/* Hero Section - Clear page purpose */}
          <div className="text-center space-y-3 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-400/20 border border-cyan-400/30 mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Wallet Manager
            </h1>
            <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
              Manage your smart wallets, deposits, withdrawals and automated transactions in one place
            </p>
          </div>

          <div className="flex flex-col gap-4 md:hidden">
            {account && subAccounts.length === 0 && renderCreateTile(false)}
          </div>

          <Card
            variant="default"
            size="md"
            className="bg-[#1A1A1A]/95 backdrop-blur-xl border border-white/10 shadow-2xl"
          >
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
              <div>
                <CardTitle className="text-lg md:text-xl text-white flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Smart Wallets Overview
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Monitor and manage derived wallets with secure session keys
                </CardDescription>
              </div>
                <div className="rounded-lg border border-gray-700 bg-gray-800/30 px-3 py-2 text-xs text-gray-400 font-mono truncate max-w-full md:max-w-sm">
                  {account?.address ?? 'Main wallet not connected'}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="bg-[#252525]/50 border border-white/10 rounded-xl p-4 hover:border-cyan-400/30 transition-all">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Total Wallets</p>
                    <p className="text-2xl font-bold text-white mb-1">
                      {initializing ? '—' : subAccounts.length}
                    </p>
                    <p className="text-xs text-gray-400">
                      {initializing
                        ? 'Loading...'
                        : subAccounts.length === 0
                        ? 'Create your first smart wallet'
                        : `${activeAccounts.length} active now`}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-xl p-4 hover:border-green-400/50 transition-all">
                    <p className="text-xs font-medium uppercase tracking-wider text-green-400 mb-2">Active</p>
                    <p className="text-2xl font-bold text-white mb-1">
                      {initializing ? '—' : activeAccounts.length}
                    </p>
                    <p className="text-xs text-gray-400">Valid session keys</p>
                  </div>
                  <div className={cn(
                    "rounded-xl p-4 border transition-all",
                    expiringSoonCount > 0
                      ? "bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-orange-500/30 hover:border-orange-400/50"
                      : "bg-[#252525]/50 border-white/10 hover:border-cyan-400/30"
                  )}>
                    <p className={cn(
                      "text-xs font-medium uppercase tracking-wider mb-2",
                      expiringSoonCount > 0 ? "text-orange-400" : "text-gray-500"
                    )}>Expiring Soon</p>
                    <p className="text-2xl font-bold text-white mb-1">
                      {initializing ? '—' : expiringSoonCount}
                    </p>
                    <p className="text-xs text-gray-400">Within 3 days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Card className="border border-red-500/40 bg-red-500/10 backdrop-blur-sm">
                <CardContent className="flex items-start gap-3 text-sm p-4">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <p className="font-semibold text-red-400 mb-1">Something went wrong</p>
                    <p className="text-gray-300">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {success && (
              <Card className="border border-green-500/40 bg-green-500/10 backdrop-blur-sm">
                <CardContent className="flex items-start gap-3 text-sm p-4">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="font-semibold text-green-400 mb-1">Success!</p>
                    <p className="text-gray-300">{success}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!account && (
              <Card className="border border-orange-500/40 bg-orange-500/10 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-orange-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="text-white mb-1">
                        Connect Your Wallet
                      </CardTitle>
                      <CardDescription className="text-gray-300">
                        Connect a wallet to create and manage derived smart wallets
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )}

            <Card className="border border-white/10 bg-[#1A1A1A]/95 backdrop-blur-xl shadow-2xl">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/5 pb-6">
                <div>
                  <CardTitle className="text-lg md:text-xl text-white flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Your Smart Wallets
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Granular control over permissions, limits and validity of your automations
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/30">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                  <span className="text-xs text-cyan-400 font-medium">
                    {initializing ? 'Loading...' : `${subAccounts.length} wallet${subAccounts.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {initializing ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/10 bg-[#252525]/50 p-4 animate-pulse space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="h-5 w-32 rounded bg-white/10" />
                          <div className="h-6 w-16 rounded-full bg-white/10" />
                        </div>
                        <div className="h-3 w-full rounded bg-white/5" />
                        <div className="h-16 w-full rounded-lg bg-black/30 border border-white/5" />
                        <div className="space-y-2">
                          <div className="h-8 w-full rounded bg-black/20" />
                          <div className="h-8 w-full rounded bg-black/20" />
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-white/5">
                          <div className="h-9 flex-1 rounded bg-white/10" />
                          <div className="h-9 flex-1 rounded bg-white/5" />
                        </div>
                        <div className="h-9 w-full rounded bg-white/5" />
                      </div>
                    ))}
                  </div>
                ) : subAccounts.length === 0 ? (
                  account ? (
                    <div className="mx-auto w-full max-w-md">
                      {renderCreateTile(false)}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-400/10 border border-cyan-400/30 mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <p className="text-gray-400 text-sm">
                        Connect your wallet to create smart wallets
                      </p>
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

                      return (
                        <Card
                          key={wallet.address}
                          variant="interactive"
                          size="sm"
                          className="h-full bg-[#252525]/70 backdrop-blur-sm border border-white/10 hover:border-cyan-400/40 transition-all group"
                        >
                          <CardHeader className="space-y-3 pb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base text-white font-semibold truncate group-hover:text-cyan-400 transition-colors">
                                  {wallet.name}
                                </CardTitle>
                                <CardDescription className="font-mono text-[10px] text-gray-500 break-all mt-1">
                                  {wallet.address}
                                </CardDescription>
                              </div>
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider flex-shrink-0',
                                  expired
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                    : 'bg-green-500/20 text-green-400 border border-green-500/50',
                                )}
                              >
                                {expired ? 'Expired' : 'Active'}
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5">
                              <div className="flex items-center gap-2 mb-1">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-cyan-400">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Session Key</span>
                              </div>
                              <p className="font-mono text-[10px] text-gray-400 break-all">
                                {wallet.sessionKeyAddress}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20">
                                <span className="text-xs text-gray-400">TX Limit</span>
                                <span className="font-semibold text-white text-xs">
                                  {wallet.permissions.nativeTokenLimitPerTransaction} ETH
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-1.5 px-2 rounded bg-black/20">
                                <span className="text-xs text-gray-400">Expiration</span>
                                <span className={cn(
                                  "font-semibold text-xs",
                                  expired ? "text-red-400" : expiresInDays <= 3 ? "text-orange-400" : "text-white"
                                )}>
                                  {expiresInDays > 0 ? `${expiresInDays}d` : 'Expired'}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                          <CardFooter className="flex flex-col gap-2 pt-4 border-t border-white/5">
                            <div className="flex gap-2 w-full">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="flex-1 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400 border-cyan-400/30"
                                onClick={() => openDeposit(wallet)}
                              >
                                Deposit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 hover:bg-white/5 text-gray-300"
                                onClick={() => openWithdraw(wallet)}
                              >
                                Withdraw
                              </Button>
                            </div>
                            <Button
                              variant="danger"
                              size="sm"
                              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                              onClick={() => handleDeleteSubAccount(wallet.address)}
                              loading={loading}
                            >
                              Remove Wallet
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
        </div>
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
    </>
  );
}
