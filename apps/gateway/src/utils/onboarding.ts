import type { InlineKeyboardMarkup } from 'grammy/types';
import type { Env } from '../env.js';

export function buildStartMenu(_env: Env): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup['inline_keyboard'] = [];

  // Row 1: Link account via chat-only
  rows.push([
    { text: '🔗 Link Account', callback_data: 'link' },
  ]);

  // Row 2: Start chat
  rows.push([
    { text: '💬 Start Chat', callback_data: 'start_chat' },
  ]);

  // Row 3: Swap flow
  rows.push([
    { text: '🔄 Do a Swap', callback_data: 'swap:start' },
  ]);

  // Row 4: Wallet tracking shortcut
  rows.push([
    { text: '👛 Track a Wallet', callback_data: 'feature:track' },
  ]);

  // Row 5: Help
  rows.push([
    { text: 'ℹ️ Learn More', callback_data: 'onboard:learn' },
    { text: '❓ Help', callback_data: 'help' },
  ]);

  return { inline_keyboard: rows };
}

export function buildPreLoginMenu(env: Env): InlineKeyboardMarkup {
  const site = env.WEBSITE_URL ?? 'https://panoramablock.com/';
  const rows: InlineKeyboardMarkup['inline_keyboard'] = [];
  rows.push([{ text: '▶️ Start Now', callback_data: 'start_now' }]);
  rows.push([{ text: '📘 Learn More', callback_data: 'onboard:learn' }]);
  rows.push([{ text: '🌐 Go Website', url: site }]);
  return { inline_keyboard: rows };
}

export function buildFeaturesMenu(): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup['inline_keyboard'] = [];
  rows.push([
    { text: '💬 Start a Chat', callback_data: 'feature:chat' },
    { text: '🔄 Liquid Swap', callback_data: 'feature:swap' },
  ]);
  rows.push([
    { text: '📈 Start Staking (soon)', callback_data: 'feature:staking' },
    { text: '🏦 Start Lending (soon)', callback_data: 'feature:lending' },
  ]);
  rows.push([
    { text: '🧮 Yield Aggregator (soon)', callback_data: 'feature:yield' },
  ]);
  rows.push([
    { text: '👛 Track a Wallet', callback_data: 'feature:track' },
  ]);
  rows.push([
    { text: 'ℹ️ Introduction', callback_data: 'feature:intro' },
    { text: '❓ Help', callback_data: 'help' },
  ]);
  rows.push([
    { text: '🚪 Logout', callback_data: 'feature:logout' },
    { text: '🏠 Back to Menu', callback_data: 'feature:menu' },
  ]);
  return { inline_keyboard: rows };
}

export function getHelpText(): string {
  return `
🤖 Zico Agent — Commands

/start — Show onboarding menu
/help — List commands
/settings — Open settings
/status — Bot status
/swap — Start swap quote (MVP)
/link — Link your account
/unlink — Unlink your account

/track <address> — Start tracking a wallet
/untrack [address] — Stop tracking one/all
/tracked — List tracked wallets

You can also just chat — type a message!
`.trim();
}

export function getLinkSuccessText(userId: string): string {
  return `✅ Your account was linked successfully!\nUser: \`${userId}\``;
}

export function getTutorialMessages(): string[] {
  return [
    '💬 Chat with me: just ask a question.\nEx.: What’s the AVAX price now?',
    '🔄 Swap tokens: send /swap and follow the steps.',
    '👛 Track wallets: use /track <address> and /tracked to list.',
  ];
}

export function getLongWelcomeText(): string {
  return [
    '👋 Welcome to Zico Agent!',
    'Your crypto copilot on Telegram — ask questions, get market insights, and perform token swaps with guided flows.',
    '',
    'What you can do:',
    '• Chat: Ask about prices, gas, protocols, and more. Zico will fetch and summarize information.',
    '• Swap: Get a quote and confirm with one tap. Execution flow via chat is coming soon.',
    '• Tracking: Follow wallet balances and activity (preview).',
    '',
    'To unlock all features, link your account directly via chat using /link or the button below.',
  ].join('\n');
}

export type OnboardPage = { id: number; title: string; text: string };

