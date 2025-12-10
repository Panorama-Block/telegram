import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Settings, 
  Shield, 
  Bell, 
  Code, 
  Globe, 
  ChevronDown, 
  Smartphone,
  Check,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import * as Switch from '@radix-ui/react-switch';
import { DataInput } from "@/components/ui/DataInput";

interface SettingsModalProps {
  onClose: () => void;
  isOpen: boolean;
}

type Tab = 'general' | 'security' | 'notifications' | 'developer';

export function SettingsModal({ onClose, isOpen }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [currency, setCurrency] = useState("USD");
  const [language, setLanguage] = useState("English");
  
  // Security State
  const [requireSignature, setRequireSignature] = useState(false);
  const [revokedTokens, setRevokedTokens] = useState<string[]>([]);

  // Notifications State
  const [notifZico, setNotifZico] = useState(true);
  const [notifHealth, setNotifHealth] = useState(true);
  const [notifNewGems, setNotifNewGems] = useState(false);

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'developer', label: 'Developer', icon: Code },
  ];

  const handleRevoke = (token: string) => {
    setRevokedTokens([...revokedTokens, token]);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-4xl h-[600px] max-h-[85vh] relative z-[101]"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full h-full flex overflow-hidden bg-[#0A0A0A] border-white/10 shadow-2xl relative">
          
          {/* Sidebar */}
          <div className="w-64 border-r border-white/5 bg-black/20 flex flex-col">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Settings
              </h2>
            </div>
            
            <div className="flex-1 py-4 px-2 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    activeTab === tab.id 
                      ? "bg-primary/10 text-primary" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-white/5">
              <div className="text-[10px] text-zinc-600 text-center">
                Panorama Block v1.0.2
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-lg font-medium text-white capitalize">{activeTab}</h3>
              <button 
                onClick={onClose}
                className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              
              {/* --- GENERAL TAB --- */}
              {activeTab === 'general' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8 max-w-2xl"
                >
                  {/* Currency */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-zinc-300">Currency Display</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['USD', 'EUR', 'ETH', 'BTC'].map((curr) => (
                        <button
                          key={curr}
                          onClick={() => setCurrency(curr)}
                          className={cn(
                            "flex items-center justify-center py-2.5 rounded-xl border transition-all text-sm font-medium",
                            currency === curr 
                              ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                              : "bg-black/40 border-white/10 text-zinc-400 hover:bg-white/5"
                          )}
                        >
                          {curr}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-zinc-300">Language</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['English', 'Portuguese'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setLanguage(lang)}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm font-medium",
                            language === lang 
                              ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                              : "bg-black/40 border-white/10 text-zinc-400 hover:bg-white/5"
                          )}
                        >
                          {lang}
                          {language === lang && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme */}
                  <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-white">Dark Mode</div>
                      <div className="text-xs text-zinc-500">Locked for brand consistency</div>
                    </div>
                    <Switch.Root checked={true} disabled className="w-10 h-6 bg-primary rounded-full relative opacity-80 cursor-not-allowed">
                      <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-5" />
                    </Switch.Root>
                  </div>
                </motion.div>
              )}

              {/* --- SECURITY TAB --- */}
              {activeTab === 'security' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8 max-w-2xl"
                >
                  <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-white">Secure Settings</div>
                      <div className="text-xs text-zinc-500">Require signature for changes</div>
                    </div>
                    <Switch.Root 
                      checked={requireSignature} 
                      onCheckedChange={setRequireSignature}
                      className={cn(
                        "w-10 h-6 rounded-full relative transition-colors",
                        requireSignature ? "bg-primary" : "bg-zinc-700"
                      )}
                    >
                      <Switch.Thumb className={cn(
                        "block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 will-change-transform",
                        requireSignature ? "translate-x-5" : "translate-x-1"
                      )} />
                    </Switch.Root>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-sm font-medium text-zinc-300">Token Allowances</label>
                       <span className="text-xs text-zinc-500">Main Wallet</span>
                    </div>
                    
                    <div className="space-y-3">
                      {[
                        { token: "USDC", spender: "Uniswap Router", limit: "Unlimited" },
                        { token: "WETH", spender: "Aave V3 Pool", limit: "Unlimited" },
                        { token: "USDT", spender: "1inch Router", limit: "50,000" },
                      ].map((allowance, i) => (
                        !revokedTokens.includes(allowance.token) && (
                          <div key={i} className="flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:border-white/20 transition-colors">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                                 {allowance.token[0]}
                               </div>
                               <div>
                                 <div className="text-sm font-medium text-white">{allowance.token}</div>
                                 <div className="text-xs text-zinc-500">Spender: {allowance.spender}</div>
                               </div>
                            </div>
                            <div className="flex items-center gap-4">
                               <div className="text-xs font-mono text-zinc-400 bg-white/5 px-2 py-1 rounded">
                                 {allowance.limit}
                               </div>
                               <button 
                                 onClick={() => handleRevoke(allowance.token)}
                                 className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-xs flex items-center gap-1"
                               >
                                 <Trash2 className="w-3 h-3" />
                                 Revoke
                               </button>
                            </div>
                          </div>
                        )
                      ))}
                      {revokedTokens.length === 3 && (
                         <div className="p-8 text-center text-zinc-500 text-sm italic bg-black/20 rounded-xl border border-white/5 border-dashed">
                           No active allowances found. Safe and sound.
                         </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- NOTIFICATIONS TAB --- */}
              {activeTab === 'notifications' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6 max-w-2xl"
                >
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-6">
                    {/* Item 1 */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-white">Executions via Zico</div>
                        <div className="text-xs text-zinc-500">Get notified when AI completes a task</div>
                      </div>
                      <Switch.Root 
                        checked={notifZico} 
                        onCheckedChange={setNotifZico}
                        className={cn("w-10 h-6 rounded-full relative transition-colors", notifZico ? "bg-primary" : "bg-zinc-700")}
                      >
                        <Switch.Thumb className={cn("block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 will-change-transform", notifZico ? "translate-x-5" : "translate-x-1")} />
                      </Switch.Root>
                    </div>
                    
                    <div className="h-px bg-white/5" />

                    {/* Item 2 */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-white">Health Factor Alerts</div>
                        <div className="text-xs text-zinc-500">Critical alerts for your lending positions</div>
                      </div>
                      <Switch.Root 
                        checked={notifHealth} 
                        onCheckedChange={setNotifHealth}
                        className={cn("w-10 h-6 rounded-full relative transition-colors", notifHealth ? "bg-primary" : "bg-zinc-700")}
                      >
                        <Switch.Thumb className={cn("block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 will-change-transform", notifHealth ? "translate-x-5" : "translate-x-1")} />
                      </Switch.Root>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Item 3 */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-white">New Gem Alerts</div>
                        <div className="text-xs text-zinc-500">Receive signals for trending tokens</div>
                      </div>
                      <Switch.Root 
                        checked={notifNewGems} 
                        onCheckedChange={setNotifNewGems}
                        className={cn("w-10 h-6 rounded-full relative transition-colors", notifNewGems ? "bg-primary" : "bg-zinc-700")}
                      >
                        <Switch.Thumb className={cn("block w-4 h-4 bg-white rounded-full transition-transform translate-x-1 will-change-transform", notifNewGems ? "translate-x-5" : "translate-x-1")} />
                      </Switch.Root>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- DEVELOPER TAB --- */}
              {activeTab === 'developer' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8 max-w-2xl"
                >
                  <div className="space-y-4">
                     <DataInput 
                       label="RPC Endpoint" 
                       defaultValue="https://mainnet.infura.io/v3/..." 
                       rightElement={<div className="text-xs text-green-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-400" />Active</div>}
                     />
                     
                     <div className="pt-4">
                       <label className="text-sm font-medium text-zinc-300 block mb-3">API Keys</label>
                       <div className="p-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                          <div className="font-mono text-sm text-zinc-400">pk_live_...9f2a</div>
                          <button className="text-xs text-primary hover:text-primary/80 font-medium">Reveal</button>
                       </div>
                     </div>
                  </div>
                </motion.div>
              )}

            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
