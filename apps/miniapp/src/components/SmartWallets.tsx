import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, 
  Key, 
  Clock, 
  Plus, 
  Settings, 
  ArrowUpRight, 
  ArrowDownLeft,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import { useState } from "react";
import { CreateWalletModal } from "./CreateWalletModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { useActiveAccount } from "thirdweb/react";
import { shortenAddress } from "thirdweb/utils";

// Mock Data simulating real application state
const metrics = [
  { label: "Total Wallets", value: "3", icon: Wallet, color: "text-blue-400", bg: "bg-blue-500/10" },
  { label: "Active Sessions", value: "3", icon: Key, color: "text-green-400", bg: "bg-green-500/10", subtext: "Valid" },
  { label: "Expiring Soon", value: "0", icon: Clock, color: "text-zinc-400", bg: "bg-zinc-500/10", subtext: "None" },
];

export function SmartWallets() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const account = useActiveAccount();

  // Combine real connected wallet with mock smart wallets if needed,
  // or just show Connected Wallet + Mocks.
  // For now, we'll replace the first mock item with the real account if connected.
  
  const connectedWallets = account ? [
    { 
      id: 0, 
      name: "Main Wallet", 
      address: shortenAddress(account.address), 
      fullAddress: account.address,
      limit: "∞", 
      expires: "Never", 
      status: "active" 
    }
  ] : [];

  const otherWallets = [
      { id: 1, name: "Trading Bot", address: "0x7c...9A41", limit: "5.0 ETH", expires: "28d", status: "active" },
      { id: 2, name: "DeFi Yield", address: "0x3d...2B99", limit: "2.0 ETH", expires: "5d", status: "active" }
  ];

  const displayWallets = [...connectedWallets, ...otherWallets];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      
      {/* Big TVL Card - First Major Element */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <GlassCard className="p-8 relative overflow-hidden">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <div className="text-zinc-500 font-medium mb-2 flex items-center gap-2">
              Total Value Locked
              <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12.4%
              </span>
            </div>
            <div className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight">
              $124,500.32
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Metrics Grid */}
      <div className="flex flex-col space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
        {metrics.map((metric, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + (i * 0.1) }}
          >
            <GlassCard className="p-5 flex items-center justify-between group hover:border-white/20 transition-colors">
              <div>
                <div className="text-sm text-zinc-500 font-medium mb-1">{metric.label}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-display font-bold text-white">{metric.value}</span>
                  {metric.subtext && (
                    <span className={`text-xs font-medium ${metric.color}`}>{metric.subtext}</span>
                  )}
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl ${metric.bg} flex items-center justify-center border border-white/5 shadow-inner`}>
                <metric.icon className={`w-6 h-6 ${metric.color}`} />
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Wallets List Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-display font-bold text-white">Your Vaults</h2>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium border border-primary/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">New Wallet</span>
            <span className="md:hidden">New</span>
          </button>
        </div>

        {displayWallets.length > 0 ? (
          <div className="flex flex-col space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            {displayWallets.map((wallet, i) => (
              <motion.div
                key={wallet.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
              >
                <GlassCard className="p-4 md:p-6 flex flex-col justify-between gap-4 md:gap-6 hover:border-primary/30 transition-all group h-full">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-zinc-800/50 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                      <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-zinc-400 group-hover:text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                        <h3 className="text-base md:text-lg font-medium text-white truncate">{wallet.name}</h3>
                        <span className="hidden md:flex px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 items-center gap-1 uppercase tracking-wide w-fit">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Active
                        </span>
                      </div>
                      <p className="text-xs md:text-sm font-mono text-zinc-500 truncate" title={wallet.fullAddress || wallet.address}>
                          {wallet.address}
                      </p>
                    </div>
                    <span className="md:hidden px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold border border-green-500/20 flex items-center gap-1 uppercase tracking-wide">
                      Active
                    </span>
                  </div>

                  {/* Info Grid - Simplified for Mobile */}
                  <div className="flex items-center gap-4 sm:gap-8 border-t border-b border-white/5 py-3 md:py-4">
                    <div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Limit</div>
                      <div className="text-white font-mono text-sm sm:text-base">{wallet.limit}</div>
                    </div>
                    <div className="hidden md:block">
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Expires</div>
                      <div className="text-white font-mono text-sm sm:text-base">{wallet.expires}</div>
                    </div>
                  </div>

                  {/* Actions - Full width on mobile */}
                  <div className="flex flex-col md:flex-row items-center gap-2 w-full">
                    <button className="w-full flex-1 px-3 py-2.5 md:py-2 rounded-lg border border-white/10 text-zinc-400 text-xs sm:text-sm hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                      <ArrowDownLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                      Deposit
                    </button>
                    <button className="w-full flex-1 px-3 py-2.5 md:py-2 rounded-lg border border-white/10 text-zinc-400 text-xs sm:text-sm hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                      <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" />
                      Withdraw
                    </button>
                    <button className="hidden md:block p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        ) : (
          // Empty State
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center bg-white/[0.02]"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No Active Vaults</h3>
            <p className="text-zinc-500 max-w-md mb-8">
              Create a new Panorama Wallet to start managing your assets with automated session keys and spending limits.
            </p>
            <div className="w-full max-w-xs">
              <NeonButton onClick={() => setIsCreateModalOpen(true)}>
                <div className="flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Panorama Wallet
                </div>
              </NeonButton>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <CreateWalletModal onClose={() => setIsCreateModalOpen(false)} />
        )}
      </AnimatePresence>

    </div>
  );
}
