export const TOKEN_CONFIG = {
  symbol: '$PANB',
  name: 'Panorama Block',
  roundName: 'Pre-seed Round',

  seedPrice: 0.04,
  listingPrice: 0.08,
  upsidePercent: 100,

  hardCapUSD: 2_000_000,

  totalSupply: '1B',
  seedAllocPercent: '6%',
  tgeFDV: '$80M',

  minInvestmentUSD: 500,
  maxInvestmentUSD: 2_000_000,

  vestingCliffMonths: 6,
  vestingDurationMonths: 24,
} as const

// Pre-seed round closes May 6, 2026 23:59:59 UTC
export const SALE_ENDS_AT = new Date('2026-09-20T23:59:59Z').getTime()
