import React from 'react';
import { cn } from '@/shared/lib/utils';

interface SwapSuccessCardProps {
  txHashes: Array<{ hash: string; chainId: number }>;
  onClose?: () => void;
  className?: string;
  variant?: 'default' | 'compact';
}

function explorerTxUrl(chainId: number, hash: string): string | null {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    42161: 'https://arbiscan.io/tx/',
    137: 'https://polygonscan.com/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    43114: 'https://snowtrace.io/tx/',
    250: 'https://ftmscan.com/tx/',
  };

  return explorers[chainId] ? `${explorers[chainId]}${hash}` : null;
}

function getChainName(chainId: number): string {
  const chainNames: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    42161: 'Arbitrum One',
    137: 'Polygon',
    10: 'Optimism',
    56: 'BNB Chain',
    43114: 'Avalanche',
    250: 'Fantom',
  };

  return chainNames[chainId] || `Chain ${chainId}`;
}

export function SwapSuccessCard({
  txHashes,
  onClose,
  className = '',
  variant = 'default'
}: SwapSuccessCardProps) {
  const isCompact = variant === 'compact';
  const displayedTx = isCompact ? txHashes.slice(0, 1) : txHashes;
  const remainingCount = txHashes.length - displayedTx.length;

  return (
    <div
      className={cn(
        'animate-slideUp rounded-2xl border border-pano-border-subtle bg-pano-surface/90 shadow-lg backdrop-blur',
        isCompact ? 'p-4' : 'p-6',
        className
      )}
    >
      {/* Success Header */}
      <div className={cn('space-y-3', isCompact && 'space-y-2')}>
        {!isCompact && (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pano-text-muted">
            Status
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3
              className={cn(
                'font-semibold text-pano-text-primary',
                isCompact ? 'text-sm' : 'text-lg'
              )}
            >
              Swap executed successfully
            </h3>
            <p
              className={cn(
                'text-pano-text-secondary',
                isCompact ? 'text-xs' : 'text-sm'
              )}
            >
              Confirmation finalized on-chain. Wallet balances update shortly after propagation.
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                'rounded-lg border border-pano-border-subtle text-pano-text-secondary transition hover:border-pano-primary hover:text-pano-text-primary',
                isCompact ? 'px-2.5 py-1 text-[11px] uppercase tracking-wide' : 'px-3 py-1.5 text-xs font-semibold uppercase tracking-wide'
              )}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Transaction Hashes */}
      {displayedTx.length > 0 && (
        <div className={cn('space-y-4', isCompact ? 'mt-4' : 'mt-8')}>
          {!isCompact && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pano-text-muted">
                Transaction {txHashes.length > 1 ? 'hashes' : 'hash'}
              </p>
              <p className="text-sm text-pano-text-secondary">
                Keep these references for audits or support tickets.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {displayedTx.map((tx, index) => {
              const explorerUrl = explorerTxUrl(tx.chainId, tx.hash);
              const chainName = getChainName(tx.chainId);

              return (
                <div
                  key={index}
                  className={cn(
                    'rounded-xl border border-pano-border-subtle bg-pano-bg-tertiary/80 transition hover:border-pano-primary/40',
                    isCompact ? 'p-3' : 'p-4'
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-pano-text-muted">
                    <span className="font-semibold text-pano-text-primary">{chainName}</span>
                    <span>Chain ID {tx.chainId}</span>
                  </div>
                  <code
                    className={cn(
                      'mt-3 block break-all font-mono text-pano-text-primary',
                      isCompact ? 'text-xs' : 'text-sm'
                    )}
                  >
                    {tx.hash}
                  </code>

                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'mt-3 inline-block font-semibold text-pano-text-accent transition hover:text-pano-primary',
                        isCompact ? 'text-[11px]' : 'text-xs'
                      )}
                    >
                      Ver no explorer
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {isCompact && remainingCount > 0 && (
            <p className="text-[11px] text-pano-text-muted">
              +{remainingCount} additional transaction{remainingCount > 1 ? 's' : ''} recorded — check the explorer for full details.
            </p>
          )}
        </div>
      )}

      {/* Success Message */}
      {!isCompact && (
        <div className="mt-6 rounded-xl border border-pano-border-subtle bg-pano-bg-tertiary/80 p-4">
          <p className="text-sm font-semibold text-pano-text-primary">Next steps</p>
          <p className="mt-2 text-xs text-pano-text-secondary">
            Your tokens are on their way. Use the hashes above as proof in any third-party interface.
            Balances refresh automatically once the wallet syncs.
          </p>
        </div>
      )}
    </div>
  );
}

export default SwapSuccessCard;
