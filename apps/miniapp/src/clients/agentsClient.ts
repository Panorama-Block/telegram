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
  transcription?: string | null;
}

export interface ChatOptions {
  jwt?: string;
  headers?: Record<string, string>;
}

export interface Conversation {
  id: string;
  title?: string;
  updated_at?: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
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
    // Read environment variables provided by Next.js
    this.baseUrl =
      process.env.NEXT_PUBLIC_AGENTS_API_BASE ||
      process.env.VITE_AGENTS_API_BASE ||
      process.env.AGENTS_API_BASE;
    this.messagePath = process.env.AGENTS_RESPONSE_MESSAGE_PATH;
    const debugFlag = process.env.AGENTS_DEBUG_SHAPE;
    this.debugShape = typeof debugFlag === 'string' ? ['1', 'true', 'on', 'yes'].includes(debugFlag.toLowerCase()) : Boolean(debugFlag);
    const fromEnv = Number(process.env.AGENTS_REQUEST_TIMEOUT_MS ?? process.env.NEXT_PUBLIC_AGENTS_REQUEST_TIMEOUT_MS);
    this.timeoutMs = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 45000;
    const chatDebug = process.env.NEXT_PUBLIC_MINIAPP_DEBUG_CHAT ?? process.env.MINIAPP_DEBUG_CHAT;
    this.debugEnabled = typeof chatDebug === 'string' ? ['1', 'true', 'on', 'yes'].includes(chatDebug.toLowerCase()) : Boolean(chatDebug);
  }

  private ensureConfigured() {
    if (!this.baseUrl) throw new Error('AGENTS_API_BASE not configured');
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
    // content can be string, array of blocks, objects, etc.
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
      // Join parts with newlines to preserve Markdown blocks (headings, lists)
      const joined = pieces.join('\n');
      return joined;
    }
    if (typeof content === 'object' && content) {
      const anyObj = content as any;
      if (AgentsClient.isString(anyObj.text)) return anyObj.text;
      if (AgentsClient.isString(anyObj.content)) return anyObj.content;
    }
    return '';
  }

  private static coerceResponse(data: any): ChatResponse {
    // Try various common return formats
    let message = '';
    if (AgentsClient.isString(data?.message)) message = data.message;
    if (!message && (data?.content !== undefined)) {
      message = AgentsClient.joinContent(data.content);
    }
    if (!message && Array.isArray(data?.messages)) {
      const msgs = data.messages as any[];
      // Prefer the last assistant response, otherwise fall back to the final message
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
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        this.logDebug('fetch:abort', {
          method: (init.method ?? 'GET').toUpperCase(),
          url: typeof input === 'string' ? input : (input as URL).toString(),
          timeoutMs: this.timeoutMs,
        });
        throw new Error(`Agents request timed out after ${this.timeoutMs}ms`);
      }
      this.logDebug('fetch:error', {
        method: (init.method ?? 'GET').toUpperCase(),
        url: typeof input === 'string' ? input : (input as URL).toString(),
        error: (error as Error)?.message ?? String(error),
      });
      throw error;
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

    // Exact structure expected by the zico_agents backend
    const body: Record<string, unknown> = {
      message: outgoingMessage,
    };

    if (req.user_id) body.user_id = req.user_id;
    if (req.conversation_id) body.conversation_id = req.conversation_id;

    if (req.chain_id) body.chain_id = req.chain_id;
    if (req.wallet_address) body.wallet_address = req.wallet_address;
    if (req.metadata) body.metadata = req.metadata;
    this.logDebug('chat:request', {
      conversationId: req.conversation_id,
      hasUserId: Boolean(req.user_id),
      hasWalletAddress: Boolean(req.wallet_address),
    });

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
      throw new Error(`Agents chat failed: ${res.status} ${text}`);
    }

    this.logDebug('chat:success', {
      conversationId: req.conversation_id,
      userId: req.user_id,
      hasUserId: Boolean(req.user_id),
      hasWalletAddress: Boolean(req.wallet_address),
    });

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
      // Lightweight shape log for diagnostics (no content included)
      const root: any = data || {};
      const keys = Object.keys(root);
      const hasMessages = Array.isArray(root.messages);
      const choicesLen = Array.isArray(root.choices) ? root.choices.length : 0;
      // eslint-disable-next-line no-console
      console.info(JSON.stringify({ level: 'info', message: 'agents_response_shape', keys, hasMessages, choicesLen }));
    }

    return final;
  }

  async listConversations(userId?: string, opts: ChatOptions = {}): Promise<Conversation[]> {
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

    const data = (await res.json()) as any;
    console.info('[CHAT TRACE][AgentsClient] listConversations:raw', {
      userId,
      type: Array.isArray(data) ? 'array' : typeof data,
      keys: data && typeof data === 'object' ? Object.keys(data) : [],
      conversation_ids_count: Array.isArray(data?.conversation_ids) ? data.conversation_ids.length : null,
      conversations_count: Array.isArray(data?.conversations) ? data.conversations.length : null,
    });
    // Handle both old (list of strings) and new (list of objects) formats for backward compatibility
    let conversations: Conversation[] = [];

    // Check if data is array of strings (old format)
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'string') {
        conversations = data.map((id: string) => ({ id, title: 'Chat' }));
      } else if (data.length > 0 && typeof data[0] === 'object') {
        conversations = data.map((item: any) => {
          const rawId = item.conversationId || item.id;
          const id = (typeof rawId === 'object' && rawId !== null && rawId.id)
            ? String(rawId.id)
            : String(rawId);

          return {
            id,
            title: item.title,
            updated_at: item.updatedAt || item.updated_at
          };
        });
      } else {
        conversations = [];
      }
    } else if (data?.conversation_ids && Array.isArray(data.conversation_ids)) {
      // Old wrapper format
      conversations = data.conversation_ids.map((id: string) => ({ id, title: 'Chat' }));
    } else if (data?.conversations && Array.isArray(data.conversations)) {
      // New wrapper format
      conversations = data.conversations.map((item: any) => {
        const rawId = item.conversationId || item.id;
        const id = (typeof rawId === 'object' && rawId !== null && rawId.id)
          ? String(rawId.id)
          : String(rawId);

        return {
          id,
          title: item.title,
          updated_at: item.updatedAt || item.updated_at
        };
      });
    }

    console.info('[CHAT TRACE][AgentsClient] listConversations:parsed', {
      userId,
      count: conversations.length,
      ids: conversations.map((item) => item.id),
    });
    this.logDebug('listConversations:success', { userId, count: conversations.length });
    return conversations;
  }

  async createConversation(userId?: string, opts: ChatOptions = {}): Promise<string> {
    this.ensureConfigured();
    const headers = this.buildHeaders(opts);

    const body: Record<string, unknown> = {};
    if (userId) body.user_id = userId;

    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    const url = `${this.baseUrl}/chat/conversations${params.toString() ? `?${params.toString()}` : ''}`;
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

  async chatAudio(
    audioFile: Blob,
    userId: string,
    conversationId: string,
    walletAddress?: string,
    opts: ChatOptions = {}
  ): Promise<ChatResponse> {
    this.ensureConfigured();

    const formData = new FormData();

    // Determine file extension from blob type
    const mimeToExt: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/flac': 'flac',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
    };
    const ext = mimeToExt[audioFile.type] || 'webm';
    const filename = `recording.${ext}`;

    formData.append('audio', audioFile, filename);
    formData.append('user_id', userId);
    formData.append('conversation_id', conversationId);
    if (walletAddress) {
      formData.append('wallet_address', walletAddress);
    }

    const headers: Record<string, string> = {};
    if (opts.jwt) headers['authorization'] = `Bearer ${opts.jwt}`;

    const requestUrl = `${this.baseUrl}/chat/audio`;
    this.logDebug('chatAudio:start', { conversationId, userId, fileSize: audioFile.size, mimeType: audioFile.type });

    const res = await this.fetchWithTimeout(requestUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      this.logDebug('chatAudio:error', { status: res.status, response: text });
      throw new Error(`Agents audio chat failed: ${res.status} ${text}`);
    }

    this.logDebug('chatAudio:success', { conversationId, userId });

    const data = await res.json();

    const final: ChatResponse = {
      message: data?.response || '',
      requires_action: false,
      actions: undefined,
      agent_name: data?.agentName ?? data?.agent_name ?? null,
      agent_type: data?.agentType ?? data?.agent_type ?? null,
      metadata: typeof data?.metadata === 'object' && data?.metadata !== null ? data.metadata as Record<string, unknown> : null,
      transcription: data?.transcription ?? null,
    };

    return final;
  }
}
