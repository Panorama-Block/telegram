import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import * as Switch from '@radix-ui/react-switch';
import { useTransactionSettings } from "@/context/TransactionSettingsContext";

interface SettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPopover({ isOpen, onClose }: SettingsPopoverProps) {
  const { slippage, setSlippage, deadline, setDeadline, expertMode, setExpertMode } = useTransactionSettings();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute top-full right-0 mt-2 w-72 bg-black/90 border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-medium text-white">Transaction Settings</h3>
          </div>

          <div className="p-4 space-y-4">
            
            {/* Slippage Tolerance */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Slippage Tolerance</span>
                <span className="text-xs text-primary font-mono">{slippage}%</span>
              </div>
              <div className="flex gap-2">
                {['Auto', '0.5', '1.0'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSlippage(opt === 'Auto' ? '0.5' : opt)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all",
                      (opt === 'Auto' && slippage === '0.5') || (opt !== 'Auto' && slippage === opt)
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-white/5 border-transparent text-zinc-400 hover:bg-white/10"
                    )}
                  >
                    {opt === 'Auto' ? 'Auto' : `${opt}%`}
                  </button>
                ))}
              </div>
              <div className="relative">
                 <input 
                   type="text" 
                   value={slippage}
                   onChange={(e) => setSlippage(e.target.value)}
                   className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-right text-sm text-white focus:border-primary/50 focus:outline-none placeholder:text-zinc-600 font-mono"
                 />
                 <span className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">%</span>
              </div>
            </div>

            {/* Transaction Deadline */}
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Transaction Deadline</span>
                <span className="text-xs text-zinc-500">(minutes)</span>
              </div>
              <div className="relative">
                 <input 
                   type="text" 
                   value={deadline}
                   onChange={(e) => setDeadline(e.target.value)}
                   className="w-full bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-right text-sm text-white focus:border-primary/50 focus:outline-none placeholder:text-zinc-600 font-mono"
                 />
                 <span className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">min</span>
              </div>
            </div>

            {/* Expert Mode */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-xs text-zinc-300">Expert Mode</span>
              <Switch.Root 
                checked={expertMode}
                onCheckedChange={setExpertMode}
                className={cn("w-8 h-5 rounded-full relative transition-colors", expertMode ? 'bg-red-500' : 'bg-zinc-700')}
              >
                <Switch.Thumb className={cn("block w-3 h-3 bg-white rounded-full transition-transform translate-x-1 translate-y-1 will-change-transform", expertMode ? 'translate-x-4' : 'translate-x-1')} />
              </Switch.Root>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
