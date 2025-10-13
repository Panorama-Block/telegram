// Auth Page JavaScript
class AuthManager {
    constructor() {
        this.client = null;
        this.wallet = null;
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
            this.client = thirdweb.createThirdwebClient({
                clientId: 'YOUR_CLIENT_ID' // Replace with actual client ID
            });
            console.log('✅ [AUTH] Thirdweb client initialized');
        } catch (error) {
            console.error('❌ [AUTH] Failed to initialize client:', error);
            this.showError('Erro ao inicializar cliente Thirdweb');
        }
    }

    setupEventListeners() {
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectWallet());
        }
    }

    async connectWallet() {
        if (this.isConnecting) return;
        
        this.isConnecting = true;
        this.showLoading('Conectando carteira...');

        try {
            console.log('🔗 [AUTH] Starting wallet connection...');
            
            // Create wallet instance
            this.wallet = thirdweb.createWallet('io.metamask');
            
            // Connect wallet
            const account = await this.wallet.connect({
                client: this.client
            });

            if (!account) {
                throw new Error('Falha ao conectar carteira');
            }

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

    async authenticate(account) {
        try {
            this.showLoading('Autenticando...');
            console.log('🔐 [AUTH] Starting authentication for:', account.address);

            // Create smart wallet
            const smartWallet = thirdweb.smartWallet({
                factoryAddress: "0x9406Cc6185a346906296840746125a0E44976454",
                gasless: true,
                client: this.client,
                chain: thirdweb.sepolia
            });

            // Connect smart wallet
            await smartWallet.connect({
                personalWallet: this.wallet
            });

            console.log('✅ [AUTH] Smart wallet connected');

            // Create session key
            const sessionKeyWallet = await smartWallet.createSessionKey();
            const sessionKeyAccount = await sessionKeyWallet.getAccount();

            console.log('✅ [AUTH] Session key created:', sessionKeyAccount.address);

            // Generate login payload
            const loginPayload = await smartWallet.generateLoginPayload({
                payload: {
                    address: account.address,
                    chainId: 11155111, // Sepolia
                    nonce: Date.now().toString()
                }
            });

            console.log('📝 [AUTH] Login payload generated');

            // Sign login payload
            const signature = await sessionKeyWallet.signMessage({
                message: loginPayload.payload
            });

            console.log('✍️ [AUTH] Payload signed');

            // Send authentication to backend
            await this.sendAuthToBackend({
                address: account.address,
                sessionKeyAddress: sessionKeyAccount.address,
                loginPayload: loginPayload.payload,
                signature: signature
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
