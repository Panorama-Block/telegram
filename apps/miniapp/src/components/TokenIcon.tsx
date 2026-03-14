'use client';

import { useState } from "react";
import { cn } from "@/lib/utils";

const NETWORK_BG: Record<string, string> = {
  'TON': 'bg-blue-400',
  'Avalanche': 'bg-red-500',
  'Base': 'bg-blue-500',
  'Binance Smart Chain': 'bg-yellow-500',
  'BSC': 'bg-yellow-500',
  'Ethereum': 'bg-indigo-500',
  'Optimism': 'bg-red-400',
  'Arbitrum': 'bg-blue-400',
  'Polygon': 'bg-purple-500',
  'World Chain': 'bg-zinc-500',
};

function networkBg(network?: string): string {
  return (network && NETWORK_BG[network]) || 'bg-zinc-600';
}

interface TokenIconProps {
  src?: string;
  ticker: string;
  network?: string;
  /** Tailwind size classes, e.g. "w-6 h-6" or "w-5 h-5 sm:w-6 sm:h-6" */
  className?: string;
  /** Tailwind text size for the fallback letter, e.g. "text-[10px]" */
  textClassName?: string;
}

/**
 * Renders a token icon image with a graceful letter-based fallback.
 * Uses React state for error handling — immune to re-render resets.
 */
export function TokenIcon({
  src,
  ticker,
  network,
  className = "w-6 h-6",
  textClassName = "text-[10px]",
}: TokenIconProps) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={ticker}
        className={cn("rounded-full object-cover shrink-0", className)}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-bold shrink-0",
        className,
        textClassName,
        networkBg(network),
      )}
    >
      {ticker?.[0] ?? "?"}
    </div>
  );
}
