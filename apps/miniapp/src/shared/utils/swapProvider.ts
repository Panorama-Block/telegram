export type DexSource = 'aerodrome' | 'uniswap' | 'thirdweb' | 'unknown';

export function resolveProvider(providerStr?: string | null): DexSource {
  if (!providerStr) return 'unknown';
  const p = providerStr.toLowerCase();
  if (p.includes('aerodrome') || p.includes('aero')) return 'aerodrome';
  if (p.includes('uniswap'))                          return 'uniswap';
  if (p.includes('thirdweb'))                         return 'thirdweb';
  return 'unknown';
}

export function buildProviderNote(provider: DexSource, network: string): string {
  switch (provider) {
    case 'aerodrome':
      return `Route executed via **Aerodrome** on ${network} (Execution Layer).`;
    case 'uniswap':
      return `**Note:** Primary route unavailable. This quote is being processed via **Uniswap (Fallback)** on ${network} due to current liquidity conditions.`;
    case 'thirdweb':
      return `Cross-chain transfer via **ThirdWeb Bridge**.`;
    default:
      return `Liquidity provider could not be identified.`;
  }
}

export interface SwapQuoteSummary {
  provider?: string | null;
  network: string;
  receiveAmount?: string;
  receiveAmountUsd?: string;
  exchangeRate?: string;
  priceImpact?: string;
  estimatedDurationMs?: number;
}

export function buildSwapConfirmationMessage(quote: SwapQuoteSummary): string {
  const provider = resolveProvider(quote.provider);
  const providerNote = buildProviderNote(provider, quote.network);
  const receive = quote.receiveAmountUsd
    ? `~$${quote.receiveAmountUsd}`
    : (quote.receiveAmount ?? 'N/A');

  const lines: string[] = [providerNote, ''];

  lines.push('**Transaction details:**');
  lines.push(`• You receive: **${receive}**`);

  if (quote.exchangeRate) {
    lines.push(`• Exchange rate: ${quote.exchangeRate}`);
  }
  if (quote.priceImpact) {
    lines.push(`• Price impact: ${quote.priceImpact}%`);
  }
  if (quote.estimatedDurationMs) {
    const seconds = Math.round(quote.estimatedDurationMs / 1000);
    lines.push(`• Estimated time: ~${seconds}s`);
  }

  lines.push('');

  if (provider === 'uniswap') {
    lines.push('Would you like to proceed via Uniswap anyway?');
  } else {
    lines.push('Would you like to proceed?');
  }

  return lines.join('\n');
}
