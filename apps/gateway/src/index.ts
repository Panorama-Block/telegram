import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { existsSync } from 'node:fs';

import { start } from './server.js';

// Carregar .env da raiz do projeto (buscar automaticamente)
function loadEnvFromRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Tentar diferentes caminhos até encontrar .env
  const possiblePaths = [
    resolve(__dirname, '../../.env'),        // da pasta dist
    resolve(__dirname, '../../../.env'),     // caso compile diferente
    resolve(process.cwd(), '.env'),          // do diretório atual
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      config({ path });
      return;
    }
  }
  
  // Se não encontrou, usar .env padrão (pode estar nas env vars do sistema)
  config();
}

loadEnvFromRoot();

export function getGatewayHello(): string {
  return 'Zico Telegram Gateway — scaffold ok';
}

if (process.env['NODE_ENV'] !== 'test') {
  start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar servidor', err);
    process.exit(1);
  });
}


