import { describe, it, expect, vi, beforeEach } from "vitest";

// Atomic per-office serial mock mirroring the DB function.
vi.mock("@/integrations/supabase/client", () => {
  const counters: Record<string, number> = {};
  const rpcMock = vi.fn(async (_fn: string, args: { p_office_id: string }) => {
    const office = args.p_office_id;
    counters[office] = (counters[office] ?? 0) + 1;
    return { data: `RCP-2026-06-${String(counters[office]).padStart(4, "0")}`, error: null };
  });
  return { supabase: { rpc: rpcMock }, __mocks: { rpcMock, counters } };
});

import { nextUnifiedReceiptNo } from "@/lib/monthlyReceiptNo";

const mod = (await import("@/integrations/supabase/client")) as any;

describe("office income — nextUnifiedReceiptNo multi-office integration", () => {
  beforeEach(() => {
    mod.__mocks.rpcMock.mockClear();
    Object.keys(mod.__mocks.counters).forEach((k) => delete mod.__mocks.counters[k]);
  });

  it("stays sequential per office across mixed BN/EN streams (IRR + SAV office income)", async () => {
    const offices = ["office-a", "office-b", "office-c"];
    const seqs: Record<string, string[]> = {};
    // Interleave offices + streams to simulate concurrent office-income entries.
    const plan: Array<[string, "IRR" | "SAV"]> = [
      ["office-a", "IRR"], ["office-b", "SAV"], ["office-a", "SAV"],
      ["office-c", "IRR"], ["office-b", "IRR"], ["office-a", "IRR"],
      ["office-c", "SAV"], ["office-b", "SAV"],
    ];
    for (const [office, kind] of plan) {
      (seqs[office] ??= []).push(await nextUnifiedReceiptNo(office, kind));
    }
    expect(seqs["office-a"]).toEqual([
      "RCP-2026-06-0001", "RCP-2026-06-0002", "RCP-2026-06-0003",
    ]);
    expect(seqs["office-b"]).toEqual([
      "RCP-2026-06-0001", "RCP-2026-06-0002", "RCP-2026-06-0003",
    ]);
    expect(seqs["office-c"]).toEqual([
      "RCP-2026-06-0001", "RCP-2026-06-0002",
    ]);
    // No duplicates within any office.
    for (const office of offices) {
      expect(new Set(seqs[office]).size).toBe(seqs[office].length);
    }
  });

  it("language/stream do not affect the serial format", async () => {
    const a = await nextUnifiedReceiptNo("office-x", "IRR");
    const b = await nextUnifiedReceiptNo("office-x", "SAV");
    expect(a).toMatch(/^RCP-2026-06-\d{4}$/);
    expect(b).toMatch(/^RCP-2026-06-\d{4}$/);
    expect(a).not.toBe(b);
  });
});
