import { parseEnv } from '../env.js';

export interface QuoteRequest {
  chain: string;
  fromToken: string;
  toToken: string;
  amount: number;
  unit?: 'token' | 'wei';
  jwtToken?: string;
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
    
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    
    // Add JWT token if provided
    if (req.jwtToken) {
      headers['Authorization'] = `Bearer ${req.jwtToken}`;
    }
    
    const res = await fetch(`${this.baseUrl}/swap/quote`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Swap quote falhou: ${res.status} ${text}`);
    }
    return (await res.json()) as QuoteResponse;
  }
}
