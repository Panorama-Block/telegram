// Configuração específica para autenticação em miniapps do Telegram

export const TELEGRAM_AUTH_CONFIG = {
  // URLs de callback específicas para o miniapp
  redirectUrls: {
    google: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback',
    telegram: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback'
  },
  
  // Configurações específicas para o ambiente do Telegram
  telegram: {
    // Usar popup em vez de redirect para evitar problemas no miniapp
    usePopup: true,
    // Timeout para popups (5 minutos)
    popupTimeout: 300000,
    // Configurações de popup
    popupFeatures: 'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,toolbar=no,menubar=no,location=no'
  },
  
  // Configurações do Google OAuth
  google: {
    // Escopo mínimo necessário
    scope: 'openid email profile',
    // Parâmetros adicionais para funcionar em miniapps
    additionalParams: {
      prompt: 'select_account',
      access_type: 'offline',
      response_type: 'code'
    }
  }
};

// Função para configurar o Google OAuth para miniapps
export function configureGoogleAuthForTelegram() {
  if (typeof window === 'undefined') return;

  // Interceptar requisições do Google OAuth
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    
    if (url.includes('accounts.google.com') && init?.method === 'POST') {
      console.log('🔍 [TELEGRAM AUTH] Interceptando requisição do Google OAuth');
      
      // Adicionar parâmetros específicos para miniapps
      if (init.body) {
        try {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
          const modifiedBody = {
            ...body,
            ...TELEGRAM_AUTH_CONFIG.google.additionalParams,
            redirect_uri: TELEGRAM_AUTH_CONFIG.redirectUrls.google
          };
          
          init.body = JSON.stringify(modifiedBody);
        } catch (err) {
          console.warn('⚠️ [TELEGRAM AUTH] Erro ao modificar body da requisição:', err);
        }
      }
    }
    
    return originalFetch(input, init);
  };
}

// Função para verificar se estamos em um miniapp do Telegram
export function isTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Verificar se estamos no contexto do Telegram
  return !!(
    (window as any).Telegram?.WebApp ||
    window.location.href.includes('t.me') ||
    window.location.href.includes('telegram.me') ||
    navigator.userAgent.includes('TelegramBot')
  );
}

// Função para configurar o ambiente de autenticação
export function setupTelegramAuthEnvironment() {
  if (typeof window === 'undefined') return;
  
  console.log('🔧 [TELEGRAM AUTH] Configurando ambiente de autenticação para miniapp');
  
  // Configurar Google OAuth
  configureGoogleAuthForTelegram();
  
  // Verificar se estamos em um miniapp
  const isMiniApp = isTelegramMiniApp();
  console.log('🔍 [TELEGRAM AUTH] É miniapp do Telegram:', isMiniApp);
  
  if (isMiniApp) {
    // Configurações específicas para miniapps
    console.log('⚙️ [TELEGRAM AUTH] Aplicando configurações específicas para miniapp');
    
    // Desabilitar alguns recursos que podem causar problemas
    if ((window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.ready();
      (window as any).Telegram.WebApp.expand();
    }
  }
}

// Inicializar automaticamente quando o módulo for carregado
if (typeof window !== 'undefined') {
  setupTelegramAuthEnvironment();
}
