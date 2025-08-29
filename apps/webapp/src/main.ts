declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        MainButton?: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        showPopup?: (params: {
          title: string;
          message: string;
          buttons: Array<{ type: string; text: string }>;
        }) => void;
      };
    };
  }
}

interface UserData {
  telegram_user_id: number;
  username?: string;
  language_code?: string;
  zico_user_id: string;
  valid: boolean;
}

class ZicoWebApp {
  private userData: UserData | null = null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_GATEWAY_BASE as string || '';
    this.init();
  }

  private init() {
    // Configurar WebApp do Telegram
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready?.();
      window.Telegram.WebApp.expand?.();
    }
  }

  async verifyUser(): Promise<UserData> {
    const initData = window.Telegram?.WebApp?.initData || 
                    new URLSearchParams(location.search).get('initData') || '';
    
    if (!initData) {
      throw new Error('initData não encontrado');
    }

    const res = await fetch(`${this.baseUrl}/auth/telegram/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    if (!res.ok) {
      throw new Error(`Erro na verificação: ${res.status}`);
    }

    this.userData = await res.json() as UserData;
    return this.userData;
  }

  render() {
    const app = document.getElementById('app');
    if (!app) return;

    if (!this.userData) {
      app.innerHTML = this.renderLoading();
      return;
    }

    app.innerHTML = this.renderMain();
    this.setupEventListeners();
  }

  private renderLoading(): string {
    return `
      <div class="container">
        <div class="loading">
          <div class="spinner"></div>
          <p>Validando sessão...</p>
        </div>
      </div>
    `;
  }

  private renderMain(): string {
    const { username, zico_user_id, telegram_user_id } = this.userData!;
    
    return `
      <div class="container">
        <header class="header">
          <h1>🤖 Zico Agent</h1>
          <p class="subtitle">Seu assistente cripto no Telegram</p>
        </header>

        <div class="user-card">
          <div class="user-info">
            <h3>👋 Olá, ${username || 'Usuário'}!</h3>
            <div class="user-details">
              <div class="detail">
                <span class="label">Telegram ID:</span>
                <span class="value">${telegram_user_id}</span>
              </div>
              <div class="detail">
                <span class="label">Zico ID:</span>
                <span class="value">${zico_user_id}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="features">
          <h3>🚀 Funcionalidades</h3>
          <div class="feature-grid">
            <button class="feature-btn" data-action="chat">
              💬 Chat com IA
            </button>
            <button class="feature-btn" data-action="portfolio">
              📊 Portfolio
            </button>
            <button class="feature-btn" data-action="settings">
              ⚙️ Configurações
            </button>
            <button class="feature-btn" data-action="help">
              ❓ Ajuda
            </button>
          </div>
        </div>

        <div class="status">
          <div class="status-item">
            <span class="status-dot success"></span>
            <span>Conectado ao Zico</span>
          </div>
        </div>
      </div>

      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: var(--tg-theme-bg-color, #ffffff);
          color: var(--tg-theme-text-color, #000000);
          line-height: 1.4;
        }

        .container {
          padding: 20px;
          max-width: 600px;
          margin: 0 auto;
        }

        .loading {
          text-align: center;
          padding: 60px 20px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid var(--tg-theme-button-color, #007acc);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
        }

        .header h1 {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .subtitle {
          color: var(--tg-theme-hint-color, #999);
          font-size: 16px;
        }

        .user-card {
          background: var(--tg-theme-secondary-bg-color, #f8f9fa);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 30px;
        }

        .user-info h3 {
          margin-bottom: 15px;
          font-size: 18px;
        }

        .detail {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .label {
          color: var(--tg-theme-hint-color, #999);
          font-size: 14px;
        }

        .value {
          font-weight: 500;
          font-size: 14px;
        }

        .features h3 {
          margin-bottom: 15px;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .feature-btn {
          background: var(--tg-theme-button-color, #007acc);
          color: var(--tg-theme-button-text-color, #ffffff);
          border: none;
          border-radius: 8px;
          padding: 16px 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .feature-btn:hover {
          opacity: 0.8;
        }

        .status {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid var(--tg-theme-hint-color, #eee);
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.success {
          background: #10b981;
        }
      </style>
    `;
  }

  private setupEventListeners() {
    // Event listeners para botões de funcionalidades
    document.querySelectorAll('.feature-btn').forEach((btn: Element) => {
      btn.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;
        this.handleFeatureClick(action || '');
      });
    });
  }

  private handleFeatureClick(action: string) {
    const webapp = window.Telegram?.WebApp;
    
    switch (action) {
      case 'chat':
        webapp?.showPopup?.({
          title: '💬 Chat com IA',
          message: 'Use o chat do Telegram para conversar diretamente com o Zico Agent!',
          buttons: [{ type: 'ok', text: 'Entendi' }]
        });
        break;
      
      case 'portfolio':
        webapp?.showPopup?.({
          title: '📊 Portfolio',
          message: 'Funcionalidade em desenvolvimento. Em breve você poderá ver seu portfolio aqui!',
          buttons: [{ type: 'ok', text: 'OK' }]
        });
        break;
      
      case 'settings':
        webapp?.showPopup?.({
          title: '⚙️ Configurações',
          message: 'Use o comando /settings no chat para acessar as configurações.',
          buttons: [{ type: 'ok', text: 'OK' }]
        });
        break;
      
      case 'help':
        webapp?.showPopup?.({
          title: '❓ Ajuda',
          message: 'Use o comando /help no chat para ver todos os comandos disponíveis.',
          buttons: [{ type: 'ok', text: 'OK' }]
        });
        break;
    }
  }
}

// Inicializar aplicação
async function main() {
  const app = new ZicoWebApp();
  
  try {
    app.render(); // Mostrar loading
    await app.verifyUser();
    app.render(); // Mostrar interface principal
  } catch (err) {
    const appDiv = document.getElementById('app');
    if (appDiv) {
      appDiv.innerHTML = `
        <div class="container">
          <div class="error">
            <h3>❌ Erro na verificação</h3>
            <p>Não foi possível verificar sua sessão.</p>
            <p><small>${err instanceof Error ? err.message : 'Erro desconhecido'}</small></p>
          </div>
        </div>
        <style>
          .error {
            text-align: center;
            padding: 60px 20px;
            color: #ef4444;
          }
          .error h3 { margin-bottom: 15px; }
          .error p { margin-bottom: 8px; }
        </style>
      `;
    }
  }
}

main();


