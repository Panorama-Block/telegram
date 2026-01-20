'use client';

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  ArrowUpRight,
  ArrowRightLeft,
  Landmark,
  Clock,
  PieChart,
  TrendingUp,
  Wallet,
  ArrowLeft,
  Droplets,
  ExternalLink,
  Scan,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { usePortfolioData } from "@/features/portfolio/usePortfolioData";
import { useActiveAccount } from "thirdweb/react";
import { shortenAddress } from "thirdweb/utils";

export default function PortfolioPage() {
  const account = useActiveAccount();
  const { assets, stats, loading, refresh } = usePortfolioData();

  return (
    <ProtectedRoute>
    <div className="min-h-[100dvh] bg-[#050505] relative overflow-x-hidden flex flex-col text-foreground font-sans safe-area-pb">
      {/* Ambient God Ray */}
      <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-500/10 via-black/5 to-transparent blur-3xl pointer-events-none z-0" />
      
      {/* Navigation Header */}
      <div className="relative z-20 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link href="/chat?new=true" className="flex items-center gap-2 text-zinc-400 hover:text-white active:text-white transition-colors group">
            <div className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 group-active:bg-white/15 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="font-medium">Back to Chat</span>
        </Link>
        <div className="flex items-center gap-3">
           <NotificationCenter />
           <div className="text-right hidden sm:block">
             <div className="text-xs text-zinc-500">Connected Wallet</div>
             <div className="font-mono text-sm text-white">{account ? shortenAddress(account.address) : 'Not Connected'}</div>
           </div>
           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 shadow-inner" />
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col py-8 px-4 md:px-8 max-w-7xl mx-auto w-full">
        
        {/* Page Title & Action */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">Portfolio Analytics</h1>
            <p className="text-zinc-400">Track your performance across all chains.</p>
          </motion.div>
          
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => refresh()}
            className="flex items-center gap-2 px-4 py-3 min-h-[44px] bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors active:scale-[0.98]"
          >
             {loading ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Scan className="w-4 h-4 text-primary" />}
             {loading ? 'Scanning...' : 'Scan Wallet'}
          </motion.button>
          
          <Link href="/smart-wallets">
            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2 px-4 py-3 min-h-[44px] bg-cyan-500/10 hover:bg-cyan-500/20 active:bg-cyan-500/30 border border-cyan-500/20 rounded-xl text-sm font-medium text-cyan-400 transition-colors active:scale-[0.98]"
            >
               <Wallet className="w-4 h-4" />
               Smart Wallets
            </motion.button>
          </Link>
        </div>

        {/* Section 1: Bento Grid Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          
          {/* Card 1: Net Worth (Large) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-2"
          >
            <GlassCard className="h-full p-6 flex flex-col justify-between bg-[#0A0A0A]/60 hover:bg-[#0A0A0A]/80 transition-colors group relative overflow-hidden">
               {/* Background Chart Effect */}
               <div className="absolute right-0 bottom-0 w-2/3 h-full opacity-10 pointer-events-none">
                 <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                    <path d="M0,100 C50,80 100,90 150,40 L200,20 L200,100 Z" fill="url(#gradient-green)" />
                    <defs>
                      <linearGradient id="gradient-green" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                 </svg>
               </div>

              <div className="flex items-start justify-between relative z-10">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-zinc-400 text-sm mb-1">Total Balance</div>
                <div className="text-4xl md:text-5xl font-bold font-display text-white tracking-tight">
                  {stats.netWorth}
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Card 2: P&L (Small) - Coming Soon */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GlassCard className="h-full p-6 flex flex-col justify-center bg-[#0A0A0A]/60 relative overflow-hidden">
              {/* Blocked Overlay */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex items-center justify-center">
                <div className="px-3 py-1.5 bg-zinc-800/90 border border-white/10 rounded-full text-xs font-medium text-zinc-400">
                  Coming Soon
                </div>
              </div>
              <div className="text-zinc-500 text-sm mb-2">P&L 24h</div>
              <div className="text-3xl font-bold font-display text-zinc-600">
                +$0.00
              </div>
              <div className="text-sm font-medium text-zinc-600 mt-1">
                (0.00%)
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Section 2: Allocation Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-medium text-white">Allocation</h3>
             <div className="flex gap-4 text-xs">
                {stats.allocation.map(item => (
                   <div key={item.label} className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", item.color)} />
                      <span className="text-zinc-400">{item.label} ({item.value.toFixed(0)}%)</span>
                   </div>
                ))}
             </div>
          </div>
          <div className="h-4 w-full rounded-full flex overflow-hidden bg-white/5">
             {stats.allocation.map(item => (
                <div 
                   key={item.label} 
                   className={cn("h-full", item.color)} 
                   style={{ width: `${item.value}%` }} 
                />
             ))}
          </div>
        </motion.div>

        {/* Section 3: Detailed Positions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-bold text-white">Active Positions</h2>

          {/* Empty/Loading States */}
          {assets.length === 0 && !loading && (
            <GlassCard className="p-8 text-center text-zinc-500 text-sm bg-[#0A0A0A]/60">
              {account ? 'No assets found. Try creating a wallet or bridging funds.' : 'Connect wallet to view portfolio.'}
            </GlassCard>
          )}
          {loading && assets.length === 0 && (
            <GlassCard className="p-8 text-center text-zinc-500 text-sm bg-[#0A0A0A]/60">
              Scanning blockchain...
            </GlassCard>
          )}

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {assets.map((asset) => (
              <GlassCard
                key={`mobile-${asset.network}-${asset.symbol}-${asset.address}`}
                className="p-4 bg-[#0A0A0A]/60"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner",
                      "bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10"
                    )}>
                      {asset.icon ? (
                        <img src={asset.icon} alt={asset.symbol} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        asset.symbol[0]
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-white">{asset.name}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-500">{asset.symbol}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5">{asset.network}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-mono font-semibold">{asset.value}</div>
                    <div className="text-xs text-zinc-500">{asset.price}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                    <Wallet className="w-3 h-3" />
                    <span>{asset.protocol}</span>
                  </div>
                  <div className="text-zinc-300 font-mono text-sm">{asset.balance}</div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Desktop Table View */}
          <GlassCard className="overflow-hidden bg-[#0A0A0A]/60 hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="p-4 font-medium">Asset</th>
                    <th className="p-4 font-medium">Protocol</th>
                    <th className="p-4 font-medium">Balance</th>
                    <th className="p-4 font-medium">Value</th>
                    <th className="p-4 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {assets.map((asset) => (
                    <tr key={`desktop-${asset.network}-${asset.symbol}-${asset.address}`} className="group hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-inner",
                            "bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10"
                          )}>
                            {asset.icon ? (
                              <img src={asset.icon} alt={asset.symbol} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              asset.symbol[0]
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white">{asset.name}</div>
                            <div className="flex items-center gap-1.5">
                               <span className="text-xs text-zinc-500">{asset.symbol}</span>
                               <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/5">{asset.network}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-zinc-400 text-sm">
                        <div className="flex items-center gap-2">
                          {asset.protocol === 'Wallet' && <Wallet className="w-3 h-3" />}
                          {asset.protocol}
                        </div>
                      </td>
                      <td className="p-4 text-zinc-300 font-mono text-sm">{asset.balance}</td>
                      <td className="p-4 text-white font-mono font-medium text-sm">{asset.value}</td>
                      <td className="p-4 text-zinc-500 font-mono text-sm">{asset.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.div>

      </div>
    </div>
    </ProtectedRoute>
  );
}
