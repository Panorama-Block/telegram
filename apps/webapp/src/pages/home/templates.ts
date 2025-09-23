import type { TelegramUser } from '../../shared/types/telegram';

export function renderLoading(): string {
  return `
    <div class="container">
      <div class="loading">
        <div class="spinner"></div>
        <p>Validando sessão...</p>
      </div>
    </div>
  `;
}

export function renderMain(user: TelegramUser): string {
  const { username, zico_user_id, telegram_user_id } = user;
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
          <button class="feature-btn" data-action="chat">💬 Chat com IA</button>
          <button class="feature-btn" data-action="portfolio">📊 Portfolio</button>
          <button class="feature-btn" data-action="settings">⚙️ Configurações</button>
          <button class="feature-btn" data-action="help">❓ Ajuda</button>
        </div>
      </div>

      <div class="status">
        <div class="status-item">
          <span class="status-dot success"></span>
          <span>Conectado ao Zico</span>
        </div>
      </div>
    </div>
  `;
}

export function renderError(message: string): string {
  return `
    <div class="container">
      <div class="error">
        <h3>❌ Erro na verificação</h3>
        <p>Não foi possível verificar sua sessão.</p>
        <p><small>${message}</small></p>
      </div>
    </div>
  `;
}

export function renderStyles(): string {
  return `
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

    .error {
      text-align: center;
      padding: 60px 20px;
      color: #ef4444;
    }

    .error h3 { margin-bottom: 15px; }
    .error p { margin-bottom: 8px; }
  `;
}
