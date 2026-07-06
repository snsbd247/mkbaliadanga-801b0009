import { describe, it, expect, vi } from "vitest";
import { createInvoiceCache } from "../invoiceCache";

describe("createInvoiceCache (Payments per-farmer cache + Retry)", () => {
  it("fetches on first visit and serves cache on revisit (no redundant refetch)", async () => {
    const cache = createInvoiceCache<any>();
    const fetcher = vi.fn().mockResolvedValue([{ id: "1" }]);

    const first = await cache.load("farmer-A", fetcher);
    expect(first.fromCache).toBe(false);
    expect(first.rows).toEqual([{ id: "1" }]);

    const second = await cache.load("farmer-A", fetcher);
    expect(second.fromCache).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1); // revisit did not refetch
  });

  it("Retry (force) refetches AND updates the cache", async () => {
    const cache = createInvoiceCache<any>();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([{ id: "stale" }])
      .mockResolvedValueOnce([{ id: "fresh" }]);

    await cache.load("farmer-A", fetcher);            // initial (stale)
    const retry = await cache.load("farmer-A", fetcher, true); // Retry
    expect(retry.fromCache).toBe(false);
    expect(retry.rows).toEqual([{ id: "fresh" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Subsequent revisit now serves the refreshed value without refetching.
    const revisit = await cache.load("farmer-A", fetcher);
    expect(revisit.fromCache).toBe(true);
    expect(revisit.rows).toEqual([{ id: "fresh" }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("caches per farmer independently", async () => {
    const cache = createInvoiceCache<any>();
    await cache.load("A", async () => [{ id: "a" }]);
    await cache.load("B", async () => [{ id: "b" }]);
    expect(cache.get("A")).toEqual([{ id: "a" }]);
    expect(cache.get("B")).toEqual([{ id: "b" }]);
    expect(cache.has("C")).toBe(false);
  });
});
