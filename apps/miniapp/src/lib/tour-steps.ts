export interface TourStep {
  /** CSS selector for the target element to spotlight */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description text */
  description: string;
  /** Tooltip placement relative to the target */
  placement: 'top' | 'bottom' | 'left' | 'right';
  /** Optional: auto-open a modal or trigger an action when this step becomes active */
  action?: () => void;
}

/** Dispatch a custom event to open or close the sidebar (listened by SeniorAppShell) */
function requestSidebar(open: boolean) {
  window.dispatchEvent(new CustomEvent('panorama:tour:sidebar', { detail: { open } }));
}

/** Dispatch a custom event to open/close a widget modal (listened by SeniorAppShell + Chat page) */
function requestWidget(widget: 'swap' | 'lending' | 'staking' | 'dca' | 'yield', open: boolean) {
  window.dispatchEvent(
    new CustomEvent('panorama:tour:widget', { detail: { widget, open } }),
  );
}

/** Close every widget at once (used before moving on to the next section) */
function closeAllWidgets() {
  (['swap', 'lending', 'staking', 'dca', 'yield'] as const).forEach((w) =>
    requestWidget(w, false),
  );
}

export const ONBOARDING_TOUR: TourStep[] = [
  // ── Welcome & Chat ──
  {
    target: '[data-tour="welcome"]',
    title: 'Welcome to Panorama Block!',
    description:
      'Your AI-powered DeFi assistant inside Telegram. Let me show you around so you can get the most out of the app.',
    placement: 'bottom',
    action: () => {
      closeAllWidgets();
      requestSidebar(false);
    },
  },
  {
    target: '[data-tour="prompt-bar"]',
    title: 'Chat with Zico AI',
    description:
      'This is your main command center. Ask Zico to swap tokens, check balances, find yield opportunities, or explain DeFi concepts — all in plain language.',
    placement: 'top',
  },
  {
    target: '[data-tour="suggestions"]',
    title: 'Quick Suggestions',
    description:
      'Not sure what to ask? Tap any of these pre-built prompts to get started instantly with common operations like swaps, bridges, and lending.',
    placement: 'top',
  },

  // ── Portfolio (sidebar only, no widget) ──
  {
    target: '[data-tour="sidebar-portfolio"]',
    title: 'Portfolio',
    description:
      'View all your assets across every chain in one place. Track balances, monitor performance, and manage your smart wallets.',
    placement: 'right',
    action: () => {
      closeAllWidgets();
      requestSidebar(true);
    },
  },

  // ── Swap ──
  {
    target: '[data-tour="sidebar-swap"]',
    title: 'Swap',
    description:
      'Swap any token on any chain. Let me show you what\'s inside.',
    placement: 'right',
    action: () => {
      closeAllWidgets();
      requestSidebar(true);
    },
  },
  {
    target: '[data-tour="widget-swap"]',
    title: 'Swap Widget',
    description:
      'Pick tokens, set amounts, and swap. Cross-chain bridges (Ethereum ↔ Base, Avalanche, etc.) are handled automatically — Zico picks the best route.',
    placement: 'left',
    action: () => {
      requestSidebar(false);
      requestWidget('swap', true);
    },
  },

  // ── Lending ──
  {
    target: '[data-tour="sidebar-lending"]',
    title: 'Lending',
    description:
      'Supply to earn or borrow against collateral. Let\'s open the Lending widget.',
    placement: 'right',
    action: () => {
      closeAllWidgets();
      requestSidebar(true);
    },
  },
  {
    target: '[data-tour="widget-lending"]',
    title: 'Lending Widget',
    description:
      'Powered by Benqi on Avalanche. View supply/borrow APYs, track your positions, and manage collateral — all from one screen.',
    placement: 'left',
    action: () => {
      requestSidebar(false);
      requestWidget('lending', true);
    },
  },

  // ── Liquid Staking ──
  {
    target: '[data-tour="sidebar-staking"]',
    title: 'Liquid Staking',
    description:
      'Stake ETH or AVAX and keep liquidity. Let\'s open the Staking widget.',
    placement: 'right',
    action: () => {
      closeAllWidgets();
      requestSidebar(true);
    },
  },
  {
    target: '[data-tour="widget-staking"]',
    title: 'Staking Widget',
    description:
      'Powered by Lido. Stake ETH to receive stETH — earn staking rewards while still being able to use your tokens in DeFi.',
    placement: 'left',
    action: () => {
      requestSidebar(false);
      requestWidget('staking', true);
    },
  },

  // ── DCA ──
  {
    target: '[data-tour="sidebar-dca"]',
    title: 'DCA (Dollar-Cost Averaging)',
    description:
      'Automate recurring purchases. Let\'s open the DCA widget.',
    placement: 'right',
    action: () => {
      closeAllWidgets();
      requestSidebar(true);
    },
  },
  {
    target: '[data-tour="widget-dca"]',
    title: 'DCA Widget',
    description:
      'Schedule recurring buys (daily, weekly, monthly) to accumulate tokens over time and smooth out volatility — set it and forget it.',
    placement: 'left',
    action: () => {
      requestSidebar(false);
      requestWidget('dca', true);
    },
  },

  // ── Yield ──
  {
    target: '[data-tour="sidebar-yield"]',
    title: 'Yield Farming',
    description:
      'Discover the best APRs across chains. Let\'s open the Yield widget.',
    placement: 'right',
    action: () => {
      closeAllWidgets();
      requestSidebar(true);
    },
  },
  {
    target: '[data-tour="widget-yield"]',
    title: 'Yield Widget',
    description:
      'Compare yield pools across multiple chains and protocols. Filter by APR, TVL, or chain, and deposit directly from this screen.',
    placement: 'left',
    action: () => {
      requestSidebar(false);
      requestWidget('yield', true);
    },
  },

  // ── Bottom navigation (close everything first) ──
  {
    target: '[data-tour="nav-chat"]',
    title: 'Bottom Navigation',
    description:
      'On mobile, use these tabs to quickly jump between Chat, Lending, Staking, and Yield without opening the sidebar.',
    placement: 'top',
    action: () => {
      closeAllWidgets();
      requestSidebar(false);
    },
  },

  // ── Multi-chain & finish ──
  {
    target: '[data-tour="multichain"]',
    title: 'Multi-Chain Support',
    description:
      'Panorama works across Ethereum, Base, Arbitrum, Avalanche, Polygon, Optimism, and TON. Swap and bridge seamlessly between chains.',
    placement: 'top',
  },
  {
    target: '[data-tour="prompt-bar"]',
    title: 'You\'re all set!',
    description:
      'Start by typing a message or tapping a suggestion. Zico will guide you through every step of your DeFi operations. Happy trading!',
    placement: 'top',
  },
];

export const TOUR_STORAGE_KEY = 'panorama-tour-completed';
