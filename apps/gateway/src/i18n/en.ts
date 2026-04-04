export const en = {
  // Onboarding
  welcome_title: '🌐 Welcome to Panorama Block!',
  welcome_body:
    'Your AI-powered DeFi copilot, right in Telegram.\n\n' +
    'I can help you:\n' +
    '• 🔄 Swap tokens across chains\n' +
    '• 📈 Stake ETH & AVAX for yield\n' +
    '• 🔁 Automate DCA strategies\n' +
    '• 💰 Lend & borrow assets\n' +
    '• 📊 Track your portfolio\n\n' +
    "Let's set up your smart wallet!",
  btn_english: '🇺🇸 English',
  btn_portuguese: '🇧🇷 Português',
  btn_create_wallet: '🔐 Create Smart Wallet',
  btn_skip: '⏭️ Skip for Now',

  // Wallet creation
  wallet_creating: '🔐 Creating your Smart Account...',
  wallet_created: (address: string) =>
    `✅ Smart Account created!\nAddress: <code>${address}</code>\nNetwork: Base`,
  wallet_fund_prompt:
    '📱 Scan this QR code or copy the address below\nto deposit ETH or tokens:\n\nSupported networks: Base, Ethereum, Arbitrum',
  btn_copy_address: '📋 Copy Address',
  btn_i_deposited: "✅ I've Deposited",
  wallet_no_funds: '⚠️ No funds detected yet. Send ETH to the address above and tap again.',
  wallet_funded: '🎉 Funds detected! You\'re all set.',

  // Welcome back
  welcome_back: '👋 Welcome back!',
  wallet_status: (address: string, balance: string) =>
    `💰 Smart Account: <code>${address}</code>\n💵 Balance: ${balance}`,

  // Menu
  menu_title: '🏠 Panorama Block',
  btn_swap: '🔄 Swap',
  btn_stake: '📈 Stake',
  btn_lend: '💰 Lend',
  btn_dca: '🔁 DCA',
  btn_bridge: '🌉 Bridge',
  btn_portfolio: '📊 Portfolio',
  btn_settings: '⚙️ Settings',
  btn_help: '❓ Help',
  btn_chat_ai: '💬 Chat with AI',
  btn_deposit_more: '💰 Deposit More',
  btn_refresh: '🔄 Refresh',
  btn_open_miniapp: '🚀 Open MiniApp',

  // Wallet command
  wallet_title: '🔐 Your Smart Account',
  wallet_not_linked: '⚠️ No smart account found.\nUse /start to create one.',
  btn_unlink: '🔓 Unlink Wallet',
  btn_view_portfolio: '📊 View Portfolio',

  // Settings
  settings_title: '⚙️ Settings',
  settings_language: 'Language',
  settings_chain: 'Default Chain',
  btn_lang_en: '🇺🇸 English',
  btn_lang_pt: '🇧🇷 Português',

  // Help
  help_title: '❓ Help',
  help_body:
    '<b>Available Commands:</b>\n\n' +
    '/start - Set up your wallet\n' +
    '/menu - Open main menu\n' +
    '/wallet - View smart account\n' +
    '/swap - Swap tokens\n' +
    '/stake - Stake ETH/AVAX\n' +
    '/lend - Lending operations\n' +
    '/dca - DCA strategies\n' +
    '/bridge - Bridge cross-chain\n' +
    '/portfolio - View positions\n' +
    '/settings - Preferences\n' +
    '/help - This message\n\n' +
    'Or just type naturally — the AI will understand!',

  // Chat
  chat_thinking: '🤔 Thinking...',
  chat_error: '😕 Sorry, I could not get a response right now. Please try again.',
  chat_no_wallet: '⚠️ Connect a wallet first with /start to execute DeFi operations.',

  // Intent confirmation (Phase 2)
  intent_expired: '⏰ This action has expired. Please describe what you want to do again.',
  intent_confirm_title: '⚡ <b>Confirm Operation</b>',
  intent_confirm_body: 'Review the details above. Tap <b>Confirm</b> to proceed.',
  intent_executing: '⏳ Executing your transaction...',
  intent_success: '✅ Transaction submitted successfully!',
  intent_tx_hash: (hash: string) => `🔗 Tx: <code>${hash}</code>`,
  intent_failed: '❌ Transaction failed. Please try again or adjust parameters.',
  intent_no_wallet: '⚠️ You need a funded smart account first.',
  btn_execute_in_chat: '⚡ Execute in Chat',
  btn_view_tx: '🔍 View Transaction',

  // Generic
  btn_cancel: '❌ Cancel',
  btn_confirm: '✅ Confirm',
  btn_back: '⬅️ Back',
  error_generic: '❌ Something went wrong. Please try again.',
} as const;

/** Widened type so PT translations can use different string values. */
export type I18nStrings = {
  -readonly [K in keyof typeof en]: (typeof en)[K] extends (...args: infer A) => infer R
    ? (...args: A) => string
    : string;
};
