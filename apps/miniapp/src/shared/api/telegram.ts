import type { TelegramUser } from '../types/telegram';

function resolveGatewayBase(): string {
  const fromEnv = (import.meta as any)?.env?.VITE_GATEWAY_BASE as string | undefined;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/+$/, '');
  }
  return window.location.origin.replace(/\/+$/, '');
}

export async function verifyTelegramSession(initData: string): Promise<TelegramUser> {
  if (!initData) {
    throw new Error('initData não encontrado');
  }

  const base = resolveGatewayBase();
  const url = `${base}/auth/telegram/init-data`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!res.ok) {
    throw new Error(`Erro na verificação: ${res.status}`);
  }

  return res.json() as Promise<TelegramUser>;
}
