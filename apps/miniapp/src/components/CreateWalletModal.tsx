import { motion } from "framer-motion";
import { X, Shield, Info } from "lucide-react";

interface CreateWalletModalProps {
  onClose: () => void;
}

export function CreateWalletModal({ onClose }: CreateWalletModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-display font-bold text-white">New Panorama Wallet</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6">
          
          {/* Wallet Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Wallet Name</label>
            <input 
              type="text" 
              placeholder="Ex: Weekly Automation" 
              className="w-full h-12 bg-zinc-900/50 border border-white/10 rounded-xl px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>

          {/* Row: Duration & Limit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Session Duration</label>
              <div className="relative">
                <select className="w-full h-12 bg-zinc-900/50 border border-white/10 rounded-xl px-4 text-white appearance-none focus:outline-none focus:border-primary/50 transition-all cursor-pointer">
                  <option>30 days</option>
                  <option>7 days</option>
                  <option>24 hours</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  ▼
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">TX Limit (ETH)</label>
              <input 
                type="number" 
                placeholder="0.1" 
                className="w-full h-12 bg-zinc-900/50 border border-white/10 rounded-xl px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-zinc-900/80 rounded-xl p-4 border border-white/5 flex items-start gap-3">
            <Info className="w-5 h-5 text-zinc-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-300">Permissions Summary</p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This session key will remain valid for <span className="text-zinc-300">30 days</span>. 
                It can execute transactions up to <span className="text-zinc-300">0.1 ETH</span> across <span className="text-zinc-300">All Contracts</span>.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-black/20">
          <button 
            onClick={onClose}
            className="px-4 py-2.5 text-zinc-400 hover:text-white font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            className="px-6 py-2.5 bg-primary text-black rounded-xl font-bold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
          >
            Create Wallet
          </button>
        </div>

      </motion.div>
    </motion.div>
  );
}
