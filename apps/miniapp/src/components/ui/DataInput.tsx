import { cn } from "@/lib/utils";
import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

interface DataInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  balance?: string;
  rightElement?: ReactNode;
  onMaxClick?: () => void;
}

export const DataInput = forwardRef<HTMLInputElement, DataInputProps>(
  ({ className, label, balance, rightElement, onMaxClick, ...props }, ref) => {
    return (
      <div className={cn("space-y-2", className)}>
        {(label || balance) && (
          <div className="flex justify-between items-center px-1">
            {label && <span className="text-xs text-zinc-500 font-medium">{label}</span>}
            {balance && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{balance}</span>
                {onMaxClick && (
                  <button
                    type="button"
                    onClick={onMaxClick}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                  >
                    Max
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="relative flex items-center bg-black/40 border border-white/5 rounded-xl focus-within:border-cyan-500/50 transition-colors">
          <input
            ref={ref}
            className="flex-1 bg-transparent border-none outline-none p-4 text-white placeholder-zinc-600 font-mono text-lg w-full"
            {...props}
          />
          {rightElement && (
            <div className="pr-4 shrink-0">
              {rightElement}
            </div>
          )}
        </div>
      </div>
    );
  }
);

DataInput.displayName = "DataInput";
