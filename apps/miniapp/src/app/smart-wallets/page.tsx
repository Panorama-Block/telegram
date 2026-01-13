'use client';

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SmartWalletConnectPanel } from "@/features/wallets/evm/SmartWalletConnectPanel";
import { 
  ArrowLeft, 
  ShieldCheck, 
  Zap, 
  Key, 
  Users,
  Bot
} from "lucide-react";
import Link from "next/link";
import { NeonButton } from "@/components/ui/NeonButton";

export default function SmartWalletsPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-[100dvh] bg-[#050505] relative overflow-x-hidden flex flex-col text-foreground font-sans">
        {/* Ambient God Ray */}
        <div className="absolute top-0 inset-x-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-black/5 to-transparent blur-3xl pointer-events-none z-0" />
        
        {/* Navigation Header */}
        <div className="relative z-20 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
          <Link href="/portfolio" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group">
              <div className="p-2 rounded-full bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </div>
              <span className="font-medium">Back to Portfolio</span>
          </Link>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-inner flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
             </div>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col py-8 px-4 md:px-8 max-w-7xl mx-auto w-full">
          
          {/* Page Title */}
          <div className="mb-8">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">Smart Wallets</h1>
              <p className="text-zinc-400 max-w-xl">
                Manage your Account Abstraction wallets. Enjoy gasless transactions, social recovery, and enhanced security.
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Main Action/Connect */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 space-y-6"
            >
              <GlassCard className="p-6 bg-[#0A0A0A]/60 border-cyan-500/20">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Bot className="w-6 h-6 text-cyan-400" />
                  Active Smart Account
                </h2>
                <div className="w-full">
                   {/* Reusing existing component for robust connection logic */}
                   <SmartWalletConnectPanel />
                </div>
              </GlassCard>

              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <GlassCard className="p-4 bg-[#0A0A0A]/40 hover:bg-[#0A0A0A]/60 transition-colors">
                    <div className="p-2 bg-cyan-500/10 rounded-lg w-fit mb-3">
                      <Zap className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-white font-medium mb-1">Gasless Transactions</h3>
                    <p className="text-xs text-zinc-400">Sponsored transactions for seamless UX.</p>
                 </GlassCard>
                 
                 <GlassCard className="p-4 bg-[#0A0A0A]/40 hover:bg-[#0A0A0A]/60 transition-colors">
                    <div className="p-2 bg-purple-500/10 rounded-lg w-fit mb-3">
                      <Key className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-white font-medium mb-1">Passkey Access</h3>
                    <p className="text-xs text-zinc-400">Login with FaceID or TouchID secure enclave.</p>
                 </GlassCard>

                 <GlassCard className="p-4 bg-[#0A0A0A]/40 hover:bg-[#0A0A0A]/60 transition-colors">
                    <div className="p-2 bg-green-500/10 rounded-lg w-fit mb-3">
                      <ShieldCheck className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="text-white font-medium mb-1">Social Recovery</h3>
                    <p className="text-xs text-zinc-400">Recover your account via trusted guardians.</p>
                 </GlassCard>

                 <GlassCard className="p-4 bg-[#0A0A0A]/40 hover:bg-[#0A0A0A]/60 transition-colors">
                    <div className="p-2 bg-pink-500/10 rounded-lg w-fit mb-3">
                      <Users className="w-5 h-5 text-pink-400" />
                    </div>
                    <h3 className="text-white font-medium mb-1">Multi-Sig Ready</h3>
                    <p className="text-xs text-zinc-400">Require multiple signatures for high value txs.</p>
                 </GlassCard>
              </div>
            </motion.div>

            {/* Right Column: Info/Status */}
            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.2 }}
               className="space-y-6"
            >
              <GlassCard className="p-6 bg-[#0A0A0A]/60">
                 <h3 className="text-lg font-bold text-white mb-4">Factory Status</h3>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <span className="text-sm text-zinc-400">Network</span>
                       <span className="text-sm text-white font-medium">Base Mainnet</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-sm text-zinc-400">Factory Address</span>
                       <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 font-mono">0x2a...9b1</span>
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                       </div>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-sm text-zinc-400">Bundler Status</span>
                       <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs border border-green-500/20">Active</span>
                    </div>
                 </div>

                 <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="text-xs text-zinc-500 text-center">
                       Powered by Thirdweb Account Abstraction
                    </div>
                 </div>
              </GlassCard>

              <div className="p-4 rounded-2xl bg-gradient-to-b from-cyan-900/20 to-transparent border border-cyan-500/20">
                 <h4 className="text-white font-bold mb-2">Did you know?</h4>
                 <p className="text-sm text-zinc-400 leading-relaxed">
                   Smart Wallets are fully programmable. In the future, you'll be able to set spending limits and automate recurrent payments directly from here.
                 </p>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </ProtectedRoute>
  );
}
