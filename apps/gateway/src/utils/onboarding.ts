import type { InlineKeyboardMarkup } from 'grammy/types';
import type { Env } from '../env.js';

export function buildStartMenu(env: Env): InlineKeyboardMarkup {
  const webAppUrl = env.PUBLIC_WEBAPP_URL;
  const rows: InlineKeyboardMarkup['inline_keyboard'] = [];

  // Row 1: Link account via Mini App (if available)
  if (webAppUrl) {
    rows.push([
      { text: '🔗 Link Account', web_app: { url: webAppUrl } },
    ]);
  } else {
    rows.push([
      { text: '🔗 Link Account', callback_data: 'link' },
    ]);
  }

  // Row 2: Start chat
  rows.push([
    { text: '💬 Start Chat', callback_data: 'start_chat' },
  ]);

  // Row 3: Swap flow
  rows.push([
    { text: '🔄 Do a Swap', callback_data: 'swap:start' },
  ]);

  // Row 4: Portfolio (placeholder)
  rows.push([
    { text: '📊 My Portfolio', callback_data: 'portfolio' },
  ]);

  // Row 5: Help
  rows.push([
    { text: 'ℹ️ Learn More', callback_data: 'onboard:learn' },
    { text: '❓ Help', callback_data: 'help' },
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
    '📊 Portfolio: soon you’ll see your connected positions here.',
  ];
}

export function getLongWelcomeText(): string {
  return [
    '👋 Welcome to Zico Agent!',
    'Your crypto copilot on Telegram — ask questions, get market insights, and perform token swaps with guided flows.',
    '',
    'What you can do:',
    '• Chat: Ask about prices, gas, protocols, and more. Zico will fetch and summarize information.',
    '• Swap: Get a quote and confirm with one tap. We will soon support execution via Mini App and relayers.',
    '• Portfolio: A consolidated view of your connected wallets (coming soon).',
    '',
    'To unlock all features, Link your account using the Mini App.',
  ].join('\n');
}

export type OnboardPage = { id: number; title: string; text: string };

export function getOnboardingPages(): OnboardPage[] {
  const pages: OnboardPage[] = [
    {
      id: 1,
      title: 'What is Zico Agent',
      text: [
        'Zico Agent is a chat-first crypto assistant in Telegram.',
        'It connects to an Agents API for intelligence and to on-chain services for actions.',
        '',
        'Core pillars:',
        '• Conversational UX: Ask questions in plain English.',
        '• Execution: Quote and (soon) execute swaps directly from chat.',
        '• Context: Persistent conversations per chat, with user linking for personalization.',
      ].join('\n'),
    },
    {
      id: 2,
      title: 'How It Works',
      text: [
        'Architecture overview:',
        '• Telegram Bot: Receives messages and renders inline keyboards.',
        '• Mini App: Handles secure account linking and advanced interactions.',
        '• Gateway API: Validates Telegram initData and proxies chat to the Agents API.',
        '• Agents API: Generates responses and suggests actions (like “Quote Swap”).',
      ].join('\n'),
    },
    {
      id: 3,
      title: 'Linking & Identity',
      text: [
        'Link your Telegram to a Zico user to enable personalized chat and actions.',
        'Steps:',
        '1) Tap “Link Account” (opens the Mini App).',
        '2) We verify Telegram initData signature server-side.',
        '3) Your session (JWT) is stored for authenticated calls.',
      ].join('\n'),
    },
    {
      id: 4,
      title: 'Security & Privacy',
      text: [
        'We validate Telegram WebApp initData with HMAC (per Telegram’s spec).',
        'Sensitive keys stay on the server — never in chat.',
        'We store minimal data needed for functionality (links, sessions, and chat state).',
        'Always verify transaction details when executing on-chain actions.',
      ].join('\n'),
    },
    {
      id: 5,
      title: 'Roadmap & Support',
      text: [
        'Coming soon:',
        '• Swap execution (Mini App + relayer).',
        '• Portfolio insights and risk checks.',
        '• Better prompts, memory, and localization (pt/en).',
        '',
        'Need help? Tap Help for commands or contact support.',
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

export function buildOnboardingKeyboard(env: Env, id: number): InlineKeyboardMarkup {
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
  // Primary actions
  if (env.PUBLIC_WEBAPP_URL) {
    rows.push([{ text: '🔗 Link Account', web_app: { url: env.PUBLIC_WEBAPP_URL } }]);
  } else {
    rows.push([{ text: '🔗 Link Account', callback_data: 'link' }]);
  }
  rows.push([{ text: '💬 Start Chat', callback_data: 'start_chat' }]);
  rows.push([{ text: '🔄 Do a Swap', callback_data: 'swap:start' }]);
  // Back to menu
  rows.push([{ text: '🏠 Back to Menu', callback_data: 'onboard:menu' }]);
  return { inline_keyboard: rows };
}
