import { useCallback, useEffect, useMemo, useState } from 'react';
import { swapApi } from './api';
import { BASE_CHAIN_ID, normalizeAddressKey, normalizeTokenForUi } from './provider';
import { networks, type Token } from './tokens';
import type { SwapPair } from './types';

const CATALOG_TTL_MS = 60_000;

let cachedPairs: SwapPair[] | null = null;
let cachedPairsExpiresAt = 0;
let inFlightPairsRequest: Promise<SwapPair[]> | null = null;

const BASE_ICON_BY_SYMBOL: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDbC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  AERO: 'https://assets.coingecko.com/coins/images/31745/small/token.png',
  DAI: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  cbBTC: 'https://assets.coingecko.com/coins/images/40489/small/cbBTC.png',
  cbETH: 'https://assets.coingecko.com/coins/images/40143/small/cbeth.png',
  wstETH: 'https://assets.coingecko.com/coins/images/18834/small/wstETH.png',
};

const BASE_NAME_BY_SYMBOL: Record<string, string> = {
  ETH: 'Ethereum',
  WETH: 'Wrapped Ether',
  USDC: 'USD Coin',
  USDbC: 'USD Base Coin',
  USDT: 'Tether USD',
  AERO: 'Aerodrome',
  DAI: 'Dai Stablecoin',
  cbBTC: 'Coinbase Wrapped BTC',
  cbETH: 'Coinbase Wrapped ETH',
  wstETH: 'Wrapped stETH',
};

interface CatalogState {
  pairs: SwapPair[];
  loading: boolean;
  error: string | null;
}

async function fetchBasePairs(force = false): Promise<SwapPair[]> {
  const now = Date.now();
  if (!force && cachedPairs && cachedPairsExpiresAt > now) {
    return cachedPairs;
  }

  if (!force && inFlightPairsRequest) {
    return inFlightPairsRequest;
  }

  inFlightPairsRequest = (async () => {
    const response = await swapApi.pairs();
    const pairs = Array.isArray(response?.pairs) ? response.pairs : [];
    cachedPairs = pairs;
    cachedPairsExpiresAt = Date.now() + CATALOG_TTL_MS;
    return pairs;
  })();

  try {
    return await inFlightPairsRequest;
  } finally {
    inFlightPairsRequest = null;
  }
}

function buildBaseTokenLookup(): Map<string, Token> {
  const map = new Map<string, Token>();
  const baseNetwork = networks.find((item) => item.chainId === BASE_CHAIN_ID);
  if (!baseNetwork) return map;

  for (const token of [baseNetwork.nativeCurrency, ...baseNetwork.tokens]) {
    map.set(normalizeAddressKey(token.address), token);
  }

  return map;
}

function toCatalogToken(token: SwapPair['tokenIn'] | SwapPair['tokenOut'], baseLookup: Map<string, Token>): Token {
  const uiAddress = normalizeTokenForUi(token.address);
  const key = normalizeAddressKey(uiAddress);
  const known = baseLookup.get(key);

  if (known) {
    return {
      symbol: known.symbol,
      address: normalizeTokenForUi(known.address),
      decimals: known.decimals,
      icon: known.icon,
      name: known.name,
    };
  }

  return {
    symbol: token.symbol,
    address: uiAddress,
    decimals: token.decimals,
    icon: BASE_ICON_BY_SYMBOL[token.symbol] || BASE_ICON_BY_SYMBOL.ETH,
    name: BASE_NAME_BY_SYMBOL[token.symbol] || token.symbol,
  };
}

function buildAllowedTargets(pairs: SwapPair[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const pair of pairs) {
    const from = normalizeAddressKey(pair.tokenIn.address);
    const to = normalizeAddressKey(pair.tokenOut.address);

    const current = map.get(from) || new Set<string>();
    current.add(to);
    map.set(from, current);
  }

  return map;
}

export function useBaseSwapCatalog() {
  const [state, setState] = useState<CatalogState>({
    pairs: cachedPairs || [],
    loading: !cachedPairs,
    error: null,
  });

  const refresh = useCallback(async (force = false) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const pairs = await fetchBasePairs(force);
      setState({ pairs, loading: false, error: null });
    } catch (error: any) {
      setState((current) => ({
        pairs: current.pairs,
        loading: false,
        error: String(error?.message || 'Failed to load Base swap catalog'),
      }));
    }
  }, []);

  useEffect(() => {
    if (!cachedPairs || cachedPairsExpiresAt <= Date.now()) {
      void refresh(false);
      return;
    }

    setState({ pairs: cachedPairs, loading: false, error: null });
  }, [refresh]);

  const baseLookup = useMemo(() => buildBaseTokenLookup(), []);

  const tokens = useMemo(() => {
    const byAddress = new Map<string, Token>();

    for (const pair of state.pairs) {
      const tokenIn = toCatalogToken(pair.tokenIn, baseLookup);
      const tokenOut = toCatalogToken(pair.tokenOut, baseLookup);

      byAddress.set(normalizeAddressKey(tokenIn.address), tokenIn);
      byAddress.set(normalizeAddressKey(tokenOut.address), tokenOut);
    }

    return Array.from(byAddress.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [state.pairs, baseLookup]);

  const allowedTargets = useMemo(() => buildAllowedTargets(state.pairs), [state.pairs]);

  const getAllowedOutputs = useCallback((tokenAddress: string): Set<string> => {
    const key = normalizeAddressKey(tokenAddress);
    return new Set(allowedTargets.get(key) || []);
  }, [allowedTargets]);

  const isPairSupported = useCallback((tokenIn: string, tokenOut: string): boolean => {
    const from = normalizeAddressKey(tokenIn);
    const to = normalizeAddressKey(tokenOut);
    const targets = allowedTargets.get(from);
    return Boolean(targets && targets.has(to));
  }, [allowedTargets]);

  return {
    pairs: state.pairs,
    tokens,
    loading: state.loading,
    error: state.error,
    refresh,
    getAllowedOutputs,
    isPairSupported,
  };
}
