import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Carregar .env da raiz do projeto
  const env = loadEnv(mode, '../../', '');
  
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
    },
  };
});

