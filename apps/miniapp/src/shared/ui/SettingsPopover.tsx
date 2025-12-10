'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/utils';
import { useTransactionSettings } from './TransactionSettingsContext';

interface SettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function SettingsPopover({ isOpen, onClose, className }: SettingsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { slippage, setSlippage, deadline, setDeadline, expertMode, setExpertMode } = useTransactionSettings();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'absolute top-full right-0 mt-2 w-72 bg-pano-bg-secondary/95 border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-xl overflow-hidden',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-medium text-pano-text-primary">Transaction Settings</h3>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-pano-text-muted">Slippage Tolerance</span>
            <span className="text-xs text-pano-text-accent font-mono">{slippage}%</span>
          </div>
          <div className="flex gap-2">
            {['Auto', '0.5', '1.0'].map((opt) => {
              const active = (opt === 'Auto' && slippage === '0.5') || (opt !== 'Auto' && slippage === opt);
              return (
                <button
                  key={opt}
                  onClick={() => setSlippage(opt === 'Auto' ? '0.5' : opt)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all',
                    active
                      ? 'bg-pano-primary/20 border-pano-primary text-pano-text-primary'
                      : 'bg-white/5 border-transparent text-pano-text-muted hover:bg-white/10'
                  )}
                >
                  {opt === 'Auto' ? 'Auto' : `${opt}%`}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <input
              type="text"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right text-sm text-pano-text-primary focus:border-pano-primary/50 focus:outline-none placeholder:text-pano-text-muted font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pano-text-muted text-sm pointer-events-none">%</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-pano-text-muted">Transaction Deadline</span>
            <span className="text-xs text-pano-text-muted">(minutes)</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right text-sm text-pano-text-primary focus:border-pano-primary/50 focus:outline-none placeholder:text-pano-text-muted font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pano-text-muted text-sm pointer-events-none">min</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-xs text-pano-text-primary">Expert Mode</span>
          <button
            onClick={() => setExpertMode(!expertMode)}
            className={cn(
              'w-12 h-6 rounded-full relative transition-colors',
              expertMode ? 'bg-pano-error' : 'bg-pano-text-muted/30'
            )}
          >
            <span
              className={cn(
                'block w-5 h-5 bg-white rounded-full transition-transform translate-y-0.5',
                expertMode ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
