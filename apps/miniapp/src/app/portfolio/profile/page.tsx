'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Copy,
  Flame,
  TrendingUp,
  ShieldCheck,
  Rocket,
  Zap,
  RefreshCw,
  Target,
  Sprout,
  BarChart3,
  Gem,
  PieChart,
  Shield,
  Globe,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────

const INVESTOR_TYPES: {
  value: InvestorType;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  glow: string;
  ring: string;
  bg: string;
}[] = [
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Steady & secure',
    icon: <ShieldCheck className="w-6 h-6" />,
    gradient: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/25',
    ring: 'ring-emerald-500/40',
    bg: 'bg-emerald-500/10',
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Balanced growth',
    icon: <TrendingUp className="w-6 h-6" />,
    gradient: 'from-blue-400 to-indigo-500',
    glow: 'shadow-blue-500/25',
    ring: 'ring-blue-500/40',
    bg: 'bg-blue-500/10',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'High conviction',
    icon: <Flame className="w-6 h-6" />,
    gradient: 'from-orange-400 to-red-500',
    glow: 'shadow-orange-500/25',
    ring: 'ring-orange-500/40',
    bg: 'bg-orange-500/10',
  },
  {
    value: 'degen',
    label: 'Degen',
    description: 'Full send mode',
    icon: <Rocket className="w-6 h-6" />,
    gradient: 'from-purple-400 to-pink-500',
    glow: 'shadow-purple-500/25',
    ring: 'ring-purple-500/40',
    bg: 'bg-purple-500/10',
  },
];

const GOAL_OPTIONS: { label: string; icon: React.ReactNode }[] = [
  { label: 'Passive Income', icon: <Sprout className="w-4 h-4" /> },
  { label: 'Long-term Growth', icon: <TrendingUp className="w-4 h-4" /> },
  { label: 'Active Trading', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Yield Farming', icon: <Gem className="w-4 h-4" /> },
  { label: 'Portfolio Diversification', icon: <PieChart className="w-4 h-4" /> },
  { label: 'Capital Preservation', icon: <Shield className="w-4 h-4" /> },
];

const CHAIN_OPTIONS: {
  value: string;
  label: string;
  color: string;
  icon: string;
}[] = [
  { value: 'ethereum', label: 'Ethereum', color: '#627EEA', icon: 'Ξ' },
  { value: 'base', label: 'Base', color: '#0052FF', icon: 'B' },
  { value: 'avalanche', label: 'Avalanche', color: '#E84142', icon: 'A' },
  { value: 'polygon', label: 'Polygon', color: '#8247E5', icon: 'P' },
  { value: 'arbitrum', label: 'Arbitrum', color: '#28A0F0', icon: '◆' },
];

const RISK_SEGMENTS = [
  { min: 1, max: 3, label: 'Conservative', color: 'from-emerald-500 to-emerald-400', textColor: 'text-emerald-400' },
  { min: 4, max: 5, label: 'Balanced', color: 'from-blue-500 to-cyan-400', textColor: 'text-blue-400' },
  { min: 6, max: 7, label: 'Growth', color: 'from-amber-500 to-orange-400', textColor: 'text-amber-400' },
  { min: 8, max: 9, label: 'Aggressive', color: 'from-orange-500 to-red-400', textColor: 'text-orange-400' },
  { min: 10, max: 10, label: 'YOLO', color: 'from-red-500 to-pink-500', textColor: 'text-red-400' },
];

function getRiskSegment(value: number) {
  return RISK_SEGMENTS.find((s) => value >= s.min && value <= s.max) || RISK_SEGMENTS[2];
}

const DEFAULT_TENANT = 'panorama';
function getTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT;
  return localStorage.getItem('tenantId') || DEFAULT_TENANT;
}

// ── Animated background ring for avatar ─────────────────────────────────

function AvatarRing({ gradient, children }: { gradient: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {/* Outer glow */}
      <div className={cn(
        'absolute -inset-1 rounded-3xl bg-gradient-to-br opacity-60 blur-lg group-hover:opacity-80 transition-opacity duration-500',
        gradient,
      )} />
      {/* Ring border */}
      <div className={cn(
        'relative w-[88px] h-[88px] sm:w-[100px] sm:h-[100px] rounded-3xl bg-gradient-to-br p-[2.5px]',
        gradient,
      )}>
        {children}
      </div>
    </div>
  );
}

