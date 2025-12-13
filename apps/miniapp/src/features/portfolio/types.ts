export interface PortfolioAsset {
  symbol: string;
  name: string;
  network: string;
  protocol: string; // 'Wallet' or other
  address: string;
  decimals: number;
  balance: string; // Human readable
  balanceRaw: string; // Wei
  price: string; // Formatted price $X.XX
  value: string; // Formatted value $X.XX
  valueRaw: number; // Numeric value for sorting
  apy?: string;
  isPositive?: boolean; // For 24h change indication
  icon?: string;
  actions: string[];
}

export interface PortfolioStats {
  netWorth: string;
  netWorthRaw: number;
  pnl24h: string;
  pnl24hPercent: string;
  isPositive: boolean;
  allocation: {
    label: string;
    value: number; // percentage 0-100
    color: string;
  }[];
}
