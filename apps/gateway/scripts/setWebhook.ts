import { parseEnv } from '../src/env.js';

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


