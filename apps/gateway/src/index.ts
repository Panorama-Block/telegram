import { start } from './server';

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


