"use client";

import { useState, useCallback } from 'react';
import { tacApi } from './client';
import { useWalletIdentity } from '@/shared/contexts/WalletIdentityContext';

export function useTacQuote() {
  const { chainType, address } = useWalletIdentity();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);

  const getQuote = useCallback(async (payload: {
    fromChain: string;
    toChain: string;
    fromToken: string;
    toToken: string;
    amount: number;
    operationType: 'cross_chain_swap' | 'cross_chain_lending' | 'cross_chain_staking' | 'cross_chain_yield_farming';
    slippage?: number;
  }) => {
    if (chainType === 'none') {
      setError('Connect a wallet first');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await tacApi.quote({
        ...payload,
        userAddress: address
      });
      setQuote(data);
      return data;
    } catch (e: any) {
      setError(e?.message || 'Quote failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [chainType, address]);

  return { getQuote, loading, error, quote };
}
