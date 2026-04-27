export const CURRENCIES = ['ETH', 'USDT', 'BNB', 'USDC'] as const
export type Currency = (typeof CURRENCIES)[number]

export const TOKEN_CONFIG = {
  symbol: '$PANBLK',
  name: 'Panorama Block',
  roundName: 'Seed Round',

  seedPrice: 0.025,
  listingPrice: 0.08,
  upsidePercent: 220,

  hardCapUSD: 500_000,
  // TODO: Replace with real figure fetched from backend
  raisedUSD: 170_000,

  totalSupply: '1B',
  seedAllocPercent: '6%',
  tgeFDV: '$80M',

  minInvestmentUSD: 1_000,
  maxInvestmentUSD: 200_000,

  vestingCliffMonths: 6,
  vestingDurationMonths: 24,
  tgeUnlockPercent: 10,

  // 30-day window — computed at runtime in CountdownTimer via useRef
  countdownDays: 30,

  // TODO: Replace with verified multisig wallet address before going live
  multisigAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,

  // Approximate rates for calculator (USD per 1 unit of currency)
  // TODO: Replace with real-time oracle prices in V2
  rates: { ETH: 3200, USDT: 1, BNB: 600, USDC: 1 } as Record<Currency, number>,
} as const
