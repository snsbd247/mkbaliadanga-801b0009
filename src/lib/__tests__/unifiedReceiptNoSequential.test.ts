import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase client so `next_unified_receipt_no` returns a strictly
// increasing serial per office (RCP-YYYY-MM-NNNN), mirroring the atomic DB fn.
vi.mock("@/integrations/supabase/client", () => {
  const counters: Record<string, number> = {};
  const rpcMock = vi.fn(async (_fn: string, args: { p_office_id: string }) => {
    const office = args.p_office_id;
    counters[office] = (counters[office] ?? 0) + 1;
    const no = `RCP-2026-06-${String(counters[office]).padStart(4, "0")}`;
    return { data: no, error: null };
  });
  return {
    supabase: { rpc: rpcMock },
    __mocks: { rpcMock, counters },
  };
});

import { nextUnifiedReceiptNo } from "@/lib/monthlyReceiptNo";

const mod = (await import("@/integrations/supabase/client")) as any;

describe("nextUnifiedReceiptNo — sequential serials (incl. office income)", () => {
  beforeEach(() => {
    mod.__mocks.rpcMock.mockClear();
    Object.keys(mod.__mocks.counters).forEach((k) => delete mod.__mocks.counters[k]);
  });

  it("emits strictly sequential serials across mixed payment + office-income calls", async () => {
    const office = "office-1";
    const serials: string[] = [];
    // Interleave irrigation payment + office income (Hawlat/Vangari/Anudan) requests.
    for (const kind of ["IRR", "SAV", "IRR", "IRR", "SAV"] as const) {
      serials.push(await nextUnifiedReceiptNo(office, kind));
    }
    expect(serials).toEqual([
      "RCP-2026-06-0001",
      "RCP-2026-06-0002",
      "RCP-2026-06-0003",
      "RCP-2026-06-0004",
      "RCP-2026-06-0005",
    ]);
    // No gaps / duplicates.
    expect(new Set(serials).size).toBe(serials.length);
  });

  it("keeps independent sequences per office", async () => {
    const a = await nextUnifiedReceiptNo("office-a", "IRR");
    const b = await nextUnifiedReceiptNo("office-b", "IRR");
    const a2 = await nextUnifiedReceiptNo("office-a", "IRR");
    expect(a).toBe("RCP-2026-06-0001");
    expect(b).toBe("RCP-2026-06-0001");
    expect(a2).toBe("RCP-2026-06-0002");
  });
});
