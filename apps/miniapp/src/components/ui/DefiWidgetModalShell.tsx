import { AnimatePresence, motion } from "framer-motion";
import { ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

type DefiWidgetVariant = "modal" | "panel";

interface DefiWidgetModalShellProps {
  onClose: () => void;
  variant?: DefiWidgetVariant;
  isMobile?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  cardClassName?: string;
  bodyClassName?: string;
  maxWidthClassName?: string;
  showGradientGlow?: boolean;
  gradientClassName?: string;
  showMobileHandle?: boolean;
  /** Optional data-tour identifier for guided-tour spotlight */
  dataTour?: string;
}

export function DefiWidgetModalShell({
  onClose,
  variant = "modal",
  isMobile = false,
  header,
  footer,
  children,
  cardClassName,
  bodyClassName,
  maxWidthClassName = "md:max-w-[480px]",
  showGradientGlow = true,
  gradientClassName = "bg-primary/10",
  showMobileHandle = false,
  dataTour,
}: DefiWidgetModalShellProps) {
  const modalVariants = {
    initial: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
    animate: isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 },
    exit: isMobile ? { y: "100%", opacity: 0 } : { scale: 0.95, opacity: 0 },
  };

  const card = (
    <GlassCard
      data-testid="defi-widget-card"
      data-tour={dataTour}
      className={cn(
        "defi-widget-shell-card w-full shadow-2xl overflow-hidden relative bg-[#0A0A0A] border-white/10 flex flex-col rounded-2xl border",
        cardClassName,
      )}
    >
      {showGradientGlow && (
        <div
          className={cn(
            "absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 blur-[60px] pointer-events-none",
            gradientClassName,
          )}
        />
      )}

      {showMobileHandle && (
        <div className="md:hidden w-full flex justify-center pt-3 pb-1 shrink-0 relative z-10">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
        </div>
      )}

      {header && <div className="relative z-10 shrink-0">{header}</div>}

      <div
        data-testid="defi-widget-body"
        className={cn(
          "defi-widget-shell-body relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain",
          bodyClassName,
        )}
      >
        {children}
      </div>

      {footer && <div className="relative z-10 shrink-0">{footer}</div>}
    </GlassCard>
  );

  if (variant === "panel") {
    return <div className="w-full max-w-[520px] mx-auto p-4">{card}</div>;
  }

  return (
    <AnimatePresence>
      <motion.div
        key="defi-widget-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        data-testid="defi-widget-overlay"
        className="defi-widget-shell-overlay fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn("relative w-full md:my-auto", maxWidthClassName)}
          onClick={(event) => event.stopPropagation()}
        >
          {card}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
