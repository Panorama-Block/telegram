import type { I18nStrings } from './en.js';

export const pt: I18nStrings = {
  // Onboarding
  welcome_title: '🌐 Bem-vindo ao Panorama Block!',
  welcome_body:
    'Seu copiloto DeFi com IA, direto no Telegram.\n\n' +
    'Eu posso te ajudar a:\n' +
    '• 🔄 Trocar tokens entre chains\n' +
    '• 📈 Fazer staking de ETH & AVAX\n' +
    '• 🔁 Automatizar estratégias DCA\n' +
    '• 💰 Emprestar & tomar emprestado\n' +
    '• 📊 Acompanhar seu portfólio\n\n' +
    'Vamos configurar sua smart wallet!',
  btn_english: '🇺🇸 English',
  btn_portuguese: '🇧🇷 Português',
  btn_create_wallet: '🔐 Criar Smart Wallet',
  btn_skip: '⏭️ Pular por Agora',

  // Wallet creation
  wallet_creating: '🔐 Criando sua Smart Account...',
  wallet_created: (address: string) =>
    `✅ Smart Account criada!\nEndereço: <code>${address}</code>\nRede: Base`,
  wallet_fund_prompt:
    '📱 Escaneie o QR code ou copie o endereço abaixo\npara depositar ETH ou tokens:\n\nRedes suportadas: Base, Ethereum, Arbitrum',
  btn_copy_address: '📋 Copiar Endereço',
  btn_i_deposited: '✅ Já Depositei',
  wallet_no_funds: '⚠️ Nenhum fundo detectado ainda. Envie ETH para o endereço acima e toque novamente.',
  wallet_funded: '🎉 Fundos detectados! Tudo pronto.',

  // Welcome back
  welcome_back: '👋 Bem-vindo de volta!',
  wallet_status: (address: string, balance: string) =>
    `💰 Smart Account: <code>${address}</code>\n💵 Saldo: ${balance}`,

  // Menu
  menu_title: '🏠 Panorama Block',
  btn_swap: '🔄 Swap',
  btn_stake: '📈 Stake',
  btn_lend: '💰 Lending',
  btn_dca: '🔁 DCA',
  btn_bridge: '🌉 Bridge',
  btn_portfolio: '📊 Portfólio',
  btn_settings: '⚙️ Config',
  btn_help: '❓ Ajuda',
  btn_chat_ai: '💬 Falar com IA',
  btn_deposit_more: '💰 Depositar Mais',
  btn_refresh: '🔄 Atualizar',
  btn_open_miniapp: '🚀 Abrir MiniApp',

  // Wallet command
  wallet_title: '🔐 Sua Smart Account',
  wallet_not_linked: '⚠️ Nenhuma smart account encontrada.\nUse /start para criar uma.',
  btn_unlink: '🔓 Desconectar',
  btn_view_portfolio: '📊 Ver Portfólio',

  // Settings
  settings_title: '⚙️ Configurações',
  settings_language: 'Idioma',
  settings_chain: 'Chain Padrão',
  btn_lang_en: '🇺🇸 English',
  btn_lang_pt: '🇧🇷 Português',

  // Help
  help_title: '❓ Ajuda',
  help_body:
    '<b>Comandos Disponíveis:</b>\n\n' +
    '/start - Configurar carteira\n' +
    '/menu - Menu principal\n' +
    '/wallet - Ver smart account\n' +
    '/swap - Trocar tokens\n' +
    '/stake - Fazer staking\n' +
    '/lend - Operações de lending\n' +
    '/dca - Estratégias DCA\n' +
    '/bridge - Bridge cross-chain\n' +
    '/portfolio - Ver posições\n' +
    '/settings - Preferências\n' +
    '/help - Esta mensagem\n\n' +
    'Ou simplesmente digite naturalmente — a IA vai entender!',

  // Chat
  chat_thinking: '🤔 Pensando...',
  chat_error: '😕 Desculpe, não consegui responder agora. Tente novamente.',
  chat_no_wallet: '⚠️ Conecte uma carteira primeiro com /start para executar operações DeFi.',

  // Intent confirmation (Phase 2)
  intent_expired: '⏰ Esta ação expirou. Descreva novamente o que você quer fazer.',
  intent_confirm_title: '⚡ <b>Confirmar Operação</b>',
  intent_confirm_body: 'Revise os detalhes acima. Toque em <b>Confirmar</b> para prosseguir.',
  intent_executing: '⏳ Executando sua transação...',
  intent_success: '✅ Transação enviada com sucesso!',
  intent_tx_hash: (hash: string) => `🔗 Tx: <code>${hash}</code>`,
  intent_failed: '❌ Transação falhou. Tente novamente ou ajuste os parâmetros.',
  intent_no_wallet: '⚠️ Você precisa de uma smart account com fundos primeiro.',
  btn_execute_in_chat: '⚡ Executar no Chat',
  btn_view_tx: '🔍 Ver Transação',

  // Generic
  btn_cancel: '❌ Cancelar',
  btn_confirm: '✅ Confirmar',
  btn_back: '⬅️ Voltar',
  error_generic: '❌ Algo deu errado. Tente novamente.',
};
