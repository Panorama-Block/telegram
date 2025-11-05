/**
 * Custom Hook for Liquidity Provision Flow
 * Encapsulates all liquidity-related logic for easy integration
 */

import { useState, useCallback } from 'react';
import type { LiquidityQuoteResponse } from './types';
import { getLiquidityQuote, prepareLiquidityTransaction, generateMockTxHash } from './mockApi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentName?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface UseLiquidityFlowProps {
  accountAddress?: string;
  activeConversationId: string | null;
  onAddMessage?: (message: Message) => void;
  getNetworkByName: (name: string) => { chainId: number } | undefined;
}

export function useLiquidityFlow({
  accountAddress,
  activeConversationId,
  onAddMessage,
  getNetworkByName,
}: UseLiquidityFlowProps) {
  // States
  const [showingSelection, setShowingSelection] = useState(false);
  const [liquidityQuote, setLiquidityQuote] = useState<LiquidityQuoteResponse['quote'] | null>(null);
  const [liquidityLoading, setLiquidityLoading] = useState(false);
  const [liquidityError, setLiquidityError] = useState<string | null>(null);
  const [liquiditySuccess, setLiquiditySuccess] = useState(false);
  const [executingLiquidity, setExecutingLiquidity] = useState(false);
  const [liquidityTxHashes, setLiquidityTxHashes] = useState<Array<{ hash: string; chainId: number }>>([]);
  const [currentLiquidityMetadata, setCurrentLiquidityMetadata] = useState<Record<string, unknown> | null>(null);

  // Start liquidity flow - show selection first
  const handleLiquidityFromMetadata = useCallback(async (metadata: Record<string, unknown>) => {
    if (!metadata || typeof metadata !== 'object') {
      console.warn('[LIQUIDITY] Invalid metadata');
      return;
    }

    console.log('[LIQUIDITY] Starting flow, showing selection card');
    setCurrentLiquidityMetadata(metadata);
    setShowingSelection(true);
    setLiquidityError(null);
  }, []);

  // Handle selection completion - fetch quote
  const handleSelectionComplete = useCallback(async (selectionData: {
    fromToken: string;
    toToken: string;
    amount: string;
  }) => {
    console.log('[LIQUIDITY] Selection completed:', selectionData);
    setShowingSelection(false);
    setLiquidityLoading(true);
    setLiquidityError(null);

    try {
      // Use selection data + metadata
      const chainName = currentLiquidityMetadata?.chain as string || 'ethereum';
      const token0Symbol = selectionData.fromToken || 'ETH';
      const token1Symbol = selectionData.toToken || '1INCH';
      const amount0 = selectionData.amount || '0.278';
      const amount1 = '1.19'; // Calculate based on pool ratio
      const feeTier = (currentLiquidityMetadata?.feeTier as number) || 100; // 0.01% default

      console.log('[LIQUIDITY] Processing provision:', {
        chainName,
        token0Symbol,
        token1Symbol,
        amount0,
        amount1,
        feeTier,
      });

      // Get network
      const network = getNetworkByName(chainName);
      if (!network) {
        throw new Error(`Network ${chainName} not supported`);
      }

      // Get quote
      const quoteResponse = await getLiquidityQuote({
        chainId: network.chainId,
        token0: token0Symbol.toUpperCase() === 'ETH' ? 'native' : '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Mock USDC address
        token1: token1Symbol.toUpperCase() === 'ETH' ? 'native' : '0x111111111117dC0aa78b770fA6A738034120C302', // Mock 1INCH address
        amount0: amount0,
        amount1: amount1,
        feeTier: feeTier,
      });

      if (!quoteResponse.success || !quoteResponse.quote) {
        throw new Error(quoteResponse.message || 'Failed to get liquidity quote');
      }

      setLiquidityQuote(quoteResponse.quote);
      console.log('[LIQUIDITY] Quote received:', quoteResponse.quote);
    } catch (error) {
      console.error('[LIQUIDITY] Error getting quote:', error);
      setLiquidityError(error instanceof Error ? error.message : 'Failed to get liquidity quote');
    } finally {
      setLiquidityLoading(false);
    }
  }, [getNetworkByName, currentLiquidityMetadata]);

  // Confirm and execute liquidity provision
  const handleConfirmLiquidity = useCallback(async () => {
    if (!liquidityQuote || !currentLiquidityMetadata) {
      console.warn('[LIQUIDITY] Missing required data');
      return;
    }

    if (!accountAddress) {
      setLiquidityError('Please connect your wallet first');
      return;
    }

    setExecutingLiquidity(true);
    setLiquidityError(null);

    try {
      console.log('[LIQUIDITY] Executing liquidity provision...');

      // Mock transaction execution (replace with real thirdweb logic later)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Generate mock transaction hash
      const mockTxHash = generateMockTxHash();
      const txData = {
        hash: mockTxHash,
        chainId: liquidityQuote.chainId,
      };

      setLiquidityTxHashes([txData]);
      setLiquiditySuccess(true);
      setLiquidityQuote(null);

      console.log('[LIQUIDITY] Position opened successfully:', txData);

      // Add success message to chat
      if (onAddMessage) {
        const successMessage: Message = {
          role: 'assistant',
          content: `✅ Liquidity position opened successfully!\n\nYour ${liquidityQuote.token0.symbol}/${liquidityQuote.token1.symbol} position is now active and earning fees.\n\n**Transaction Hash:** \`${mockTxHash}\`\n\n**Position Details:**\n- Fee Tier: ${liquidityQuote.feeTierLabel}\n- Share of Pool: ${liquidityQuote.shareOfPool}%\n- Estimated APR: ${liquidityQuote.estimatedApr}%\n\nYou can monitor your position in the Portfolio section.`,
          timestamp: new Date(),
        };
        onAddMessage(successMessage);
      }
    } catch (error) {
      console.error('[LIQUIDITY] Error executing:', error);
      setLiquidityError(error instanceof Error ? error.message : 'Failed to execute liquidity provision');
    } finally {
      setExecutingLiquidity(false);
    }
  }, [liquidityQuote, currentLiquidityMetadata, accountAddress, onAddMessage]);

  // Cancel selection
  const handleCancelSelection = useCallback(() => {
    setShowingSelection(false);
    setCurrentLiquidityMetadata(null);
    setLiquidityError(null);
  }, []);

  // Cancel liquidity provision
  const handleCancelLiquidity = useCallback(() => {
    setLiquidityQuote(null);
    setCurrentLiquidityMetadata(null);
    setLiquidityError(null);
  }, []);

  // Close liquidity success card
  const handleCloseLiquiditySuccess = useCallback(() => {
    setLiquiditySuccess(false);
    setLiquidityTxHashes([]);
  }, []);

  // Reset all states
  const resetLiquidityFlow = useCallback(() => {
    setShowingSelection(false);
    setLiquidityQuote(null);
    setLiquidityLoading(false);
    setLiquidityError(null);
    setLiquiditySuccess(false);
    setExecutingLiquidity(false);
    setLiquidityTxHashes([]);
    setCurrentLiquidityMetadata(null);
  }, []);

  return {
    // States
    showingSelection,
    liquidityQuote,
    liquidityLoading,
    liquidityError,
    liquiditySuccess,
    executingLiquidity,
    liquidityTxHashes,
    currentLiquidityMetadata,

    // Handlers
    handleLiquidityFromMetadata,
    handleSelectionComplete,
    handleCancelSelection,
    handleConfirmLiquidity,
    handleCancelLiquidity,
    handleCloseLiquiditySuccess,
    resetLiquidityFlow,
  };
}
