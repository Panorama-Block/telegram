import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] active:scale-[0.98]",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

NeonButton.displayName = "NeonButton";
