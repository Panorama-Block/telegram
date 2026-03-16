import { TON_CHAIN_ID } from './tokens';

export const BASE_CHAIN_ID = 8453;
export const EXECUTION_BASE_NATIVE_TOKEN = '0x0000000000000000000000000000000000000000';
export const UI_NATIVE_TOKEN = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export type SwapProvider = 'execution-base' | 'thirdweb' | 'bridge';

interface ResolveSwapProviderInput {
  fromChainId: number;
  toChainId: number;
  forcedProvider?: string | null;
}

export function isBaseToBaseSwap(fromChainId: number, toChainId: number): boolean {
  return fromChainId === BASE_CHAIN_ID && toChainId === BASE_CHAIN_ID;
}

export function resolveSwapProvider(input: ResolveSwapProviderInput): SwapProvider {
  const forced = (input.forcedProvider || '').trim().toLowerCase();
  if (forced === 'execution-base') return 'execution-base';
  if (forced === 'thirdweb') return 'thirdweb';
  if (forced === 'bridge') return 'bridge';

  if (input.fromChainId === TON_CHAIN_ID || input.toChainId === TON_CHAIN_ID) {
    return 'bridge';
  }

  if (isBaseToBaseSwap(input.fromChainId, input.toChainId)) {
    return 'execution-base';
  }

  return 'thirdweb';
}

function normalizeLower(address: string): string {
  return address.trim().toLowerCase();
}

function isNativeLike(address: string): boolean {
  const lower = normalizeLower(address);
  return (
    lower === 'native' ||
    lower === UI_NATIVE_TOKEN ||
    lower === EXECUTION_BASE_NATIVE_TOKEN
  );
}

export function normalizeTokenForExecution(address: string): string {
  if (!address) return EXECUTION_BASE_NATIVE_TOKEN;
  if (isNativeLike(address)) return EXECUTION_BASE_NATIVE_TOKEN;
  return address;
}

export function normalizeTokenForUi(address: string): string {
  if (!address) return UI_NATIVE_TOKEN;
  if (isNativeLike(address)) return UI_NATIVE_TOKEN;
  return address;
}

export function normalizeAddressKey(address: string): string {
  return normalizeTokenForUi(address).toLowerCase();
}
