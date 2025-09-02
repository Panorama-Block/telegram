import { parseEnv } from '../env.js';

export interface AuthRegisterTelegramRequest {
  telegramUserId: number;
  profile: {
    username?: string | null;
    language_code?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
}

export interface AuthExchangeTelegramRequest {
  telegramUserId: number;
}

export interface AuthResponse {
  jwt: string;
  userId: string;
}

export class AuthClient {
  private readonly baseUrl: string | undefined;
  private readonly timeoutMs: number;

  constructor() {
    const env = parseEnv();
    this.baseUrl = env.AUTH_API_BASE;
    this.timeoutMs = 10000;
  }

  private ensureConfigured() {
    if (!this.baseUrl) throw new Error('AUTH_API_BASE não configurado');
  }

  async registerTelegram(input: AuthRegisterTelegramRequest): Promise<AuthResponse> {
    this.ensureConfigured();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    const res = await fetch(`${this.baseUrl}/auth/register_telegram`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`register_telegram falhou: ${res.status} ${text}`);
    }
    return (await res.json()) as AuthResponse;
  }

  async exchangeTelegram(input: AuthExchangeTelegramRequest): Promise<AuthResponse> {
    this.ensureConfigured();
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    const res = await fetch(`${this.baseUrl}/auth/telegram/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`exchange falhou: ${res.status} ${text}`);
    }
    return (await res.json()) as AuthResponse;
  }
}

export function decodeJwtExp(jwt: string): number | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const body = parts[1];
    if (!body) return null;
    const base64 = body.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