// ── Section header ──────────────────────────────────────────────────────

function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="text-zinc-400">{icon}</div>
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
      </div>
      {badge}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function ProfilePage() {
  const account = useActiveAccount();
  const walletAddress = account?.address?.toLowerCase() || '';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editable fields
  const [nickname, setNickname] = useState('');
  const [investorType, setInvestorType] = useState<InvestorType | ''>('');
  const [goals, setGoals] = useState<string[]>([]);
  const [preferredChains, setPreferredChains] = useState<string[]>([]);
  const [riskTolerance, setRiskTolerance] = useState(5);
  const [editingName, setEditingName] = useState(false);

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
      if (!p.nickname) setEditingName(true);
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

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      nickname !== (profile.nickname || '') ||
      investorType !== (profile.investorType || '') ||
      JSON.stringify(goals) !== JSON.stringify(profile.goals || []) ||
      JSON.stringify(preferredChains) !== JSON.stringify(profile.preferredChains || []) ||
      riskTolerance !== (profile.riskTolerance || 5)
    );
  }, [profile, nickname, investorType, goals, preferredChains, riskTolerance]);

  const handleSave = async () => {
    if (!profile || !hasChanges) return;
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
      setEditingName(false);
      setSaved(true);
      if (nickname.trim()) {
        localStorage.setItem('profileNickname', nickname.trim());
      } else {
        localStorage.removeItem('profileNickname');
      }
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError('Failed to save profile.');
      console.error('[Profile] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (profile) populateForm(profile);
    setEditingName(false);
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

  const activeType = INVESTOR_TYPES.find((t) => t.value === investorType);
  const riskSegment = getRiskSegment(riskTolerance);
  const avatarGradient = activeType?.gradient || 'from-cyan-400 to-blue-500';

  const profileCompleteness = useMemo(() => {
    let score = 0;
    if (nickname) score += 25;
    if (investorType) score += 25;
    if (goals.length > 0) score += 25;
    if (preferredChains.length > 0) score += 25;
    return score;
  }, [nickname, investorType, goals, preferredChains]);

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  // ── Animation variants ────────────────────────────────────────────────

  const cardVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
    }),
  };

  return (
    <ProtectedRoute>
    <div className="min-h-[100dvh] bg-[#050508] relative overflow-x-hidden flex flex-col text-foreground font-sans safe-area-pb">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className={cn(
          'absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-[0.07] transition-colors duration-1000',
          activeType ? `bg-gradient-to-br ${activeType.gradient}` : 'bg-cyan-500',
        )} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-600 rounded-full blur-[120px] opacity-[0.04]" />
      </div>

      {/* Navigation */}
      <div className="relative z-20 px-4 py-3 sm:p-5 flex justify-between items-center max-w-2xl mx-auto w-full">
        <Link
          href="/portfolio"
          className="flex items-center gap-2 text-zinc-400 hover:text-white active:text-white transition-colors group"
        >
          <div className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] group-hover:bg-white/[0.08] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationCenter />
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-4 max-w-2xl mx-auto w-full pb-32">

        {/* ── Loading ─────────────────────────────────────────────── */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <p className="text-zinc-600 text-sm">Loading profile...</p>
            </div>
          </div>
        )}

        {/* ── Error (no profile) ──────────────────────────────────── */}
        {!loading && error && !profile && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-zinc-400 mb-4 text-sm">{error}</p>
              <button
                onClick={loadProfile}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-zinc-300 hover:bg-white/[0.1] text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── Profile Content ─────────────────────────────────────── */}
        {!loading && profile && (
          <>
            {/* ▌ Hero / Identity ──────────────────────────────────── */}
            <motion.div
              variants={cardVariant}
              custom={0}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center text-center pt-2 pb-8"
            >
              {/* Avatar */}
              <AvatarRing gradient={avatarGradient}>
                <div className="w-full h-full rounded-[21px] bg-[#0c0e14] flex items-center justify-center">
                  <span className={cn(
                    'text-3xl sm:text-4xl font-bold bg-gradient-to-br bg-clip-text text-transparent select-none',
                    avatarGradient,
                  )}>
                    {nickname ? nickname.charAt(0).toUpperCase() : '?'}
                  </span>
                </div>
              </AvatarRing>

              {/* Name */}
              <div className="mt-5 mb-1.5">
                {editingName ? (
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onBlur={() => { if (nickname.trim()) setEditingName(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && nickname.trim()) setEditingName(false); }}
                    maxLength={24}
                    placeholder="Enter your name..."
                    autoFocus
                    className="bg-transparent text-center text-2xl sm:text-3xl font-bold text-white placeholder-zinc-700 focus:outline-none border-b-2 border-cyan-500/50 focus:border-cyan-400 pb-1 w-64 max-w-full"
                  />
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="group flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">
                      {nickname || 'Anonymous'}
                    </h1>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  </button>
                )}
              </div>

              {/* Wallet address */}
              <button
                onClick={copyAddress}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors group"
              >
                <span className="font-mono text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  {walletAddress ? shortenAddress(walletAddress) : '--'}
                </span>
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                )}
              </button>

              {/* Meta badges */}
              <div className="flex items-center gap-3 mt-4">
                {memberSince && (
                  <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider">
                    Since {memberSince}
                  </span>
                )}
                {memberSince && profileCompleteness < 100 && (
                  <span className="w-1 h-1 rounded-full bg-zinc-700" />
                )}
                {profileCompleteness < 100 && (
                  <span className="text-[11px] font-medium text-cyan-500/80 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {profileCompleteness}% complete
                  </span>
                )}
              </div>
            </motion.div>

            {/* ▌ Investor Type ────────────────────────────────────── */}
            <motion.div
              variants={cardVariant}
              custom={1}
              initial="hidden"
              animate="visible"
              className="mb-4"
            >
              <SectionHeader
                icon={<Target className="w-4 h-4" />}
                title="Investor Type"
                badge={activeType && (
                  <span className={cn('text-xs font-semibold', activeType.gradient.includes('emerald') ? 'text-emerald-400' : activeType.gradient.includes('blue') ? 'text-blue-400' : activeType.gradient.includes('orange') ? 'text-orange-400' : 'text-purple-400')}>
                    {activeType.label}
                  </span>
                )}
              />
              <div className="grid grid-cols-2 gap-2.5">
                {INVESTOR_TYPES.map((type) => {
                  const isActive = investorType === type.value;
                  return (
                    <motion.button
                      key={type.value}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setInvestorType(type.value)}
                      className={cn(
                        'relative p-4 rounded-2xl border text-left transition-all duration-300 overflow-hidden',
                        isActive
                          ? cn('border-white/20 shadow-lg', type.bg, type.glow)
                          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]',
                      )}
                    >
                      {isActive && (
                        <div className={cn(
                          'absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl opacity-20 rounded-bl-[60px]',
                          type.gradient,
                        )} />
                      )}
                      <div className="relative">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors duration-300',
                          isActive ? cn('bg-gradient-to-br text-white', type.gradient) : 'bg-white/[0.04] text-zinc-600',
                        )}>
                          {type.icon}
                        </div>
                        <p className={cn(
                          'text-sm font-semibold mb-0.5 transition-colors',
                          isActive ? 'text-white' : 'text-zinc-400',
                        )}>
                          {type.label}
                        </p>
                        <p className={cn(
                          'text-[11px] transition-colors',
                          isActive ? 'text-zinc-400' : 'text-zinc-600',
                        )}>
                          {type.description}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* ▌ Goals ────────────────────────────────────────────── */}
            <motion.div
              variants={cardVariant}
              custom={2}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4"
            >
              <SectionHeader
                icon={<Zap className="w-4 h-4" />}
                title="Goals"
                badge={goals.length > 0 ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 font-medium">
                    {goals.length} selected
                  </span>
                ) : undefined}
              />
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((goal) => {
                  const isSelected = goals.includes(goal.label);
                  return (
                    <motion.button
                      key={goal.label}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleGoal(goal.label)}
                      className={cn(
                        'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border',
                        isSelected
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25 shadow-[0_0_16px_rgba(34,211,238,0.06)]'
                          : 'bg-white/[0.02] text-zinc-500 border-white/[0.06] hover:bg-white/[0.05] hover:text-zinc-300 hover:border-white/[0.12]',
                      )}
                    >
                      <span className={cn(
                        'transition-colors',
                        isSelected ? 'text-cyan-400' : 'text-zinc-600',
                      )}>
                        {goal.icon}
                      </span>
                      {goal.label}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* ▌ Preferred Chains ─────────────────────────────────── */}
            <motion.div
              variants={cardVariant}
              custom={3}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-4"
            >
              <SectionHeader
                icon={<Globe className="w-4 h-4" />}
                title="Preferred Chains"
              />
              <div className="flex flex-wrap gap-2">
                {CHAIN_OPTIONS.map((chain) => {
                  const isSelected = preferredChains.includes(chain.value);
                  return (
                    <motion.button
                      key={chain.value}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleChain(chain.value)}
                      className={cn(
                        'flex items-center gap-2.5 pl-2.5 pr-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border',
                        isSelected
                          ? 'bg-white/[0.08] text-white border-white/[0.15]'
                          : 'bg-white/[0.02] text-zinc-500 border-white/[0.06] hover:bg-white/[0.05] hover:text-zinc-300 hover:border-white/[0.12]',
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold transition-all duration-200',
                          isSelected ? 'opacity-100' : 'opacity-30',
                        )}
                        style={{
                          backgroundColor: isSelected ? `${chain.color}20` : 'transparent',
                          color: chain.color,
                          border: `1.5px solid ${isSelected ? `${chain.color}40` : 'transparent'}`,
                        }}
                      >
                        {chain.icon}
                      </div>
                      {chain.label}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* ▌ Risk Appetite ────────────────────────────────────── */}
            <motion.div
              variants={cardVariant}
              custom={4}
              initial="hidden"
              animate="visible"
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6"
            >
              <SectionHeader
                icon={<Flame className="w-4 h-4" />}
                title="Risk Appetite"
                badge={(
                  <div className="flex items-baseline gap-1">
                    <span className={cn('text-xl font-bold font-mono', riskSegment.textColor)}>
                      {riskTolerance}
                    </span>
                    <span className="text-zinc-600 text-sm font-mono">/10</span>
                  </div>
                )}
              />

              {/* Risk label */}
              <div className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold mb-5',
                riskSegment.textColor,
                riskTolerance <= 3 ? 'bg-emerald-500/10' :
                riskTolerance <= 5 ? 'bg-blue-500/10' :
                riskTolerance <= 7 ? 'bg-amber-500/10' :
                riskTolerance <= 9 ? 'bg-orange-500/10' :
                'bg-red-500/10',
              )}>
                {riskSegment.label}
              </div>

              {/* Custom slider */}
              <div className="relative">
                {/* Track background */}
                <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full bg-gradient-to-r', riskSegment.color)}
                    initial={false}
                    animate={{ width: `${(riskTolerance / 10) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </div>
                {/* Native range — invisible but functional */}
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(Number(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  style={{ height: '32px', top: '-10px' }}
                />
                {/* Tick marks */}
                <div className="flex justify-between mt-2 px-[2px]">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                    <div
                      key={v}
                      className={cn(
                        'w-1 h-1 rounded-full transition-colors duration-300',
                        v <= riskTolerance ? 'bg-white/20' : 'bg-white/[0.06]',
                      )}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-zinc-600 font-medium">Safe</span>
                  <span className="text-[10px] text-zinc-600 font-medium">YOLO</span>
                </div>
              </div>
            </motion.div>

            {/* ── Inline error ────────────────────────────────────── */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-sm text-center mb-4"
              >
                {error}
              </motion.p>
            )}
          </>
        )}
      </div>

      {/* ── Floating Save Bar ────────────────────────────────────── */}
      <AnimatePresence>
        {hasChanges && !loading && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-0 inset-x-0 z-50 safe-area-pb"
          >
            <div className="max-w-2xl mx-auto px-4 pb-5 pt-3">
              <div className="flex gap-3 p-2 rounded-2xl bg-[#0c0e14]/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">
                <button
                  onClick={handleDiscard}
                  className="flex-1 py-3 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all text-sm font-medium"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all',
                    'bg-gradient-to-r from-cyan-500 to-blue-500 text-white',
                    'hover:from-cyan-400 hover:to-blue-400',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'shadow-[0_0_24px_rgba(34,211,238,0.15)]',
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Save confirmation toast ──────────────────────────────── */}
      <AnimatePresence>
        {saved && !hasChanges && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="fixed top-5 inset-x-0 z-50 flex justify-center px-4"
          >
            <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm font-medium backdrop-blur-xl shadow-lg">
              <Check className="w-4 h-4" />
              Profile saved successfully
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ProtectedRoute>
  );
}
