// Handler específico para autenticação em miniapps do Telegram
export class TelegramAuthHandler {
  private static instance: TelegramAuthHandler;
  private authCallback: ((success: boolean, data?: any) => void) | null = null;

  static getInstance(): TelegramAuthHandler {
    if (!TelegramAuthHandler.instance) {
      TelegramAuthHandler.instance = new TelegramAuthHandler();
    }
    return TelegramAuthHandler.instance;
  }

  // Interceptar o fluxo de autenticação do Google OAuth
  interceptGoogleAuth() {
    if (typeof window === 'undefined') return;

    // Interceptar cliques em botões de autenticação do Google
    const originalOpen = window.open;
    window.open = (url?: string | URL, target?: string, features?: string) => {
      if (url && typeof url === 'string' && url.includes('accounts.google.com')) {
        console.log('🔍 [TELEGRAM AUTH] Interceptando Google OAuth:', url);
        
        // Abrir em popup controlado
        const popup = originalOpen.call(window, url, '_blank', 'width=500,height=600,scrollbars=yes,resizable=yes');
        
        if (popup) {
          // Monitorar o popup
          this.monitorPopup(popup);
        }
        
        return popup;
      }
      
      return originalOpen.call(window, url, target, features);
    };

    // Interceptar redirecionamentos
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      get: () => originalLocation,
      set: (value) => {
        if (typeof value === 'string' && value.includes('auth/callback')) {
          console.log('🔍 [TELEGRAM AUTH] Interceptando callback:', value);
          this.handleAuthCallback(value);
        } else {
          originalLocation.href = value;
        }
      }
    });
  }

  private monitorPopup(popup: Window) {
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        console.log('🔍 [TELEGRAM AUTH] Popup fechado');
        
        // Verificar se a autenticação foi bem-sucedida
        const authToken = localStorage.getItem('authToken');
        if (authToken) {
          this.authCallback?.(true, { token: authToken });
        } else {
          this.authCallback?.(false, { error: 'Autenticação cancelada' });
        }
      }
    }, 1000);

    // Timeout após 5 minutos
    setTimeout(() => {
      if (!popup.closed) {
        popup.close();
        clearInterval(checkClosed);
        this.authCallback?.(false, { error: 'Timeout na autenticação' });
      }
    }, 300000);
  }

  private handleAuthCallback(url: string) {
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      // Verificar se há parâmetros de sucesso
      const code = params.get('code');
      const error = params.get('error');
      
      if (code) {
        console.log('✅ [TELEGRAM AUTH] Código de autorização recebido');
        // Processar o código de autorização
        this.processAuthCode(code);
      } else if (error) {
        console.error('❌ [TELEGRAM AUTH] Erro na autenticação:', error);
        this.authCallback?.(false, { error });
      }
    } catch (err) {
      console.error('❌ [TELEGRAM AUTH] Erro ao processar callback:', err);
      this.authCallback?.(false, { error: 'Erro ao processar callback' });
    }
  }

  private async processAuthCode(code: string) {
    try {
      // Aqui você processaria o código de autorização
      // Por enquanto, vamos simular um sucesso
      console.log('🔄 [TELEGRAM AUTH] Processando código:', code);
      
      // Simular processamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar se já temos um token
      const authToken = localStorage.getItem('authToken');
      if (authToken) {
        this.authCallback?.(true, { token: authToken });
      } else {
        this.authCallback?.(false, { error: 'Token não encontrado' });
      }
    } catch (err) {
      console.error('❌ [TELEGRAM AUTH] Erro ao processar código:', err);
      this.authCallback?.(false, { error: 'Erro ao processar código de autorização' });
    }
  }

  // Registrar callback para notificar sobre o resultado da autenticação
  onAuthResult(callback: (success: boolean, data?: any) => void) {
    this.authCallback = callback;
  }

  // Limpar callback
  clearCallback() {
    this.authCallback = null;
  }
}

// Inicializar o handler quando o módulo for carregado
if (typeof window !== 'undefined') {
  const handler = TelegramAuthHandler.getInstance();
  handler.interceptGoogleAuth();
}
