import { describe, it, expect } from "vitest";
import { checkManualReceiptNoLocal } from "@/lib/manualReceiptValidation";

const ctx = (nextSerial: number, maxUsed: number, used: string[] = []) => ({
  nextSerial,
  maxUsed,
  activeNos: new Set(used),
});

describe("manual receipt validation (client rules)", () => {
  it("accepts a gap number: 4754 while nextSerial=4770, maxUsed=4769", () => {
    const r = checkManualReceiptNoLocal("4754", ctx(4770, 4769));
    expect(r.status).toBe("ok_gap");
  });

  it("rejects a number ≥ nextSerial (would advance the counter)", () => {
    const r = checkManualReceiptNoLocal("4770", ctx(4770, 4769));
    expect(r.status).toBe("would_break_serial");
  });

  it("rejects a number ≥ maxUsed (would advance next_serial via max+1)", () => {
    const r = checkManualReceiptNoLocal("4769", ctx(4770, 4769));
    expect(r.status).toBe("would_break_serial");
  });

  it("rejects an already-used number", () => {
    const r = checkManualReceiptNoLocal("4754", ctx(4770, 4769, ["4754"]));
    expect(r.status).toBe("duplicate");
  });

  it("accepts non-numeric manual codes when unique", () => {
    const r = checkManualReceiptNoLocal("FLD-2026-07-14-A", ctx(4770, 4769));
    expect(r.status).toBe("ok_manual");
  });

  it("empty input is invalid", () => {
    const r = checkManualReceiptNoLocal("   ", ctx(4770, 4769));
    expect(r.status).toBe("invalid_format");
  });
});
