import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createDefiCache } from '../../lib/defiCache';
import { useDefiData } from '../useDefiData';

describe('useDefiData', () => {
  it('fetches on mount when cache is empty', async () => {
    const cache = createDefiCache<number>({ label: 'test' });
    const fetcher = vi.fn().mockResolvedValue(42);

    const { result } = renderHook(() =>
      useDefiData({ key: 'k', cache, fetcher }),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(42));
    expect(result.current.loading).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('seeds state from cache and skips fetch when fresh', async () => {
    const cache = createDefiCache<number>({ label: 'test', defaultTtlMs: 60_000 });
    cache.set('k', 99);
    const fetcher = vi.fn();

    const { result } = renderHook(() =>
      useDefiData({ key: 'k', cache, fetcher }),
    );

    expect(result.current.data).toBe(99);
    expect(result.current.loading).toBe(false);
    // Allow any async flush.
    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('surfaces fetch errors and keeps loading false after', async () => {
    const cache = createDefiCache<number>({ label: 'test' });
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() =>
      useDefiData({ key: 'k', cache, fetcher }),
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('refresh() bypasses freshness and refetches', async () => {
    const cache = createDefiCache<number>({ label: 'test', defaultTtlMs: 60_000 });
    cache.set('k', 10);
    const fetcher = vi.fn().mockResolvedValue(20);

    const { result } = renderHook(() =>
      useDefiData({ key: 'k', cache, fetcher }),
    );

    expect(result.current.data).toBe(10);
    expect(fetcher).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBe(20);
  });

  it('syncs across instances via cache subscription', async () => {
    const cache = createDefiCache<number>({ label: 'test', defaultTtlMs: 60_000 });
    cache.set('k', 1);
    const fetcher = vi.fn();

    const hookA = renderHook(() =>
      useDefiData({ key: 'k', cache, fetcher }),
    );
    const hookB = renderHook(() =>
      useDefiData({ key: 'k', cache, fetcher }),
    );

    expect(hookA.result.current.data).toBe(1);
    expect(hookB.result.current.data).toBe(1);

    act(() => cache.set('k', 99));

    await waitFor(() => {
      expect(hookA.result.current.data).toBe(99);
      expect(hookB.result.current.data).toBe(99);
    });
  });

  it('does not fetch when key is null', async () => {
    const cache = createDefiCache<number>({ label: 'test' });
    const fetcher = vi.fn();

    const { result } = renderHook(() =>
      useDefiData({ key: null, cache, fetcher }),
    );

    await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('re-fetches when key changes', async () => {
    const cache = createDefiCache<string>({ label: 'test' });
    const fetcher = vi.fn(async () => 'value');

    const { result, rerender } = renderHook(
      (props: { key: string }) =>
        useDefiData({ key: props.key, cache, fetcher }),
      { initialProps: { key: 'a' } },
    );

    await waitFor(() => expect(result.current.data).toBe('value'));
    expect(fetcher).toHaveBeenCalledTimes(1);

    rerender({ key: 'b' });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
