'use client';

import React from 'react';
import { useLiquidityFlow } from '@/features/liquidity/useLiquidityFlow';
import { LiquiditySelectionCard } from '@/components/ui/LiquiditySelectionCard';
import { LiquidityPreviewCard } from '@/components/ui/LiquidityPreviewCard';
import { LiquiditySuccessCard } from '@/components/ui/LiquiditySuccessCard';

export default function TestLiquidityPage() {
  const liquidity = useLiquidityFlow({
    accountAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', // Mock address
    activeConversationId: 'test-conversation',
    onAddMessage: (message) => {
      console.log('[TEST PAGE] Message added:', message);
    },
    getNetworkByName: (chainName: string) => {
      // Mock network getter
      const networks: Record<string, { chainId: number; name: string }> = {
        ethereum: { chainId: 1, name: 'Ethereum' },
        base: { chainId: 8453, name: 'Base' },
        arbitrum: { chainId: 42161, name: 'Arbitrum' },
        polygon: { chainId: 137, name: 'Polygon' },
      };
      return networks[chainName.toLowerCase()] || networks.ethereum;
    },
  });

  const handleStartFlow = async () => {
    console.log('[TEST PAGE] Starting liquidity flow...');
    await liquidity.handleLiquidityFromMetadata({
      action: 'request_liquidity_provision',
      chain: 'ethereum',
      token0: 'ETH',
      token1: '1INCH',
      amount0: '0.278',
      amount1: '1.19',
      feeTier: 100,
    });
  };

  return (
    <div className="min-h-screen bg-pano-bg-primary text-pano-text-primary p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-pano-primary">
            🧪 Liquidity Flow Test Page
          </h1>
          <p className="text-sm text-pano-text-secondary">
            Isolated test environment for the liquidity provision flow
          </p>
        </div>

        {/* Test Button */}
        {!liquidity.showingSelection && !liquidity.liquidityQuote && !liquidity.liquidityLoading && (
          <button
            onClick={handleStartFlow}
            className="w-full px-6 py-4 bg-pano-primary text-pano-text-inverse rounded-xl font-semibold text-base hover:bg-pano-primary-hover transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
          >
            <span>🚀</span>
            <span>Start Liquidity Flow</span>
          </button>
        )}

        {/* Selection Card */}
        {liquidity.showingSelection && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-pano-text-muted">
              <span className="inline-block w-2 h-2 bg-pano-primary rounded-full animate-pulse" />
              <span>Selection Card Rendered</span>
            </div>
            <LiquiditySelectionCard
              onContinue={liquidity.handleSelectionComplete}
              onCancel={liquidity.handleCancelSelection}
            />
          </div>
        )}

        {/* Loading State */}
        {liquidity.liquidityLoading && !liquidity.liquidityQuote && (
          <div className="bg-[#1C1C1C]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 text-gray-300">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-pano-primary border-t-transparent" />
              <span className="text-base font-medium">Fetching liquidity quote...</span>
            </div>
            <p className="mt-3 text-sm text-pano-text-muted">
              Mock API delay: ~1.2s
            </p>
          </div>
        )}

        {/* Preview Card */}
        {liquidity.liquidityQuote && !liquidity.liquiditySuccess && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-pano-text-muted">
              <span className="inline-block w-2 h-2 bg-pano-primary rounded-full animate-pulse" />
              <span>Preview Card Rendered</span>
            </div>
            <LiquidityPreviewCard
              quote={liquidity.liquidityQuote}
              onConfirm={liquidity.handleConfirmLiquidity}
              onCancel={liquidity.handleCancelLiquidity}
              isLoading={liquidity.executingLiquidity}
            />
          </div>
        )}

        {/* Success Card */}
        {liquidity.liquiditySuccess && liquidity.liquidityTxHashes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-pano-text-muted">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
              <span>Success Card Rendered</span>
            </div>
            <LiquiditySuccessCard
              txHashes={liquidity.liquidityTxHashes}
              positionId="12345"
              token0Symbol={liquidity.liquidityQuote?.token0.symbol || 'ETH'}
              token1Symbol={liquidity.liquidityQuote?.token1.symbol || 'TOKEN'}
              onClose={liquidity.handleCloseLiquiditySuccess}
              variant="default"
            />

            {/* Reset Button */}
            <button
              onClick={handleStartFlow}
              className="w-full px-4 py-3 bg-pano-bg-secondary border border-pano-border-subtle text-pano-text-primary rounded-xl font-medium text-sm hover:border-pano-primary transition-all"
            >
              🔄 Test Again
            </button>
          </div>
        )}

        {/* Error State */}
        {liquidity.liquidityError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-base font-semibold text-red-500">Error</p>
            <p className="text-sm text-pano-text-secondary mt-2">{liquidity.liquidityError}</p>
            <button
              onClick={handleStartFlow}
              className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Debug Info */}
        <div className="rounded-xl border border-pano-border-subtle bg-pano-bg-secondary/50 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-pano-text-primary uppercase tracking-wide">
            Debug Info
          </h3>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-pano-text-muted">Showing Selection:</span>
              <span className={liquidity.showingSelection ? 'text-cyan-400' : 'text-gray-500'}>
                {liquidity.showingSelection ? '✓ True' : '✗ False'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-pano-text-muted">Loading:</span>
              <span className={liquidity.liquidityLoading ? 'text-yellow-400' : 'text-gray-500'}>
                {liquidity.liquidityLoading ? '✓ True' : '✗ False'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-pano-text-muted">Has Quote:</span>
              <span className={liquidity.liquidityQuote ? 'text-green-400' : 'text-gray-500'}>
                {liquidity.liquidityQuote ? '✓ True' : '✗ False'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-pano-text-muted">Executing:</span>
              <span className={liquidity.executingLiquidity ? 'text-yellow-400' : 'text-gray-500'}>
                {liquidity.executingLiquidity ? '✓ True' : '✗ False'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-pano-text-muted">Success:</span>
              <span className={liquidity.liquiditySuccess ? 'text-green-400' : 'text-gray-500'}>
                {liquidity.liquiditySuccess ? '✓ True' : '✗ False'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-pano-text-muted">Has Error:</span>
              <span className={liquidity.liquidityError ? 'text-red-400' : 'text-gray-500'}>
                {liquidity.liquidityError ? '✓ True' : '✗ False'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-pano-text-muted">TX Count:</span>
              <span className="text-pano-text-primary">
                {liquidity.liquidityTxHashes.length}
              </span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="rounded-xl border border-pano-border-subtle bg-pano-bg-secondary/50 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-pano-text-primary uppercase tracking-wide">
            Expected Flow
          </h3>
          <ol className="space-y-2 text-sm text-pano-text-secondary list-decimal list-inside">
            <li>Click "Start Liquidity Flow" button</li>
            <li>Loading state appears (~1.2s)</li>
            <li>Preview card renders with ETH/1INCH data</li>
            <li>Click "Confirm Open Position"</li>
            <li>Button shows loading (~2s)</li>
            <li>Success card appears with transaction hash</li>
            <li>Click "Test Again" to restart</li>
          </ol>
        </div>

        {/* Console Logs */}
        <div className="rounded-xl border border-pano-border-subtle bg-pano-bg-secondary/50 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-pano-text-primary uppercase tracking-wide">
            Expected Console Logs
          </h3>
          <pre className="text-xs text-pano-text-muted font-mono overflow-x-auto">
{`[TEST PAGE] Starting liquidity flow...
[LIQUIDITY] Processing provision: {...}
// 1.2s delay
[LIQUIDITY] Quote received: {...}
// User clicks Confirm
[LIQUIDITY] Executing liquidity provision...
// 2s delay
[LIQUIDITY] Position opened successfully: {...}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
