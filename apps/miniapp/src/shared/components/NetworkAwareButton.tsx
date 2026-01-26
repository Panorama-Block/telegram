/**
 * Network Aware Button Component
 *
 * A smart button that validates the wallet network before allowing actions.
 * Automatically transforms into a "Switch Network" button when on wrong chain.
 */

'use client';

import React, { useCallback, useState } from 'react';
import { Loader2, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNetworkGuard, type SwitchResult } from '../hooks/useNetworkGuard';
import { TON_CHAIN_ID } from '@/features/swap/tokens';

export interface NetworkAwareButtonProps {
  /** The chain ID required for this action */
  requiredChainId: number;
  /** Content to display when network is correct */
  children: React.ReactNode;
  /** Action to perform when network is correct and button is clicked */
  onClick: () => void | Promise<void>;
  /** Additional disabled state (merged with network check) */
  disabled?: boolean;
  /** Loading state from parent (shows spinner) */
  loading?: boolean;
  /** Custom class names */
  className?: string;
  /** Variant style */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width button */
  fullWidth?: boolean;
  /** Show network badge when correct */
  showNetworkBadge?: boolean;
  /** Custom switch button text */
  switchText?: string;
}

/**
 * NetworkAwareButton - Validates network before action
 *
 * States:
 * 1. Correct network → Normal button with children
 * 2. Wrong network → "Switch to [Network]" button
 * 3. Switching → Loading spinner with "Switching..."
 * 4. Error → Error message with retry option
 *
 * @example
 * ```tsx
 * <NetworkAwareButton
 *   requiredChainId={1}
 *   onClick={handleSwap}
 *   disabled={!canSwap}
 * >
 *   Swap Tokens
 * </NetworkAwareButton>
 * ```
 */
export function NetworkAwareButton({
  requiredChainId,
  children,
  onClick,
  disabled = false,
  loading = false,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  showNetworkBadge = false,
  switchText,
}: NetworkAwareButtonProps) {
  const [actionLoading, setActionLoading] = useState(false);

  // Skip network guard for TON (non-EVM)
  const isTonChain = requiredChainId === TON_CHAIN_ID;

  const {
    isConnected,
    isCorrectNetwork,
    isWrongNetwork,
    isSwitching,
    requiredChainName,
    currentChainName,
    switchToRequired,
    lastError,
    clearError,
  } = useNetworkGuard(requiredChainId);

  // Handle switch network
  const handleSwitch = useCallback(async () => {
    clearError();
    const result = await switchToRequired();

    if (!result.success && result.error === 'USER_REJECTED') {
      // User cancelled - no need to show error
      console.log('[NetworkAwareButton] User cancelled network switch');
    }
  }, [switchToRequired, clearError]);

  // Handle main action
  const handleClick = useCallback(async () => {
    if (disabled || loading || actionLoading) return;

    try {
      setActionLoading(true);
      await onClick();
    } finally {
      setActionLoading(false);
    }
  }, [onClick, disabled, loading, actionLoading]);

  // Style variants
  const baseStyles = cn(
    'relative flex items-center justify-center gap-2 font-semibold transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black',
    {
      'w-full': fullWidth,
      // Size variants
      'px-3 py-2 text-sm rounded-lg min-h-[36px]': size === 'sm',
      'px-4 py-3 text-base rounded-xl min-h-[48px]': size === 'md',
      'px-6 py-4 text-lg rounded-2xl min-h-[56px]': size === 'lg',
    }
  );

  const variantStyles = {
    primary: cn(
      'bg-gradient-to-r from-cyan-500 to-cyan-600 text-black',
      'hover:from-cyan-400 hover:to-cyan-500',
      'active:from-cyan-600 active:to-cyan-700',
      'focus:ring-cyan-500'
    ),
    secondary: cn(
      'bg-white/10 text-white border border-white/20',
      'hover:bg-white/20',
      'active:bg-white/5',
      'focus:ring-white/50'
    ),
    outline: cn(
      'bg-transparent text-cyan-400 border border-cyan-500/50',
      'hover:bg-cyan-500/10',
      'active:bg-cyan-500/20',
      'focus:ring-cyan-500'
    ),
  };

  const switchStyles = cn(
    'bg-gradient-to-r from-orange-500 to-amber-500 text-black',
    'hover:from-orange-400 hover:to-amber-400',
    'active:from-orange-600 active:to-amber-600',
    'focus:ring-orange-500'
  );

  const errorStyles = cn(
    'bg-red-500/20 text-red-400 border border-red-500/50',
    'hover:bg-red-500/30',
    'focus:ring-red-500'
  );

  // For TON chain, skip network validation
  if (isTonChain) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled || loading || actionLoading}
        className={cn(baseStyles, variantStyles[variant], className)}
      >
        {(loading || actionLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
      </button>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <button
        disabled
        className={cn(baseStyles, variantStyles.secondary, 'opacity-50', className)}
      >
        Connect Wallet
      </button>
    );
  }

  // Switching state
  if (isSwitching) {
    return (
      <button
        disabled
        className={cn(baseStyles, switchStyles, className)}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Switching to {requiredChainName}...</span>
      </button>
    );
  }

  // Error state (with retry)
  if (lastError && lastError.error !== 'USER_REJECTED') {
    return (
      <div className="space-y-2">
        <button
          onClick={handleSwitch}
          className={cn(baseStyles, errorStyles, className)}
        >
          <AlertCircle className="w-4 h-4" />
          <span>Retry Switch</span>
        </button>
        <p className="text-xs text-red-400 text-center px-2">
          {lastError.message || 'Failed to switch network'}
        </p>
      </div>
    );
  }

  // Wrong network state
  if (isWrongNetwork) {
    return (
      <div className="space-y-2">
        <button
          onClick={handleSwitch}
          className={cn(baseStyles, switchStyles, className)}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>{switchText || `Switch to ${requiredChainName}`}</span>
        </button>
        {currentChainName && (
          <p className="text-xs text-zinc-500 text-center">
            Currently on {currentChainName}
          </p>
        )}
      </div>
    );
  }

  // Correct network - render normal button
  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading || actionLoading}
      className={cn(baseStyles, variantStyles[variant], className)}
    >
      {(loading || actionLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
      {showNetworkBadge && isCorrectNetwork && (
        <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">
          {requiredChainName}
        </span>
      )}
    </button>
  );
}

/**
 * Simplified version that only shows the switch button when needed
 * Useful for inline network checks
 */
export function NetworkSwitchPrompt({
  requiredChainId,
  className,
}: {
  requiredChainId: number;
  className?: string;
}) {
  const {
    isWrongNetwork,
    isSwitching,
    requiredChainName,
    currentChainName,
    switchToRequired,
  } = useNetworkGuard(requiredChainId);

  if (!isWrongNetwork) return null;

  return (
    <div className={cn('p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl', className)}>
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-orange-400 mb-1">Wrong Network</p>
          <p className="text-xs text-zinc-400 mb-3">
            Please switch from {currentChainName} to {requiredChainName} to continue.
          </p>
          <button
            onClick={switchToRequired}
            disabled={isSwitching}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-black text-sm font-semibold rounded-lg hover:bg-orange-400 transition-colors disabled:opacity-50"
          >
            {isSwitching ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Switching...
              </>
            ) : (
              <>
                <ArrowLeftRight className="w-3 h-3" />
                Switch Network
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NetworkAwareButton;
