'use client';

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { SmartWallets } from "@/components/SmartWallets";
import { Lending } from "@/components/Lending";
import { Staking } from "@/components/Staking";
import { SwapWidget } from "@/components/SwapWidget";
import { DCA } from "@/components/DCA";
import { SettingsModal } from "@/components/SettingsModal";
import { NotificationCenter } from "@/components/NotificationCenter";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Copy, LogOut, Settings, Wallet, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

import { useActiveAccount, useDisconnect, useActiveWallet } from "thirdweb/react";
import { shortenAddress } from "thirdweb/utils";

export default function DashboardPage() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const [activeTab, setActiveTab] = useState("chat");
  const [showSwap, setShowSwap] = useState(false);
  const [showLending, setShowLending] = useState(false);
  const [showStaking, setShowStaking] = useState(false);
  const [showDCA, setShowDCA] = useState(false);
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    setShowSwap(false);
    setShowLending(false);
    setShowStaking(false);
    setShowDCA(false);

    if (tab === "swap") {
      setShowSwap(true);
      return;
    }
    if (tab === "lending") {
      setShowLending(true);
      return;
    }
    if (tab === "staking") {
      setShowStaking(true);
      return;
    }
    if (tab === "dca") {
      setShowDCA(true);
      return;
    }
    setActiveTab(tab);
  };

  const sidebarActiveTab = showSwap ? 'swap' : showLending ? 'lending' : showStaking ? 'staking' : showDCA ? 'dca' : activeTab;

  // Helper to get Page Title
  const getPageTitle = () => {
    if (activeTab === "chat") return "Zico AI Agent";
    if (activeTab === "wallets") return "Smart Vaults";
    return "Dashboard";
  };

  return (
    <div className="flex h-[100dvh] bg-[#050505] text-foreground font-sans selection:bg-primary/30 overflow-hidden w-full">
      {/* Global God Ray - Fixed Background */}
      <div className="fixed top-0 inset-x-0 h-[800px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-black/5 to-transparent blur-3xl pointer-events-none z-0" />
      
      <Sidebar 
        activeTab={sidebarActiveTab} 
        onTabChange={handleTabChange} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      
      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 w-full lg:ml-64 transition-all duration-300">
        
        {/* Mobile Header */}
        <div className="lg:hidden h-16 flex items-center justify-between px-4 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
             <img 
              src="/logo.png" 
              alt="Panorama Block" 
              className="h-8 w-auto drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]"
            />
            <span className="font-display font-bold text-white">Panorama Block</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Line 1: Fixed Header (Desktop) */}
        <header className="hidden lg:flex h-20 flex-none items-center justify-between px-8 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-20">
          {/* Page Title */}
          <h1 className="text-xl font-display font-bold text-white">
            {getPageTitle()}
          </h1>

          {/* Profile Widget */}
          <div className="relative flex items-center gap-4">
            <NotificationCenter />
            
            <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-colors backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 shadow-inner" />
              <span className="text-sm font-medium text-white">{account ? shortenAddress(account.address) : 'Connect'}</span>
              <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", isProfileOpen && "rotate-180")} />
            </button>

            {/* Profile Dropdown */}
            <AnimatePresence>
              {isProfileOpen && account && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-3 w-72 bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl p-2"
                >
                  {/* Header */}
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span>Connected as</span>
                      <Copy 
                        className="w-3 h-3 cursor-pointer hover:text-white" 
                        onClick={() => navigator.clipboard.writeText(account.address)}
                      />
                    </div>
                    <div className="font-mono text-sm text-white mb-3">{shortenAddress(account.address)}</div>
                    <div className="text-2xl font-bold text-white">$12,450.32</div>
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-1">
                    <button 
                      onClick={() => {
                        setActiveTab("wallets");
                        setIsProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
                    >
                      <Wallet className="w-4 h-4" />
                      Panorama Wallets Dashboard
                    </button>
                    <button 
                      onClick={() => {
                        setIsSettingsOpen(true);
                        setIsProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                  </div>

                  <div className="h-px bg-white/5 my-2" />

                  <button 
                    onClick={() => {
                      if (wallet) disconnect(wallet);
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Line 2: Scrollable Content Area */}
        <main className={cn(
          "flex-1 relative w-full",
          activeTab !== "chat" && "overflow-y-auto overflow-x-hidden p-4 md:p-8 pt-4 md:pt-6 scrollbar-hide"
        )}>
          {activeTab === "chat" && <ChatInterface />}
          {activeTab === "wallets" && <SmartWallets />}
        </main>

        {/* Modal Widgets (Overlays) */}
        <AnimatePresence>
          {showSwap && <SwapWidget onClose={() => setShowSwap(false)} />}
          {showLending && <Lending onClose={() => setShowLending(false)} />}
          {showStaking && <Staking onClose={() => setShowStaking(false)} />}
          {showDCA && <DCA onClose={() => setShowDCA(false)} />}
          {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
