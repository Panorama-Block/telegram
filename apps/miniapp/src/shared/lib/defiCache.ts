'use client';

/**
 * Module-level TTL cache with in-flight dedup and subscription support.
 *
 * Designed to match the patterns currently inlined across yield/lending
 * feature hooks: one cache object lives at module scope, multiple
 * component instances read the same entries, and concurrent fetches
 * for the same key share a single in-flight promise.
 *
 * Keys are opaque strings. Callers compose them (e.g.
 * `pools:base` or `position:${userAddress}`) so the cache doesn't need
 * to know the feature's domain model.
 */

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export interface DefiCacheOptions {
  /** Human-readable cache name (used in dev logs). */
  label: string;
  /** Default TTL in ms; can be overridden per-call. */
  defaultTtlMs?: number;
}

export interface DefiCache<T> {
  readonly label: string;
  get(key: string): CacheEntry<T> | undefined;
  peek(key: string): T | undefined;
  isFresh(key: string, ttlMs?: number): boolean;
  set(key: string, data: T): void;
  invalidate(key?: string): void;
  /**
   * Runs `fetcher` if no fresh entry and no in-flight request exists.
   * Concurrent callers with the same key receive the same promise.
   * The result is written into the cache.
   */
  withDedup(key: string, fetcher: () => Promise<T>): Promise<T>;
  /** Subscribe to changes for `key`. Returns unsubscribe fn. */
  subscribe(key: string, listener: (entry: CacheEntry<T> | undefined) => void): () => void;
}

export function createDefiCache<T>(opts: DefiCacheOptions): DefiCache<T> {
  const defaultTtlMs = opts.defaultTtlMs ?? 60_000;

  const store = new Map<string, CacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();
  const listeners = new Map<string, Set<(entry: CacheEntry<T> | undefined) => void>>();

  function notify(key: string, entry: CacheEntry<T> | undefined): void {
    const set = listeners.get(key);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(entry);
      } catch (err) {
        console.warn(`[defiCache:${opts.label}] listener for "${key}" threw`, err);
      }
    }
  }

  return {
    label: opts.label,

    get(key) {
      return store.get(key);
    },

    peek(key) {
      return store.get(key)?.data;
    },

    isFresh(key, ttlMs) {
      const entry = store.get(key);
      if (!entry) return false;
      const effectiveTtl = ttlMs ?? defaultTtlMs;
      return Date.now() - entry.fetchedAt < effectiveTtl;
    },

    set(key, data) {
      const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };
      store.set(key, entry);
      notify(key, entry);
    },

    invalidate(key) {
      if (key === undefined) {
        const keys = Array.from(store.keys());
        store.clear();
        inFlight.clear();
        for (const k of keys) notify(k, undefined);
        return;
      }
      store.delete(key);
      inFlight.delete(key);
      notify(key, undefined);
    },

    async withDedup(key, fetcher) {
      const existing = inFlight.get(key);
      if (existing) return existing;

      const promise = (async () => {
        const data = await fetcher();
        const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };
        store.set(key, entry);
        notify(key, entry);
        return data;
      })().finally(() => {
        inFlight.delete(key);
      });

      inFlight.set(key, promise);
      return promise;
    },

    subscribe(key, listener) {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(listener);
      return () => {
        set!.delete(listener);
        if (set!.size === 0) listeners.delete(key);
      };
    },
  };
}
