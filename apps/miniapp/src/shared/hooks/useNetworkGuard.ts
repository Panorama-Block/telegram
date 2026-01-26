/**
 * Network Guard Hook
 *
 * Validates wallet network against required chain and provides
 * seamless network switching functionality.
 */

import { useState, useMemo, useCallback } from 'react';
import { useActiveAccount, useSwitchActiveWalletChain } from 'thirdweb/react';
import { defineChain } from 'thirdweb';
import { useWalletChainId } from './useWalletChainId';
import {
  getChainConfig,
  getChainName,
  isChainSupported,
  chainIdToHex,
  type ChainConfig,
} from '../config/chains';

// Network Guard Status
export type NetworkGuardStatus =
  | 'disconnected'      // No wallet connected
  | 'correct_network'   // Wallet is on the required network
  | 'wrong_network'     // Wallet is on a different network
  | 'switching'         // Network switch in progress
  | 'adding_network';   // Adding network to wallet

// Switch result error types
export type SwitchErrorType =
  | 'USER_REJECTED'       // User rejected the switch request
  | 'CHAIN_NOT_SUPPORTED' // Chain config not found
  | 'ADD_CHAIN_FAILED'    // Failed to add chain to wallet
  | 'SWITCH_FAILED'       // Generic switch failure
  | 'NO_PROVIDER'         // No ethereum provider available
  | 'UNKNOWN';            // Unknown error

export interface SwitchResult {
  success: boolean;
  error?: SwitchErrorType;
  message?: string;
}

export interface NetworkGuardState {
  // Status
  status: NetworkGuardStatus;

  // Chain info
  currentChainId: number | null;
  requiredChainId: number;
  currentChainName: string | null;
  requiredChainName: string;
  requiredChainConfig: ChainConfig | undefined;

  // Computed flags
  isConnected: boolean;
  isCorrectNetwork: boolean;
  isWrongNetwork: boolean;
  isSwitching: boolean;
  isAddingNetwork: boolean;

  // Actions
  switchToRequired: () => Promise<SwitchResult>;

  // Error state
  lastError: SwitchResult | null;
  clearError: () => void;
}

/**
 * Error code constants from EIP-1193
 */
const ERROR_CODES = {
  USER_REJECTED: 4001,
  CHAIN_NOT_ADDED: 4902,
  REQUEST_PENDING: -32002,
} as const;

/**
 * Hook for network validation and switching
 *
 * @param requiredChainId - The chain ID required for the operation
 * @returns NetworkGuardState with status, flags, and actions
 *
 * @example
 * ```tsx
 * const { isWrongNetwork, switchToRequired, requiredChainName } = useNetworkGuard(1);
 *
 * if (isWrongNetwork) {
 *   return <button onClick={switchToRequired}>Switch to {requiredChainName}</button>;
 * }
 * ```
 */
