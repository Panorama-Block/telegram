'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveAccount } from 'thirdweb/react';
import { shortenAddress } from 'thirdweb/utils';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { NotificationCenter } from '@/components/NotificationCenter';
import { profileApi, type UserProfile, type InvestorType } from '@/features/gateway/profileApi';
import { isGatewayUnavailableError } from '@/features/gateway';
import {
  ArrowLeft,
  Loader2,
  Check,
  Pencil,
  Copy,
  Flame,
  TrendingUp,
  ShieldCheck,
  Rocket,
  Zap,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────
const INVESTOR_TYPES: { value: InvestorType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'conservative', label: 'Conservative', icon: <ShieldCheck className="w-5 h-5" />, color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400' },
  { value: 'moderate', label: 'Moderate', icon: <TrendingUp className="w-5 h-5" />, color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400' },
  { value: 'aggressive', label: 'Aggressive', icon: <Flame className="w-5 h-5" />, color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400' },
  { value: 'degen', label: 'Degen', icon: <Rocket className="w-5 h-5" />, color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400' },
];

const GOAL_OPTIONS = [
  { label: 'Passive Income', emoji: '💰' },
  { label: 'Long-term Growth', emoji: '📈' },
  { label: 'Active Trading', emoji: '⚡' },
  { label: 'Yield Farming', emoji: '🌾' },
  { label: 'Portfolio Diversification', emoji: '🎯' },
  { label: 'Capital Preservation', emoji: '🛡️' },
];

const CHAIN_OPTIONS = [
  { value: 'ethereum', label: 'Ethereum', color: '#627EEA' },
  { value: 'base', label: 'Base', color: '#0052FF' },
  { value: 'avalanche', label: 'Avalanche', color: '#E84142' },
  { value: 'polygon', label: 'Polygon', color: '#8247E5' },
  { value: 'arbitrum', label: 'Arbitrum', color: '#28A0F0' },
];

const RISK_LABELS = ['', 'Ultra Safe', 'Very Safe', 'Safe', 'Cautious', 'Balanced', 'Growth', 'Bold', 'Aggressive', 'Very Aggressive', 'YOLO'];

const DEFAULT_TENANT = 'panorama';
function getTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT;
  return localStorage.getItem('tenantId') || DEFAULT_TENANT;
}

export default function ProfilePage() {
  const account = useActiveAccount();
  const walletAddress = account?.address?.toLowerCase() || '';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editable fields
  const [nickname, setNickname] = useState('');
  const [investorType, setInvestorType] = useState<InvestorType | ''>('');
  const [goals, setGoals] = useState<string[]>([]);
  const [preferredChains, setPreferredChains] = useState<string[]>([]);
  const [riskTolerance, setRiskTolerance] = useState(5);

  // Populate form from profile
  const populateForm = (p: UserProfile) => {
    setNickname(p.nickname || '');
    setInvestorType((p.investorType as InvestorType) || '');
    setGoals(p.goals || []);
    setPreferredChains(p.preferredChains || []);
    setRiskTolerance(p.riskTolerance || 5);
  };

  const loadProfile = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const p = await profileApi.getOrCreate(walletAddress, getTenantId());
      setProfile(p);
      populateForm(p);
      // Auto-enter edit mode for fresh profiles
      if (!p.nickname) setEditing(true);
    } catch (err) {
      if (isGatewayUnavailableError(err)) {
        setError('Service temporarily unavailable. Try again later.');
      } else {
        setError('Failed to load profile.');
      }
      console.error('[Profile] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await profileApi.update(profile.id, {
        nickname: nickname.trim() || undefined,
        investorType: (investorType as InvestorType) || undefined,
        goals,
        preferredChains,
        riskTolerance,
      });
      setProfile(updated);
      populateForm(updated);
      setEditing(false);
      setSaved(true);
      // Persist nickname for welcome screen
      if (nickname.trim()) {
        localStorage.setItem('profileNickname', nickname.trim());
      } else {
        localStorage.removeItem('profileNickname');
      }
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save profile.');
      console.error('[Profile] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    if (profile) populateForm(profile);
  };

  const toggleGoal = (goal: string) => {
    setGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]);
  };

  const toggleChain = (chain: string) => {
    setPreferredChains((prev) => prev.includes(chain) ? prev.filter((c) => c !== chain) : [...prev, chain]);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasChanges = profile ? (
    nickname !== (profile.nickname || '') ||
    investorType !== (profile.investorType || '') ||
    JSON.stringify(goals) !== JSON.stringify(profile.goals || []) ||
    JSON.stringify(preferredChains) !== JSON.stringify(profile.preferredChains || []) ||
    riskTolerance !== (profile.riskTolerance || 5)
  ) : false;

  const activeInvestorType = INVESTOR_TYPES.find((t) => t.value === investorType);
  const riskLabel = RISK_LABELS[riskTolerance] || '';

  return (
    <ProtectedRoute>
    <div className="min-h-[100dvh] bg-[#050505] relative overflow-x-hidden flex flex-col text-foreground font-sans safe-area-pb">
      {/* Ambient God Ray */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/8 via-purple-500/4 to-transparent blur-3xl pointer-events-none z-0" />

      {/* Navigation Header */}
      <div className="relative z-20 px-4 py-4 sm:p-6 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link href="/chat?new=true" className="flex items-center gap-2 text-zinc-400 hover:text-white active:text-white transition-colors group">
          <div className="p-2.5 sm:p-3 min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 group-active:bg-white/15 transition-colors">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="font-medium text-sm sm:text-base hidden xs:inline">Back to Chat</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationCenter />
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 shadow-inner" />
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-4 md:px-8 max-w-5xl mx-auto w-full pb-12">

        {/* ── Loading ──────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        )}

        {/* ── Error (no profile loaded) ────────────────────────────── */}
        {!loading && error && !profile && (
          <div className="text-center py-32">
            <p className="text-zinc-400 mb-4">{error}</p>
            <button onClick={loadProfile} className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {/* ── Profile Content ──────────────────────────────────────── */}
        {!loading && profile && (
          <>
            {/* Hero Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-6 sm:p-8 mb-6"
            >
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

              <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 p-[2px] shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                    <div className="w-full h-full rounded-2xl bg-[#0a0c10] flex items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                        {nickname ? nickname.charAt(0).toUpperCase() : '?'}
                      </span>
                    </div>
                  </div>
                  {activeInvestorType && (
                    <div className={cn('absolute -top-3 -right-3 w-8 h-8 rounded-lg flex items-center justify-center border shadow-lg z-10 bg-[#0a0c10]', activeInvestorType.color)}>
                      {activeInvestorType.icon}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    {editing ? (
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={30}
                        placeholder="Your nickname..."
                        autoFocus
                        className="bg-transparent border-b-2 border-cyan-500/50 text-2xl sm:text-3xl font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-400 pb-1 w-full max-w-xs"
                      />
                    ) : (
                      <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
                        {nickname || 'Anonymous'}
                      </h1>
                    )}
                    {!editing && (
                      <button
                        onClick={() => setEditing(true)}
                        className="shrink-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-500 hover:text-white transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button onClick={copyAddress} className="flex items-center gap-2 group mt-1">
                    <span className="font-mono text-xs sm:text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      {walletAddress ? shortenAddress(walletAddress) : '--'}
                    </span>
                    {copied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    )}
                  </button>

                  {activeInvestorType && !editing && (
                    <div className={cn('inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-medium border bg-gradient-to-r', activeInvestorType.color)}>
                      {activeInvestorType.icon}
                      {activeInvestorType.label} Investor
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Investor Type (edit) */}
            <AnimatePresence>
              {editing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-6"
                >
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3 px-1">What kind of investor are you?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {INVESTOR_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => setInvestorType(type.value)}
                        className={cn(
                          'relative p-4 rounded-2xl border text-left transition-all group overflow-hidden',
                          investorType === type.value
                            ? cn('bg-gradient-to-br shadow-lg', type.color)
                            : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:border-white/20'
                        )}
                      >
                        <div className={cn('mb-2', investorType === type.value ? '' : 'text-zinc-600')}>{type.icon}</div>
                        <p className="text-sm font-semibold">{type.label}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Goals */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 mb-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-cyan-400" />
                <p className="text-sm font-medium text-zinc-300">Goals</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((goal) => {
                  const isSelected = goals.includes(goal.label);
                  return editing ? (
                    <button
                      key={goal.label}
                      onClick={() => toggleGoal(goal.label)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm font-medium transition-all border',
                        isSelected
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.08)]'
                          : 'bg-white/[0.03] text-zinc-500 border-white/10 hover:bg-white/[0.06] hover:text-zinc-300 hover:border-white/20'
                      )}
                    >
                      <span className="mr-1.5">{goal.emoji}</span>
                      {goal.label}
                    </button>
                  ) : isSelected ? (
                    <span key={goal.label} className="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      <span className="mr-1.5">{goal.emoji}</span>
                      {goal.label}
                    </span>
                  ) : null;
                })}
                {!editing && goals.length === 0 && (
                  <p className="text-zinc-600 text-sm italic">No goals set yet</p>
                )}
              </div>
            </motion.div>

            {/* Preferred Chains */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 mb-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
                <p className="text-sm font-medium text-zinc-300">Preferred Chains</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {CHAIN_OPTIONS.map((chain) => {
                  const isSelected = preferredChains.includes(chain.value);
                  return editing ? (
                    <button
                      key={chain.value}
                      onClick={() => toggleChain(chain.value)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border',
                        isSelected
                          ? 'bg-white/10 text-white border-white/20'
                          : 'bg-white/[0.03] text-zinc-500 border-white/10 hover:bg-white/[0.06] hover:text-zinc-300 hover:border-white/20'
                      )}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: chain.color, opacity: isSelected ? 1 : 0.4 }} />
                      {chain.label}
                    </button>
                  ) : isSelected ? (
                    <span key={chain.value} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.06] text-zinc-200 border border-white/10">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: chain.color }} />
                      {chain.label}
                    </span>
                  ) : null;
                })}
                {!editing && preferredChains.length === 0 && (
                  <p className="text-zinc-600 text-sm italic">No chains selected</p>
                )}
              </div>
            </motion.div>

            {/* Risk Tolerance */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 mb-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-cyan-400" />
                  <p className="text-sm font-medium text-zinc-300">Risk Appetite</p>
                </div>
                <div className="text-right">
                  <span className="text-cyan-400 font-mono text-lg font-bold">{riskTolerance}</span>
                  <span className="text-zinc-600 font-mono text-sm">/10</span>
                </div>
              </div>

              {editing ? (
                <>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={riskTolerance}
                    onChange={(e) => setRiskTolerance(Number(e.target.value))}
                    className="w-full accent-cyan-500 h-2 mb-3"
                  />
                  <div className="flex justify-between">
                    <span className="text-xs text-emerald-500/70">Safe</span>
                    <span className="text-xs text-zinc-500">{riskLabel}</span>
                    <span className="text-xs text-red-500/70">YOLO</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden relative">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        riskTolerance <= 3 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                        riskTolerance <= 6 ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
                        riskTolerance <= 8 ? 'bg-gradient-to-r from-orange-500 to-amber-400' :
                        'bg-gradient-to-r from-red-500 to-pink-400'
                      )}
                      style={{ width: `${(riskTolerance / 10) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">{riskLabel}</p>
                </>
              )}
            </motion.div>

            {/* Inline error */}
            {error && (
              <p className="text-red-400 text-sm text-center mb-4">{error}</p>
            )}

            {/* Save / Cancel */}
            <AnimatePresence>
              {editing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex gap-3 sticky bottom-6"
                >
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-3.5 rounded-2xl border border-white/10 text-zinc-400 hover:bg-white/5 transition-colors text-sm font-medium backdrop-blur-xl bg-[#0a0c10]/80"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                      <>
                        <Check className="w-4 h-4" />
                        Saved!
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
