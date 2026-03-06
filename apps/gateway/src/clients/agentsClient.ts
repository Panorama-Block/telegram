import { parseEnv } from '../env.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: ChatMessage;
  user_id?: string;
  conversation_id?: string;
  wallet_address?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  message: string;
  requires_action?: boolean;
  actions?: Array<{ type: string; label: string; payload?: unknown }>;
  agent_name?: string | null;
  agent_type?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class AgentsClient {
  private baseUrl?: string;
  private messagePath?: string;
  private timeoutMs: number;

  constructor() {
    const env = parseEnv();
    this.baseUrl = env.AGENTS_API_BASE;
    this.messagePath = env.AGENTS_RESPONSE_MESSAGE_PATH;
    this.timeoutMs = env.AGENTS_REQUEST_TIMEOUT_MS;
  }

  private ensureConfigured() {
    if (!this.baseUrl) throw new Error('AGENTS_API_BASE not configured');
  }

  private extractByPath(obj: any, path?: string): unknown {
    if (!obj || !path) return undefined;

    const parts = path.split('.').flatMap((segment) => {
      const matches = [...segment.matchAll(/([^\[\]]+)|(\[(.*?)\])/g)];
      return matches.map((m) => (m[1] !== undefined ? m[1] : m[3]!));
    });

    let current: any = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      if (/^-?\d+$/.test(part)) {
        const idx = parseInt(part, 10);
        const arr = Array.isArray(current)
          ? current
          : current instanceof Object && 'length' in current
            ? Array.from(current as any)
            : undefined;
        if (!arr) return undefined;
        const realIdx = idx < 0 ? arr.length + idx : idx;
        current = arr[realIdx];
      } else {
        current = current[part];
      }
    }
    return current;
  }

  private static isString(x: unknown): x is string {
    return typeof x === 'string';
  }

  private static joinContent(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const pieces = content
        .map((part) => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if (typeof part === 'object') {
            const anyPart = part as any;
            if (AgentsClient.isString(anyPart.text)) return anyPart.text;
            if (AgentsClient.isString(anyPart.content)) return anyPart.content;
          }
          return '';
        })
        .filter(Boolean);
      return pieces.join('\n');
    }

    if (typeof content === 'object' && content) {
      const anyObj = content as any;
      if (AgentsClient.isString(anyObj.text)) return anyObj.text;
      if (AgentsClient.isString(anyObj.content)) return anyObj.content;
    }

    return '';
  }

  private static coerceResponse(data: any): ChatResponse {
    let message = '';
    if (AgentsClient.isString(data?.message)) message = data.message;
    if (!message && data?.content !== undefined) {
      message = AgentsClient.joinContent(data.content);
    }
    if (!message && Array.isArray(data?.messages)) {
      const msgs = data.messages as any[];
      const assistant = [...msgs].reverse().find((m) => m?.role === 'assistant') ?? msgs[msgs.length - 1];
      if (assistant) {
        message = AgentsClient.joinContent(assistant.content ?? assistant.text ?? assistant.message);
      }
    }
    if (!message && AgentsClient.isString(data?.answer)) message = data.answer;
    if (!message && AgentsClient.isString(data?.response)) message = data.response;
    if (!message && AgentsClient.isString(data?.text)) message = data.text;
    if (!message && AgentsClient.isString(data?.error_message)) message = data.error_message;
    if (!message && Array.isArray(data?.choices) && data.choices.length > 0) {
      const ch0 = data.choices[0];
      message = AgentsClient.joinContent(ch0?.message?.content ?? ch0?.text ?? '');
    }
    if (!message && data?.output) {
      message = AgentsClient.joinContent(data.output?.message ?? data.output?.text ?? data.output?.content);
    }
    if (!message && data?.data) {
      message = AgentsClient.joinContent(data.data?.message ?? data.data?.text ?? data.data?.content);
    }
    if (!message && data?.result) {
      message = AgentsClient.joinContent(data.result?.message ?? data.result?.text ?? data.result?.content);
    }

    return {
      message: message ?? '',
      requires_action: Boolean(data?.requires_action),
      actions: Array.isArray(data?.actions) ? data.actions : undefined,
    };
  }

  private async fetchWithTimeout(input: string | URL, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = this.timeoutMs > 0 ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(`Agents request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    this.ensureConfigured();

    const body: Record<string, unknown> = {
      message: {
        role: req.message.role ?? 'user',
        content: req.message.content,
      },
    };

    if (req.user_id) body.user_id = req.user_id;
    if (req.conversation_id) body.conversation_id = req.conversation_id;
    if (req.wallet_address) body.wallet_address = req.wallet_address;
    if (req.metadata) body.metadata = req.metadata;

    const res = await this.fetchWithTimeout(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agents chat failed: ${res.status} ${text}`);
    }

    const data: any = await res.json();

    let extractedMessage: string | undefined;
    if (this.messagePath) {
      const byPath = this.extractByPath(data, this.messagePath);
      extractedMessage = AgentsClient.joinContent(byPath);
    }

    const coerced = AgentsClient.coerceResponse(data);
    return {
      message: extractedMessage?.trim() ? extractedMessage : coerced.message,
      requires_action: coerced.requires_action,
      actions: coerced.actions,
      agent_name: data?.agentName ?? data?.agent_name ?? null,
      agent_type: data?.agentType ?? data?.agent_type ?? null,
      metadata:
        typeof data?.metadata === 'object' && data?.metadata !== null
          ? (data.metadata as Record<string, unknown>)
          : null,
    };
  }
}
