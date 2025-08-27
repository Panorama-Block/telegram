import { parseEnv } from '../src/env';

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


