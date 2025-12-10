import { motion } from "framer-motion";
import { X, Copy, ExternalLink, Wallet as WalletIcon, CreditCard } from "lucide-react";

interface WalletWidgetProps {
  onClose: () => void;
}

export function WalletWidget({ onClose }: WalletWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-white">Panorama Wallets</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Total Balance */}
          <div className="space-y-2 text-center py-4">
            <span className="text-zinc-400 text-sm uppercase tracking-widest">Total Balance</span>
            <h3 className="text-4xl font-display font-bold text-white">$12,450.32</h3>
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs">
              +2.4% (24h)
            </span>
          </div>

          {/* Wallet List */}
          <div className="space-y-3">
            {['Main Wallet', 'Trading Vault', 'Cold Storage'].map((name, i) => (
              <div key={i} className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all cursor-pointer flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/5 transition-colors">
                    <WalletIcon className="w-5 h-5 text-zinc-400 group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{name}</p>
                    <p className="text-xs text-zinc-500">0x...8f9</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">${(4500 + i * 200).toLocaleString()}</p>
                  <p className="text-xs text-zinc-500">3.2 ETH</p>
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full py-4 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
            <CreditCard className="w-5 h-5" />
            Connect New Wallet
          </button>
        </div>
      </div>
    </motion.div>
  );
}