export function getOnboardingPages(): OnboardPage[] {
  const pages: OnboardPage[] = [
    {
      id: 1,
      title: 'Our Vision (Panorama Block)',
      text: [
        'We enable AI agents to automate DeFi strategies (the “money legos”).',
        'Agents operate across protocols/chains prioritizing risk mitigation while seeking alpha.',
        'Users can deploy pre-built agents or create custom ones; developers can monetize bots.',
      ].join('\n'),
    },
    {
      id: 2,
      title: 'Who It’s For',
      text: [
        '• Developers: build and monetize AI DeFi agents with on-chain data access.',
        '• Enterprises: analytics + AI tools for risk and portfolio optimization.',
        '• Retail: automate strategies, execute swaps, track yields, and monitor markets.',
      ].join('\n'),
    },
    {
      id: 3,
      title: 'The Problem (Summary)',
      text: [
        '• Data fragmentation across chains; hard to interpret + correlate.',
        '• AI integration is complex and costly; limited infra standards.',
        '• DeFi strategies are fragmented; multi-protocol execution is hard.',
      ].join('\n'),
    },
    {
      id: 4,
      title: 'Our Solutions (Highlights)',
      text: [
        '• Proprietary scanners + cross-chain aggregation and normalization.',
        '• Unified data layer with standardized interfaces.',
        '• AI-driven analytics for actionable insights.',
        '• Reputation scoring and resource optimization marketplace.',
      ].join('\n'),
    },
    {
      id: 5,
      title: 'ZICO Agent (At a Glance)',
      text: [
        '• Conversational AI for DeFi: chat, analyze, automate.',
        '• Actions: swaps, tracking, DCA, staking, lending (progressively).',
        '• Works with multi-source data (CoinGecko, news, on-chain).',
      ].join('\n'),
    },
    {
      id: 6,
      title: 'Security & Privacy',
      text: [
        'We store minimal data (links, sessions, state) and prioritize safety.',
        'Always verify details before on-chain execution.',
      ].join('\n'),
    },
    {
      id: 7,
      title: 'Roadmap',
      text: [
        '• Swap execution via chat + relayer.',
        '• Portfolio insights and risk checks.',
        '• More strategies (staking, lending, yield).',
        '• Localization (pt/en), better prompts and memory.',
      ].join('\n'),
    },
  ];
  return pages;
}

export function getOnboardingPageById(id: number): { page: OnboardPage; total: number } | null {
  const pages = getOnboardingPages();
  const page = pages.find((p) => p.id === id);
  if (!page) return null;
  return { page, total: pages.length };
}

export function buildOnboardingKeyboard(_env: Env, id: number): InlineKeyboardMarkup {
  const data = getOnboardingPageById(id);
  const total = data?.total ?? 1;
  const isFirst = id <= 1;
  const isLast = id >= total;
  const rows: InlineKeyboardMarkup['inline_keyboard'] = [];
  // Prev / Next navigation
  rows.push([
    { text: isFirst ? '⏹' : '⬅️ Prev', callback_data: isFirst ? 'noop' : `onboard:page:${id - 1}` },
    { text: `${id}/${total}`, callback_data: 'noop' },
    { text: isLast ? '⏹' : '➡️ Next', callback_data: isLast ? 'noop' : `onboard:page:${id + 1}` },
  ]);
  // Primary actions (chat-only)
  rows.push([{ text: '🔗 Link Account', callback_data: 'link' }]);
  rows.push([{ text: '💬 Start Chat', callback_data: 'start_chat' }]);
  rows.push([{ text: '🔄 Do a Swap', callback_data: 'swap:start' }]);
  // Back to menu
  rows.push([{ text: '🏠 Back to Menu', callback_data: 'onboard:menu' }]);
  return { inline_keyboard: rows };
}

export function getFeatureIntroText(key: string): string {
  switch (key) {
    case 'intro':
      return [
        'Welcome! You’re linked and ready to explore features:',
        '• Start a Chat: ask questions, analyze markets, get insights.',
        '• Liquid Swap: get quotes and (soon) execute via chat.',
        '• Track a Wallet: follow balances and activity (preview).',
        '• Staking / Lending / Yield: coming soon with guided flows.',
      ].join('\n');
    case 'chat':
      return [
        'Start a Chat: just type your question.',
        'Examples: “What is AVAX price now?”, “Summarize today’s XRP news.”',
        'Tips: be specific for better answers; you can ask follow-ups!',
      ].join('\n');
    case 'swap':
      return [
        'Liquid Swap: we’ll guide you to choose a chain, tokens, and amount.',
        'You’ll see a quote summary and can confirm (execution soon).',
        'Try the button below to begin.',
      ].join('\n');
    case 'staking':
      return 'Staking is coming soon. You’ll be able to earn yield with guided flows and safety checks.';
    case 'lending':
      return 'Lending is coming soon. Borrow or supply with smart risk hints and position health tracking.';
    case 'yield':
      return 'Yield Aggregator is coming soon. We’ll help compose strategies across protocols.';
    case 'track':
      return [
        'Track a Wallet: send an EVM address to watch balances and activity (preview).',
        'You can remove tracking anytime with /untrack.',
      ].join('\n');
    default:
      return 'Feature coming soon.';
  }
}
