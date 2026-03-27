'use client';

import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResilienceBannerProps {
  /** Whether the currently displayed data comes from a previous successful fetch */
  isStale: boolean;
  /** The timestamp of the last successful data fetch */
  lastUpdated: Date | null;
  /** Called when the user clicks "Retry" */
  onRetry?: () => void;
  /** Extra CSS classes for the container */
  className?: string;
}

function useRelativeTime(date: Date | null): string {
  const [label, setLabel] = useState('');

  const compute = useCallback(() => {
    if (!date) return '';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }, [date]);

  useEffect(() => {
    setLabel(compute());
    const id = setInterval(() => setLabel(compute()), 15_000);
    return () => clearInterval(id);
  }, [compute]);

  return label;
}

/**
 * Subtle banner shown when data is stale due to a transient network/server error.
 * Renders nothing when data is fresh.
 */
export function ResilienceBanner({ isStale, lastUpdated, onRetry, className }: ResilienceBannerProps) {
  const relativeTime = useRelativeTime(lastUpdated);

  if (!isStale) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2',
        'bg-amber-500/10 border border-amber-500/20 text-amber-400',
        'text-xs font-medium',
        className,
      )}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />

      <span className="flex-1 leading-tight">
        {lastUpdated ? (
          <>
            <Clock className="inline h-3 w-3 mr-1 opacity-70" aria-hidden />
            Last known data &mdash; updated {relativeTime}
          </>
        ) : (
          'Showing cached data. Live prices may differ.'
        )}
      </span>

      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'ml-1 shrink-0 flex items-center gap-1 rounded px-2 py-0.5',
            'bg-amber-500/15 hover:bg-amber-500/25 transition-colors',
            'text-amber-300 hover:text-amber-200',
          )}
          aria-label="Retry fetching fresh data"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}
