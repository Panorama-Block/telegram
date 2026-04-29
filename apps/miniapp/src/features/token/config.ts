export const TOKEN_CONFIG = {
  symbol: '$PANBLK',
  name: 'Panorama Block',
  roundName: 'Pre-seed Round',

  seedPrice: 0.025,
  listingPrice: 0.08,
  upsidePercent: 220,

  hardCapUSD: 500_000,

  totalSupply: '1B',
  seedAllocPercent: '6%',
  tgeFDV: '$80M',

  minInvestmentUSD: 500,
  maxInvestmentUSD: 500_000,

  vestingCliffMonths: 6,
  vestingDurationMonths: 24,
} as const

// Pre-seed round closes May 6, 2026 23:59:59 UTC
export const SALE_ENDS_AT = new Date('2026-05-06T23:59:59Z').getTime()
