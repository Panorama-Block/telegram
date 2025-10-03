export interface ChatMessage {
  // Generic message object to satisfy API model
  type?: string;
  content?: string;
  text?: string;
  role?: string;
}

export interface ChatRequest {
  user_id: string;
  conversation_id: string;
  message: string | ChatMessage;
  chain_id?: string;
  wallet_address?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  message: string;
  requires_action?: boolean;
  actions?: Array<{ type: string; label: string; payload?: unknown }>;
}

export interface ChatOptions {
  jwt?: string;
  headers?: Record<string, string>;
}

export class AgentsClient {
  private baseUrl?: string;
  private messagePath?: string;
  private debugShape: boolean = false;

  constructor() {
    // Usar variáveis de ambiente do Gateway via window
    const env = (window as any).__ENV__ || {};
    this.baseUrl = env.AGENTS_API_BASE;
    this.messagePath = env.AGENTS_RESPONSE_MESSAGE_PATH;
    this.debugShape = !!env.AGENTS_DEBUG_SHAPE;
  }

  private ensureConfigured() {
    if (!this.baseUrl) throw new Error('AGENTS_API_BASE não configurado');
  }

  private extractByPath(obj: any, path?: string): unknown {
    if (!obj || !path) return undefined;
    // supports dot notation and [index], with [-1] as last element
    const parts = path.split('.').flatMap((p) => {
      const m = [...p.matchAll(/([^\[\]]+)|(\[(.*?)\])/g)];
      return m.map((seg) => (seg[1] !== undefined ? seg[1] : seg[3]!));
    });
    let cur: any = obj;
    for (const part of parts) {
      if (cur == null) return undefined;
      if (/^-?\d+$/.test(part)) {
        const idx = parseInt(part, 10);
        const arr = Array.isArray(cur) ? cur : cur instanceof Object && 'length' in cur ? Array.from(cur as any) : undefined;
        if (!arr) return undefined;
        const real = idx < 0 ? arr.length + idx : idx;
        cur = arr[real];
      } else {
        cur = cur[part];
      }
    }
    return cur;
  }

  private static isString(x: unknown): x is string {
    return typeof x === 'string';
  }

  private static joinContent(content: unknown): string {
    // content pode ser string, array de blocos, objetos etc.
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
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
        .filter(Boolean)
        .join('');
    }
    if (typeof content === 'object' && content) {
      const anyObj = content as any;
      if (AgentsClient.isString(anyObj.text)) return anyObj.text;
      if (AgentsClient.isString(anyObj.content)) return anyObj.content;
    }
    return '';
  }

  private static coerceResponse(data: any): ChatResponse {
    // Tenta diversas formas comuns de retorno
    let message = '';
    if (AgentsClient.isString(data?.message)) message = data.message;
    if (!message && (data?.content !== undefined)) {
      message = AgentsClient.joinContent(data.content);
    }
    if (!message && Array.isArray(data?.messages)) {
      const msgs = data.messages as any[];
      // pegar a última mensagem do assistente, senão a última
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
      const out = data.output;
      message = AgentsClient.joinContent(out?.message ?? out?.text ?? out?.content);
    }
    if (!message && data?.data) {
      const out = data.data;
      message = AgentsClient.joinContent(out?.message ?? out?.text ?? out?.content);
    }
    if (!message && data?.result) {
      const out = data.result;
      message = AgentsClient.joinContent(out?.message ?? out?.text ?? out?.content);
    }

    const requires_action = Boolean(data?.requires_action);
    const actions = Array.isArray(data?.actions) ? data.actions : undefined;

    return { message: message ?? '', requires_action, actions } as ChatResponse;
  }

  async chat(req: ChatRequest, opts: ChatOptions = {}): Promise<ChatResponse> {
    this.ensureConfigured();
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
    if (opts.jwt) headers['authorization'] = `Bearer ${opts.jwt}`;
    
    const outgoingMessage = typeof req.message === 'string'
      ? { role: 'user', content: req.message }
      : req.message.role
      ? req.message
      : { role: 'user', ...req.message };
    
    // Estrutura exata esperada pelo backend zico_agents
    const body = {
      message: outgoingMessage,
      prompt: outgoingMessage, // Usar o mesmo objeto message como prompt
      chain_id: req.chain_id || 'default',
      wallet_address: req.wallet_address || 'default',
      conversation_id: req.conversation_id || 'default',
      user_id: req.user_id || 'anonymous'
    };

    console.log('🤖 [AGENTS CLIENT] Sending request:', {
      url: `${this.baseUrl}/chat`,
      body: JSON.stringify(body, null, 2),
      headers: Object.keys(headers)
    });
    
    // Apply a timeout to avoid long hangs
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    
    const res = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    clearTimeout(t);
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Agents chat falhou: ${res.status} ${text}`);
    }
    
    const data = await res.json();
    
    // Preferred extraction via path if configured
    let extractedMessage: string | undefined;
    if (this.messagePath) {
      const byPath = this.extractByPath(data, this.messagePath);
      extractedMessage = AgentsClient.joinContent(byPath);
    }
    
    const coerced = AgentsClient.coerceResponse(data);
    const final: ChatResponse = {
      message: (extractedMessage && extractedMessage.trim()) ? extractedMessage : coerced.message,
      requires_action: coerced.requires_action,
      actions: coerced.actions,
    };
    
    if (this.debugShape && !final.message) {
      // Log leve de formato para diagnóstico (sem conteúdo)
      const root: any = data || {};
      const keys = Object.keys(root);
      const hasMessages = Array.isArray(root.messages);
      const choicesLen = Array.isArray(root.choices) ? root.choices.length : 0;
      // eslint-disable-next-line no-console
      console.info(JSON.stringify({ level: 'info', message: 'agents_response_shape', keys, hasMessages, choicesLen }));
    }
    
    return final;
  }
}
