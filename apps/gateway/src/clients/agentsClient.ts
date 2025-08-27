import { parseEnv } from '../env';

export interface ChatRequest {
  user_id: string;
  conversation_id: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  message: string;
  requires_action?: boolean;
  actions?: Array<{ type: string; label: string; payload?: unknown }>;
}

export class AgentsClient {
  private baseUrl?: string;
  constructor() {
    const env = parseEnv();
    this.baseUrl = env.AGENTS_API_BASE;
  }
  private ensureConfigured() {
    if (!this.baseUrl) throw new Error('AGENTS_API_BASE não configurado');
  }
  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.ensureConfigured();
    const res = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agents chat falhou: ${res.status} ${text}`);
    }
    return (await res.json()) as ChatResponse;
  }
}


