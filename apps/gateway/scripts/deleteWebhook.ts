import { parseEnv } from '../src/env.js';

// topo do arquivo
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

(function loadEnvFromRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const candidates = [
    resolve(__dirname, '../../.env'),   // saindo de scripts/ para raiz de apps/gateway
    resolve(__dirname, '../../../.env'),// saindo ainda mais (caso monorepo)
    resolve(process.cwd(), '.env'),     // fallback: diretório atual
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      config({ path: p });
      return;
    }
  }
  config(); // padrão
})();


async function main() {
  const env = parseEnv();
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/deleteWebhook`;
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  // eslint-disable-next-line no-console
  console.log(data);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


