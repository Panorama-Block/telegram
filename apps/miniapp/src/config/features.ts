/**
 * Feature flags configuration
 *
 * Controls which features are enabled/disabled in the application.
 * Set a feature to `false` to show "Coming Soon" overlay and block navigation.
 */

export const FEATURE_FLAGS = {
  /** Lending service - Benqi on Avalanche */
  LENDING_ENABLED: false,

  /** Liquid Staking service - Lido on Ethereum */
  STAKING_ENABLED: false,

  /** Token Swap service */
  SWAP_ENABLED: true,

  /** DCA (Dollar Cost Averaging) service */
  DCA_ENABLED: true,

  /** AI Chat assistant */
  CHAT_ENABLED: true,

  /** Analytics dashboard */
  ANALYTICS_ENABLED: false,

  /** Settings page */
  SETTINGS_ENABLED: false,
} as const;

export type FeatureKey = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: FeatureKey): boolean {
  return FEATURE_FLAGS[feature];
}

/**
 * Feature metadata for Coming Soon display
 */
export const FEATURE_METADATA: Record<string, {
  name: string;
  description: string;
  expectedLaunch?: string;
}> = {
  lending: {
    name: 'Lending Service',
    description: 'Supply, borrow, and earn interest on your crypto assets using Benqi Protocol on Avalanche.',
    expectedLaunch: 'Q1 2026',
  },
  staking: {
    name: 'Liquid Staking',
    description: 'Stake your ETH and receive stETH tokens while earning staking rewards with Lido Protocol.',
    expectedLaunch: 'Q1 2026',
  },
  analytics: {
    name: 'Analytics Dashboard',
    description: 'Track your portfolio performance, view detailed charts, and analyze your DeFi positions.',
    expectedLaunch: 'Q2 2026',
  },
  settings: {
    name: 'Settings',
    description: 'Customize your experience with preferences, notifications, and account settings.',
    expectedLaunch: 'Q2 2026',
  },
};
