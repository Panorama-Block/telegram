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

  // Wizard shared
  wizard_cancelled: '❌ Operação cancelada.',
  wizard_timeout: '⏰ Sessão expirou. Comece novamente quando quiser.',
  wizard_no_wallet: '⚠️ Você precisa de uma smart account primeiro. Use /start para criar.',
  wizard_select_token: '🪙 Selecione um token ou digite o símbolo:',
  wizard_enter_amount: '💰 Digite a quantidade:',
  wizard_invalid_amount: '⚠️ Digite um número válido (ex: 0.5 ou 100).',
  wizard_confirm_details: '📋 <b>Confirme sua operação:</b>',
  wizard_processing: '⏳ Processando sua transação...',
  wizard_success: '✅ Transação enviada!',
  wizard_failed: '❌ Transação falhou. Tente novamente.',

  // Swap wizard
  swap_title: '🔄 <b>Swap de Token</b>',
  swap_select_from: '🔄 Qual token você quer <b>vender</b>?',
  swap_select_to: '🔄 Qual token você quer <b>comprar</b>?',
  swap_enter_amount: '💰 Quanto de <b>${token}</b> você quer trocar?',
  swap_summary: (from: string, to: string, amount: string) =>
    `🔄 <b>Resumo do Swap</b>\n\n• Vender: <b>${amount} ${from}</b>\n• Comprar: <b>${to}</b>\n• Rede: Base\n• Slippage: 0.5%`,

  // Stake wizard
  stake_title: '📈 <b>Staking</b>',
  stake_select_token: '📈 Qual token você quer fazer staking?',
  stake_enter_amount: '💰 Quanto você quer fazer staking?',
  stake_summary: (token: string, amount: string, protocol: string) =>
    `📈 <b>Resumo do Staking</b>\n\n• Token: <b>${amount} ${token}</b>\n• Protocolo: <b>${protocol}</b>\n• Rede: Base`,

  // Lend wizard
  lend_title: '💰 <b>Lending</b>',
  lend_select_action: '💰 O que você gostaria de fazer?',
  lend_select_token: '💰 Qual token?',
  lend_enter_amount: '💰 Quanto você quer fornecer?',
  lend_summary: (action: string, token: string, amount: string) =>
    `💰 <b>Resumo do Lending</b>\n\n• Ação: <b>${action}</b>\n• Token: <b>${amount} ${token}</b>\n• Rede: Base`,
  btn_lend_supply: '📥 Fornecer',
  btn_lend_borrow: '📤 Tomar Emprestado',
  btn_lend_repay: '💳 Pagar',
  btn_lend_withdraw: '📤 Retirar',

  // DCA wizard
  dca_title: '🔁 <b>Estratégia DCA</b>',
  dca_select_from: '🔁 Qual token você quer <b>gastar</b>?',
  dca_select_to: '🔁 Qual token você quer <b>acumular</b>?',
  dca_enter_amount: '💰 Quanto por execução?',
  dca_select_frequency: '📅 Com que frequência?',
  dca_select_duration: '📆 Por quanto tempo?',
  dca_summary: (from: string, to: string, amount: string, freq: string, duration: string) =>
    `🔁 <b>Resumo do DCA</b>\n\n• Gastar: <b>${amount} ${from}</b>\n• Comprar: <b>${to}</b>\n• Frequência: <b>${freq}</b>\n• Duração: <b>${duration}</b>`,
  btn_freq_daily: '📅 Diário',
  btn_freq_weekly: '📅 Semanal',
  btn_freq_biweekly: '📅 Quinzenal',
  btn_freq_monthly: '📅 Mensal',
  btn_dur_1month: '1 Mês',
  btn_dur_3months: '3 Meses',
  btn_dur_6months: '6 Meses',
  btn_dur_12months: '12 Meses',

  // Bridge wizard
  bridge_title: '🌉 <b>Bridge</b>',
  bridge_select_from_chain: '🌉 De qual rede?',
  bridge_select_to_chain: '🌉 Para qual rede?',
  bridge_select_token: '🪙 Qual token para bridge?',
  bridge_enter_amount: '💰 Quanto você quer transferir?',
  bridge_summary: (token: string, amount: string, fromChain: string, toChain: string) =>
    `🌉 <b>Resumo do Bridge</b>\n\n• Token: <b>${amount} ${token}</b>\n• De: <b>${fromChain}</b>\n• Para: <b>${toChain}</b>`,

  // Price alerts (Phase 4)
  alert_title: 'Alertas de Preço',
  alert_none: 'Nenhum alerta definido. Crie um abaixo ou digite:\n<code>alert ETH above 4000</code>',
  alert_btn_create: '➕ Novo Alerta',
  alert_btn_clear_all: '🗑️ Limpar Todos',
  alert_select_token: 'Selecione um Token',
  alert_instructions: 'Digite um comando como:\n<code>alert ETH above 4000</code>\n<code>alert AVAX below 30</code>',
  alert_invalid_format: '⚠️ Formato: <code>alert TOKEN above/below PREÇO</code>\nExemplo: <code>alert ETH above 4000</code>',
  alert_invalid_price: '⚠️ Digite um número de preço válido.',
  alert_created: 'Alerta criado!',
  alert_cleared: '🗑️ Todos os alertas limpos.',

  // Rate limiting
  rate_limited: '⏱️ Muitas mensagens. Aguarde um momento.',

  // Generic
  btn_cancel: '❌ Cancelar',
  btn_confirm: '✅ Confirmar',
  btn_back: '⬅️ Voltar',
  error_generic: '❌ Algo deu errado. Tente novamente.',
};
