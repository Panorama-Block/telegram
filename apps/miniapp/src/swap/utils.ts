import type { Address, ThirdwebClient } from 'thirdweb';
import { defineChain, getContract, readContract } from 'thirdweb';

export const NATIVE_SENTINELS = [
  'native',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000000000',
];

export function isNative(addr: string): boolean {
  if (!addr) return false;
  return NATIVE_SENTINELS.includes(addr.toLowerCase());
}

export function normalizeToApi(addr: string): string {
  // Prefer 0xeeee... for native when talking to API
  if (isNative(addr)) return '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  return addr;
}

export function formatAmountHuman(wei: bigint, decimals: number, maxFrac = 6): string {
  const neg = wei < 0n;
  const val = neg ? -wei : wei;
  const base = 10n ** BigInt(decimals);
  const int = val / base;
  const frac = val % base;
  if (frac === 0n) return `${neg ? '-' : ''}${int.toString()}`;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  const trimmed = fracStr.slice(0, Math.max(0, Math.min(maxFrac, fracStr.length)));
  return `${neg ? '-' : ''}${int.toString()}${trimmed.length ? '.' + trimmed : ''}`;
}

export function parseAmountToWei(amount: string, decimals: number): bigint {
  const [i, f = ''] = String(amount).trim().split('.');
  const frac = f.slice(0, decimals);
  const padded = frac.padEnd(decimals, '0');
  const s = `${i}${padded}`.replace(/^0+(?=\d)/, '');
  if (!/^\d+$/.test(s || '0')) throw new Error('Invalid amount');
  return BigInt(s || '0');
}

const decimalsCache = new Map<string, number>(); // key = `${chainId}:${address}`

type GetTokenDecimalsOptions = {
  client: ThirdwebClient;
  chainId: number;
  token: string;
};

export async function getTokenDecimals(opts: GetTokenDecimalsOptions): Promise<number> {
  if (isNative(opts.token)) return 18;
  const key = `${opts.chainId}:${opts.token.toLowerCase()}`;
  if (decimalsCache.has(key)) return decimalsCache.get(key)!;
  const chain = defineChain(opts.chainId);
  const contract = getContract({ client: opts.client, address: opts.token as Address, chain });
  const decimals = await readContract({
    contract,
    method: 'function decimals() view returns (uint8)',
    params: [],
  }) as unknown as number;
  const value = Number(decimals);
  decimalsCache.set(key, value);
  return value;
}

export function explorerTxUrl(chainId: number, hash: string): string | null {
  const map: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    10: 'https://optimistic.etherscan.io/tx/',
    56: 'https://bscscan.com/tx/',
    137: 'https://polygonscan.com/tx/',
    42161: 'https://arbiscan.io/tx/',
    43114: 'https://snowtrace.io/tx/',
    8453: 'https://basescan.org/tx/',
  };
  return map[chainId] ? `${map[chainId]}${hash}` : null;
}
