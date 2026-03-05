import { parseEnv } from '../env.js';

export interface TelegramIdentityResolveResult {
  found: boolean;
  telegram_user_id: string;
  zico_user_id?: string;
}

export class TelegramIdentityClient {
  private readonly baseUrl?: string;
  private readonly timeoutMs: number;

  constructor() {
    const env = parseEnv();
    this.baseUrl = env.AUTH_API_BASE;
    this.timeoutMs = 8000;
  }

  private ensureConfigured() {
    if (!this.baseUrl) throw new Error('AUTH_API_BASE not configured');
  }

  private async fetchWithTimeout(input: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`Identity resolve timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async resolveUserId(telegramUserId: string): Promise<TelegramIdentityResolveResult> {
    this.ensureConfigured();
    const uid = String(telegramUserId || '').trim();
    if (!uid) {
      return { found: false, telegram_user_id: '' };
    }

    const url = new URL(`${this.baseUrl}/auth/telegram/resolve`);
    url.searchParams.set('telegram_user_id', uid);

    const res = await this.fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Identity resolve failed: ${res.status} ${text}`);
    }

    const data: any = await res.json();
    return {
      found: Boolean(data?.found && typeof data?.zico_user_id === 'string' && data.zico_user_id.trim().length > 0),
      telegram_user_id: String(data?.telegram_user_id || uid),
      zico_user_id: typeof data?.zico_user_id === 'string' ? data.zico_user_id : undefined,
    };
  }
}
