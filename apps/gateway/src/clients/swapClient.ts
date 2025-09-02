import { parseEnv } from '../env.js';

export interface QuoteRequest {
  chain: string;
  fromToken: string;
  toToken: string;
  amount: number;
}

export interface QuoteResponse {
  price?: number | string;
  fee?: number | string;
  route?: unknown;
  [k: string]: unknown;
}

export class SwapClient {
  private baseUrl?: string;
  constructor() {
    const env = parseEnv();
    this.baseUrl = (env as any).SWAP_API_BASE || process.env['SWAP_API_BASE'];
  }
  private ensureConfigured() {
    if (!this.baseUrl) throw new Error('SWAP_API_BASE não configurado');
  }
  async quote(req: QuoteRequest): Promise<QuoteResponse> {
    this.ensureConfigured();
    const res = await fetch(`${this.baseUrl}/swap/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Swap quote falhou: ${res.status} ${text}`);
    }
    return (await res.json()) as QuoteResponse;
  }
}

