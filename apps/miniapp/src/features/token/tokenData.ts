export interface Allocation {
  label: string
  pct: number
  color: string
  price: string
  vesting: string
}

export interface RoadmapItem {
  phase: string
  status: 'live' | 'next' | 'planned'
  title: string
  items: string[]
}

export const ALLOCATIONS: Allocation[] = [
  { label: 'Seed Round',      pct: 6,  color: '#22d3ee', price: '$0.025', vesting: '6mo cliff · 18mo linear' },
  { label: 'Strategic',       pct: 8,  color: '#06b6d4', price: '$0.045', vesting: '3mo cliff · 12mo linear' },
  { label: 'Public Sale',     pct: 4,  color: '#0891b2', price: '$0.080', vesting: '25% TGE · 9mo linear' },
  { label: 'Team & Advisors', pct: 18, color: '#164e63', price: '—',      vesting: '12mo cliff · 36mo linear' },
  { label: 'Ecosystem',       pct: 25, color: '#155e75', price: '—',      vesting: '4yr linear emission' },
  { label: 'Treasury',        pct: 20, color: '#0e7490', price: '—',      vesting: 'Governed by multisig' },
  { label: 'Research',        pct: 12, color: '#0369a1', price: '—',      vesting: '2yr linear' },
  { label: 'Liquidity',       pct: 7,  color: '#1d4ed8', price: '—',      vesting: 'Unlocked at TGE' },
]

export const ROADMAP: RoadmapItem[] = [
  {
    phase: 'Q2 2026',
    status: 'live',
    title: 'Seed & Foundation',
    items: ['Token sale (seed)', 'Core protocol v0.1', 'Agent framework alpha', 'UCLA partnership formalized'],
  },
  {
    phase: 'Q3 2026',
    status: 'next',
    title: 'Strategic & Testnet',
    items: ['Strategic round closes', 'Testnet launch', 'Agent marketplace beta', 'Audit (Halborn)'],
  },
  {
    phase: 'Q4 2026',
    status: 'planned',
    title: 'Public Sale & TGE',
    items: ['Public round', 'TGE & DEX listing', 'Mainnet v1.0', 'Staking goes live'],
  },
  {
    phase: 'Q1 2027',
    status: 'planned',
    title: 'Mainnet Expansion',
    items: ['Cross-chain agents', 'Governance launch', 'CEX listings', 'Agent SDK public'],
  },
]

export const CCY_DOT: Record<string, string> = {
  ETH:  'bg-cyan-400',
  USDT: 'bg-emerald-400',
  BNB:  'bg-yellow-400',
  USDC: 'bg-emerald-400',
}
