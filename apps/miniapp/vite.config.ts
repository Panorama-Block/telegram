import { defineConfig, loadEnv } from 'vite';
// Optional: enable Node polyfills for browser when installed
// import nodePolyfills from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
  // Carregar .env da raiz do projeto, mas excluir as variáveis que queremos sobrescrever
  const env = loadEnv(mode, '../../', '');
  
  // Remover as variáveis que queremos sobrescrever
  delete env.VITE_GATEWAY_BASE;
  delete env.VITE_AUTH_API_BASE;
  delete env.VITE_SWAP_API_BASE;
  
  return {
    base: '/miniapp/',        // Alinhado ao novo prefixo do servidor

    build: { 
      outDir: 'dist' 
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    define: {
      // Passar env vars para o cliente
      'import.meta.env.VITE_GATEWAY_BASE': JSON.stringify(
        env.PUBLIC_GATEWAY_URL 
      ),
      'import.meta.env.VITE_SWAP_API_BASE': JSON.stringify(
        env.SWAP_API_BASE || ''
      ),
      global: 'window',
      'process.env': {},
      'import.meta.env.VITE_THIRDWEB_CLIENT_ID': JSON.stringify(env.THIRDWEB_CLIENT_ID || ''),
      'import.meta.env.VITE_EVM_CHAIN_ID': JSON.stringify(env.DEFAULT_CHAIN_ID || '8453'),
      'import.meta.env.VITE_AI_API_URL': JSON.stringify(env.AI_API_URL),
      'import.meta.env.VITE_AGENTS_API_BASE': JSON.stringify(env.AGENTS_API_BASE || ''),
      'window.__ENV__': JSON.stringify({
        AGENTS_API_BASE: env.AGENTS_API_BASE || '',
        AGENTS_RESPONSE_MESSAGE_PATH: env.AGENTS_RESPONSE_MESSAGE_PATH || '',
        AGENTS_DEBUG_SHAPE: env.AGENTS_DEBUG_SHAPE || false,
      }),
    },
    optimizeDeps: { include: ['buffer'] },
    // plugins: [nodePolyfills()],
  };
});
