export const CURRENCIES = ['ETH', 'USDT', 'BNB', 'USDC'] as const
export type Currency = (typeof CURRENCIES)[number]

export const TOKEN_CONFIG = {
  symbol: '$PANBLK',
  name: 'Panorama Block',
  roundName: 'Seed Round',

  seedPrice: 0.025,
  listingPrice: 0.10,
  upsidePercent: 300,

  hardCapUSD: 3_000_000,
  softCapUSD: 750_000,
  // TODO: Replace with real figure fetched from backend
  raisedUSD: 1_240_000,
  participants: 312,

  totalSupply: '1B',
  seedAllocPercent: '6%',
  tgeFDV: '$25M',

  minInvestmentUSD: 250,
  maxInvestmentUSD: 50_000,

  vestingCliffMonths: 6,
  vestingDurationMonths: 18,
  tgeUnlockPercent: 10,

  countdownDays: 11,

  // TODO: Replace with verified multisig wallet address before going live
  multisigAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,

  // Approximate rates for calculator (USD per 1 unit of currency)
  // TODO: Replace with real-time oracle prices in V2
  rates: { ETH: 3200, USDT: 1, BNB: 600, USDC: 1 } as Record<Currency, number>,
} as const

// Seed round closes May 9, 2026 23:59:59 UTC
export const SALE_ENDS_AT = new Date('2026-05-09T23:59:59Z').getTime()
