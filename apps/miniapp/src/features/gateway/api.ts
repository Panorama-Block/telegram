// ============================================================================
// GATEWAY API CLIENT
// Cliente base para comunicação com o Database Gateway
// ============================================================================

import type { GatewayError, PaginatedResponse } from './types';

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

const DEFAULT_TENANT_ID = 'panorama';

function getGatewayUrl(): string {
  const url = process.env.NEXT_PUBLIC_GATEWAY_URL as string | undefined;
  if (url && url.length > 0) return url.replace(/\/+$/, '');
  // Fallback para desenvolvimento local
  return 'http://localhost:8080';
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

function getTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID;
  return localStorage.getItem('tenantId') || DEFAULT_TENANT_ID;
}

// ----------------------------------------------------------------------------
// Error Handling
// ----------------------------------------------------------------------------

export class GatewayApiError extends Error {
  readonly url: string;
  readonly status?: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      url: string;
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'GatewayApiError';
    this.url = options.url;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function extractErrorMessage(parsed: unknown): string {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (obj.error && typeof obj.error === 'object') {
      const err = obj.error as Record<string, unknown>;
      if (typeof err.message === 'string') return err.message;
    }
  }
  return 'Gateway API error';
}

// ----------------------------------------------------------------------------
// HTTP Methods
// ----------------------------------------------------------------------------

interface RequestOptions {
  idempotencyKey?: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const url = `${getGatewayUrl()}${path}`;
  const authToken = getAuthToken();
  const tenantId = getTenantId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Idempotency key para operações de escrita
  if (options?.idempotencyKey && ['POST', 'PATCH', 'DELETE'].includes(method)) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  } else if (['POST', 'PATCH', 'DELETE'].includes(method)) {
    // Gera um idempotency key automático se não fornecido
    headers['Idempotency-Key'] = `${method}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  console.log('[GatewayAPI]', method, url, { hasAuth: !!authToken, tenantId });

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const parsed = await parseJsonSafe(res);

    if (!res.ok) {
      const message = extractErrorMessage(parsed);
      const error = parsed as GatewayError | undefined;
      throw new GatewayApiError(message, {
        url,
        status: res.status,
        code: error?.code,
        details: error?.details,
      });
    }

    // DELETE retorna 204 No Content
    if (res.status === 204) {
      return undefined as T;
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof GatewayApiError) throw err;
    throw new GatewayApiError('Network request failed', {
      url,
      cause: err,
    });
  }
}

// ----------------------------------------------------------------------------
// Generic CRUD Operations
// ----------------------------------------------------------------------------

export interface QueryParams {
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  take?: number;
  skip?: number;
  include?: Record<string, boolean>;
}

function buildQueryString(params?: QueryParams): string {
  if (!params) return '';

  const searchParams = new URLSearchParams();

  if (params.where) {
    searchParams.set('where', JSON.stringify(params.where));
  }
  if (params.orderBy) {
    searchParams.set('orderBy', JSON.stringify(params.orderBy));
  }
  if (params.take !== undefined) {
    searchParams.set('take', String(params.take));
  }
  if (params.skip !== undefined) {
    searchParams.set('skip', String(params.skip));
  }
  if (params.include) {
    searchParams.set('include', JSON.stringify(params.include));
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const gatewayApi = {
  // List entities with pagination
  async list<T>(entity: string, params?: QueryParams): Promise<PaginatedResponse<T>> {
    const qs = buildQueryString(params);
    return request<PaginatedResponse<T>>('GET', `/v1/${entity}${qs}`);
  },

  // Get single entity by ID
  async get<T>(entity: string, id: string): Promise<T> {
    return request<T>('GET', `/v1/${entity}/${id}`);
  },

  // Create new entity
  async create<T>(entity: string, data: unknown, idempotencyKey?: string): Promise<T> {
    return request<T>('POST', `/v1/${entity}`, data, { idempotencyKey });
  },

  // Update entity
  async update<T>(entity: string, id: string, data: unknown, idempotencyKey?: string): Promise<T> {
    return request<T>('PATCH', `/v1/${entity}/${id}`, data, { idempotencyKey });
  },

  // Delete entity
  async delete(entity: string, id: string, idempotencyKey?: string): Promise<void> {
    return request<void>('DELETE', `/v1/${entity}/${id}`, undefined, { idempotencyKey });
  },

  // Execute transaction (multiple operations)
  async transact<T>(ops: Array<{ op: string; entity: string; args: unknown }>): Promise<T> {
    return request<T>('POST', '/v1/_transact', { ops });
  },
};

export default gatewayApi;
