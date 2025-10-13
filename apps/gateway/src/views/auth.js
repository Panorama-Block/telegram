// Auth Page JavaScript
class AuthManager {
    constructor() {
        this.client = null;
        this.wallet = null;
        this.account = null;
        this.isConnecting = false;
        this.init();
    }

    init() {
        console.log('🔐 [AUTH] Initializing auth manager...');
        this.setupClient();
        this.setupEventListeners();
    }

    setupClient() {
        try {
            const clientId = window.THIRDWEB_CLIENT_ID;

            if (!clientId) {
                throw new Error('THIRDWEB_CLIENT_ID não configurado');
            }

            this.client = thirdweb.createThirdwebClient({
                clientId: clientId
            });
            console.log('✅ [AUTH] Thirdweb client initialized');
        } catch (error) {
            console.error('❌ [AUTH] Failed to initialize client:', error);
            this.showError('Erro ao inicializar cliente Thirdweb');
        }
    }

    setupEventListeners() {
        // MetaMask button
        const metamaskBtn = document.getElementById('metamaskBtn');
        if (metamaskBtn) {
            metamaskBtn.addEventListener('click', () => this.connectWallet('metamask'));
        }

        // Google button
        const googleBtn = document.getElementById('googleBtn');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.connectWallet('google'));
        }

        // Telegram button
        const telegramBtn = document.getElementById('telegramBtn');
        if (telegramBtn) {
            telegramBtn.addEventListener('click', () => this.connectWallet('telegram'));
        }

        // Email button
        const emailBtn = document.getElementById('emailBtn');
        if (emailBtn) {
            emailBtn.addEventListener('click', () => this.connectWallet('email'));
        }
    }

    async connectWallet(walletType) {
        if (this.isConnecting) return;

        this.isConnecting = true;
        this.showLoading(`Conectando via ${walletType}...`);

        try {
            console.log(`🔗 [AUTH] Starting ${walletType} connection...`);

            // Check if we're in Telegram WebView
            const isTelegram = !!window.Telegram?.WebApp;

            // For OAuth providers in Telegram, open external window
            if (isTelegram && (walletType === 'google' || walletType === 'telegram')) {
                this.openOAuthInBrowser(walletType);
                return;
            }

            // Create wallet instance based on type
            if (walletType === 'metamask') {
                this.wallet = thirdweb.createWallet('io.metamask');
            } else if (walletType === 'google' || walletType === 'telegram' || walletType === 'email') {
                // Use in-app wallet for OAuth providers
                this.wallet = thirdweb.inAppWallet();
            } else {
                throw new Error('Tipo de carteira não suportado');
            }

            // Connect wallet
            let account;
            if (walletType === 'metamask') {
                account = await this.wallet.connect({
                    client: this.client
                });
            } else if (walletType === 'google') {
                // Use redirect mode for OAuth to avoid CORS issues
                const redirectUrl = `${window.location.origin}/auth/callback`;
                account = await this.wallet.connect({
                    client: this.client,
                    strategy: 'google',
                    redirectUrl: redirectUrl
                });
            } else if (walletType === 'telegram') {
                const redirectUrl = `${window.location.origin}/auth/callback`;
                account = await this.wallet.connect({
                    client: this.client,
                    strategy: 'telegram',
                    redirectUrl: redirectUrl
                });
            } else if (walletType === 'email') {
                account = await this.wallet.connect({
                    client: this.client,
                    strategy: 'email',
                    email: prompt('Digite seu email:')
                });
            }

            if (!account) {
                throw new Error('Falha ao conectar carteira');
            }

            this.account = account;
            console.log('✅ [AUTH] Wallet connected:', account.address);
            this.showSuccess('Carteira conectada com sucesso!');

            // Proceed with authentication
            await this.authenticate(account);

        } catch (error) {
            console.error('❌ [AUTH] Connection failed:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.isConnecting = false;
        }
    }

    openOAuthInBrowser(walletType) {
        try {
            const strategy = walletType === 'google' ? 'google' : 'telegram';
            const url = `${window.location.origin}/auth/external?strategy=${strategy}`;

            console.log(`🌐 [AUTH] Opening OAuth in external browser: ${url}`);

            // Use Telegram WebApp API to open external link
            if (window.Telegram?.WebApp?.openLink) {
                window.Telegram.WebApp.openLink(url, { try_instant_view: false });
                this.showInfo('Por favor, complete a autenticação na janela que se abriu.');
            } else {
                // Fallback for non-Telegram environments
                window.open(url, '_blank');
                this.showInfo('Por favor, complete a autenticação na nova aba.');
            }
        } catch (error) {
            console.error('❌ [AUTH] Failed to open OAuth window:', error);
            this.showError('Falha ao abrir janela de autenticação');
        } finally {
            this.isConnecting = false;
        }
    }

    async authenticate(account) {
        try {
            this.showLoading('Autenticando com backend...');
            console.log('🔐 [AUTH] Starting authentication for:', account.address);

            const authApiBase = window.location.origin.replace(/:\d+/, ':3001');

            // 1. Get login payload from backend
            const loginResponse = await fetch(`${authApiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: account.address })
            });

            if (!loginResponse.ok) {
                throw new Error('Falha ao obter payload de login');
            }

            const { payload } = await loginResponse.json();
            console.log('📝 [AUTH] Login payload received from backend');

            // 2. Sign payload using the connected wallet
            let signature;
            try {
                // Try using signLoginPayload if available
                if (thirdweb.signLoginPayload) {
                    const signResult = await thirdweb.signLoginPayload({
                        account: account,
                        payload: payload
                    });
                    signature = typeof signResult === 'string' ? signResult : signResult.signature;
                } else {
                    // Fallback to direct message signing
                    const messageToSign = JSON.stringify(payload);
                    signature = await this.wallet.signMessage({ message: messageToSign });
                }
            } catch (error) {
                console.error('❌ [AUTH] Signing failed:', error);
                throw new Error('Falha ao assinar payload');
            }

            console.log('✍️ [AUTH] Payload signed');

            // 3. Verify signature with backend
            const verifyResponse = await fetch(`${authApiBase}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload, signature })
            });

            if (!verifyResponse.ok) {
                throw new Error('Falha na verificação de assinatura');
            }

            const { token } = await verifyResponse.json();
            console.log('✅ [AUTH] Authentication successful');

            // 4. Send to gateway backend
            await this.sendAuthToBackend({
                address: account.address,
                sessionKeyAddress: account.address, // Use same address for simplicity
                loginPayload: payload,
                signature: signature,
                token: token
            });

        } catch (error) {
            console.error('❌ [AUTH] Authentication failed:', error);
            this.showError(this.getErrorMessage(error));
        }
    }

    async sendAuthToBackend(authData) {
        try {
            this.showLoading('Finalizando autenticação...');
            console.log('📤 [AUTH] Sending auth data to backend...', authData);

            const response = await fetch('/auth/telegram/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...authData,
                    telegram_user_id: this.getTelegramUserId()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha na autenticação');
            }

            const result = await response.json();
            console.log('✅ [AUTH] Authentication successful:', result);

            this.showSuccess('Autenticação concluída! Você pode fechar esta janela.');
            
            // Notify parent window if in iframe
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'AUTH_SUCCESS', data: result }, '*');
            }

            // Auto close after success
            setTimeout(() => {
                window.close();
            }, 2000);

        } catch (error) {
            console.error('❌ [AUTH] Backend auth failed:', error);
            this.showError(this.getErrorMessage(error));
        }
    }

    getTelegramUserId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('telegram_user_id');
    }

    getErrorMessage(error) {
        if (error.message.includes('User rejected')) {
            return 'Conexão cancelada pelo usuário';
        }
        if (error.message.includes('No Ethereum provider')) {
            return 'MetaMask não encontrada. Instale a extensão MetaMask';
        }
        if (error.message.includes('Already processing')) {
            return 'Conexão já em andamento';
        }
        return error.message || 'Erro desconhecido';
    }

    showLoading(message) {
        this.updateStatus(message, 'loading');
    }

    showSuccess(message) {
        this.updateStatus(message, 'success');
    }

    showError(message) {
        this.updateStatus(message, 'error');
    }

    showInfo(message) {
        this.updateStatus(message, 'info');
    }

    updateStatus(message, type) {
        const statusEl = document.getElementById('status');
        if (!statusEl) return;

        statusEl.className = `status status-${type}`;
        
        const icon = type === 'loading' ? '<div class="loading"></div>' : 
                    type === 'success' ? '✅' : 
                    type === 'error' ? '❌' : 'ℹ️';
        
        statusEl.innerHTML = `
            <div class="status-icon">${icon}</div>
            <div class="status-text">${message}</div>
        `;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('🔐 [AUTH] Page hidden');
    } else {
        console.log('🔐 [AUTH] Page visible');
    }
});

// Handle beforeunload
window.addEventListener('beforeunload', () => {
    console.log('🔐 [AUTH] Page unloading');
});
