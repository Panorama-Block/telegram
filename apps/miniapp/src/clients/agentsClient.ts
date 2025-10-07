export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  message: ChatMessage;
  user_id?: string;
  conversation_id?: string;
  chain_id?: string;
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

export interface ChatOptions {
  jwt?: string;
  headers?: Record<string, string>;
}

export interface ConversationListResponse {
  conversation_ids: string[];
}

export interface ConversationCreateResponse {
  conversation_id: string;
}

export interface BackendChatMessage {
  role: string;
  content: string;
  agent_name?: string | null;
  agent_type?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp?: string;
  conversation_id?: string;
  user_id?: string;
}

export interface FetchMessagesResponse {
  messages: BackendChatMessage[];
}

export class AgentsClient {
  private baseUrl?: string;
  private messagePath?: string;
  private debugShape: boolean = false;
  private timeoutMs: number;
  private debugEnabled: boolean;

  constructor() {
    // Usar variáveis de ambiente do Next.js
    this.baseUrl = process.env.AGENTS_API_BASE;
    this.messagePath = process.env.AGENTS_RESPONSE_MESSAGE_PATH;
    const debugFlag = process.env.AGENTS_DEBUG_SHAPE;
    this.debugShape = typeof debugFlag === 'string' ? ['1', 'true', 'on', 'yes'].includes(debugFlag.toLowerCase()) : Boolean(debugFlag);
    const fromEnv = Number(process.env.AGENTS_REQUEST_TIMEOUT_MS ?? process.env.NEXT_PUBLIC_AGENTS_REQUEST_TIMEOUT_MS);
    this.timeoutMs = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 45000;
    const chatDebug = process.env.NEXT_PUBLIC_MINIAPP_DEBUG_CHAT ?? process.env.MINIAPP_DEBUG_CHAT;
    this.debugEnabled = typeof chatDebug === 'string' ? ['1', 'true', 'on', 'yes'].includes(chatDebug.toLowerCase()) : Boolean(chatDebug);
  }

  private ensureConfigured() {
    if (!this.baseUrl) throw new Error('AGENTS_API_BASE não configurado');
  }

  private logDebug(event: string, payload?: Record<string, unknown>) {
    if (!this.debugEnabled) return;
    const entry = {
      scope: 'AgentsClient',
      event,
      timestamp: new Date().toISOString(),
      ...(payload ?? {}),
    } satisfies Record<string, unknown>;
    // eslint-disable-next-line no-console
    console.info('[miniapp-debug]', entry);
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

  private buildHeaders(opts: ChatOptions = {}): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
    if (opts.jwt) headers['authorization'] = `Bearer ${opts.jwt}`;
    return headers;
  }

  private async fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = this.timeoutMs > 0 ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

    try {
      this.logDebug('fetch:start', {
        method: (init.method ?? 'GET').toUpperCase(),
        url: typeof input === 'string' ? input : (input as URL).toString(),
      });
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  async chat(req: ChatRequest, opts: ChatOptions = {}): Promise<ChatResponse> {
    this.ensureConfigured();
    const headers = this.buildHeaders(opts);

    const outgoingMessage = {
      role: req.message.role ?? 'user',
      content: req.message.content,
    };

    // Estrutura exata esperada pelo backend zico_agents
    const body: Record<string, unknown> = {
      message: outgoingMessage,
    };

    if (req.user_id) body.user_id = req.user_id;
    if (req.conversation_id) body.conversation_id = req.conversation_id;

    if (req.chain_id) body.chain_id = req.chain_id;
    if (req.wallet_address) body.wallet_address = req.wallet_address;
    if (req.metadata) body.metadata = req.metadata;
    
    // Apply a timeout to avoid long hangs
    const requestUrl = `${this.baseUrl}/chat`;
    const res = await this.fetchWithTimeout(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logDebug('chat:error', { status: res.status, body, response: text });
      throw new Error(`Agents chat falhou: ${res.status} ${text}`);
    }

    this.logDebug('chat:success', { conversationId: req.conversation_id, userId: req.user_id });

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
      agent_name: data?.agentName ?? data?.agent_name ?? null,
      agent_type: data?.agentType ?? data?.agent_type ?? null,
      metadata: typeof data?.metadata === 'object' && data?.metadata !== null ? data.metadata as Record<string, unknown> : null,
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

  async listConversations(userId?: string, opts: ChatOptions = {}): Promise<string[]> {
    this.ensureConfigured();
    const headers = this.buildHeaders(opts);

    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);

    const url = `${this.baseUrl}/chat/conversations${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      this.logDebug('listConversations:error', { status: res.status, userId, response: text });
      throw new Error(`Agents list conversations failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as ConversationListResponse;
    this.logDebug('listConversations:success', { userId, conversations: data.conversation_ids?.length ?? 0 });
    return Array.isArray(data.conversation_ids) ? data.conversation_ids : [];
  }

  async createConversation(userId?: string, opts: ChatOptions = {}): Promise<string> {
    this.ensureConfigured();
    const headers = this.buildHeaders(opts);

    const body: Record<string, unknown> = {};
    if (userId) body.user_id = userId;

    const url = `${this.baseUrl}/chat/conversations`;
    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logDebug('createConversation:error', { status: res.status, userId, response: text });
      throw new Error(`Agents create conversation failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as ConversationCreateResponse;
    if (!data?.conversation_id) {
      this.logDebug('createConversation:error', { status: res.status, userId, response: 'missing conversation_id' });
      throw new Error('Agents create conversation failed: missing conversation_id');
    }
    this.logDebug('createConversation:success', { userId, conversationId: data.conversation_id });
    return data.conversation_id;
  }

  async fetchMessages(userId: string | undefined, conversationId: string | undefined, opts: ChatOptions = {}): Promise<BackendChatMessage[]> {
    this.ensureConfigured();
    const headers = this.buildHeaders(opts);

    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (conversationId) params.set('conversation_id', conversationId);

    const url = `${this.baseUrl}/chat/messages${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      this.logDebug('fetchMessages:error', { status: res.status, userId, conversationId, response: text });
      throw new Error(`Agents fetch messages failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as FetchMessagesResponse;
    this.logDebug('fetchMessages:success', {
      userId,
      conversationId,
      messages: Array.isArray(data?.messages) ? data.messages.length : 0,
    });
    if (!data?.messages || !Array.isArray(data.messages)) return [];
    return data.messages;
  }
}