export function useNetworkGuard(requiredChainId: number): NetworkGuardState {
  const account = useActiveAccount();
  const switchChain = useSwitchActiveWalletChain();
  const { chainId: currentChainId } = useWalletChainId();

  const [status, setStatus] = useState<NetworkGuardStatus>('disconnected');
  const [lastError, setLastError] = useState<SwitchResult | null>(null);

  // Get chain configurations
  const requiredChainConfig = useMemo(
    () => getChainConfig(requiredChainId),
    [requiredChainId]
  );

  // Computed values
  const isConnected = account !== null;
  const isCorrectNetwork = isConnected && currentChainId === requiredChainId;
  const isWrongNetwork = isConnected && currentChainId !== null && currentChainId !== requiredChainId;
  const isSwitching = status === 'switching';
  const isAddingNetwork = status === 'adding_network';

  // Derive status from state
  const derivedStatus = useMemo<NetworkGuardStatus>(() => {
    if (isSwitching) return 'switching';
    if (isAddingNetwork) return 'adding_network';
    if (!isConnected) return 'disconnected';
    if (isCorrectNetwork) return 'correct_network';
    return 'wrong_network';
  }, [isConnected, isCorrectNetwork, isSwitching, isAddingNetwork]);

  // Get chain names
  const currentChainName = currentChainId ? getChainName(currentChainId) : null;
  const requiredChainName = getChainName(requiredChainId);

  // Clear error state
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  /**
   * Try to add the network to the wallet
   */
  const tryAddNetwork = useCallback(async (): Promise<SwitchResult> => {
    const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;

    if (!ethereum) {
      return { success: false, error: 'NO_PROVIDER', message: 'No wallet provider found' };
    }

    const config = getChainConfig(requiredChainId);
    if (!config) {
      return {
        success: false,
        error: 'CHAIN_NOT_SUPPORTED',
        message: `Chain ${requiredChainId} is not supported`,
      };
    }

    try {
      setStatus('adding_network');

      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdToHex(config.chainId),
            chainName: config.name,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: config.rpcUrls,
            blockExplorerUrls: config.blockExplorerUrls,
          },
        ],
      });

      console.log(`[NetworkGuard] Successfully added chain ${config.name}`);
      return { success: true };
    } catch (error: any) {
      console.error('[NetworkGuard] Failed to add chain:', error);

      if (error?.code === ERROR_CODES.USER_REJECTED) {
        return { success: false, error: 'USER_REJECTED', message: 'User rejected adding the network' };
      }

      return {
        success: false,
        error: 'ADD_CHAIN_FAILED',
        message: error?.message || 'Failed to add network to wallet',
      };
    }
  }, [requiredChainId]);

  /**
   * Switch to the required network
   */
  const switchToRequired = useCallback(async (): Promise<SwitchResult> => {
    const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;

    // Check prerequisites
    if (!account) {
      const result: SwitchResult = {
        success: false,
        error: 'NO_PROVIDER',
        message: 'No wallet connected',
      };
      setLastError(result);
      return result;
    }

    if (!isChainSupported(requiredChainId)) {
      const result: SwitchResult = {
        success: false,
        error: 'CHAIN_NOT_SUPPORTED',
        message: `Chain ${requiredChainId} is not supported`,
      };
      setLastError(result);
      return result;
    }

    // Already on correct network
    if (currentChainId === requiredChainId) {
      return { success: true };
    }

    try {
      setStatus('switching');
      setLastError(null);

      console.log(`[NetworkGuard] Switching from chain ${currentChainId} to ${requiredChainId}`);

      // Try using Thirdweb's switchChain first
      await switchChain(defineChain(requiredChainId));

      console.log(`[NetworkGuard] Successfully switched to chain ${requiredChainId}`);
      setStatus('correct_network');
      return { success: true };
    } catch (error: any) {
      console.error('[NetworkGuard] Switch failed:', error);

      // Check if chain needs to be added
      if (error?.code === ERROR_CODES.CHAIN_NOT_ADDED) {
        console.log('[NetworkGuard] Chain not added, attempting to add...');

        const addResult = await tryAddNetwork();

        if (addResult.success) {
          // Try switching again after adding
          try {
            await switchChain(defineChain(requiredChainId));
            setStatus('correct_network');
            return { success: true };
          } catch (retryError: any) {
            console.error('[NetworkGuard] Switch after add failed:', retryError);
            const result: SwitchResult = {
              success: false,
              error: 'SWITCH_FAILED',
              message: 'Failed to switch after adding network',
            };
            setLastError(result);
            setStatus('wrong_network');
            return result;
          }
        } else {
          setLastError(addResult);
          setStatus('wrong_network');
          return addResult;
        }
      }

      // User rejected
      if (error?.code === ERROR_CODES.USER_REJECTED) {
        const result: SwitchResult = {
          success: false,
          error: 'USER_REJECTED',
          message: 'Network switch was cancelled',
        };
        setLastError(result);
        setStatus('wrong_network');
        return result;
      }

      // Request pending
      if (error?.code === ERROR_CODES.REQUEST_PENDING) {
        const result: SwitchResult = {
          success: false,
          error: 'SWITCH_FAILED',
          message: 'A request is already pending. Check your wallet.',
        };
        setLastError(result);
        setStatus('wrong_network');
        return result;
      }

      // Unknown error
      const result: SwitchResult = {
        success: false,
        error: 'UNKNOWN',
        message: error?.message || 'Failed to switch network',
      };
      setLastError(result);
      setStatus('wrong_network');
      return result;
    }
  }, [account, currentChainId, requiredChainId, switchChain, tryAddNetwork]);

  return {
    // Status
    status: derivedStatus,

    // Chain info
    currentChainId,
    requiredChainId,
    currentChainName,
    requiredChainName,
    requiredChainConfig,

    // Computed flags
    isConnected,
    isCorrectNetwork,
    isWrongNetwork,
    isSwitching,
    isAddingNetwork,

    // Actions
    switchToRequired,

    // Error state
    lastError,
    clearError,
  };
}

export default useNetworkGuard;
