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

  // Wizard shared
  wizard_cancelled: '❌ Operation cancelled.',
  wizard_timeout: '⏰ Session timed out. Start again when ready.',
  wizard_no_wallet: '⚠️ You need a smart account first. Use /start to create one.',
  wizard_select_token: '🪙 Select a token or type a token symbol:',
  wizard_enter_amount: '💰 Enter the amount:',
  wizard_invalid_amount: '⚠️ Please enter a valid number (e.g. 0.5 or 100).',
  wizard_confirm_details: '📋 <b>Confirm your operation:</b>',
  wizard_processing: '⏳ Processing your transaction...',
  wizard_success: '✅ Transaction submitted!',
  wizard_failed: '❌ Transaction failed. Please try again.',

  // Swap wizard
  swap_title: '🔄 <b>Token Swap</b>',
  swap_select_from: '🔄 Which token do you want to <b>sell</b>?',
  swap_select_to: '🔄 Which token do you want to <b>buy</b>?',
  swap_enter_amount: '💰 How much <b>${token}</b> do you want to swap?',
  swap_summary: (from: string, to: string, amount: string) =>
    `🔄 <b>Swap Summary</b>\n\n• Sell: <b>${amount} ${from}</b>\n• Buy: <b>${to}</b>\n• Network: Base\n• Slippage: 0.5%`,

  // Stake wizard
  stake_title: '📈 <b>Stake</b>',
  stake_select_token: '📈 Which token do you want to stake?',
  stake_enter_amount: '💰 How much do you want to stake?',
  stake_summary: (token: string, amount: string, protocol: string) =>
    `📈 <b>Stake Summary</b>\n\n• Token: <b>${amount} ${token}</b>\n• Protocol: <b>${protocol}</b>\n• Network: Base`,

  // Lend wizard
  lend_title: '💰 <b>Lending</b>',
  lend_select_action: '💰 What would you like to do?',
  lend_select_token: '💰 Which token?',
  lend_enter_amount: '💰 How much do you want to supply?',
  lend_summary: (action: string, token: string, amount: string) =>
    `💰 <b>Lending Summary</b>\n\n• Action: <b>${action}</b>\n• Token: <b>${amount} ${token}</b>\n• Network: Base`,
  btn_lend_supply: '📥 Supply',
  btn_lend_borrow: '📤 Borrow',
  btn_lend_repay: '💳 Repay',
  btn_lend_withdraw: '📤 Withdraw',

  // DCA wizard
  dca_title: '🔁 <b>DCA Strategy</b>',
  dca_select_from: '🔁 Which token do you want to <b>spend</b>?',
  dca_select_to: '🔁 Which token do you want to <b>accumulate</b>?',
  dca_enter_amount: '💰 How much per execution?',
  dca_select_frequency: '📅 How often?',
  dca_select_duration: '📆 For how long?',
  dca_summary: (from: string, to: string, amount: string, freq: string, duration: string) =>
    `🔁 <b>DCA Summary</b>\n\n• Spend: <b>${amount} ${from}</b>\n• Buy: <b>${to}</b>\n• Frequency: <b>${freq}</b>\n• Duration: <b>${duration}</b>`,
  btn_freq_daily: '📅 Daily',
  btn_freq_weekly: '📅 Weekly',
  btn_freq_biweekly: '📅 Bi-weekly',
  btn_freq_monthly: '📅 Monthly',
  btn_dur_1month: '1 Month',
  btn_dur_3months: '3 Months',
  btn_dur_6months: '6 Months',
  btn_dur_12months: '12 Months',

  // Bridge wizard
  bridge_title: '🌉 <b>Bridge</b>',
  bridge_select_from_chain: '🌉 From which chain?',
  bridge_select_to_chain: '🌉 To which chain?',
  bridge_select_token: '🪙 Which token to bridge?',
  bridge_enter_amount: '💰 How much do you want to bridge?',
  bridge_summary: (token: string, amount: string, fromChain: string, toChain: string) =>
    `🌉 <b>Bridge Summary</b>\n\n• Token: <b>${amount} ${token}</b>\n• From: <b>${fromChain}</b>\n• To: <b>${toChain}</b>`,

  // Price alerts (Phase 4)
  alert_title: 'Price Alerts',
  alert_none: 'No alerts set. Create one below or type:\n<code>alert ETH above 4000</code>',
  alert_btn_create: '➕ New Alert',
  alert_btn_clear_all: '🗑️ Clear All',
  alert_select_token: 'Select a Token',
  alert_instructions: 'Type a command like:\n<code>alert ETH above 4000</code>\n<code>alert AVAX below 30</code>',
  alert_invalid_format: '⚠️ Format: <code>alert TOKEN above/below PRICE</code>\nExample: <code>alert ETH above 4000</code>',
  alert_invalid_price: '⚠️ Please enter a valid price number.',
  alert_created: 'Alert created!',
  alert_cleared: '🗑️ All alerts cleared.',

  // Rate limiting
  rate_limited: '⏱️ Too many messages. Please wait a moment.',

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
