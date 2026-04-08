// Load .env BEFORE any other import (must be first line)
import './loadEnv.js';

import { start } from './server.js';

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


