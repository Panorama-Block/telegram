import { describe, it, expect, vi } from 'vitest';
import { createDefiCache } from '../defiCache';

describe('createDefiCache', () => {
  it('stores and returns entries', () => {
    const cache = createDefiCache<number>({ label: 'test', defaultTtlMs: 1000 });
    expect(cache.get('a')).toBeUndefined();
    cache.set('a', 42);
    expect(cache.peek('a')).toBe(42);
    expect(cache.get('a')?.data).toBe(42);
    expect(typeof cache.get('a')?.fetchedAt).toBe('number');
  });

  it('isFresh respects default TTL and per-call override', () => {
    const cache = createDefiCache<number>({ label: 'test', defaultTtlMs: 1000 });
    cache.set('a', 1);
    expect(cache.isFresh('a')).toBe(true);
    expect(cache.isFresh('a', 0)).toBe(false);
    expect(cache.isFresh('missing')).toBe(false);
  });

  it('invalidate(key) removes a single entry and notifies subscribers', () => {
    const cache = createDefiCache<number>({ label: 'test' });
    const listener = vi.fn();
    cache.set('a', 1);
    cache.subscribe('a', listener);
    cache.invalidate('a');
    expect(cache.get('a')).toBeUndefined();
    expect(listener).toHaveBeenCalledWith(undefined);
  });

  it('invalidate() clears all entries', () => {
    const cache = createDefiCache<number>({ label: 'test' });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('withDedup shares a single in-flight promise per key', async () => {
    const cache = createDefiCache<number>({ label: 'test' });
    const fetcher = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 7;
    });

    const [a, b, c] = await Promise.all([
      cache.withDedup('k', fetcher),
      cache.withDedup('k', fetcher),
      cache.withDedup('k', fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect([a, b, c]).toEqual([7, 7, 7]);
    expect(cache.peek('k')).toBe(7);
  });

  it('withDedup releases in-flight on failure so subsequent calls can retry', async () => {
    const cache = createDefiCache<number>({ label: 'test' });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(5);

    await expect(cache.withDedup('k', fetcher)).rejects.toThrow('boom');
    await expect(cache.withDedup('k', fetcher)).resolves.toBe(5);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('subscribe fires on set and unsubscribes cleanly', () => {
    const cache = createDefiCache<number>({ label: 'test' });
    const listener = vi.fn();
    const unsub = cache.subscribe('a', listener);

    cache.set('a', 1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ data: 1 }));

    unsub();
    cache.set('a', 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
