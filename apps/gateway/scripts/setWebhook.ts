import { parseEnv } from '../src/env.js';

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
  const baseUrl = process.env['PUBLIC_GATEWAY_URL'];
  if (!baseUrl) throw new Error('Defina PUBLIC_GATEWAY_URL apontando para seu gateway HTTPS público');

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;
  const body = new URLSearchParams({
    url: `${baseUrl}/telegram/webhook`,
    allowed_updates: JSON.stringify(['message', 'callback_query', 'chat_member']),
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
  });

  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json();
  // eslint-disable-next-line no-console
  console.log(data);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


