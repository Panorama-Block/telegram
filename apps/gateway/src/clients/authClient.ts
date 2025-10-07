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

export interface AuthLoginRequest {
  address: string;
}

export interface AuthLoginResponse {
  payload: any;
}

export interface AuthVerifyRequest {
  payload: any;
  signature: string;
}

export interface AuthVerifyResponse {
  token: string;
  address: string;
  sessionId?: string;
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
    throw new Error('Use a página web para autenticação: /auth');
  }

  async exchangeTelegram(input: AuthExchangeTelegramRequest): Promise<AuthResponse> {
    throw new Error('Use a página web para autenticação: /auth');
  }

  async login(input: AuthLoginRequest): Promise<AuthLoginResponse> {
    this.ensureConfigured();
    
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' })) as any;
      throw new Error(error.error || 'Erro ao fazer login');
    }

    return response.json() as Promise<AuthLoginResponse>;
  }

  async verify(input: AuthVerifyRequest): Promise<AuthVerifyResponse> {
    this.ensureConfigured();
    
    const response = await fetch(`${this.baseUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' })) as any;
      throw new Error(error.error || 'Erro na verificação');
    }

    return response.json() as Promise<AuthVerifyResponse>;
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

