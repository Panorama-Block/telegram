import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { server } from '../../../../test/mocks/server';
import { createDefiHttp, DefiApiError, resolveDefiBaseUrl } from '../defiApiBase';

const BASE = 'http://api.test.local/api/fixture';

function buildHttp(overrides: Partial<Parameters<typeof createDefiHttp>[0]> = {}) {
  return createDefiHttp({
    baseUrl: BASE,
    label: 'fixture',
    anonymous: true,
    timeoutMs: 500,
    ...overrides,
  });
}

describe('createDefiHttp', () => {
  it('issues GET to the resolved URL and returns parsed JSON', async () => {
    server.use(
      http.get(`${BASE}/items`, () => HttpResponse.json({ items: [1, 2, 3] })),
    );
    const http2 = buildHttp();
    const data = await http2.get<{ items: number[] }>('/items');
    expect(data).toEqual({ items: [1, 2, 3] });
  });

  it('accepts paths without leading slash', async () => {
    server.use(
      http.get(`${BASE}/items`, () => HttpResponse.json({ ok: true })),
    );
    const http2 = buildHttp();
    const data = await http2.get<{ ok: boolean }>('items');
    expect(data).toEqual({ ok: true });
  });

  it('strips trailing slash from baseUrl', async () => {
    server.use(http.get(`${BASE}/x`, () => HttpResponse.json({ ok: 1 })));
    const http2 = buildHttp({ baseUrl: `${BASE}///` });
    await expect(http2.get('/x')).resolves.toEqual({ ok: 1 });
  });

  it('sends JSON body on POST with content-type header', async () => {
    let received: unknown = null;
    server.use(
      http.post(`${BASE}/echo`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ received });
      }),
    );
    const http2 = buildHttp();
    await http2.post<{ received: unknown }>('/echo', { a: 1, b: 'two' });
    expect(received).toEqual({ a: 1, b: 'two' });
  });

  it('throws DefiApiError on non-2xx with derived message', async () => {
    server.use(
      http.get(`${BASE}/fail`, () =>
        HttpResponse.json({ error: { message: 'not allowed' } }, { status: 403 }),
      ),
    );
    const http2 = buildHttp();
    await expect(http2.get('/fail')).rejects.toMatchObject({
      name: 'DefiApiError',
      message: 'not allowed',
      status: 403,
    });
  });

  it('falls back to status-based error message when body has none', async () => {
    server.use(
      http.get(`${BASE}/empty`, () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );
    const http2 = buildHttp();
    await expect(http2.get('/empty')).rejects.toBeInstanceOf(DefiApiError);
    await expect(http2.get('/empty')).rejects.toMatchObject({
      status: 500,
      message: 'fixture API error: 500',
    });
  });

  it('runs Zod schema on successful responses', async () => {
    server.use(http.get(`${BASE}/typed`, () => HttpResponse.json({ n: 5 })));
    const http2 = buildHttp();
    const schema = z.object({ n: z.number() });
    const data = await http2.get<{ n: number }>('/typed', { schema });
    expect(data).toEqual({ n: 5 });
  });

  it('aborts on timeout and wraps the error', async () => {
    server.use(
      http.get(`${BASE}/slow`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({ ok: 1 });
      }),
    );
    const http2 = buildHttp({ timeoutMs: 10 });
    await expect(http2.get('/slow')).rejects.toMatchObject({
      name: 'DefiApiError',
      message: expect.stringContaining('timed out'),
    });
  });
});

describe('resolveDefiBaseUrl', () => {
  it('returns the first non-empty env candidate', () => {
    expect(
      resolveDefiBaseUrl({
        envCandidates: ['', undefined, 'http://a.test/', 'http://b.test'],
        proxyPath: '/api/x',
      }),
    ).toBe('http://a.test');
  });

  it('falls back to proxyPath when all env candidates are empty', () => {
    expect(
      resolveDefiBaseUrl({
        envCandidates: ['', undefined, '   '],
        proxyPath: '/api/x',
      }),
    ).toBe('/api/x');
  });
});
