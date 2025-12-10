import { motion, AnimatePresence } from "framer-motion";
import { 
  ClipboardList, 
  X, 
  ChevronDown, 
  ChevronRight,
  Info,
  ArrowLeft,
  Fuel,
  Calendar,
  CheckCircle2
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { DataInput } from "@/components/ui/DataInput";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DCAProps {
  onClose: () => void;
}

type ViewState = 'input' | 'review';

export function DCA({ onClose }: DCAProps) {
  const [viewState, setViewState] = useState<ViewState>('input');
  const [frequency, setFrequency] = useState("Weekly");
  const [duration, setDuration] = useState("Until Cancelled");

  // Responsive variants
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={modalVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full md:max-w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 h-[85vh] md:h-auto md:min-h-[600px] flex flex-col rounded-t-3xl rounded-b-none md:rounded-2xl border-b-0 md:border-b pb-safe">
          {/* Gradient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-primary/10 blur-[60px] pointer-events-none" />

          {/* Mobile Drag Handle */}
          <div className="md:hidden w-full flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
          </div>

          <AnimatePresence mode="wait">
            {/* --- STATE 1: INPUT --- */}
            {viewState === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Header */}
                <div className="p-6 flex items-center justify-between relative z-10">
                   <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-display font-bold text-white">Custom Orders</h2>
                        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                          Automated Strategy
                        </div>
                      </div>
                   </div>
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                </div>

                <div className="px-6 pb-8 space-y-6 relative z-10 flex-1 flex flex-col">
                  
                  {/* Input 1: I want to buy */}
                  <DataInput
                    label="I want to buy"
                    defaultValue="0.1"
                    rightElement={
                      <button className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group">
                        <div className="w-6 h-6 rounded-full bg-blue-500" />
                        <span className="text-white font-medium">ETH</span>
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />

                  {/* Input 2: Paying with */}
                  <DataInput
                    label="Paying with"
                    defaultValue="200.00"
                    rightElement={
                      <button className="flex items-center gap-2 bg-black border border-white/10 rounded-full px-3 py-1.5 hover:bg-zinc-900 transition-colors group">
                        <div className="w-6 h-6 rounded-full bg-green-500" />
                        <span className="text-white font-medium">USDC</span>
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                      </button>
                    }
                  />

                  {/* Frequency Config */}
                  <div className="space-y-2">
                     <label className="text-xs font-medium text-zinc-500">Frequency</label>
                     <div className="flex bg-black/40 border border-white/5 rounded-xl p-1">
                       {['Daily', 'Weekly', 'Monthly'].map((freq) => (
                         <button
                           key={freq}
                           onClick={() => setFrequency(freq)}
                           className={cn(
                             "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                             frequency === freq 
                               ? 'bg-white/10 text-white shadow-sm' 
                               : 'text-zinc-500 hover:text-zinc-300'
                           )}
                         >
                           {freq}
                         </button>
                       ))}
                     </div>
                     <div className="flex items-center gap-3 mt-3">
                       <span className="text-sm text-zinc-400">Every</span>
                       <input 
                         type="number" 
                         defaultValue="7" 
                         className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-center text-white focus:border-primary/50 outline-none"
                       />
                       <span className="text-sm text-zinc-400">Days</span>
                     </div>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-500">Next purchase</span>
                       <span className="text-white font-medium">Tomorrow at 9:00 AM</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-500">Total Duration</span>
                       <span className="text-white font-medium">Until Cancelled</span>
                     </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-auto">
                    <NeonButton 
                      onClick={() => setViewState('review')}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 border-none w-full"
                    >
                      Start DCA Strategy
                    </NeonButton>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- STATE 2: REVIEW --- */}
            {viewState === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Header */}
                <div className="p-6 flex items-center justify-between relative z-10">
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setViewState('input')}
                        className="p-2 -ml-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <h2 className="text-lg font-display font-bold text-white">Confirm Strategy</h2>
                   </div>
                   <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-5 h-5" />
                   </button>
                </div>

                <div className="px-6 pb-8 flex-1 flex flex-col relative z-10 overflow-y-auto custom-scrollbar">
                  
                  {/* Highlight Block (Summary) */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8 text-center">
                    <div className="text-zinc-400 text-sm mb-1">You are buying</div>
                    <div className="text-3xl font-bold text-white font-display mb-2">0.1 ETH</div>
                    <div className="text-zinc-500 text-sm mb-4">with <span className="text-white font-mono">200 USDC</span></div>
                    
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
                      <Clock className="w-3 h-3" />
                      Every 7 Days
                    </div>
                  </div>

                  {/* Timeline Preview */}
                  <div className="mb-8 px-4 relative">
                    <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-white/10" />
                    
                    <div className="space-y-6 relative z-10">
                      {/* Item 1 */}
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5 ring-4 ring-black" />
                        <div>
                          <div className="text-white font-medium text-sm">Now</div>
                          <div className="text-zinc-500 text-xs">Approve USDC & Create Session</div>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 mt-1.5 ring-4 ring-black border border-white/20" />
                        <div>
                          <div className="text-white font-medium text-sm">1st Buy: Today</div>
                          <div className="text-zinc-500 text-xs">Executes immediately after setup</div>
                        </div>
                      </div>

                      {/* Item 3 */}
                      <div className="flex items-start gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-700 mt-1.5 ring-4 ring-black border border-white/20" />
                        <div>
                          <div className="text-white font-medium text-sm">2nd Buy: Nov 24</div>
                          <div className="text-zinc-500 text-xs">Runs automatically next week</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Card (Session Gas) */}
                  <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 shrink-0">
                        <Fuel className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium text-sm">Gas Tank Required</span>
                          <span className="text-yellow-500 font-mono text-xs font-bold px-1.5 py-0.5 bg-yellow-500/10 rounded border border-yellow-500/20">
                            0.005 ETH
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs leading-relaxed">
                          This gas is stored in your Panorama Wallet to pay for future automated transactions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Final Button */}
                  <div className="mt-auto">
                    <NeonButton className="bg-white text-black hover:bg-zinc-200 shadow-none w-full">
                      Activate Session & Start
                    </NeonButton>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
