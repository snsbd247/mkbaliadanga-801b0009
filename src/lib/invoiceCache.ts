// Tiny per-farmer invoice cache used by the Payments page.
//
// Encapsulates the "serve from cache unless forced" logic so the Retry button
// (force = true) always refreshes AND updates the cache, while a later revisit
// to the same farmer avoids a redundant refetch. Pure + easily testable.

export type InvoiceCache<T> = {
  has: (key: string) => boolean;
  get: (key: string) => T[] | undefined;
  set: (key: string, rows: T[]) => void;
  /**
   * Returns cached rows when present and not forced; otherwise runs `fetcher`,
   * caches its result and returns it. `force` (Retry) always refetches.
   */
  load: (key: string, fetcher: () => Promise<T[]>, force?: boolean) => Promise<{ rows: T[]; fromCache: boolean }>;
};

export function createInvoiceCache<T = any>(): InvoiceCache<T> {
  const store = new Map<string, T[]>();
  return {
    has: (key) => store.has(key),
    get: (key) => store.get(key),
    set: (key, rows) => { store.set(key, rows); },
    async load(key, fetcher, force = false) {
      if (!force && store.has(key)) return { rows: store.get(key)!, fromCache: true };
      const rows = await fetcher();
      store.set(key, rows);
      return { rows, fromCache: false };
    },
  };
}
